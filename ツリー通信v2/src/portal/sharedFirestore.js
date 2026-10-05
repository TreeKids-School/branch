import { Timestamp, doc } from './browserFirestore.js';
import { getSession, waitForSession, requestPortal } from './sessionBridge.js';

// Firestore-shaped operations travel through the authenticated parent. Only
// document data, versions and write intents cross this bridge, never credentials.
const timestampTag = '__treeTsushinBrowserTimestamp';
const dateTag = '__treeTsushinDate';
const listeners = new Set();
let scheduled = null, reading = false, rerun = false, generation = 0;

export function encodeSharedValue(value) {
  if (value instanceof Timestamp) return { [timestampTag]: true, seconds: value.seconds, nanoseconds: value.nanoseconds };
  if (value instanceof Date) return { [dateTag]: value.toISOString() };
  if (Array.isArray(value)) return value.map(encodeSharedValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, encodeSharedValue(child)]));
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol' || (typeof value === 'number' && !Number.isFinite(value))) throw new Error('保存できない値が含まれています。');
  return value;
}
export function decodeSharedValue(value) {
  if (value?.[timestampTag] === true) return new Timestamp(value.seconds, value.nanoseconds);
  if (typeof value?.[dateTag] === 'string') return new Date(value[dateTag]);
  if (Array.isArray(value)) return value.map(decodeSharedValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, decodeSharedValue(child)]));
  return value;
}
async function sessionFor(ref) {
  const session = await waitForSession();
  assertSession(session.uid, ref);
  return session;
}
function assertSession(uid, ref) {
  const session = getSession();
  if (!session || session.uid !== uid || session.storageMode !== 'shared-firestore' || !['staff', 'admin'].includes(session.role) || (ref?.uid && ref.uid !== uid)) throw new Error('共有保存のログインが変わりました。予約V2から開き直してください。');
}
function documentRef(ref) {
  if (ref?.type !== 'document') throw new Error('文書の保存先が必要です。');
}
function checkedRow(row, path) {
  if (!row || row.path !== path || !Number.isSafeInteger(row.version) || row.version < 0 || !(row.data === null || (row.data && typeof row.data === 'object' && !Array.isArray(row.data)))) throw new Error('共有データの応答を確認できません。再読み込みしてください。');
  return row;
}
function snapshot(ref, row) {
  checkedRow(row, ref.path);
  return { id: ref.id, ref, exists: () => row.data !== null, data: () => row.data === null ? undefined : decodeSharedValue(row.data),
    get: field => row.data === null ? undefined : String(field).split('.').reduce((value, key) => value?.[key], decodeSharedValue(row.data)),
    metadata: { fromCache: false, hasPendingWrites: false } };
}
function queryRequest(ref) {
  if (!['collection', 'query'].includes(ref?.type)) throw new Error('一覧の保存先が必要です。');
  return { path: ref.path, constraints: encodeSharedValue(ref.constraints || []) };
}
function querySnapshot(ref, result) {
  if (result?.path !== ref.path || !Array.isArray(result.documents)) throw new Error('共有一覧の応答を確認できません。');
  const docs = result.documents.map(row => {
    const suffix = row.path?.slice(ref.path.length + 1);
    if (!row.path?.startsWith(ref.path + '/') || !suffix || suffix.includes('/')) throw new Error('共有一覧の保存先が正しくありません。');
    return snapshot(doc({ ...ref, type: 'collection' }, suffix), row);
  }).filter(item => item.exists());
  return { docs, size: docs.length, empty: docs.length === 0, forEach: callback => docs.forEach(callback), metadata: { fromCache: false, hasPendingWrites: false } };
}
async function readDocuments(paths, uid) {
  const result = await requestPortal('read', { documents: paths });
  assertSession(uid);
  if (!Array.isArray(result?.documents)) throw new Error('共有データの応答がありません。');
  return paths.map(path => checkedRow(result.documents.find(row => row.path === path), path));
}
export async function getDoc(ref) {
  documentRef(ref);
  const session = await sessionFor(ref);
  return snapshot(ref, (await readDocuments([ref.path], session.uid))[0]);
}
export async function getDocs(ref) {
  const request = queryRequest(ref), session = await sessionFor(ref);
  const result = await requestPortal('read', { queries: [request] });
  assertSession(session.uid, ref);
  return querySnapshot(ref, result?.queries?.[0]);
}

function refreshSoon() {
  if (reading) { rerun = true; return; }
  if (scheduled !== null) return;
  scheduled = window.setTimeout(() => { scheduled = null; void deliverSnapshots(); }, 0);
}
async function deliverSnapshots() {
  if (reading || !listeners.size) return;
  reading = true;
  const ticket = generation, active = [...listeners];
  try {
    const session = await sessionFor();
    const documents = [...new Set(active.filter(item => item.ref.type === 'document').map(item => item.ref.path))];
    const queries = [], queryKeys = new Map();
    for (const item of active) {
      assertSession(session.uid, item.ref);
      if (item.ref.type !== 'document') {
        const request = queryRequest(item.ref), key = JSON.stringify(request);
        if (!queryKeys.has(key)) { queryKeys.set(key, queries.length); queries.push(request); }
      }
    }
    const result = await requestPortal('read', { documents, queries });
    assertSession(session.uid);
    if (ticket !== generation) { rerun = true; return; }
    for (const item of active) {
      if (!listeners.has(item)) continue;
      try {
        const row = item.ref.type === 'document' ? checkedRow(result?.documents?.find(row => row.path === item.ref.path), item.ref.path)
          : result?.queries?.[queryKeys.get(JSON.stringify(queryRequest(item.ref)))];
        const value = item.ref.type === 'document' ? snapshot(item.ref, row) : querySnapshot(item.ref, row);
        const signature = JSON.stringify(row);
        item.lastError = null;
        if (signature !== item.signature) { item.signature = signature; item.next(value); }
      } catch (error) { item.error(error); }
    }
  } catch (error) {
    for (const item of active) if (listeners.has(item) && item.lastError !== error.message) { item.lastError = error.message; item.error(error); }
  } finally {
    reading = false;
    if (rerun) { rerun = false; refreshSoon(); }
  }
}
export function onSnapshot(ref, ...args) {
  const offset = typeof args[0] === 'object' && !args[0]?.next ? 1 : 0;
  const observer = args[offset];
  const next = typeof observer === 'function' ? observer : observer?.next?.bind(observer);
  const error = (typeof observer === 'object' ? observer?.error?.bind(observer) : args[offset + 1]) || (failure => console.error('共有データの更新を取得できませんでした。', failure));
  if (typeof next !== 'function') throw new Error('更新通知の受け取り先が必要です。');
  const listener = { ref, next, error, signature: null, lastError: null };
  listeners.add(listener);
  refreshSoon();
  return () => listeners.delete(listener);
}

// The callback may run again after a conflict. Its return value is delivered only
// after the server has atomically stored all report, mirror, history and index writes.
export async function runTransaction(_database, callback) {
  const session = await sessionFor();
  for (let attempt = 0; attempt < 5; attempt++) {
    assertSession(session.uid);
    const reads = new Map(), operations = [];
    let writing = false;
    const checkRef = ref => { documentRef(ref); assertSession(session.uid, ref); };
    const api = {
      async get(ref) {
        checkRef(ref);
        if (writing) throw new Error('読み込みは書き込みの前に行ってください。');
        if (!reads.has(ref.path)) reads.set(ref.path, (await readDocuments([ref.path], session.uid))[0]);
        return snapshot(ref, reads.get(ref.path));
      },
      set(ref, data, options) { checkRef(ref); writing = true; operations.push({ kind: 'set', path: ref.path, data: encodeSharedValue(data), ...(options ? { options } : {}) }); return api; },
      update(ref, data) { checkRef(ref); writing = true; operations.push({ kind: 'update', path: ref.path, data: encodeSharedValue(data) }); return api; },
      delete(ref) { checkRef(ref); writing = true; operations.push({ kind: 'delete', path: ref.path }); return api; },
    };
    const value = await callback(api);
    assertSession(session.uid);
    if (!operations.length && !reads.size) return value;
    const payload = { attemptId: crypto.randomUUID(), reads: [...reads.values()].map(row => ({ path: row.path, version: row.version })), writes: operations };
    try {
      // A transport retry reuses the same idempotency key; only a confirmed
      // optimistic conflict starts a new callback and new commit attempt.
      for (let networkAttempt = 0; ; networkAttempt++) {
        try { await requestPortal('commit', payload); break; }
        catch (error) {
          if (networkAttempt < 1 && ['unavailable', 'deadline-exceeded'].includes(error.code)) continue;
          throw error;
        }
      }
      assertSession(session.uid);
      generation++;
      refreshSoon();
      return value;
    } catch (error) {
      if (error.code !== 'aborted' || attempt === 4) throw error;
    }
  }
  throw new Error('ほかのスタッフの更新が続いています。少し待って再試行してください。');
}
export const setDoc = (ref, data, options) => runTransaction(null, transaction => { transaction.set(ref, data, options); });
export const updateDoc = (ref, data) => runTransaction(null, transaction => { transaction.update(ref, data); });
export const deleteDoc = ref => runTransaction(null, transaction => { transaction.delete(ref); });
export async function addDoc(ref, data) { const created = doc(ref); await setDoc(created, data); return created; }
export async function syncReservationDay(payload) {
  const session = await sessionFor();
  const value = await requestPortal('syncDay', payload);
  assertSession(session.uid);
  generation++;
  refreshSoon();
  return value;
}
export async function manageLineDelivery(payload) {
  const session = await sessionFor();
  const value = await requestPortal('lineDelivery', payload);
  assertSession(session.uid);
  return value;
}

window.setInterval(() => { if (document.visibilityState !== 'hidden') refreshSoon(); }, 8000);
window.addEventListener('focus', refreshSoon);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refreshSoon(); });

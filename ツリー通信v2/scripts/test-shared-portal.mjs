import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

// A synthetic parent tests the wire contract without a Firebase connection or
// user data. Server authorization and storage tests live in Reservation V2.
const events = new Map(), sent = [], records = new Map();
let hostOperation = async () => { throw new Error('Unexpected operation'); };
const parent = { postMessage(message) {
  sent.push(message);
  if (message.type !== 'tree-tsushin:rpc') return;
  queueMicrotask(async () => {
    try { deliver({ type: 'tree-tsushin:rpc-result', id: message.id, ok: true, value: await hostOperation(message.operation, message.payload) }); }
    catch (error) { deliver({ type: 'tree-tsushin:rpc-result', id: message.id, ok: false, error: { code: error.code || 'internal', message: error.message } }); }
  });
} };
if (!globalThis.crypto) Object.defineProperty(globalThis, 'crypto', { value: webcrypto });
globalThis.window = { parent, location: { origin: 'https://synthetic.invalid', reload() { throw new Error('Unexpected reload'); } },
  setTimeout, clearTimeout, setInterval: (...args) => { const timer = setInterval(...args); timer.unref(); return timer; }, clearInterval,
  addEventListener(type, listener) { if (!events.has(type)) events.set(type, []); events.get(type).push(listener); } };
globalThis.document = { visibilityState: 'visible', addEventListener() {} };
let indexedDbReads = 0;
Object.defineProperty(globalThis, 'indexedDB', { get() { indexedDbReads++; throw new Error('Shared mode touched browser storage'); } });
function deliver(data, source = parent, origin = window.location.origin) { for (const handler of events.get('message') || []) handler({ data, source, origin }); }
const { getSession } = await import('../src/portal/sessionBridge.js');
const shared = await import('../src/portal/sharedFirestore.js');
const facade = await import('../src/portal/portalFirestore.js');
const { Timestamp, doc, collection, query, where, orderBy } = facade;
deliver({ type: 'tree-tsushin:session', uid: 'synthetic-staff', role: 'staff', displayName: '合成スタッフ', storageMode: 'shared-firestore' }, {}, window.location.origin);
assert.equal(getSession(), null, 'other-window session rejected');
deliver({ type: 'tree-tsushin:session', uid: 'synthetic-staff', role: 'staff', displayName: '合成スタッフ', storageMode: 'shared-firestore' });

const path = 'reports/facility_2030-01-02', ref = doc(null, 'reports', 'facility_2030-01-02');
records.set(path, { path, data: { count: 1 }, version: 1 });
const read = payload => ({ documents: (payload.documents || []).map(path => records.get(path) || { path, data: null, version: 0 }),
  queries: (payload.queries || []).map(request => ({ path: request.path, documents: [{ path: request.path + '/synthetic', data: { name: '合成児童' }, version: 1 }] })) });
hostOperation = async (operation, payload) => { assert.equal(operation, 'read'); return read(payload); };
assert.equal((await facade.getDoc(ref)).data().count, 1);
const queryResult = await facade.getDocs(query(collection(null, 'children'), where('active', '==', true), orderBy('name')));
assert.equal(queryResult.docs[0].data().name, '合成児童');
const values = { timestamp: Timestamp.fromMillis(1234567), date: new Date('2030-01-02T00:00:00Z') };
const decoded = shared.decodeSharedValue(shared.encodeSharedValue(values));
assert.equal(decoded.timestamp.toMillis(), values.timestamp.toMillis());
assert.equal(decoded.date.toISOString(), values.date.toISOString());

let callbacks = 0, commits = 0;
hostOperation = async (operation, payload) => {
  if (operation === 'read') return read(payload);
  assert.equal(operation, 'commit');
  commits++;
  if (commits === 1) { records.set(path, { path, data: { count: 2 }, version: 2 }); throw Object.assign(new Error('synthetic conflict'), { code: 'functions/aborted' }); }
  assert.equal(payload.reads[0].version, 2);
  assert.equal(payload.writes[0].data.count, 3);
  records.set(path, { path, data: payload.writes[0].data, version: 3 });
  return { documents: [records.get(path)], changedPaths: [path] };
};
const savedValue = await facade.runTransaction(null, async transaction => {
  callbacks++;
  const current = await transaction.get(ref);
  transaction.set(ref, { count: current.data().count + 1 });
  return current.data().count + 1;
});
assert.equal(callbacks, 2); assert.equal(savedValue, 3);

const attemptIds = [];
hostOperation = async (operation, payload) => {
  if (operation === 'read') return read(payload);
  attemptIds.push(payload.attemptId);
  if (attemptIds.length === 1) throw Object.assign(new Error('synthetic uncertain reply'), { code: 'functions/unavailable' });
  return { documents: [], changedPaths: [] };
};
await facade.setDoc(ref, { count: 4 }, { merge: true });
assert.equal(attemptIds.length, 2); assert.equal(attemptIds[0], attemptIds[1]);
hostOperation = async () => { throw Object.assign(new Error('synthetic denied'), { code: 'functions/permission-denied' }); };
await assert.rejects(facade.setDoc(ref, { count: 5 }), /synthetic denied/);
assert.equal(indexedDbReads, 0);

hostOperation = async (operation, payload) => operation === 'syncDay' ? { added: 2, skipped: 1 } : read(payload);
assert.deepEqual(await shared.syncReservationDay({ facilityId: 'facility', date: '2030-01-02' }), { added: 2, skipped: 1 });
const snapshots = [];
const before = sent.length;
const unsubscribeA = facade.onSnapshot(ref, value => snapshots.push(value.data().count));
const unsubscribeB = facade.onSnapshot(doc(null, 'meta', 'tag_settings'), () => {});
await new Promise(resolve => setTimeout(resolve, 30));
const snapshotReads = sent.slice(before).filter(message => message.operation === 'read');
assert.equal(snapshotReads.length, 1);
assert.equal(snapshotReads[0].payload.documents.length, 2);
assert.deepEqual(snapshots, [3]);
unsubscribeA(); unsubscribeB();
assert.equal(sent.some(message => /token|password/i.test(JSON.stringify(message))), false);
console.log('Shared portal adapter: 7 checks passed (wire codecs, document/query reads, conflict retry, idempotent retry, no local fallback, syncDay, batched snapshots).');

import { getSession, waitForSession } from './sessionBridge.js';

// The launch workspace has no Firebase connection. Each signed-in staff member
// has a separate browser database; none of these records are shared or published.
const DATABASE_PREFIX = 'tree-tsushin-v2-browser-v1:';
const STORE = 'documents';
const databases = new Map();
const channels = new Map();
const listeners = new Set();
const operationTag = '__treeTsushinBrowserOperation';
const timestampTag = '__treeTsushinBrowserTimestamp';

function storageError(message) {
    return new Error(`この端末の作業保存に失敗しました。${message}`);
}

function assertSession(uid) {
    const session = getSession();
    if (!session || !['staff', 'admin'].includes(session.role) || (uid && session.uid !== uid)) {
        throw storageError('予約システムのスタッフログインを確認してください。');
    }
    return session;
}

async function sessionFor(reference) {
    if (!getSession()) await waitForSession();
    return assertSession(reference?.uid);
}

export class Timestamp {
    constructor(seconds, nanoseconds = 0) {
        if (!Number.isInteger(seconds) || !Number.isInteger(nanoseconds) || nanoseconds < 0 || nanoseconds >= 1e9) {
            throw new Error('日時が正しくありません。');
        }
        this.seconds = seconds;
        this.nanoseconds = nanoseconds;
    }
    static fromDate(value) { return Timestamp.fromMillis(value.getTime()); }
    static fromMillis(value) {
        if (!Number.isFinite(value)) throw new Error('日時が正しくありません。');
        const seconds = Math.floor(value / 1000);
        return new Timestamp(seconds, Math.floor((value - seconds * 1000) * 1e6));
    }
    static now() { return Timestamp.fromMillis(Date.now()); }
    toMillis() { return this.seconds * 1000 + this.nanoseconds / 1e6; }
    toDate() { return new Date(this.toMillis()); }
    isEqual(other) { return other instanceof Timestamp && this.seconds === other.seconds && this.nanoseconds === other.nanoseconds; }
}

export const serverTimestamp = () => ({ [operationTag]: 'timestamp' });
export const arrayUnion = (...values) => ({ [operationTag]: 'arrayUnion', values });
export const deleteField = () => ({ [operationTag]: 'delete' });

function encode(value) {
    if (value instanceof Timestamp) return { [timestampTag]: true, seconds: value.seconds, nanoseconds: value.nanoseconds };
    if (value instanceof Date) return new Date(value.getTime());
    if (Array.isArray(value)) return value.map(encode);
    if (value && typeof value === 'object') {
        const result = Object.create(null);
        for (const [key, child] of Object.entries(value)) result[key] = encode(child);
        return result;
    }
    if (value === undefined || typeof value === 'function' || typeof value === 'symbol') {
        throw storageError('保存できない値が含まれています。');
    }
    return value;
}

function decode(value) {
    if (value?.[timestampTag] === true) return new Timestamp(value.seconds, value.nanoseconds);
    if (value instanceof Date) return new Date(value.getTime());
    if (Array.isArray(value)) return value.map(decode);
    if (value && typeof value === 'object') {
        const result = Object.create(null);
        for (const [key, child] of Object.entries(value)) result[key] = decode(child);
        return result;
    }
    return value;
}

function clone(value) { return decode(encode(value)); }
function plainMap(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        && !(value instanceof Timestamp) && !(value instanceof Date) && !value[operationTag];
}

function equivalent(left, right) {
    if (left === right) return true;
    if (left instanceof Timestamp || right instanceof Timestamp) return left instanceof Timestamp && left.isEqual(right);
    if (left instanceof Date || right instanceof Date) return left instanceof Date && right instanceof Date && left.getTime() === right.getTime();
    if (Array.isArray(left) || Array.isArray(right)) return Array.isArray(left) && Array.isArray(right)
        && left.length === right.length && left.every((item, index) => equivalent(item, right[index]));
    if (plainMap(left) && plainMap(right)) {
        const keys = Object.keys(left);
        return keys.length === Object.keys(right).length && keys.every(key => Object.hasOwn(right, key) && equivalent(left[key], right[key]));
    }
    return false;
}

const DELETED = Symbol('deleted');
function resolvedValue(value, previous, now, mergeMaps = false) {
    if (value?.[operationTag] === 'delete') return DELETED;
    if (value?.[operationTag] === 'timestamp') return now;
    if (value?.[operationTag] === 'arrayUnion') {
        const result = Array.isArray(previous) ? clone(previous) : [];
        for (const entry of value.values) if (!result.some(item => equivalent(item, entry))) result.push(clone(entry));
        return result;
    }
    if (plainMap(value)) {
        const result = mergeMaps && plainMap(previous) ? clone(previous) : Object.create(null);
        for (const [key, child] of Object.entries(value)) {
            const resolved = resolvedValue(child, previous?.[key], now, mergeMaps);
            if (resolved === DELETED) delete result[key];
            else result[key] = resolved;
        }
        return result;
    }
    return clone(value);
}

function fieldParts(path) {
    if (typeof path !== 'string' || path.split('.').some(part => !part || ['__proto__', 'prototype', 'constructor'].includes(part))) {
        throw storageError('フィールド名が正しくありません。');
    }
    return path.split('.');
}
function fieldValue(data, path) { return fieldParts(path).reduce((value, part) => value?.[part], data); }
function applyField(target, path, value, now) {
    const parts = fieldParts(path);
    let cursor = target;
    for (const part of parts.slice(0, -1)) {
        if (!plainMap(cursor[part])) cursor[part] = Object.create(null);
        cursor = cursor[part];
    }
    const key = parts.at(-1);
    const resolved = resolvedValue(value, cursor[key], now);
    if (resolved === DELETED) delete cursor[key];
    else cursor[key] = resolved;
}

function reference(type, parent, parts) {
    let path = [...(parent?.__browserReference ? [parent.path] : []), ...parts];
    if (type === 'document' && parent?.type === 'collection' && parts.length === 0) path.push(crypto.randomUUID());
    if (path.some(part => typeof part !== 'string' || !part)) throw new Error('保存先の指定が正しくありません。');
    path = path.join('/').split('/');
    if (path.some(part => !part || part === '.' || part === '..') || path.length % 2 !== (type === 'document' ? 0 : 1)) {
        throw new Error('保存先の階層が正しくありません。');
    }
    return Object.freeze({ __browserReference: true, type, path: path.join('/'), id: path.at(-1), uid: parent?.uid || getSession()?.uid || null });
}
export const doc = (parent, ...parts) => reference('document', parent, parts);
export const collection = (parent, ...parts) => reference('collection', parent, parts);
export function where(field, operator, value) {
    fieldParts(field);
    if (operator !== '==') throw new Error('この起動確認版で未対応の検索条件です。');
    return { type: 'where', field, operator, value };
}
export function orderBy(field, direction = 'asc') {
    fieldParts(field);
    if (!['asc', 'desc'].includes(direction)) throw new Error('並び順が正しくありません。');
    return { type: 'orderBy', field, direction };
}
export function query(base, ...constraints) {
    if (!['collection', 'query'].includes(base?.type) || constraints.some(item => !['where', 'orderBy'].includes(item?.type))) {
        throw new Error('この起動確認版で未対応の検索です。');
    }
    return { ...base, type: 'query', constraints: [...(base.constraints || []), ...constraints] };
}

function requestResult(request) {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || storageError('ブラウザの保存領域を読み書きできません。'));
    });
}
function completed(transaction) {
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onabort = () => reject(transaction.error || storageError('保存処理が中断されました。'));
        transaction.onerror = () => reject(transaction.error || storageError('ブラウザの保存領域を読み書きできません。'));
    });
}
function openDatabase(uid) {
    if (!globalThis.indexedDB) return Promise.reject(storageError('このブラウザは端末保存に対応していません。'));
    if (!databases.has(uid)) {
        databases.set(uid, new Promise((resolve, reject) => {
            const request = indexedDB.open(DATABASE_PREFIX + encodeURIComponent(uid), 1);
            let failed = false;
            request.onupgradeneeded = () => { request.result.createObjectStore(STORE, { keyPath: 'path' }); };
            request.onsuccess = () => {
                if (failed) { request.result.close(); return; }
                const database = request.result;
                database.onversionchange = () => { database.close(); databases.delete(uid); };
                resolve(database);
            };
            request.onerror = () => { failed = true; databases.delete(uid); reject(request.error || storageError('端末保存を利用できません。')); };
            request.onblocked = () => { failed = true; databases.delete(uid); reject(storageError('別のタブを閉じてから開き直してください。')); };
        }));
    }
    return databases.get(uid);
}

function snapshot(ref, stored) {
    return {
        id: ref.id, ref, exists: () => stored !== undefined,
        data: () => stored === undefined ? undefined : decode(stored.data),
        get: field => stored === undefined ? undefined : fieldValue(decode(stored.data), field),
        metadata: { fromCache: true, hasPendingWrites: false },
    };
}
async function readWithSession(ref, read) {
    const session = await sessionFor(ref);
    const database = await openDatabase(session.uid);
    assertSession(session.uid);
    const transaction = database.transaction(STORE, 'readonly');
    const done = completed(transaction);
    try {
        const result = await read(transaction.objectStore(STORE), session.uid);
        await done;
        assertSession(session.uid);
        return result;
    } catch (error) { await done.catch(() => {}); throw error; }
}
export async function getDoc(ref) {
    if (ref?.type !== 'document') throw new Error('文書の保存先が必要です。');
    return readWithSession(ref, async store => snapshot(ref, await requestResult(store.get(ref.path))));
}
function comparable(value) { return value instanceof Timestamp ? value.toMillis() : value instanceof Date ? value.getTime() : value; }
export async function getDocs(ref) {
    if (!['collection', 'query'].includes(ref?.type)) throw new Error('一覧の保存先が必要です。');
    return readWithSession(ref, async store => {
        const all = await requestResult(store.getAll());
        const prefix = ref.path + '/';
        let rows = all.filter(row => row.path.startsWith(prefix) && !row.path.slice(prefix.length).includes('/'));
        for (const condition of ref.constraints || []) {
            if (condition.type === 'where') rows = rows.filter(row => equivalent(fieldValue(decode(row.data), condition.field), condition.value));
            if (condition.type === 'orderBy') rows = rows.filter(row => fieldValue(decode(row.data), condition.field) !== undefined);
        }
        const ordering = (ref.constraints || []).filter(condition => condition.type === 'orderBy');
        rows.sort((a, b) => {
            for (const condition of ordering) {
                const left = comparable(fieldValue(decode(a.data), condition.field));
                const right = comparable(fieldValue(decode(b.data), condition.field));
                const comparison = left < right ? -1 : left > right ? 1 : 0;
                if (comparison) return condition.direction === 'desc' ? -comparison : comparison;
            }
            return a.path.localeCompare(b.path);
        });
        const docs = rows.map(row => snapshot(doc({ ...ref, type: 'collection' }, row.path.slice(prefix.length)), row));
        return { docs, size: docs.length, empty: docs.length === 0, forEach: callback => docs.forEach(callback), metadata: { fromCache: true, hasPendingWrites: false } };
    });
}

function refresh(uid, paths) {
    for (const listener of listeners) {
        if (listener.uid === uid && (paths === null || paths.some(path => path === listener.ref.path || path.startsWith(listener.ref.path + '/')))) listener.deliver();
    }
}
function channelFor(uid) {
    if (!globalThis.BroadcastChannel) return null;
    if (!channels.has(uid)) {
        const channel = new BroadcastChannel(DATABASE_PREFIX + encodeURIComponent(uid));
        channel.onmessage = event => {
            if (event.data?.type === 'changed' && Array.isArray(event.data.paths)) refresh(uid, event.data.paths);
        };
        channels.set(uid, channel);
    }
    return channels.get(uid);
}
function announce(uid, paths) {
    refresh(uid, paths);
    try { channelFor(uid)?.postMessage({ type: 'changed', paths }); } catch (error) { console.warn('端末内の別タブへの更新通知に失敗しました。', error); }
}

async function applyWrite(store, operation, now) {
    const { ref, kind, data, options } = operation;
    if (ref?.type !== 'document') throw new Error('文書の保存先が必要です。');
    if (kind === 'delete') { await requestResult(store.delete(ref.path)); return; }
    if (!plainMap(data)) throw storageError('文書の内容が正しくありません。');
    const record = await requestResult(store.get(ref.path));
    const previous = record ? decode(record.data) : Object.create(null);
    if (kind === 'update' && !record) throw storageError('更新する文書がありません。');
    let next;
    if (kind === 'update') {
        next = clone(previous);
        for (const [field, value] of Object.entries(data)) applyField(next, field, value, now);
    } else if (options?.mergeFields) {
        if (!Array.isArray(options.mergeFields)) throw storageError('保存する項目の指定が正しくありません。');
        next = clone(previous);
        for (const field of options.mergeFields) {
            const value = fieldValue(data, field);
            if (value === undefined) throw storageError(`保存する項目「${field}」がありません。`);
            applyField(next, field, value, now);
        }
    } else next = resolvedValue(data, previous, now, options?.merge === true);
    await requestResult(store.put({ path: ref.path, data: encode(next) }));
}

export async function runTransaction(_database, callback) {
    const session = await sessionFor();
    const database = await openDatabase(session.uid);
    assertSession(session.uid);
    const transaction = database.transaction(STORE, 'readwrite');
    const done = completed(transaction);
    // Attach an immediate rejection handler: a request can fail before the
    // callback has finished and reached the final await of the transaction.
    void done.catch(() => {});
    const store = transaction.objectStore(STORE);
    const operations = [];
    let writing = false;
    const checkReference = ref => {
        assertSession(session.uid);
        if (ref?.type !== 'document' || (ref.uid && ref.uid !== session.uid)) throw storageError('別のアカウントの文書は扱えません。');
    };
    const api = {
        async get(ref) {
            checkReference(ref);
            if (writing) throw new Error('読み込みは書き込みの前に行ってください。');
            return snapshot(ref, await requestResult(store.get(ref.path)));
        },
        set(ref, data, options) { checkReference(ref); writing = true; operations.push({ ref, data, options, kind: 'set' }); return api; },
        update(ref, data) { checkReference(ref); writing = true; operations.push({ ref, data, kind: 'update' }); return api; },
        delete(ref) { checkReference(ref); writing = true; operations.push({ ref, kind: 'delete' }); return api; },
    };
    try {
        const result = await callback(api);
        assertSession(session.uid);
        const now = Timestamp.now();
        for (const operation of operations) {
            assertSession(session.uid);
            await applyWrite(store, operation, now);
        }
        await done;
        assertSession(session.uid);
        if (operations.length) announce(session.uid, [...new Set(operations.map(item => item.ref.path))]);
        return result;
    } catch (error) {
        try { transaction.abort(); } catch { /* It may already have aborted. */ }
        await done.catch(() => {});
        throw error;
    }
}
export const setDoc = (ref, data, options) => runTransaction(null, transaction => { transaction.set(ref, data, options); });
export const updateDoc = (ref, data) => runTransaction(null, transaction => { transaction.update(ref, data); });
export const deleteDoc = ref => runTransaction(null, transaction => { transaction.delete(ref); });
export async function addDoc(ref, data) {
    const created = doc(ref);
    await setDoc(created, data);
    return created;
}

export function onSnapshot(ref, ...args) {
    const optionsOffset = typeof args[0] === 'object' && !args[0]?.next ? 1 : 0;
    const observer = args[optionsOffset];
    const next = typeof observer === 'function' ? observer : observer?.next?.bind(observer);
    const error = (typeof observer === 'object' ? observer?.error?.bind(observer) : args[optionsOffset + 1])
        || (failure => console.error('端末保存の更新を読み込めませんでした。', failure));
    if (typeof next !== 'function') throw new Error('更新通知の受け取り先が必要です。');
    let active = true;
    let delivery = 0;
    const listener = {
        ref, uid: ref.uid || getSession()?.uid || null,
        async deliver() {
            const ticket = ++delivery;
            try {
                const session = await sessionFor(ref);
                if (!active) return;
                listener.uid = session.uid;
                channelFor(session.uid);
                const result = ref.type === 'document' ? await getDoc(ref) : await getDocs(ref);
                if (active && ticket === delivery) { assertSession(session.uid); next(result); }
            } catch (failure) {
                if (active && ticket === delivery) { active = false; listeners.delete(listener); error(failure); }
            }
        },
    };
    listeners.add(listener);
    void listener.deliver();
    return () => { active = false; delivery++; listeners.delete(listener); };
}

// Returning to a tab also refreshes snapshots, including browsers without
// BroadcastChannel. No document contents travel through the notification channel.
if (typeof window !== 'undefined') {
    const refreshCurrent = () => { const session = getSession(); if (session) refresh(session.uid, null); };
    window.addEventListener('focus', refreshCurrent);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refreshCurrent(); });
}

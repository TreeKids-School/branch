let session = null;
const listeners = new Set();
const waiting = new Set();
const requests = new Map();
export function getSession() { return session; }
export function waitForSession() {
  return session ? Promise.resolve(session) : new Promise(resolve => waiting.add(resolve));
}
export function subscribeSession(listener) {
  listeners.add(listener);
  if (session) queueMicrotask(() => listener(session));
  return () => listeners.delete(listener);
}
export function sendToPortal(message) {
  if (window.parent !== window) window.parent.postMessage(message, window.location.origin);
}
export async function requestPortal(operation, payload) {
  const active = await waitForSession();
  if (active.storageMode !== 'shared-firestore') throw new Error('共有保存の接続がありません。予約V2から開き直してください。');
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      requests.delete(id);
      const error = new Error('共有サーバーから応答がありません。入力を残したまま再試行してください。');
      error.code = 'deadline-exceeded';
      reject(error);
    }, 75000);
    requests.set(id, { uid: active.uid, resolve, reject, timeout });
    sendToPortal({ type: 'tree-tsushin:rpc', id, operation, payload });
  });
}
window.addEventListener('message', event => {
  if (window.parent === window || event.source !== window.parent || event.origin !== window.location.origin) return;
  const data = event.data;
  if (data?.type === 'tree-tsushin:rpc-result') {
    const pending = requests.get(data.id);
    if (!pending || pending.uid !== session?.uid) return;
    requests.delete(data.id);
    window.clearTimeout(pending.timeout);
    if (data.ok === true) pending.resolve(data.value);
    else {
      const error = new Error(typeof data.error?.message === 'string' ? data.error.message : '共有データを読み書きできませんでした。');
      error.code = typeof data.error?.code === 'string' ? data.error.code.replace(/^functions\//, '') : 'unknown';
      pending.reject(error);
    }
    return;
  }
  if (data?.type !== 'tree-tsushin:session' || !['admin', 'staff'].includes(data.role) || typeof data.uid !== 'string' || !data.uid || data.uid.length > 128) return;
  // A frame belongs to one authenticated user for its lifetime.
  if (session && session.uid !== data.uid) { window.location.reload(); return; }
  const storageMode = data.storageMode === 'browser-preview' ? 'browser-preview' : 'shared-firestore';
  if (session && session.storageMode !== storageMode) { window.location.reload(); return; }
  session = Object.freeze({uid: data.uid, role: data.role, storageMode, displayName: typeof data.displayName === 'string' ? data.displayName : 'スタッフ'});
  for (const resolve of waiting) resolve(session);
  waiting.clear();
  for (const listener of listeners) listener(session);
});
// Repeat briefly so React StrictMode's first mount/cleanup cannot lose READY.
sendToPortal({type: 'tree-tsushin:ready'});
let attempts = 0;
const timer = window.setInterval(() => {
  if (session || ++attempts > 30) { window.clearInterval(timer); return; }
  sendToPortal({type: 'tree-tsushin:ready'});
}, 500);

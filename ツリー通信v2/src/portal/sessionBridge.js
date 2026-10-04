let session = null;
const listeners = new Set();
const waiting = new Set();
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
window.addEventListener('message', event => {
  if (window.parent === window || event.source !== window.parent || event.origin !== window.location.origin) return;
  const data = event.data;
  if (data?.type !== 'tree-tsushin:session' || !['admin', 'staff'].includes(data.role) || typeof data.uid !== 'string' || !data.uid || data.uid.length > 128) return;
  // A frame belongs to one authenticated user for its lifetime.
  if (session && session.uid !== data.uid) { window.location.reload(); return; }
  session = Object.freeze({uid: data.uid, role: data.role, displayName: typeof data.displayName === 'string' ? data.displayName : 'スタッフ'});
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

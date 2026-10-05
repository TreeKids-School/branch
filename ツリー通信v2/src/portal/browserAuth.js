import { getSession, subscribeSession, sendToPortal } from './sessionBridge';
export function onAuthStateChanged(_auth, listener) {
  return subscribeSession(session => listener({uid: session.uid, email: null, displayName: session.displayName, role: session.role}));
}
export async function signOut() {
  if (getSession()) sendToPortal({type: 'tree-tsushin:exit'});
}
export async function signInAnonymously() { throw new Error('予約システムのスタッフメニューから開いてください。'); }

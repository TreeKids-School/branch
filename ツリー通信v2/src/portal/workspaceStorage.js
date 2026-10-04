import { getSession } from './sessionBridge';
function key(name) {
  const session = getSession();
  if (!session) throw new Error('スタッフのログインを確認しています。');
  return `tree-tsushin-portal:${session.uid}:${name}`;
}
export const workspaceStorage = {
  getItem(name) { return window.localStorage.getItem(key(name)); },
  setItem(name, value) { window.localStorage.setItem(key(name), value); },
  removeItem(name) { window.localStorage.removeItem(key(name)); },
};

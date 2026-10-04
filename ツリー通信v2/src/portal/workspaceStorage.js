import { getSession } from './sessionBridge.js';
function key(name) {
  const session = getSession();
  if (!session || !['staff', 'admin'].includes(session.role)) throw new Error('スタッフのログインを確認しています。');
  return `tree-tsushin-portal:${session.uid}:${name}`;
}
function access(operation, name, value) {
  const storageKey = key(name);
  try { return window.localStorage[operation](storageKey, ...(operation === 'setItem' ? [value] : [])); }
  catch (cause) {
    const message = operation === 'getItem' ? 'この端末の下書き・設定を読み込めません。ブラウザーの保存設定を確認してください。'
      : 'この端末の下書き・設定を保存できません。保存領域の空き容量とブラウザーの設定を確認してください。';
    throw new Error(message, { cause });
  }
}
export const workspaceStorage = {
  getItem(name) { return access('getItem', name); },
  setItem(name, value) { return access('setItem', name, value); },
  removeItem(name) { return access('removeItem', name); },
};

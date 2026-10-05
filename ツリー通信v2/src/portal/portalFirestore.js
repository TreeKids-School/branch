// Shared storage is the default. Preview storage is available only when the
// authenticated host explicitly selects it; a server failure never changes it.
import * as browser from './browserFirestore.js';
import * as shared from './sharedFirestore.js';
import { waitForSession } from './sessionBridge.js';
export { Timestamp, doc, collection, query, where, orderBy, serverTimestamp, arrayUnion, deleteField } from './browserFirestore.js';
const use = async (name, args) => {
  const session = await waitForSession();
  return (session.storageMode === 'browser-preview' ? browser : shared)[name](...args);
};
export const getDoc = (...args) => use('getDoc', args);
export const getDocs = (...args) => use('getDocs', args);
export const setDoc = (...args) => use('setDoc', args);
export const updateDoc = (...args) => use('updateDoc', args);
export const deleteDoc = (...args) => use('deleteDoc', args);
export const addDoc = (...args) => use('addDoc', args);
export const runTransaction = (...args) => use('runTransaction', args);
export function onSnapshot(...args) {
  let cancelled = false, unsubscribe;
  void waitForSession().then(session => {
    if (!cancelled) unsubscribe = (session.storageMode === 'browser-preview' ? browser : shared).onSnapshot(...args);
  });
  return () => { cancelled = true; unsubscribe?.(); };
}

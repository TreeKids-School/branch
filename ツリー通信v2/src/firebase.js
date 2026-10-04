import { initializeApp } from 'firebase/app';
import { initializeFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { initializeAuth, connectAuthEmulator, inMemoryPersistence } from 'firebase/auth';

// This copy cannot connect to a live Firebase project, even with .env overrides.
if (!['127.0.0.1', 'localhost', '[::1]'].includes(window.location.hostname)) {
  throw new Error('ツリー通信v2はローカル開発専用です。既存の公開サイトには接続できません。');
}
const app = initializeApp({
  apiKey: 'local-emulator-only',
  projectId: 'demo-tree-tsushin-v2',
  appId: 'tree-tsushin-v2-local',
}, 'tree-tsushin-v2');
export const auth = initializeAuth(app, {persistence: inMemoryPersistence});
connectAuthEmulator(auth, 'http://127.0.0.1:9199', {disableWarnings: true});
export const firestore = initializeFirestore(app, {experimentalForceLongPolling: true});
connectFirestoreEmulator(firestore, '127.0.0.1', 8183);
export default app;

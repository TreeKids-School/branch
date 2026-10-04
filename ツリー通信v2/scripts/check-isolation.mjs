import { readFileSync, existsSync, readdirSync, realpathSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
if (realpathSync(process.cwd()) !== root) throw new Error('ツリー通信v2フォルダから実行してください。');
const read = path => readFileSync(resolve(root, path), 'utf8');
const config = JSON.parse(read('app.config.json'));
if (config.firebaseProject !== 'demo-tree-tsushin-v2' || config.liveConnectionEnabled !== false || config.deploymentEnabled !== false) throw new Error('ローカル開発の接続制限が変更されています。');
for (const name of ['firebase.json', '.firebaserc', 'users.json']) if (existsSync(resolve(root, name))) throw new Error(`既存環境用の設定を置かないでください: ${name}`);
function walk(path) { return readdirSync(resolve(root, path), {withFileTypes: true}).flatMap(entry => entry.isDirectory() ? walk(`${path}/${entry.name}`) : [`${path}/${entry.name}`]); }
for (const file of walk('src').filter(path => ['.js', '.jsx'].includes(extname(path)))) {
  if (/test-octopus|octopus-5735b|tree-schedule-v2|\.firebaseapp\.com|AIza[\w-]+|PORTAL_AUTH_DATA|\/api\/gemini/.test(read(file))) throw new Error(`稼働環境への接続情報・外部連携が残っています: ${file}`);
}
const firebase = read('src/firebase.js');
for (const required of ["projectId: 'demo-tree-tsushin-v2'", 'connectAuthEmulator(', 'connectFirestoreEmulator(', 'inMemoryPersistence', "'127.0.0.1'"]) if (!firebase.includes(required)) throw new Error(`ローカル接続ガードがありません: ${required}`);
const emulators = JSON.parse(read('config/emulators.json'));
if (emulators.hosting || emulators.functions || emulators.emulators.auth.host !== '127.0.0.1' || emulators.emulators.firestore.host !== '127.0.0.1') throw new Error('エミュレーター構成がローカル専用ではありません。');
console.log('分離確認: demo-tree-tsushin-v2 / localhostのみ / 既存環境への接続なし');

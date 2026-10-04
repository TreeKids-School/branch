import { spawnSync } from 'node:child_process';
import './check-isolation.mjs';
if (process.argv.length > 2) throw new Error('追加の接続先・オプションは指定できません。');
const args = ['emulators:start', '--project', 'demo-tree-tsushin-v2', '--config', 'config/emulators.json', '--only', 'auth,firestore', '--import', '.runtime/emulator-data', '--export-on-exit', '.runtime/emulator-data'];
// Arguments are fixed literals; Windows needs cmd for the installed firebase.cmd.
const result = spawnSync(process.platform === 'win32' ? 'firebase.cmd' : 'firebase', args, {stdio: 'inherit', shell: process.platform === 'win32'});
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;

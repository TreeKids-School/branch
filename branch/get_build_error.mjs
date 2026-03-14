import { build } from 'vite';
import { writeFileSync } from 'fs';

// Capture console.error
const origError = console.error;
const origWarn = console.warn;
const logs = [];
console.error = (...args) => { logs.push('ERROR: ' + args.join(' ')); origError(...args); };
console.warn = (...args) => { logs.push('WARN: ' + args.join(' ')); origWarn(...args); };

try {
    await build({ logLevel: 'info', root: process.cwd() });
    writeFileSync('build_result.txt', 'SUCCESS', 'utf8');
    console.log('BUILD SUCCESS');
} catch (e) {
    const msg = (e?.stack || e?.message || String(e));
    logs.push('THROWN: ' + msg);
    writeFileSync('build_result.txt', logs.join('\n'), 'utf8');
    origError('BUILD FAILED');
    process.exit(1);
}

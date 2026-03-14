import { build } from 'vite';
import { writeFileSync } from 'fs';

try {
    await build({ logLevel: 'info', root: process.cwd() });
    writeFileSync('build_result.txt', 'SUCCESS', 'utf8');
} catch (e) {
    writeFileSync('build_result.txt', String(e?.stack || e?.message || e), 'utf8');
    process.exit(1);
}

import { writeFileSync } from 'fs';

// Intercept process-level errors
process.on('uncaughtException', (err) => {
    writeFileSync('build_error_detail.txt', 'UNCAUGHT: ' + err.stack, 'utf8');
    process.exit(1);
});

process.on('unhandledRejection', (reason) => {
    writeFileSync('build_error_detail.txt', 'REJECTION: ' + (reason?.stack || String(reason)), 'utf8');
    process.exit(1);
});

const { build } = await import('vite');

try {
    await build({ logLevel: 'info', root: process.cwd() });
    writeFileSync('build_error_detail.txt', 'SUCCESS', 'utf8');
    process.exit(0);
} catch (e) {
    writeFileSync('build_error_detail.txt', 'CAUGHT: ' + (e?.stack || e?.message || String(e)), 'utf8');
    process.exit(1);
}

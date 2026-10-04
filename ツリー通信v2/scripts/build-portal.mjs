import './check-isolation.mjs';
import { build } from 'vite';
import { renameSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
await build({configFile: 'vite.portal.config.js'});
renameSync('dist-portal/portal.html', 'dist-portal/index.html');
const commit = execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim();
const dirty = Boolean(execFileSync('git', ['status', '--porcelain', '--', '.'], {encoding: 'utf8'}).trim());
writeFileSync('dist-portal/portal-release.json', JSON.stringify({system: 'ツリー通信v2', mode: 'browser-preview', sourceCommit: commit, sourceDirty: dirty, builtAt: new Date().toISOString(), migrated: false, sharedStorage: false}, null, 2) + '\n');

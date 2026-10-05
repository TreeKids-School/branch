// Disposable local-browser checks with a synthetic RPC host; no cloud/user data.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { dirname, resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..'), dist = resolve(root, 'dist-portal');
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  response.setHeader('Cache-Control', 'no-store');
  if (url.pathname === '/') { response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}iframe{border:0;width:100%;height:100dvh}</style>'); return; }
  const path = resolve(dist, decodeURIComponent(url.pathname.replace(/^\/tree-communication-v2\//, '')));
  if (!path.startsWith(dist + sep)) { response.writeHead(404).end(); return; }
  try { response.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' })[extname(path)] || 'application/octet-stream'); response.end(await readFile(path)); }
  catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ headless: true, ...(process.env.TEST_BROWSER_CHANNEL ? { channel: process.env.TEST_BROWSER_CHANNEL } : {}) });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(12000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:' + server.address().port);
  await page.evaluate(() => {
    window.testRole = 'admin'; window.rpcOperations = [];
    const today = new Date(), date = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    const data = new Map(), versions = new Map();
    const put = (path, value) => { data.set(path, value); versions.set(path, (versions.get(path) || 0) + 1); };
    const row = path => ({ path, data: data.get(path) || null, version: versions.get(path) || 0 });
    const archiveId = 'a'.repeat(64);
    put('offices/facility-a', { name: '合成事業所' });
    put('children/child-a', { name: '合成児童A' }); put('children/child-b', { name: '合成児童B' });
    put('staff/synthetic-admin', { name: '合成管理者', facilityIds: ['facility-a'], post: ['スタッフ'] });
    put('reports/facility-a_' + date, { children: [{ id: 'child-a', name: '合成児童A' }], results: {}, messages: {}, dailyTable: {}, globalLog: {} });
    put('meta/migration_unresolved_index', { count: 1, items: [{ archiveId, kind: 'report', date: '2030-01-01', sourcePath: 'reports/2030-01-01', label: '照合保留の合成記録', reason: '事業所の対応未確定' }] });
    put('legacyArchive/' + archiveId, { sourceProject: 'synthetic', sourcePath: 'reports/2030-01-01', sourceUpdatedAt: '2030-01-01T09:00:00Z', kind: 'report', sourceData: { children: [{ id: 'old-child', name: '合成旧児童' }], results: { 'old-child': { D: '旧通信の原文です。', futurePlan: '次回も制作を楽しみます。' } }, messages: { 'old-child': [{ text: '粘土を丸めました。', staffName: '旧スタッフ', tag: '【学習】' }] }, otherPreserved: '全項目を保持' } });
    window.addEventListener('message', event => {
      if (event.source !== document.querySelector('iframe')?.contentWindow || event.origin !== location.origin) return;
      const message = event.data;
      if (message?.type === 'tree-tsushin:ready') event.source.postMessage({ type: 'tree-tsushin:session', uid: 'synthetic-admin', role: window.testRole, displayName: '合成管理者', storageMode: 'shared-firestore' }, location.origin);
      if (message?.type !== 'tree-tsushin:rpc') return;
      window.rpcOperations.push(message);
      let value;
      if (message.operation === 'read') value = { documents: (message.payload.documents || []).map(row), queries: (message.payload.queries || []).map(request => ({ path: request.path, documents: [...data.keys()].filter(path => path.startsWith(request.path + '/') && !path.slice(request.path.length + 1).includes('/')).map(row) })) };
      else if (message.operation === 'syncDay') { const path = 'reports/' + message.payload.facilityId + '_' + message.payload.date, existing = data.get(path); put(path, { ...existing, children: [...existing.children, { id: 'child-b', name: '合成児童B' }] }); value = { added: 1, skipped: 1 }; }
      else throw new Error('Unexpected write in readonly UI checks');
      event.source.postMessage({ type: 'tree-tsushin:rpc-result', id: message.id, ok: true, value }, location.origin);
    });
    const frame = document.createElement('iframe'); frame.src = '/tree-communication-v2/index.html'; frame.sandbox = 'allow-scripts allow-same-origin allow-forms allow-modals allow-downloads allow-popups'; document.body.append(frame);
  });
  let frame = page.frameLocator('iframe');
  await frame.getByRole('heading', { name: '合成児童A', exact: true }).waitFor();
  await frame.getByRole('button', { name: '予約名簿を取り込む', exact: true }).click();
  await frame.getByRole('heading', { name: '合成児童B', exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.rpcOperations.filter(item => item.operation === 'syncDay').length), 1);
  await frame.getByRole('navigation', { name: 'ツリー通信のメニュー' }).getByRole('button', { name: '業務・設定', exact: true }).click();
  await frame.getByRole('button', { name: /移行した旧データ・照合保留/ }).click();
  await frame.getByRole('button', { name: /照合保留の合成記録/ }).click();
  await frame.getByText('旧通信の原文です。', { exact: true }).waitFor();
  await frame.getByText('次回も制作を楽しみます。', { exact: true }).waitFor();
  await frame.getByText('粘土を丸めました。', { exact: true }).waitFor();
  assert.equal(await frame.locator('.legacy-archive input:not([type="date"])').count(), 1, 'only a metadata filter, no editable source fields');
  assert.equal(await page.evaluate(() => window.rpcOperations.filter(item => item.operation === 'commit').length), 0);
  await mkdir(resolve(root, 'output/shared-verification'), { recursive: true });
  await page.screenshot({ path: resolve(root, 'output/shared-verification/archive-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  const rawFrame = page.frames().find(value => value.url().includes('/tree-communication-v2/'));
  assert.equal(await rawFrame.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'mobile has no horizontal overflow');
  await frame.getByRole('button', { name: '一覧に戻る', exact: true }).click();
  await frame.getByLabel('データ種別', { exact: true }).selectOption('report');
  await frame.getByRole('button', { name: /照合保留の合成記録/ }).click();
  await frame.getByText('旧通信の原文です。', { exact: true }).waitFor();
  await page.screenshot({ path: resolve(root, 'output/shared-verification/archive-mobile.png') });
  await frame.getByRole('button', { name: '旧データの確認を閉じる', exact: true }).click();
  await page.evaluate(() => { window.testRole = 'staff'; document.querySelector('iframe').src = '/tree-communication-v2/index.html?staff=1'; });
  frame = page.frameLocator('iframe');
  await frame.getByRole('navigation', { name: 'ツリー通信のメニュー' }).getByRole('button', { name: '業務・設定', exact: true }).click();
  assert.equal(await frame.getByRole('button', { name: /移行した旧データ・照合保留/ }).count(), 0);
  assert.deepEqual(errors, []);
  console.log('Shared portal UI: roster import reflects in list; archive desktop/mobile read-only source display and staff exclusion passed.');
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }

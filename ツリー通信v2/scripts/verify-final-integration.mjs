// Runs only against a disposable browser profile and a local build. It never
// authenticates to Firebase, reads V1, or touches the user's browser database.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, sep, extname } from 'node:path';
import { createRequire } from 'node:module';
import { parseCSV } from '../src/utils/csv.js';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist-portal');
const uid = 'ui-verification-disposable';
const dbName = 'tree-tsushin-v2-browser-v1:' + uid;
const server = createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    response.setHeader('Cache-Control', 'no-store');
    if (url.pathname === '/') {
        response.setHeader('Content-Type', 'text/html; charset=utf-8');
        response.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}header{height:52px;background:white;border-top:3px solid #236649;padding:8px 16px;box-sizing:border-box;font:14px sans-serif}iframe{border:0;width:100%;height:calc(100dvh - 52px)}</style></head><body><header>Tree Kids Schedule ／ ツリー通信v2</header><script>window.portalStates=[];window.addEventListener("message",event=>{if(event.data?.type==="tree-tsushin:ready")event.source.postMessage({type:"tree-tsushin:session",storageMode:"browser-preview",uid:"' + uid + '",role:"staff",displayName:"検証スタッフA"},location.origin);if(event.data?.type==="tree-tsushin:state")window.portalStates.push(event.data)})</script></body></html>');
        return;
    }
    if (!url.pathname.startsWith('/tree-communication-v2/')) { response.writeHead(404).end(); return; }
    const name = decodeURIComponent(url.pathname.slice('/tree-communication-v2/'.length)) || 'index.html';
    const path = resolve(dist, name);
    if (!path.startsWith(dist + sep)) { response.writeHead(404).end(); return; }
    try {
        response.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.json': 'application/json' })[extname(path)] || 'application/octet-stream');
        response.end(await readFile(path));
    } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser, currentPage;
try {
    browser = await chromium.launch({ headless: true, ...(process.env.TEST_BROWSER_CHANNEL ? { channel: process.env.TEST_BROWSER_CHANNEL } : {}) });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await context.newPage();
    currentPage = page;
    page.setDefaultTimeout(12000);
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('dialog', dialog => dialog.accept());
    await page.goto('http://127.0.0.1:' + server.address().port);
    const date = await page.evaluate(async ({ dbName }) => {
        const today = new Date(); const date = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0');
        const request = indexedDB.open(dbName, 1);
        request.onupgradeneeded = () => request.result.createObjectStore('documents', { keyPath: 'path' });
        const db = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
        const tx = db.transaction('documents', 'readwrite'); const store = tx.objectStore('documents');
        const put = (path, data) => store.put({ path, data });
        put('offices/office-a', { name: '検証Home' });
        put('offices/office-b', { name: '検証Search' });
        put('staff/ui-verification-disposable', { name: '検証スタッフA', officeId: 'office-a', post: ['児童指導員・保育士'] });
        put('staff/staff-b', { name: '検証スタッフB', officeId: 'office-a', post: ['スタッフ'] });
        put('children/child-a', { name: '検証児童A', yomi: 'ケンショウジドウエー' });
        put('children/child-b', { name: '検証児童B', yomi: 'ケンショウジドウビー', defaultPickupLocation: '既定の学校' });
        put('reports/office-a_' + date, {
            children: [{ id: 'child-a', name: '検証児童A', isAbsent: false, isWaitlist: false }, { id: 'child-b', name: '検証児童B', isAbsent: false, isWaitlist: false }],
            messages: { 'child-a': [{ id: 'old-memo', text: '既存の備考', tag: '【備考】', timestamp: new Date().toISOString(), staffName: '検証スタッフA' }] },
            results: { 'child-a': { D: '保存済み通信', futurePlan: '次回の活動', B_result: '支援記録は維持' } },
            dailyTable: { 'child-a': { transportTime: '15:00', endTime: '16:00', pickupLocation: '教室' }, 'child-b': { notes: 'CSVからの備考を保持' } },
            globalLog: { notice: '事前の周知', activities: '既存の共有', programs: [{ title: '制作', summary: '色を選んで制作します', staff: '検証スタッフA' }] }, summaryC: '',
        });
        put('attendance/office-a_' + date, { 'ui-verification-disposable': { name: '検証スタッフA', type: 'work', startTime: '09:30', endTime: '18:30', role: '児童指導員・保育士' }, 'staff-b': { name: '検証スタッフB', type: 'paid_leave', startTime: '09:30', endTime: '18:30' } });
        put('meta/reports_index_office-a', { dates: [date] });
        await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); }); db.close(); return date;
    }, { dbName });
    const read = path => page.evaluate(async ({ dbName, path }) => {
        const request = indexedDB.open(dbName, 1);
        const db = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
        const get = db.transaction('documents').objectStore('documents').get(path);
        const value = await new Promise((resolve, reject) => { get.onsuccess = () => resolve(get.result?.data); get.onerror = () => reject(get.error); }); db.close(); return value;
    }, { dbName, path });
    await page.evaluate(() => { const frame = document.createElement('iframe'); frame.src='/tree-communication-v2/'; frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-forms allow-modals allow-downloads allow-popups'); frame.setAttribute('allow','clipboard-write'); document.body.append(frame); });
    const frame = page.frameLocator('iframe');
    await frame.getByRole('heading', { name: '検証児童A', exact: true }).waitFor();
    await mkdir(resolve(root, 'output/ui-verification'), { recursive: true });
    await page.screenshot({ path: resolve(root, 'output/ui-verification/desktop-workspace.png'), fullPage: true });
    const child = () => frame.locator('.cw-child').filter({ has: frame.getByRole('heading', { name: '検証児童A', exact: true }) });
    const reportPath = 'reports/office-a_' + date;
    const mirrorPath = 'children/child-a/app_categories/書類管理/tree_communications/office-a_' + date;
    await page.setViewportSize({ width: 390, height: 844 });
    await child().getByRole('button', { name: '通信を整える', exact: true }).click();
    const actualFrame = page.frames().find(item => item.url().includes('/tree-communication-v2/'));
    await frame.getByLabel('通信本文', { exact: true }).waitFor();
    await actualFrame.evaluate(() => {
        window.__nativePut = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = () => { throw new DOMException('Verification quota failure', 'QuotaExceededError'); };
    });
    await frame.getByLabel('通信本文', { exact: true }).fill('再試行して保存した通信本文');
    await frame.getByRole('button', { name: '保存して閉じる', exact: true }).click();
    await frame.locator('.comm-error').waitFor();
    assert.equal(await frame.getByLabel('通信本文', { exact: true }).inputValue(), '再試行して保存した通信本文');
    assert.equal((await read(reportPath)).results['child-a'].D, '保存済み通信');
    await actualFrame.evaluate(() => { IDBObjectStore.prototype.put = window.__nativePut; delete window.__nativePut; });
    await frame.getByRole('button', { name: 'もう一度保存', exact: true }).click();
    await frame.getByRole('button', { name: '保存して閉じる', exact: true }).click();
    await frame.locator('.communication-editor').waitFor({ state: 'detached' });
    assert.equal((await read(reportPath)).results['child-a'].D, '再試行して保存した通信本文');
    assert.equal((await read(mirrorPath)).tree_comm_text, '再試行して保存した通信本文');
    assert.match((await read(mirrorPath)).notes, /既存の備考/);
    console.log('PASS final build: failed editor write keeps input/report; retry updates report and office mirror');
    await child().getByRole('button', { name: '通信を整える', exact: true }).click();
    await frame.getByRole('button', { name: '今後の予定', exact: true }).click();
    await frame.getByLabel('予定・次回への見通し', { exact: true }).waitFor();
    assert.equal(await frame.locator('.cw-toast').count(), 0, 'global notification must not cover the editor identity');
    await page.screenshot({ path: resolve(root, 'output/ui-verification/mobile-future-plan.png'), fullPage: true });
    await frame.getByRole('button', { name: '保存して閉じる', exact: true }).click();
    await frame.locator('.communication-editor').waitFor({ state: 'detached' });

    await frame.getByRole('navigation', { name: 'ツリー通信のメニュー' }).getByRole('button', { name: '業務・設定', exact: true }).click();
    await frame.locator('.cw-tools').getByRole('button', { name: /入力設定/ }).click();
    await frame.getByRole('button', { name: 'OKワード', exact: true }).click();
    await frame.getByLabel('追加するOKワード', { exact: true }).fill('検証ワード');
    await frame.getByRole('button', { name: '追加', exact: true }).click();
    await frame.getByRole('button', { name: 'タグ・挿入文', exact: true }).click();
    const remarkTag = frame.locator('.settings-tag').filter({ has: frame.locator('input[value="【備考】"]') });
    await remarkTag.getByLabel(/業務表の表示列/).selectOption('learning');
    await actualFrame.evaluate(() => {
        window.__nativePut = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = function (record, ...args) {
            if (record.path === 'meta/ok_words') throw new DOMException('Verification settings failure', 'QuotaExceededError');
            return window.__nativePut.call(this, record, ...args);
        };
    });
    await frame.getByRole('button', { name: 'タグ・OKワードを保存', exact: true }).click();
    await frame.getByRole('alert').filter({ hasText: '設定を保存できませんでした' }).waitFor();
    assert.equal(await read('meta/tag_settings'), undefined, 'settings transaction partially wrote tag mapping');
    assert.equal(await read('meta/ok_words'), undefined, 'settings transaction partially wrote words');
    assert.match((await read(mirrorPath)).notes, /既存の備考/, 'mirror changed despite rejected settings save');
    assert.equal(await remarkTag.getByLabel(/業務表の表示列/).inputValue(), 'learning', 'edited mapping lost after failed save');
    await actualFrame.evaluate(() => { IDBObjectStore.prototype.put = window.__nativePut; delete window.__nativePut; });
    await frame.getByRole('button', { name: 'タグ・OKワードを保存', exact: true }).click();
    await frame.getByRole('dialog', { name: '設定・定型文' }).waitFor({ state: 'detached' });
    assert.equal((await read('meta/tag_settings')).tagColumnMap['【備考】'], 'learning');
    assert.ok((await read('meta/ok_words')).words.includes('検証ワード'));
    assert.equal((await read(mirrorPath)).notes, '', 'old derived remarks remained in mirror');
    assert.equal((await read('children/child-b/app_categories/書類管理/tree_communications/office-a_' + date)).notes, 'CSVからの備考を保持');
    console.log('PASS settings atomic failure rollback and retry: tag + OK words + recalculated mirrors; CSV notes retained');

    await frame.locator('.cw-tools').getByRole('button', { name: /^出欠・送迎/ }).click();
    await child().locator('.cw-derived').first().getByText(/既存の備考/).waitFor();
    const otherChild = frame.locator('.cw-child').filter({ has: frame.getByRole('heading', { name: '検証児童B', exact: true }) });
    await otherChild.getByText('CSVからの備考を保持', { exact: true }).waitFor();
    await page.screenshot({ path: resolve(root, 'output/ui-verification/mobile-operations.png'), fullPage: true });
    await frame.getByRole('navigation', { name: 'ツリー通信のメニュー' }).getByRole('button', { name: '業務・設定', exact: true }).click();
    await frame.locator('.cw-tools').getByRole('button', { name: /書出し・Excel・印刷/ }).click();
    const downloading = page.waitForEvent('download');
    await frame.getByRole('button', { name: 'CSVを書き出す', exact: true }).click();
    const csv = parseCSV(await readFile(await (await downloading).path(), 'utf8'));
    const a = csv.find(row => row[0] === '検証児童A'), b = csv.find(row => row[0] === '検証児童B');
    assert.match(a[csv[0].indexOf('学習')], /既存の備考/);
    assert.equal(a[csv[0].indexOf('備考')], '');
    assert.equal(a[csv[0].indexOf('ツリー通信')], '再試行して保存した通信本文');
    assert.equal(a[csv[0].indexOf('今後の予定')], '次回の活動');
    assert.equal(b[csv[0].indexOf('備考')], 'CSVからの備考を保持');
    const popupOpened = context.waitForEvent('page');
    await frame.getByRole('button', { name: '当日日誌を印刷', exact: true }).click();
    const popup = await popupOpened;
    await popup.getByText('業務管理日誌', { exact: true }).waitFor();
    const diary = await popup.locator('body').innerText();
    assert.match(diary, /事前の周知/); assert.match(diary, /既存の共有/);
    assert.match(diary, /制作/); assert.match(diary, /色を選んで制作します/);
    assert.match(diary, /CSVからの備考を保持/);
    assert.ok(await page.locator('iframe').getAttribute('sandbox').then(value => value.includes('allow-popups')));
    await popup.close();
    await frame.getByRole('button', { name: '書出しを閉じる', exact: true }).click();
    console.log('PASS sandbox allow-popups: diary popup contains notices/shared notes/program/CSV notes; newsletter + future are in downloaded CSV');

    await frame.locator('.cw-tools').getByRole('button', { name: /入力設定/ }).click();
    await frame.getByRole('button', { name: 'タグ・挿入文', exact: true }).click();
    assert.equal(await remarkTag.getByLabel(/業務表の表示列/).inputValue(), 'learning');
    await frame.getByRole('button', { name: 'OKワード', exact: true }).click();
    await frame.getByText('検証ワード', { exact: true }).waitFor();
    await frame.getByRole('button', { name: '設定を閉じる', exact: true }).click();
    await frame.getByRole('navigation', { name: 'ツリー通信のメニュー' }).getByRole('button', { name: '今日の記録', exact: true }).click();
    const notificationClose = frame.getByRole('button', { name: '通知を閉じる', exact: true });
    if (await notificationClose.count()) await notificationClose.click();
    await page.screenshot({ path: resolve(root, 'output/ui-verification/mobile-workspace.png'), fullPage: true });
    assert.equal(await actualFrame.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(pageErrors, []);
    console.log('PASS settings reopen, 390px no overflow, four updated screenshots; no uncaught browser errors');
} catch (error) {
    if (currentPage) {
        console.error('UI state on failure:', await currentPage.frames().find(item => item.url().includes('/tree-communication-v2/'))?.locator('body').innerText());
        await currentPage.screenshot({ path: resolve(root, 'output/ui-verification/final-workflow-failure.png'), fullPage: true });
    }
    throw error;
} finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
}

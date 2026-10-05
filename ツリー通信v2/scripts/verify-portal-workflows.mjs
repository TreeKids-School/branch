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
            children: [{ id: 'child-a', name: '検証児童A', isAbsent: false, isWaitlist: false }],
            messages: { 'child-a': [{ id: 'old-memo', text: '既存の備考', tag: '【備考】', timestamp: new Date().toISOString(), staffName: '検証スタッフA' }] },
            results: { 'child-a': { D: '保存済み通信', futurePlan: '次回の活動', B_result: '支援記録は維持' } },
            dailyTable: { 'child-a': { transportTime: '15:00', endTime: '16:00', pickupLocation: '教室' } },
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
    await page.evaluate(() => { const frame = document.createElement('iframe'); frame.src='/tree-communication-v2/'; document.body.append(frame); });
    const frame = page.frameLocator('iframe');
    await frame.getByRole('heading', { name: '検証児童A', exact: true }).waitFor();
    await mkdir(resolve(root, 'output/ui-verification'), { recursive: true });
    await page.screenshot({ path: resolve(root, 'output/ui-verification/desktop-workspace.png'), fullPage: true });
    const child = () => frame.locator('.cw-child').filter({ has: frame.getByRole('heading', { name: '検証児童A', exact: true }) });
    const reportPath = 'reports/office-a_' + date;
    const mirrorPath = 'children/child-a/app_categories/書類管理/tree_communications/office-a_' + date;
    let saved;
    if (!process.env.VERIFY_EXTENDED_ONLY) {
    await child().getByRole('button', { name: 'メモを書く', exact: true }).click();
    await frame.getByRole('button', { name: '【共有】', exact: true }).click();
    await frame.getByLabel('スタッフメモ', { exact: true }).fill('新しい共有メモ');
    await frame.getByRole('button', { name: 'メモを保存', exact: true }).click();
    await frame.locator('.comm-memo-card').filter({ hasText: '新しい共有メモ' }).waitFor();
    saved = await read(reportPath);
    assert.equal(saved.messages['child-a'].at(-1).text, '新しい共有メモ');
    assert.match(saved.globalLog.activities, /検証児童A.*新しい共有メモ/);
    await frame.getByRole('button', { name: 'ツリー通信', exact: true }).click();
    await frame.getByLabel('通信本文', { exact: true }).fill('今日の活動を自分で選びました。');
    await frame.getByRole('button', { name: '今後の予定', exact: true }).click();
    await frame.getByLabel('予定・次回への見通し', { exact: true }).fill('次回は作品の続きを相談します。');
    await frame.getByRole('button', { name: '保存して閉じる', exact: true }).click();
    await frame.locator('.communication-editor').waitFor({ state: 'detached' });
    saved = await read(reportPath); const mirror = await read(mirrorPath);
    assert.equal(saved.results['child-a'].futurePlan, '次回は作品の続きを相談します。');
    assert.equal(saved.results['child-a'].B_result, '支援記録は維持');
    assert.equal(mirror.tree_comm_text, saved.results['child-a'].D);
    assert.equal(mirror.future_plan, saved.results['child-a'].futurePlan);
    assert.match(mirror.notes, /既存の備考/);
    assert.ok((await read('changeLogs/office-a_' + date)).logs.some(log => log.field === 'futurePlan'));
    console.log('PASS integrated PC memo → shared daylog / newsletter + future → report, individual mirror, history');

    await frame.getByRole('button', { name: '出欠・送迎を確認', exact: true }).click();
    await child().getByRole('button', { name: '出欠・送迎を変更', exact: true }).click();
    await frame.getByLabel('送迎時刻', { exact: true }).fill('15:25');
    await frame.getByLabel('迎え場所', { exact: true }).fill('変更した学校');
    await frame.getByRole('button', { name: '変更を保存して戻る', exact: true }).click();
    await frame.getByRole('dialog', { name: '出欠・送迎を変更' }).waitFor({ state: 'detached' });
    assert.equal((await read(reportPath)).dailyTable['child-a'].transportTime, '15:25');
    assert.equal((await read(mirrorPath)).pickupLocation, '変更した学校');
    await child().getByText('15:25', { exact: true }).waitFor();
    console.log('PASS transport edit → operational display + individual mirror');

    await frame.getByRole('button', { name: '児童を追加', exact: true }).click();
    await frame.getByRole('checkbox', { name: /検証児童B/ }).click();
    await frame.getByRole('button', { name: 'キャンセル待ちとして追加', exact: true }).click();
    await frame.getByRole('dialog', { name: '児童を追加' }).waitFor({ state: 'detached' });
    saved = await read(reportPath);
    assert.equal(saved.children.find(child => child.id === 'child-b').isWaitlist, true);
    assert.equal(saved.dailyTable['child-b'].pickupLocation, '既定の学校');
    console.log('PASS child selection → waitlist and inherited pickup in daily record');

    await page.setViewportSize({ width: 390, height: 844 });
    await frame.getByRole('navigation', { name: 'ツリー通信のメニュー' }).getByRole('button', { name: '業務・設定', exact: true }).click();
    await frame.locator('.cw-tools').getByRole('button', { name: /スタッフ勤務/ }).click();
    await frame.getByLabel(/スタッフを選択/).selectOption(uid);
    await frame.getByRole('group', { name: '検証スタッフAの勤務区分' }).getByRole('button', { name: '公休', exact: true }).click();
    await frame.getByRole('button', { name: '勤務を保存', exact: true }).click();
    await frame.getByRole('dialog', { name: 'スタッフ勤務' }).waitFor({ state: 'detached' });
    const attendance = await read('attendance/office-a_' + date);
    assert.equal(attendance['ui-verification-disposable'].type, 'public_holiday');
    assert.equal(attendance['staff-b'].type, 'paid_leave');
    console.log('PASS mobile attendance → stored row + unrelated staff preservation');

    await frame.locator('.cw-tools').getByRole('button', { name: /施設日報・プログラム/ }).click();
    await frame.getByLabel(/特記事項（事前の連絡）/).fill('更新した事前連絡');
    await frame.getByLabel('プログラム名', { exact: true }).fill('続きの制作');
    await frame.getByLabel(/詳細・手順/).fill('色を選び、続きを組み立てます');
    await frame.getByRole('button', { name: '日報とプログラムを保存', exact: true }).click();
    await frame.getByRole('status').filter({ hasText: '日報とプログラムを保存しました' }).waitFor();
    saved = await read(reportPath);
    assert.equal(saved.globalLog.notice, '更新した事前連絡');
    assert.equal(saved.globalLog.programs[0].title, '続きの制作');
    assert.equal(saved.globalLog.programTitle, '続きの制作');
    assert.equal(saved.globalLog.programSummary, '色を選び、続きを組み立てます');
    assert.match(saved.globalLog.activities, /新しい共有メモ/);
    console.log('PASS mobile daylog/program edit → canonical program + compatibility export fields');
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await frame.getByRole('navigation', { name: 'ツリー通信のメニュー' }).getByRole('button', { name: '今日の記録', exact: true }).click();
    const savedBeforeFailure = (await read(reportPath)).results['child-a'].D;
    await child().getByRole('button', { name: '通信を整える', exact: true }).click();
    const actualFrame = page.frames().find(item => item.url().includes('/tree-communication-v2/'));
    await frame.getByLabel('通信本文', { exact: true }).waitFor();
    await actualFrame.evaluate(() => { window.__nativePut = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = () => { throw new DOMException('Verification quota failure', 'QuotaExceededError'); }; });
    await frame.getByLabel('通信本文', { exact: true }).fill('保存失敗でも失わない入力');
    await frame.getByRole('button', { name: '保存して閉じる', exact: true }).click();
    await frame.locator('.comm-error').waitFor();
    assert.equal(await frame.getByLabel('通信本文', { exact: true }).inputValue(), '保存失敗でも失わない入力');
    assert.equal((await read(reportPath)).results['child-a'].D, savedBeforeFailure);
    assert.equal((await read(mirrorPath))?.tree_comm_text || savedBeforeFailure, savedBeforeFailure);
    await actualFrame.evaluate(() => { IDBObjectStore.prototype.put = window.__nativePut; delete window.__nativePut; });
    await frame.getByRole('button', { name: 'もう一度保存', exact: true }).click();
    await frame.getByRole('button', { name: '保存して閉じる', exact: true }).click();
    await frame.locator('.communication-editor').waitFor({ state: 'detached' });
    assert.equal((await read(reportPath)).results['child-a'].D, '保存失敗でも失わない入力');
    assert.equal((await read(mirrorPath)).tree_comm_text, '保存失敗でも失わない入力');
    assert.equal(await actualFrame.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await page.waitForFunction(() => window.portalStates.at(-1)?.dirty === false && window.portalStates.at(-1)?.busy === false);
    assert.ok(await page.evaluate(() => window.portalStates.some(state => state.dirty || state.busy)));
    console.log('PASS mobile save failure preserves input and both saved destinations; retry + portal dirty/busy reset');

    await child().getByRole('button', { name: '通信を整える', exact: true }).click();
    await frame.getByRole('button', { name: '入力を完了', exact: true }).click();
    await frame.locator('.communication-editor').waitFor({ state: 'detached' });
    assert.equal((await read(reportPath)).results['child-a'].isCompleted, true);
    await child().getByText('入力完了', { exact: true }).waitFor();
    await frame.getByRole('navigation', { name: 'ツリー通信のメニュー' }).getByRole('button', { name: '通信を整える', exact: true }).click();
    await child().getByRole('button', { name: 'コピー', exact: true }).click();
    await frame.getByRole('status').filter({ hasText: 'コピーしました。LINEで送信後' }).waitFor();
    assert.match(await actualFrame.evaluate(() => navigator.clipboard.readText()), /保存失敗でも失わない入力/);
    assert.ok(!(await read(reportPath)).dailyTable['child-a'].sentChecked);
    await child().getByRole('button', { name: '通信を編集', exact: true }).click();
    await frame.getByRole('button', { name: '今後の予定', exact: true }).click();
    assert.equal(await frame.getByLabel('予定・次回への見通し', { exact: true }).inputValue(), (await read(reportPath)).results['child-a'].futurePlan);
    await page.screenshot({ path: resolve(root, 'output/ui-verification/mobile-future-plan.png'), fullPage: true });
    await frame.getByRole('button', { name: '完了を解除', exact: true }).click();
    await frame.locator('.communication-editor').waitFor({ state: 'detached' });
    assert.equal((await read(reportPath)).results['child-a'].isCompleted, false);
    console.log('PASS first completion → list badge → copy without sent flag → reopen future plan → completion undo');

    await child().getByRole('button', { name: '通信を編集', exact: true }).click();
    await frame.getByRole('button', { name: 'スタッフメモ', exact: true }).click();
    await frame.getByRole('button', { name: '【プログラム】', exact: true }).click();
    const programTitle = (await read(reportPath)).globalLog.programs[0].title;
    await frame.locator('.comm-program-choice').filter({ hasText: programTitle }).click();
    assert.equal(await frame.getByLabel('スタッフメモ', { exact: true }).inputValue(), (await read(reportPath)).globalLog.programs[0].summary);
    await frame.getByRole('button', { name: 'メモを保存', exact: true }).click();
    await frame.locator('.comm-memo-card').filter({ hasText: (await read(reportPath)).globalLog.programs[0].summary }).waitFor();
    await frame.getByRole('button', { name: '保存して閉じる', exact: true }).click();
    await frame.locator('.communication-editor').waitFor({ state: 'detached' });
    console.log('PASS stored daylog program → memo insert picker → saved program memo');

    await frame.getByRole('navigation', { name: 'ツリー通信のメニュー' }).getByRole('button', { name: '業務・設定', exact: true }).click();
    await frame.locator('.cw-tools').getByRole('button', { name: /入力設定/ }).click();
    await frame.getByRole('button', { name: 'タグ・挿入文', exact: true }).click();
    const remarkTag = frame.locator('.settings-tag').filter({ has: frame.locator('input[value="【備考】"]') });
    await remarkTag.getByLabel(/業務表の表示列/).selectOption('learning');
    await frame.getByRole('button', { name: 'タグ・OKワードを保存', exact: true }).click();
    await frame.getByRole('dialog', { name: '設定・定型文' }).waitFor({ state: 'detached' });
    assert.equal((await read('meta/tag_settings')).tagColumnMap['【備考】'], 'learning');
    await frame.locator('.cw-tools').getByRole('button', { name: /^出欠・送迎/ }).click();
    await child().locator('.cw-derived').first().getByText(/既存の備考/).waitFor();
    await page.screenshot({ path: resolve(root, 'output/ui-verification/mobile-operations.png'), fullPage: true });
    await frame.getByRole('navigation', { name: 'ツリー通信のメニュー' }).getByRole('button', { name: '業務・設定', exact: true }).click();
    await frame.locator('.cw-tools').getByRole('button', { name: /書出し・Excel・印刷/ }).click();
    const download = page.waitForEvent('download');
    await frame.getByRole('button', { name: 'CSVを書き出す', exact: true }).click();
    const csv = parseCSV(await readFile(await (await download).path(), 'utf8'));
    const row = csv.find(item => item[0] === '検証児童A');
    assert.match(row[csv[0].indexOf('学習')], /既存の備考/);
    assert.equal(row[csv[0].indexOf('備考')], '');
    assert.equal(row[csv[0].indexOf('今後の予定')], (await read(reportPath)).results['child-a'].futurePlan);
    assert.equal(row[csv[0].indexOf('ツリー通信')], (await read(reportPath)).results['child-a'].D);
    await frame.getByRole('button', { name: '書出しを閉じる', exact: true }).click();
    console.log('PASS settings column mapping → existing operational row → backup CSV fields and future plan');

    await frame.getByLabel('事業所', { exact: true }).selectOption('office-b');
    await frame.getByText('この日の記録を始めましょう', { exact: true }).waitFor();
    await frame.getByLabel('事業所', { exact: true }).selectOption('office-a');
    await frame.getByRole('heading', { name: '検証児童A', exact: true }).waitFor();
    await frame.getByTitle('翌日', { exact: true }).click();
    await frame.getByText('この日の記録を始めましょう', { exact: true }).waitFor();
    await frame.getByTitle('前日', { exact: true }).click();
    await frame.getByRole('heading', { name: '検証児童A', exact: true }).waitFor();
    await actualFrame.evaluate(() => window.location.reload());
    await frame.getByRole('heading', { name: '検証児童A', exact: true }).waitFor();
    assert.equal((await read(reportPath)).results['child-a'].D, '保存失敗でも失わない入力');
    await page.screenshot({ path: resolve(root, 'output/ui-verification/mobile-workspace.png'), fullPage: true });
    console.log('PASS office/date switch and iframe reload preserve record, memo, program and preferences');

    assert.deepEqual(pageErrors, [], 'uncaught browser errors');
    console.log('PASS no uncaught UI errors; production data untouched');
} catch (error) {
    if (currentPage) {
        console.error('UI state on failure:', await currentPage.frames().find(item => item.url().includes('/tree-communication-v2/'))?.locator('body').innerText());
        await currentPage.screenshot({ path: resolve(root, 'output/ui-verification/workflow-failure.png'), fullPage: true });
    }
    throw error;
} finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
}

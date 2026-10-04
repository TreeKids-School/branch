import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const storageId = '\0modal-test-storage';
const harnessId = '\0modal-test-harness';
const server = await createServer({
    configFile: false, root, logLevel: 'error', server: { host: '127.0.0.1', port: 0 },
    plugins: [react(), {
        name: 'operation-modal-verification',
        enforce: 'pre',
        resolveId(id, importer) {
            if (id === '/__modal-harness.js') return harnessId;
            if (id.endsWith('/hooks/useStorage') && importer?.replaceAll('\\', '/').includes('/src/components/')) return storageId;
        },
        load(id) {
            if (id === storageId) return 'export const callStorage = payload => window.__callStorage(payload);';
            if (id === harnessId) return [
                "import React from 'react';",
                "import {createRoot} from 'react-dom/client';",
                "import AddChildModal from '/src/components/AddChildModal.jsx';",
                "import AttendanceModal from '/src/components/AttendanceModal.jsx';",
                "import ExportModal from '/src/components/ExportModal.jsx';",
                "import '/src/index.css';",
                "const root=createRoot(document.getElementById('root'));",
                "window.renderAdd=()=>root.render(React.createElement(AddChildModal,{show:true,selectedDate:'2099-10-05',officeName:'検証Home',masterChildren:[{id:'child-a',name:'検証児童A',yomi:'ケンショウジドウエー'},{id:'child-b',name:'検証児童B',yomi:'ケンショウジドウビー'}],currentChildren:[],onClose:()=>window.events.push('close'),onAddChildren:(selected,wait)=>window.__add(selected,wait)}));",
                "window.renderAttendance=()=>root.render(React.createElement(AttendanceModal,{selectedDate:'2099-10-05',officeId:'office-a',officeName:'検証Home',staffList:[{id:'a',name:'スタッフA',post:['児童指導員・保育士']},{id:'b',name:'スタッフB',post:['スタッフ']}],onClose:()=>window.events.push('close'),onSaved:patch=>window.events.push({saved:patch})}));",
                "window.renderExport=()=>root.render(React.createElement(ExportModal,{show:true,selectedDate:'2099-10-05',selectedOffice:{id:'office-a',name:'検証Home'},children:[],results:{},onClose:()=>window.events.push('close'),onPrintDay:()=>window.__printDay()}));",
                "window.ready=true;",
            ].join('\n');
        },
        configureServer(vite) {
            vite.middlewares.use(async (request, response, next) => {
                if (request.url !== '/__modal-check') return next();
                response.setHeader('Content-Type', 'text/html');
                const html = await vite.transformIndexHtml(request.url, '<!doctype html><html><body><div id="root"></div><script type="module" src="/__modal-harness.js"></script></body></html>');
                response.end(html);
            });
        },
    }],
});
await server.listen();
let browser;
try {
    browser = await chromium.launch({ headless: true, ...(process.env.TEST_BROWSER_CHANNEL ? { channel: process.env.TEST_BROWSER_CHANNEL } : {}) });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    page.on('pageerror', error => console.error('Browser error:', error.message));
    await page.goto('http://127.0.0.1:' + server.httpServer.address().port + '/__modal-check');
    await page.waitForFunction(() => window.ready);
    if (process.env.VERIFY_PRINT_BLOCK_ONLY) {
        const uncaught = [];
        page.on('pageerror', error => uncaught.push(error.message));
        await page.evaluate(() => { window.events = []; window.__printDay = () => { throw new Error('印刷画面を開けません。ブラウザーのポップアップ許可を確認してください。'); }; window.renderExport(); });
        await page.getByRole('button', { name: '当日日誌を印刷', exact: true }).click();
        await page.getByRole('alert').filter({ hasText: 'ブラウザーのポップアップ許可を確認してください' }).waitFor();
        assert.equal(await page.getByRole('status').count(), 0, 'failed print must not display success');
        assert.deepEqual(uncaught, []);
        await page.getByRole('button', { name: '書出しを閉じる', exact: true }).click();
        assert.deepEqual(await page.evaluate(() => window.events), ['close']);
        console.log('PASS print callback exception → visible popup-permission error, no success/uncaught exception, close remains usable');
    } else {
    await page.evaluate(() => { window.events = []; window.__add = () => new Promise((_resolve, reject) => { window.rejectAdd = reject; }); window.renderAdd(); });
    await page.getByRole('searchbox').fill('けんしょうじどうえー');
    await page.getByRole('checkbox', { name: /検証児童A/ }).click();
    await page.getByRole('button', { name: '通常児童として追加', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: '通常児童として追加', exact: true }).isDisabled(), true);
    assert.deepEqual(await page.evaluate(() => window.events), []);
    await page.evaluate(() => window.rejectAdd(new Error('検証用の保存失敗')));
    await page.getByRole('alert').waitFor();
    assert.equal(await page.getByRole('checkbox', { name: /検証児童A/ }).getAttribute('aria-checked'), 'true');
    assert.deepEqual(await page.evaluate(() => window.events), []);
    await page.evaluate(() => { window.__add = async (selected, wait) => { window.events.push({selected: selected.map(child => child.id), wait}); return true; }; });
    await page.getByRole('button', { name: 'キャンセル待ちとして追加', exact: true }).click();
    await page.waitForFunction(() => window.events.includes('close'));
    assert.deepEqual(await page.evaluate(() => window.events), [{ selected: ['child-a'], wait: true }, 'close']);
    console.log('PASS mobile child selection → pending save → failure retains selection → retry waitlist callback');

    await page.evaluate(() => { window.events = []; window.__callStorage = async () => { throw new Error('検証読込失敗'); }; window.renderAttendance(); });
    await page.getByRole('button', { name: '再読込み', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: '勤務を保存', exact: true }).isDisabled(), true);
    await page.evaluate(() => { window.__callStorage = async payload => {
        if (payload.action === 'getAttendance') return { a: { type: 'work', startTime: '09:30', endTime: '18:30', legacy: '保持' }, b: { type: 'paid_leave', startTime: '09:30', endTime: '18:30' } };
        throw new Error('検証保存失敗');
    }; });
    await page.getByRole('button', { name: '再読込み', exact: true }).click();
    await page.waitForFunction(() => !document.body.textContent.includes('勤務を読み込んでいます'));
    await page.getByRole('group', { name: 'スタッフAの勤務区分' }).getByRole('button', { name: '公休', exact: true }).click();
    assert.equal(await page.locator('div.md\\:hidden').getByLabel('スタッフAの開始・時').isDisabled(), true);
    await page.getByRole('button', { name: '勤務を保存', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: '入力内容は残っています' }).waitFor();
    assert.equal(await page.getByRole('group', { name: 'スタッフAの勤務区分' }).getByRole('button', { name: '公休', exact: true }).getAttribute('aria-pressed'), 'true');
    assert.deepEqual(await page.evaluate(() => window.events), []);
    await page.evaluate(() => { window.__callStorage = async payload => { window.events.push(payload); return {status:'OK'}; }; });
    await page.getByRole('button', { name: '勤務を保存', exact: true }).click();
    await page.waitForFunction(() => window.events.includes('close'));
    const events = await page.evaluate(() => window.events);
    assert.equal(events[0].action, 'saveAttendance');
    assert.deepEqual(Object.keys(events[0].data), ['a']);
    assert.equal(events[0].data.a.type, 'public_holiday');
    assert.equal(events[0].data.a.legacy, '保持');
    assert.equal(events[0].data.a.role, '児童指導員・保育士');
    assert.deepEqual(events[1].saved, events[0].data);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'mobile form overflows the viewport');
    console.log('PASS mobile attendance read error blocks save → retry → holiday disables time → failed save keeps draft → edited staff only + onSaved');

    await page.setViewportSize({ width: 1440, height: 1000 });
    assert.equal(await page.getByRole('table').isVisible(), true);
    assert.equal(await page.getByRole('table').getByRole('row').count(), 3);
    console.log('PASS desktop attendance table exposes both staff and all preserved fields');
    }
} finally {
    if (browser) await browser.close();
    await server.close();
}

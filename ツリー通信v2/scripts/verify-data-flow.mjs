import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, sep } from 'node:path';
import { createRequire } from 'node:module';
import { attendancePatch, roundAttendanceTime } from '../src/utils/attendance.js';
import { availableChildren } from '../src/utils/childSelection.js';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const server = createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    response.setHeader('Cache-Control', 'no-store');
    if (url.pathname === '/') {
        response.setHeader('Content-Type', 'text/html');
        response.end('<!doctype html><script>window.addEventListener("message",event=>{if(event.data?.type==="tree-tsushin:ready")event.source.postMessage({type:"tree-tsushin:session",storageMode:"browser-preview",uid:new URL(location.href).searchParams.get("uid")||"test-staff-a",role:"staff",displayName:"検証スタッフ"},location.origin)})</script><iframe src="/harness.html"></iframe>');
        return;
    }
    if (url.pathname === '/harness.html') {
        response.setHeader('Content-Type', 'text/html');
        response.end('<!doctype html><script type="module">import {waitForSession} from "/src/portal/sessionBridge.js";await waitForSession();window.testReady=true;</script>');
        return;
    }
    const path = resolve(root, '.' + decodeURIComponent(url.pathname));
    if (!path.startsWith(root + sep) || !path.endsWith('.js')) { response.writeHead(404).end(); return; }
    try { response.setHeader('Content-Type', 'text/javascript'); response.end(await readFile(path)); }
    catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
let browser;
try {
    assert.equal(roundAttendanceTime('09:33'), '09:35');
    assert.equal(roundAttendanceTime('09:32'), '09:30');
    assert.equal(roundAttendanceTime('25:00', '09:30'), '09:30');
    const records = { a: { name: 'A', type: 'work', startTime: '09:30', endTime: '18:30', legacy: true }, b: { name: 'B', type: 'paid_leave' } };
    assert.deepEqual(Object.keys(attendancePatch(records, new Set(['a']))), ['a']);
    assert.equal(attendancePatch(records, new Set(['a'])).a.legacy, true);
    assert.throws(() => attendancePatch({ a: { ...records.a, startTime: '09:32' } }, new Set(['a'])), /5分/);
    assert.equal(attendancePatch(records, new Set(['b'])).b.type, 'paid_leave');
    const master = [{ id: 'a', name: '山田 太郎', yomi: 'ヤマダタロウ' }, { id: 'b', name: '佐藤', nameFurigana: 'サトウ' }];
    assert.deepEqual(availableChildren(master, [], 'やまだ たろう').map(child => child.id), ['a']);
    assert.deepEqual(availableChildren(master, [], 'ﾔﾏﾀﾞ').map(child => child.id), ['a']);
    assert.equal(availableChildren(master, [{ id: 'a' }], 'やまだ').length, 0);
    console.log('PASS attendance validation, changed-row patch and kana child search');

    browser = await chromium.launch({ headless: true, ...(process.env.TEST_BROWSER_CHANNEL ? { channel: process.env.TEST_BROWSER_CHANNEL } : {}) });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(origin);
    let frame = page.frames().find(item => item.url().endsWith('/harness.html'));
    await frame.waitForFunction(() => window.testReady);
    const report = await frame.evaluate(async () => {
        const db = await import('/src/portal/browserFirestore.js');
        const { commitDailyMutation } = await import('/src/utils/commitDailyMutation.js');
        const { workspaceStorage } = await import('/src/portal/workspaceStorage.js');
        const assert = (condition, message) => { if (!condition) throw new Error(message); };
        const storage = { ...db, firestore: {} };
        const date = '2099-10-05';
        const reportRef = db.doc({}, 'reports', 'office-a_' + date);
        const childRef = db.doc({}, 'children', 'child-a', 'app_categories', '書類管理', 'tree_communications', 'office-a_' + date);
        const legacyRef = db.doc({}, 'children', 'child-a', 'app_categories', '書類管理', 'tree_communications', date);
        await db.setDoc(legacyRef, { tree_comm_text: '旧経路の本文を保持', officeId: 'office-a' });
        await db.setDoc(reportRef, { children: [{ id: 'child-a', name: '検証児童' }], results: { 'child-a': { D: '元の本文', futurePlan: '', legacySupport: '保持' } }, messages: {}, dailyTable: { 'child-a': { transportTime: '15:05' } }, globalLog: { notice: '保持する周知', activities: '' }, activeLocks: { 'child-a': { uid: 'test-staff-a' } }, unknownLegacyField: '保持' });
        let deliveries = [];
        const stop = db.onSnapshot(reportRef, snapshot => deliveries.push(snapshot.data()));
        const saved = await commitDailyMutation(storage, {
            date, officeId: 'office-a',
            mutate: previous => ({ results: { ...previous.results, 'child-a': { ...previous.results['child-a'], D: '新しい本文', futurePlan: '次は続きを作ろう' } }, messages: { ...previous.messages, 'child-a': [{ id: 'memo-a', tag: '備考', text: '持ち物' }] } }),
            logs: [{ id: 'log-a', description: '通信変更' }], syncChildIds: ['child-a'], deriveRemarks: messages => messages.map(item => item.text).join('\n'),
        });
        assert(saved.report.unknownLegacyField === '保持', 'unknown report field lost');
        assert(saved.report.activeLocks['child-a'].uid === 'test-staff-a', 'lock lost');
        const mirror = (await db.getDoc(childRef)).data();
        assert(mirror.tree_comm_text === '新しい本文' && mirror.future_plan === '次は続きを作ろう' && mirror.notes === '持ち物', 'report -> individual mirror mismatch');
        assert(mirror.transportTime === '15:05' && mirror.officeId === 'office-a', 'transport/office mismatch');
        assert((await db.getDoc(db.doc({}, 'meta', 'reports_index_office-a'))).data().dates.includes(date), 'calendar index missing');
        assert((await db.getDoc(db.doc({}, 'changeLogs', 'office-a_' + date))).data().logs[0].id === 'log-a', 'change history missing');
        await commitDailyMutation(storage, { date, officeId: 'office-a', mutate: previous => ({ results: { ...previous.results, 'child-a': { ...previous.results['child-a'], D: '' } } }), syncChildIds: ['child-a'] });
        assert((await db.getDoc(childRef)).data().tree_comm_text === '', 'explicit empty text was not reflected');
        assert((await db.getDoc(reportRef)).data().results['child-a'].legacySupport === '保持', 'legacy support lost');

        await Promise.all(['one', 'two'].map(id => commitDailyMutation(storage, { date, officeId: 'office-a', mutate: previous => ({ messages: { ...previous.messages, 'child-a': [...(previous.messages['child-a'] || []), { id, text: id }] } }) })));
        const ids = (await db.getDoc(reportRef)).data().messages['child-a'].map(item => item.id);
        assert(ids.includes('one') && ids.includes('two'), 'concurrent append overwritten');
        await new Promise(resolve => setTimeout(resolve, 30));
        assert(deliveries.at(-1).messages['child-a'].length === 3, 'snapshot did not reflect latest saved data');
        stop();

        const failedDate = '2099-10-06';
        let failed = false;
        try {
            await commitDailyMutation(storage, { date: failedDate, officeId: 'office-a', mutate: previous => ({ ...previous, children: [{ id: 'child-a', name: '検証児童' }] }), logs: [{ id: 'must-rollback' }], syncChildIds: ['child-a'], deriveRemarks: () => undefined });
        } catch { failed = true; }
        assert(failed, 'invalid mirror save falsely succeeded');
        assert(!(await db.getDoc(db.doc({}, 'reports', 'office-a_' + failedDate))).exists(), 'failed report was partially saved');
        assert(!(await db.getDoc(db.doc({}, 'changeLogs', 'office-a_' + failedDate))).exists(), 'failed history was partially saved');
        assert(!(await db.getDoc(db.doc({}, 'meta', 'reports_index_office-a'))).data().dates.includes(failedDate), 'failed calendar index was partially saved');
        assert(!(await db.getDoc(db.doc({}, 'children', 'child-a', 'app_categories', '書類管理', 'tree_communications', 'office-a_' + failedDate))).exists(), 'failed mirror exists');

        await commitDailyMutation(storage, { date, officeId: 'office-b', mutate: previous => ({ ...previous, children: [{ id: 'child-a', name: '検証児童' }], results: { 'child-a': { D: '別事業所の本文', futurePlan: '別事業所の予定' } } }), syncChildIds: ['child-a'] });
        const secondOffice = (await db.getDoc(db.doc({}, 'children', 'child-a', 'app_categories', '書類管理', 'tree_communications', 'office-b_' + date))).data();
        assert(secondOffice.tree_comm_text === '別事業所の本文', 'second office mirror missing');
        assert((await db.getDoc(childRef)).data().future_plan === '次は続きを作ろう', 'office-a mirror overwritten by office-b');
        assert((await db.getDoc(legacyRef)).data().tree_comm_text === '旧経路の本文を保持', 'legacy date document overwritten');

        const attendance = db.doc({}, 'attendance', 'office-a_' + date);
        await db.setDoc(attendance, { a: { type: 'work', startTime: '09:30', legacy: true }, b: { type: 'paid_leave' } });
        await db.setDoc(attendance, { a: { startTime: '10:05' } }, { merge: true });
        const staff = (await db.getDoc(attendance)).data();
        assert(staff.a.startTime === '10:05' && staff.a.legacy && staff.b.type === 'paid_leave', 'attendance patch dropped another staff/legacy field');
        await db.updateDoc(attendance, { 'a.startTime': '10:10' });
        assert((await db.getDoc(attendance)).get('a.startTime') === '10:10', 'dot field update failed');
        await db.updateDoc(attendance, { 'a.legacy': db.deleteField() });
        assert((await db.getDoc(attendance)).get('a.legacy') === undefined, 'deleteField failed');
        assert((await db.getDocs(db.query(db.collection({}, 'reports'), db.where('unknownLegacyField', '==', '保持')))).size === 1, 'query missing saved report');

        workspaceStorage.setItem('test-draft', '下書き');
        assert(workspaceStorage.getItem('test-draft') === '下書き', 'draft not readable');
        const nativeSetItem = Storage.prototype.setItem;
        Storage.prototype.setItem = () => { throw new DOMException('full', 'QuotaExceededError'); };
        try {
            let quotaError;
            try { workspaceStorage.setItem('test-draft', '失われない'); } catch (error) { quotaError = error; }
            assert(quotaError?.message.includes('保存できません'), 'quota failure swallowed/unexplained');
        } finally { Storage.prototype.setItem = nativeSetItem; }
        assert(workspaceStorage.getItem('test-draft') === '下書き', 'draft altered despite failed save');
        return { scenarios: ['report → mirror / index / history', 'empty value clear + legacy preservation', 'concurrent memo append', 'snapshot delivery', 'atomic rollback', 'same child/date office isolation + legacy path preserved', 'attendance merge + dot fields', 'query', 'draft save failure'] };
    });
    for (const scenario of report.scenarios) console.log('PASS ' + scenario);
    const second = await context.newPage();
    await second.goto(origin + '/?uid=test-staff-b');
    const secondFrame = second.frames().find(item => item.url().endsWith('/harness.html'));
    await secondFrame.waitForFunction(() => window.testReady);
    assert.equal(await secondFrame.evaluate(async () => {
        const db = await import('/src/portal/browserFirestore.js');
        const { workspaceStorage } = await import('/src/portal/workspaceStorage.js');
        return !(await db.getDoc(db.doc({}, 'reports', 'office-a_2099-10-05'))).exists() && workspaceStorage.getItem('test-draft') === null;
    }), true);
    console.log('PASS UID isolation in the same browser context');
    const sameUser = await context.newPage();
    await sameUser.goto(origin + '/?uid=test-staff-a');
    const sameUserFrame = sameUser.frames().find(item => item.url().endsWith('/harness.html'));
    await sameUserFrame.waitForFunction(() => window.testReady);
    await sameUserFrame.evaluate(async () => {
        const db = await import('/src/portal/browserFirestore.js');
        window.stopSnapshot = db.onSnapshot(db.doc({}, 'reports', 'office-a_2099-10-05'), snapshot => { window.observedOtherTab = snapshot.data()?.dailyTable?.['child-a']?.transportTime; });
    });
    await sameUserFrame.waitForFunction(() => window.observedOtherTab === '15:05');
    await frame.evaluate(async () => {
        const db = await import('/src/portal/browserFirestore.js');
        await db.updateDoc(db.doc({}, 'reports', 'office-a_2099-10-05'), { 'dailyTable.child-a.transportTime': '15:45' });
    });
    await sameUserFrame.waitForFunction(() => window.observedOtherTab === '15:45');
    await sameUserFrame.evaluate(() => window.stopSnapshot());
    console.log('PASS same-UID tab receives committed changes through snapshot broadcast');
    await page.reload();
    frame = page.frames().find(item => item.url().endsWith('/harness.html'));
    await frame.waitForFunction(() => window.testReady);
    assert.equal(await frame.evaluate(async () => {
        const db = await import('/src/portal/browserFirestore.js');
        const { workspaceStorage } = await import('/src/portal/workspaceStorage.js');
        return (await db.getDoc(db.doc({}, 'reports', 'office-a_2099-10-05'))).data().results['child-a'].futurePlan === '次は続きを作ろう' && workspaceStorage.getItem('test-draft') === '下書き';
    }), true);
    console.log('PASS reopen persistence; test data remains only in disposable browser context');
} finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { editorDraftKey, editorSavePayload, restoreEditorDraft, reconcileEditor, orderedMemoText, programTemplateText, appendEditorText, scanForNames } from '../src/utils/communicationEditor.js';
import { copyToClipboard } from '../src/utils/clipboard.js';

test('drafts are isolated by account, office, date, and child', () => {
    const identity = { scope: 'staff-a', officeId: 'home', date: '2026-10-05', childId: 'child-a' };
    const keys = [identity, { ...identity, scope: 'staff-b' }, { ...identity, officeId: 'arts' }, { ...identity, date: '2026-10-06' }, { ...identity, childId: 'child-b' }].map(editorDraftKey);
    assert.equal(new Set(keys).size, 5);
});
test('saving body alone cannot overwrite an unchanged future plan, and carries the expected version', () => {
    assert.deepEqual(editorSavePayload({ D: 'new body', futurePlan: 'same plan' }, { D: 'old body', futurePlan: 'same plan' }), { patch: { D: 'new body' }, expected: { D: 'old body' } });
    assert.deepEqual(editorSavePayload({ D: '', futurePlan: 'next' }, { D: 'old', futurePlan: 'before' }, { isCompleted: true }), { patch: { D: '', futurePlan: 'next', isCompleted: true }, expected: { D: 'old', futurePlan: 'before' } });
});
test('unsaved future plan and deliberate empty body both survive draft restoration', () => {
    const stored = { D: 'before', futurePlan: 'old plan' };
    const restored = restoreEditorDraft(stored, { version: 2, base: stored, values: { D: '', futurePlan: 'next activity' } });
    assert.deepEqual(restored.values, { D: '', futurePlan: 'next activity' });
    assert.deepEqual(restored.conflicts, {});
});
test('an outdated draft cannot silently overwrite a newer saved plan', () => {
    const restored = restoreEditorDraft({ D: 'same', futurePlan: 'other saved plan' }, { version: 2, base: { D: 'same', futurePlan: 'old plan' }, values: { D: 'same', futurePlan: 'my plan' } });
    assert.equal(restored.values.futurePlan, 'my plan');
    assert.deepEqual(restored.conflicts, { futurePlan: 'other saved plan' });
});
test('incoming saved body applies without erasing a separately edited future plan', () => {
    const reconciled = reconcileEditor({ D: 'old', futurePlan: 'my new plan' }, { D: 'old', futurePlan: 'old plan' }, { D: 'new body', futurePlan: 'old plan' });
    assert.deepEqual(reconciled.values, { D: 'new body', futurePlan: 'my new plan' });
    assert.deepEqual(reconciled.conflicts, {});
});
test('clear from another editor applies when this editor is clean', () => {
    assert.equal(reconcileEditor({ D: 'text', futurePlan: '' }, { D: 'text', futurePlan: '' }, { D: '', futurePlan: '' }).values.D, '');
});
test('both independently edited fields retain local text for comparison', () => {
    const result = reconcileEditor({ D: 'my body', futurePlan: 'my plan' }, { D: 'old body', futurePlan: 'old plan' }, { D: 'other body', futurePlan: 'other plan' });
    assert.deepEqual(result.values, { D: 'my body', futurePlan: 'my plan' });
    assert.deepEqual(result.conflicts, { D: 'other body', futurePlan: 'other plan' });
});
test('memo insertion follows selected order and preserves originals', () => {
    const messages = [{ id: 'a', text: '【学習】一枚目' }, { id: 'b', text: '【制作】二枚目' }];
    assert.equal(orderedMemoText(messages, ['b', 'a'], ['【学習】', '【制作】']), '二枚目\n\n一枚目');
    assert.equal(messages[0].text, '【学習】一枚目');
    assert.equal(appendEditorText('挨拶\n', orderedMemoText(messages, ['a'], [])), '挨拶\n一枚目');
});
test('program insertion supports one, all, and tag only without losing template wording', () => {
    const programs = [{ title: '制作', summary: '色紙を選ぶ' }, { title: '運動', summary: 'ボール遊び' }];
    const templates = { '【制作】': '今日は{プログラム内容}。' };
    assert.equal(programTemplateText('【制作】', templates, programs, 1), '今日はボール遊び。');
    assert.equal(programTemplateText('【制作】', templates, programs, 'none'), '');
    assert.equal(programTemplateText('【制作】', templates, programs, 'all'), '今日は【制作】\n色紙を選ぶ\n\n【運動】\nボール遊び。');
});
test('name warnings respect persistent OK words without affecting the body', () => {
    assert.deepEqual(scanForNames('児童Aくん、みなさん、児童Bちゃん', ['児童Aくん']), ['児童Bちゃん']);
});

async function clipboardEnvironment({ writeText, accepted }, check) {
    const originals = Object.fromEntries(['navigator', 'document', 'HTMLElement'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    const state = { removed: false, restoredFocus: false, fallbackCalls: 0 };
    class Element { focus() { state.restoredFocus = true; } }
    const textarea = { value: '', style: {}, setAttribute() {}, focus() {}, select() {}, setSelectionRange() {}, remove() { state.removed = true; } };
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: writeText ? { writeText } : undefined } });
    Object.defineProperty(globalThis, 'HTMLElement', { configurable: true, value: Element });
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { activeElement: new Element(), body: { appendChild() {} }, createElement: () => textarea, execCommand: () => { state.fallbackCalls++; return accepted; } } });
    try { await check(state); }
    finally { for (const [key, descriptor] of Object.entries(originals)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } }
}
test('clipboard fallback false rejects, cleans up and never reports success', async () => {
    await clipboardEnvironment({ accepted: false }, async state => {
        await assert.rejects(copyToClipboard('通信本文'), /コピーできませんでした/);
        assert.equal(state.removed, true);
        assert.equal(state.restoredFocus, true);
    });
});
test('clipboard API rejection can use confirmed fallback success', async () => {
    await clipboardEnvironment({ writeText: async () => { throw new Error('denied'); }, accepted: true }, async state => {
        await copyToClipboard('通信本文');
        assert.equal(state.fallbackCalls, 1);
        assert.equal(state.removed, true);
    });
});
test('successful clipboard API does not perform a second fallback copy', async () => {
    await clipboardEnvironment({ writeText: async text => assert.equal(text, '通信本文'), accepted: false }, async state => {
        await copyToClipboard('通信本文');
        assert.equal(state.fallbackCalls, 0);
    });
});

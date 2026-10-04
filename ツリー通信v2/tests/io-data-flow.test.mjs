import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { parseCSV, toCSV, buildHeaderIndex } from '../src/utils/csv.js';
import { normalizeDate, mergeBackupRowsIntoReport } from '../src/utils/backup.js';
import { backupRows, BACKUP_HEADERS, columnText } from '../src/utils/communicationFlow.js';
const bundled = await build({ entryPoints: ['src/utils/print.js'], bundle: true, write: false, format: 'esm', platform: 'node' });
const { buildDayPageHTML, extractStudyText, extractProgramText, extractNotesText } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
const mapping = { '【試す】': 'learning', '【造形】': 'program', '【引継】': 'remarks' };
const child = { id: 'a', name: '架空児童A' };
const other = { id: 'b', name: '架空児童B' };

test('invalid calendar dates cannot silently redirect import into the visible date', () => {
  assert.equal(normalizeDate('2026/02/30'), '');
  assert.equal(normalizeDate('2026/13/1'), '');
  assert.equal(normalizeDate('2024年2月29日'), '2024-02-29');
});
test('backup CSV round trip retains multiline communication, future plan, multi-tag memos and unselected child', () => {
  const original = { children:[child], results:{a:{D:'一行目,\n"二行目"',futurePlan:'次は色を重ねる',treeCommComplete:true}}, messages:{a:[{id:'m',tag:'【試す】 【引継】',text:'自分で選んだ\n色'}]}, dailyTable:{a:{pickupLocation:'学校',transportTime:'14:30',notes:'要確認'}}, globalLog:{notice:'特記',activities:'共有'} };
  const table = parseCSV(toCSV([BACKUP_HEADERS, ...backupRows(original, '2026-10-05', mapping)]));
  const h = buildHeaderIndex(table[0]); const row = table[1];
  const existing = { children:[child,other], results:{b:{D:'保持する通信'}}, messages:{b:[{text:'保持するメモ'}]}, dailyTable:{b:{notes:'保持する備考'}}, attendance:{staff:{type:'paid_leave'}}, legacy:{preserve:true} };
  const { data } = mergeBackupRowsIntoReport(existing,[{matchedChild:child,restore:JSON.parse(row[h['復元用データ']])}],42,mapping);
  assert.deepEqual(data.results.a, original.results.a);
  assert.deepEqual(data.messages.a, original.messages.a);
  assert.deepEqual(data.dailyTable.a, original.dailyTable.a);
  assert.deepEqual(data.results.b,existing.results.b);
  assert.deepEqual(data.messages.b,existing.messages.b);
  assert.deepEqual(data.attendance,existing.attendance);
  assert.deepEqual(data.legacy,existing.legacy);
});
test('legacy CSV restores visible learning/program columns, clears explicitly empty fields, and preserves other tags', () => {
  const existing = {children:[child,other],results:{a:{D:'古い本文',futurePlan:'保持'}}, messages:{a:[{id:'multi',tag:'【試す】 【引継】',text:'既存の共有も残す'}]},dailyTable:{a:{pickupLocation:'学校',notes:'保持する'}}};
  const {data} = mergeBackupRowsIntoReport(existing,[{matchedChild:child,study:'新しい学習',program:'新しい造形',treeComm:'',pickupLocation:'',presentFields:{study:true,program:true,treeComm:true,pickupLocation:true}}],100,mapping);
  assert.equal(data.results.a.D,''); assert.equal(data.results.a.futurePlan,'保持');
  assert.equal(data.dailyTable.a.pickupLocation,''); assert.equal(data.dailyTable.a.notes,'保持する');
  assert.match(columnText(data.messages.a,'learning',mapping),/新しい学習/);
  assert.match(columnText(data.messages.a,'program',mapping),/新しい造形/);
  assert.match(columnText(data.messages.a,'remarks',mapping),/既存の共有も残す/);
});
test('print uses the same custom tags and text as the table, and prints daily programs', () => {
  const messages = {a:[{tag:'【試す】 【造形】',text:'赤と青を混ぜた'},{tag:'【引継】',text:'家庭へ確認'}]};
  const dailyTable = {a:{notes:'CSVの備考'}};
  assert.equal(extractStudyText(messages,'a',mapping),columnText(messages.a,'learning',mapping));
  assert.equal(extractProgramText(messages,'a',mapping),columnText(messages.a,'program',mapping));
  assert.match(extractNotesText(messages,dailyTable,'a',mapping),/家庭へ確認.*CSVの備考/);
  const html = buildDayPageHTML('2026/10/5',[child],dailyTable,messages,{notice:'<大切> & 確認',programs:[{title:'色あそび',staff:'スタッフA',summary:'色を重ねる'}]},'',{},[],mapping);
  assert.match(html,/赤と青を混ぜた/); assert.match(html,/色あそび/); assert.match(html,/スタッフA/); assert.match(html,/色を重ねる/);
  assert.match(html,/&lt;大切&gt; &amp; 確認/); assert.doesNotMatch(html,/<大切>/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyReport,patchResult,patchTable,mutateMemo,columnText,remarksText,backupRows,programPatch,combinedCommunication,exportDates,assertExpectedResult} from '../src/utils/communicationFlow.js';
const initial=()=>({...emptyReport(),children:[{id:'a',name:'児童A',lastName:'田中',firstName:'一郎'},{id:'b',name:'児童B',lastName:'田中',firstName:'二郎'}],results:{a:{D:'以前の本文',futurePlan:'以前の予定',B_plan:'既存支援計画'}},dailyTable:{a:{pickupLocation:'学校',notes:'CSVからの備考'}},customLegacy:'keep'});
test('初回の完了保存を許し、別操作による同一項目の更新は止める',()=>{
 assert.doesNotThrow(()=>assertExpectedResult({}, {D:'',futurePlan:'',isCompleted:false}));
 assert.throws(()=>assertExpectedResult({D:'外部で変更'}, {D:'変更前'}),/変更されています/);
 assert.throws(()=>assertExpectedResult({isCompleted:true}, {isCompleted:false}),/変更されています/);
});
test('タグ付きメモが業務表・共有事項・CSVの各必要箇所へ流れ、編集は共有転記を勝手に変更しない',()=>{
 const mapping={'【創作】':'program','【共有】':'remarks'};
 let report=mutateMemo(initial(),'a','add',{id:'m1',text:'はさみを使った',tag:['【創作】','【共有】']});
 assert.match(columnText(report.messages.a,'program',mapping),/はさみ/);
 assert.equal(report.globalLog.activities,'[田中 一郎] はさみを使った');
 assert.equal(mutateMemo(report,'a','add',{id:'m1',text:'はさみを使った',tag:['【創作】','【共有】']}).globalLog.activities,report.globalLog.activities);
 report=mutateMemo(report,'a','edit',{id:'m1',text:'丁寧にはさみを使った',tag:'【創作】 【共有】'});
 assert.match(columnText(report.messages.a,'program',mapping),/丁寧に/);
 assert.equal(report.globalLog.activities,'[田中 一郎] はさみを使った');
 assert.match(remarksText(report.messages.a,mapping,report.dailyTable.a),/CSVからの備考/);
 const row=backupRows(report,'2026-10-05',mapping)[0];
 assert.match(row[3],/丁寧に/);assert.match(row[10],/CSVからの備考/);
 assert.equal(JSON.parse(row[11]).r.B_plan,'既存支援計画');
});
test('本文と予定の差分保存は互いと旧項目を保ち、空欄への変更もコピー・書出しへ反映する',()=>{
 let report=patchResult(initial(),'a',{D:'新しい本文'});
 report=patchResult(report,'a',{futurePlan:'次回は工作'});
 report=patchTable(report,'a',{transportTime:'14:05',endTime:'17:00'});
 const row=backupRows(report,'2026-10-05',{})[0];
 assert.equal(row[7],'新しい本文');assert.equal(row[9],'次回は工作');assert.equal(row[6],'学校');assert.equal(report.customLegacy,'keep');
 assert.match(combinedCommunication(report.children,report.results,['a']),/新しい本文/);
 report=patchResult(report,'a',{D:'',futurePlan:''});
 assert.equal(backupRows(report,'2026-10-05',{})[0][7],'');assert.equal(combinedCommunication(report.children,report.results,['a']),'');assert.equal(report.results.a.B_plan,'既存支援計画');
});
test('複数プログラムの名称・担当・詳細と旧互換項目、独立した完了と送信確認を保持する',()=>{
 const programs=[{title:'工作',summary:'切って貼る',staff:'担当A'},{title:'運動',summary:'ボール',staff:'担当B'}];
 const patch=programPatch(programs);assert.equal(patch.programStaff,'担当A');assert.equal(patch.programSummary,'切って貼る');assert.equal(patch.programs[1].title,'運動');
 let report=patchResult(initial(),'a',{isCompleted:true});assert.equal(report.dailyTable.a.sentChecked,undefined);
 report=patchTable(report,'a',{sentChecked:true});report=patchResult(report,'a',{isCompleted:false});assert.equal(report.dailyTable.a.sentChecked,true);
});
test('選択順と同姓の結合、暦月ではない書出し期間を保持する',()=>{
 const report=initial();report.results.b={D:'二人目の本文'};
 assert.match(combinedCommunication(report.children,report.results,['b','a']),/^【田中二郎さん一郎さん】\n二人目の本文\n以前の本文$/);
 assert.deepEqual(exportDates('2026-10-05','week'),['2026-09-29','2026-09-30','2026-10-01','2026-10-02','2026-10-03','2026-10-04','2026-10-05']);
 assert.equal(exportDates('2026-10-05','month')[0],'2026-09-05');
});

import {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {auth, firestore} from './firebase';
import {onAuthStateChanged, signOut} from 'firebase/auth';
import {doc, onSnapshot, setDoc, runTransaction, deleteField, updateDoc} from 'firebase/firestore';
import {callStorage} from './hooks/useStorage';
import Workspace from './components/CommunicationWorkspace';
import MemoPanel from './components/MemoPanel';
import Login from './components/Login';
import SettingsModal from './components/SettingsModal';
import CalendarModal from './components/CalendarModal';
import AddChildModal from './components/AddChildModal';
import AttendanceModal from './components/AttendanceModal';
import CSVImportModal from './components/CSVImportModal';
import BackupImportModal from './components/BackupImportModal';
import ExportModal from './components/ExportModal';
import LogModal from './components/LogModal';
import WorkspaceHelp from './components/WorkspaceHelp';
import UpdateModal from './components/UpdateModal';
import {ErrorBoundary} from './components/Shared';
import {APP_VERSION} from './app_constants';
import {printAllDocuments} from './utils/print';
import {toCSV} from './utils/csv';
import {copyToClipboard} from './utils/clipboard';
import {findGreetingTemplateForStaff, checkHasGreeting} from './utils/greetingUtils';
import {DEFAULT_TAGS, DEFAULT_INSERTS, DEFAULT_COLUMNS, emptyReport, childName, childStatus, localDate, offsetDate, columnText, remarksText, patchResult, patchTable, mutateMemo, programPatch, combinedCommunication, BACKUP_HEADERS, backupRows, exportDates, assertExpectedResult} from './utils/communicationFlow';
import './workspace.css';

const cs = payload => callStorage(payload);
const preference = (key, fallback) => {try{return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback;}catch{return fallback;}};
const labels = {regular:'通常',waitlist:'キャンセル待ち',absent:'欠席'};
const browserPreview = auth.mode === 'staff-portal';

export default function CommunicationApp(){
 const [user,setUser]=useState(null),[authLoading,setAuthLoading]=useState(true);
 const [date,setDate]=useState(localDate),[office,setOffice]=useState(null),[offices,setOffices]=useState([]);
 const [report,setReport]=useState(emptyReport),[attendance,setAttendance]=useState({}),[logs,setLogs]=useState([]),[dates,setDates]=useState([]);
 const [masterChildren,setMasterChildren]=useState([]),[staff,setStaff]=useState([]);
 const [tags,setTags]=useState(()=>preference('tree_tsushin_v2_tags',DEFAULT_TAGS));
 const [inserts,setInserts]=useState(()=>preference('tree_tsushin_v2_tag_insert_texts',DEFAULT_INSERTS));
 const [columns,setColumns]=useState(()=>preference('tree_tsushin_v2_tag_column_map',DEFAULT_COLUMNS));
 const [greetings,setGreetings]=useState({}),[okWords,setOkWords]=useState([]);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(0),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [modal,setModal]=useState(null),[editor,setEditor]=useState(null),[memoTab,setMemoTab]=useState('memo'),[dirty,setDirty]=useState(false);
 const [reload,setReload]=useState(0),[importLock,setImportLock]=useState(null),[tourStep,setTourStep]=useState(null),[sandbox,setSandbox]=useState(null);
 const queue=useRef(Promise.resolve()),scopeRef=useRef(''),reportRef=useRef(report),editorRef=useRef(editor);
 const scope=`${office?.id || ''}/${date}`;
 scopeRef.current=scope;reportRef.current=report;editorRef.current=editor;
 const staffName=staff.find(item=>item.id===user?.uid || (item.email && item.email===user?.email))?.name || user?.displayName || user?.email?.split('@')[0] || 'スタッフ';
 const officeStaff=staff.filter(item=>!office || item.officeId===office.id || item.office===office.name || (Array.isArray(item.office)&&item.office.includes(office.name)));
 useEffect(()=>onAuthStateChanged(auth,value=>{setUser(value);setAuthLoading(false);}),[]);
 useEffect(()=>{
  if(!user)return;let alive=true;setLoading(true);setError('');
  Promise.all([cs({action:'getOffices'}),cs({action:'getMasterChildren'}),cs({action:'getStaffNames'})]).then(([locations,children,people])=>{
   if(!alive)return;setOffices(locations || []);setMasterChildren(children || []);setStaff(people || []);
   const saved=preference('tree_tsushin_v2_selected_office',null);
   setOffice(previous=>(locations || []).find(item=>item.id===(previous?.id || saved?.id)) || locations?.[0] || null);
   if(!locations?.length){setLoading(false);setError(browserPreview?'このブラウザーには事業所データがありません。旧データ移行・予約名簿の接続はまだ行っていません。':'事業所が未登録です。ローカル開発用の事業所を用意してから再読み込みしてください。');}
  }).catch(()=>{if(alive){setLoading(false);setError('事業所・児童・スタッフの取得に失敗しました。再読み込みしてください。');}});
  return()=>{alive=false;};
 },[user,reload]);
 useEffect(()=>{
  if(!user||!office)return;let alive=true;setLoading(true);setReport(emptyReport());setAttendance({});setLogs([]);setError('');
  const id=`${office.id}_${date}`, ready=new Set();
  const failed=()=>{if(alive){setLoading(false);setError('記録の取得に失敗しました。入力せず再読み込みしてください。');}};
  const received=key=>{ready.add(key);if(alive&&ready.size===3)setLoading(false);};
  const unsub=[
   onSnapshot(doc(firestore,'reports',id),snap=>{if(!alive)return;setReport(snap.exists()?{...emptyReport(),...snap.data()}:emptyReport());received('report');},failed),
   onSnapshot(doc(firestore,'attendance',id),snap=>{if(!alive)return;setAttendance(snap.exists()?snap.data():{});received('attendance');},failed),
   onSnapshot(doc(firestore,'changeLogs',id),snap=>{if(!alive)return;setLogs((snap.exists()?snap.data().logs || []:[]).slice().sort((a,b)=>String(b.timestamp).localeCompare(String(a.timestamp))));received('logs');},failed),
   onSnapshot(doc(firestore,'meta',`reports_index_${office.id}`),snap=>{if(alive)setDates(snap.exists()?snap.data().dates || []:[]);},failed)];
  return()=>{alive=false;unsub.forEach(fn=>fn());};
 },[user,office?.id,date,reload]);
 useEffect(()=>{
  if(!user)return;const failed=()=>setError('入力設定の取得に失敗しました。再読み込みしてください。');
  const unsub=[
   onSnapshot(doc(firestore,'meta','greeting_templates'),snap=>setGreetings(snap.exists()?snap.data():{}),failed),
   onSnapshot(doc(firestore,'meta','ok_words'),snap=>setOkWords(snap.exists()?snap.data().words || []:[]),failed),
   onSnapshot(doc(firestore,'meta','tag_settings'),snap=>{if(!snap.exists())return;const data=snap.data();if(Array.isArray(data.tags))setTags(data.tags);if(data.tagInsertTexts)setInserts(data.tagInsertTexts);if(data.tagColumnMap)setColumns(data.tagColumnMap);},failed),
   onSnapshot(doc(firestore,'meta','importLock'),snap=>{const lock=snap.exists()?snap.data():null;setImportLock(lock?.isLocked&&lock.expiresAt>Date.now()&&lock.lockedBy!==user.uid?lock:null);},failed)];
  return()=>unsub.forEach(fn=>fn());
 },[user,reload]);
 useEffect(()=>{
  window.dispatchEvent(new CustomEvent('tree-tsushin:workstate',{detail:{dirty,busy:busy>0}}));
  const prevent=event=>{if(dirty||busy){event.preventDefault();event.returnValue='';}};
  window.addEventListener('beforeunload',prevent);return()=>window.removeEventListener('beforeunload',prevent);
 },[dirty,busy]);
 useEffect(()=>{if(!notice)return;const timeout=setTimeout(()=>setNotice(''),6000);return()=>clearTimeout(timeout);},[notice]);
 const logEntry=(id,field,description,previous,next,type='result')=>({id:crypto.randomUUID(),timestamp:new Date().toISOString(),staffName,childId:id || '',childName:childName(reportRef.current.children.find(c=>c.id===id)),type,field,description,prevDisplay:String(previous ?? '') || '（未入力）',newDisplay:String(next ?? '') || '（未入力）',restoreValue:previous ?? ''});
 const commit=(mutate,options={})=>{
  const target={date,officeId:office?.id},operationScope=scope;
  if(!target.officeId||loading||error||sandbox)return Promise.reject(new Error('記録の読込みが完了していないか、デモ表示中です。'));
  setBusy(value=>value+1);
  const pending=queue.current.catch(()=>{}).then(()=>cs({action:'commitDailyMutation',...target,mutate,...options,deriveRemarks:(messages,id,next)=>remarksText(messages,columns,next.dailyTable?.[id])}));queue.current=pending;
  return pending.then(value=>{if(scopeRef.current===operationScope){setReport(value.report);reportRef.current=value.report;}setNotice('保存しました');return value;}).catch(reason=>{setNotice('保存できませんでした。入力を残したまま再試行してください。');throw reason;}).finally(()=>setBusy(value=>Math.max(0,value-1)));
 };
 const saveResult=(id,patch,expected)=>commit(previous=>{
  assertExpectedResult(previous.results?.[id],expected);
  return patchResult(previous,id,{...patch,staffName});
 },{syncChildIds:[id],buildLogs:(previous,next)=>Object.keys(patch).filter(key=>JSON.stringify(previous.results?.[id]?.[key])!==JSON.stringify(next.results?.[id]?.[key])).map(key=>logEntry(id,key,({D:'通信本文',futurePlan:'今後の予定',isCompleted:'入力完了'})[key] || key,previous.results?.[id]?.[key],next.results?.[id]?.[key]))});
 const saveTable=(id,patch)=>commit(previous=>patchTable(previous,id,patch),{syncChildIds:[id],buildLogs:(previous,next)=>Object.keys(patch).filter(key=>previous.dailyTable?.[id]?.[key]!==next.dailyTable?.[id]?.[key]).map(key=>logEntry(id,key,key==='sentChecked'?'手動送信確認':key,previous.dailyTable?.[id]?.[key],next.dailyTable?.[id]?.[key],'tableRow'))});
 const saveMemo=(id,action,message)=>commit(previous=>mutateMemo(previous,id,action,message),{syncChildIds:[id],buildLogs:previous=>[logEntry(id,'messagesList',`メモ${{add:'追加',edit:'編集',delete:'削除'}[action]}`,previous.messages?.[id]?.find(m=>m.id===message.id)?.text || '',action==='delete'?'（削除）':message.text,'messagesList')]});
 const addMemo=(id,text,tag)=>saveMemo(id,'add',{id:crypto.randomUUID(),timestamp:new Date().toISOString(),included:true,staffName,text,tag:tag || null});
 const editMemo=(id,id2,text,tag)=>saveMemo(id,'edit',{id:id2,text,tag:tag || null});
 const deleteMemo=(id,id2)=>saveMemo(id,'delete',{id:id2});
 const saveGlobal=(patch,expected)=>commit(previous=>{
  for(const key of Object.keys(patch))if(expected&&JSON.stringify(previous.globalLog?.[key] ?? '')!==JSON.stringify(expected[key] ?? ''))throw new Error('日報が変更されています。入力を控えてから最新の内容を読み直してください。');
  return {...previous,globalLog:{...previous.globalLog,...patch,...(patch.programs?programPatch(patch.programs):{})}};
 },{buildLogs:(previous,next)=>Object.keys(patch).map(key=>logEntry('',key,'施設日報',JSON.stringify(previous.globalLog?.[key] ?? ''),JSON.stringify(next.globalLog?.[key] ?? ''),'globalLog'))});
 const addChildren=(selected,waitlist)=>commit(previous=>{
  const added=selected.filter(item=>!previous.children.some(c=>c.id===item.id));
  return {...previous,children:[...previous.children,...added.map(item=>({...item,isAbsent:false,isWaitlist:!!waitlist,timestamp:Date.now()}))],dailyTable:{...previous.dailyTable,...Object.fromEntries(added.map(item=>[item.id,{...previous.dailyTable?.[item.id],pickupLocation:item.defaultPickupLocation || ''}]))}};
 },{syncChildIds:selected.map(c=>c.id),buildLogs:(previous,next)=>next.children.filter(c=>!previous.children.some(old=>old.id===c.id)).map(c=>({...logEntry(c.id,'add','児童追加','未所属',labels[childStatus(c)],'add'),childName:childName(c)}))});
 const saveChild=(id,patch)=>commit(previous=>{
  if(!previous.children.some(c=>c.id===id))throw new Error('当日の一覧に児童が見つかりません。');
  let next=patchTable(previous,id,{transportTime:patch.transportTime,endTime:patch.endTime,pickupLocation:patch.pickupLocation,assignedStaff:patch.assignedStaff});
  next.children=previous.children.map(c=>c.id===id?{...c,isAbsent:patch.status==='absent',isWaitlist:patch.status==='waitlist'}:c);
  const result=previous.results?.[id] || {};
  if(patch.assignedStaff&&patch.assignedStaff!==previous.dailyTable?.[id]?.assignedStaff&&!checkHasGreeting(result.D || '',greetings)){
   const person=staff.find(s=>s.name===patch.assignedStaff||s.id===patch.assignedStaff)||{name:patch.assignedStaff};const greeting=findGreetingTemplateForStaff(person,greetings,staff);
   if(greeting?.trim())next=patchResult(next,id,{D:[greeting.trim(),(result.D || '').trim()].filter(Boolean).join('\n\n'),staffName:patch.assignedStaff});
  }
  return next;
 },{syncChildIds:[id],buildLogs:(previous,next)=>[logEntry(id,'daily','出欠・送迎・担当',`${labels[childStatus(previous.children.find(c=>c.id===id))]} ${JSON.stringify(previous.dailyTable?.[id] || {})}`,`${labels[patch.status]} ${JSON.stringify(next.dailyTable?.[id] || {})}`,'tableRow')]});
 const removeChild=id=>commit(previous=>({...previous,children:previous.children.filter(c=>c.id!==id)}),{logs:[logEntry(id,'remove','当日一覧から外す','所属','未所属','remove')]});
 const saveTags=async(nextTags,nextInserts,nextColumns)=>{await setDoc(doc(firestore,'meta','tag_settings'),{tags:nextTags,tagInsertTexts:nextInserts,tagColumnMap:nextColumns});setTags(nextTags);setInserts(nextInserts);setColumns(nextColumns);};
 const saveSettings=async(nextTags,nextInserts,nextColumns,words)=>{
  await runTransaction(firestore,async transaction=>{
   const reportId=`${office.id}_${date}`,snapshot=await transaction.get(doc(firestore,'reports',reportId));
   transaction.set(doc(firestore,'meta','tag_settings'),{tags:nextTags,tagInsertTexts:nextInserts,tagColumnMap:nextColumns});
   transaction.set(doc(firestore,'meta','ok_words'),{words});
   if(snapshot.exists()){
    const current=snapshot.data();
    for(const child of current.children || [])if(!child.isPlaceholder)transaction.set(doc(firestore,'children',child.id,'app_categories','書類管理','tree_communications',reportId),{notes:remarksText(current.messages?.[child.id] || [],nextColumns,current.dailyTable?.[child.id]),officeId:office.id},{merge:true});
   }
  });setTags(nextTags);setInserts(nextInserts);setColumns(nextColumns);setOkWords(words);
 };
 const saveGreeting=async(name,text)=>{await setDoc(doc(firestore,'meta','greeting_templates'),{[name]:text},{merge:true});setGreetings(previous=>({...previous,[name]:text}));};
 const saveOkWords=async words=>{await setDoc(doc(firestore,'meta','ok_words'),{words});setOkWords(words);};
 const addOkWord=word=>runTransaction(firestore,async transaction=>{const ref=doc(firestore,'meta','ok_words');const snap=await transaction.get(ref);transaction.set(ref,{words:[...new Set([...(snap.exists()?snap.data().words || []:[]),word])]});});
 const closeEditor=async()=>{await queue.current.catch(()=>{});const active=editorRef.current;if(active){try{await updateDoc(doc(firestore,'reports',active.reportId),{[`activeLocks.${active.id}`]:deleteField()});}catch{setNotice('編集ロックを解除できませんでした。期限後に解除されます。');}}setEditor(null);setDirty(false);};
 const openEditor=async(id,tab='memo')=>{
  if(busy||loading||error)return;setBusy(value=>value+1);
  try{const reportId=`${office.id}_${date}`;
   const success=await runTransaction(firestore,async transaction=>{const ref=doc(firestore,'reports',reportId);const snap=await transaction.get(ref);const lock=snap.exists()?snap.data().activeLocks?.[id]:null;if(lock?.expiresAt>Date.now()&&lock.userId!==user.uid)return false;transaction.set(ref,{activeLocks:{[id]:{userId:user.uid,userName:staffName,expiresAt:Date.now()+300000}}},{merge:true});return true;});
   if(!success)throw new Error('他のスタッフが入力中です。時間をおいて開き直してください。');setNotice('');setMemoTab(tab);setEditor({id,reportId});
  }catch(reason){setNotice(reason.message || '記録を開けませんでした。');}finally{setBusy(value=>value-1);}
 };
 useEffect(()=>{if(!editor)return;const timer=setInterval(()=>{void runTransaction(firestore,async transaction=>{const ref=doc(firestore,'reports',editor.reportId);const snap=await transaction.get(ref);const lock=snap.data()?.activeLocks?.[editor.id];if(lock?.userId===user?.uid)transaction.set(ref,{activeLocks:{[editor.id]:{...lock,expiresAt:Date.now()+300000}}},{merge:true});}).catch(()=>setNotice('編集ロックの更新に失敗しました。入力を控えて開き直してください。'));},120000);return()=>clearInterval(timer);},[editor,user?.uid]);
 const copyText=async text=>{if(!text.trim())throw new Error('コピーする本文がありません。');await copyToClipboard(text);setNotice('コピーしました。LINEで送信後、手動送信確認を付けてください。');};
 const copySingle=id=>{if(!report.results[id]?.D?.trim())throw new Error('コピーする本文がありません。');return copyText(`${childName(report.children.find(c=>c.id===id))}さん\n${report.results[id].D}`);};
 const copySelected=ids=>copyText(combinedCommunication(report.children,report.results,ids));
 const printDay=()=>printAllDocuments(report.children,report.results,report.summaryC,date,report.dailyTable,report.messages,report.globalLog,attendance,officeStaff,columns);
 const exportBackup=async range=>{
  await queue.current;const selectedDates=range==='all'?await cs({action:'getReportIndex',officeId:office.id}):exportDates(date,range);const rows=[];
  for(const day of selectedDates){const value=await cs({action:'getReport',date:day,officeId:office.id});if(value)rows.push(...backupRows(value,day,columns));}
  if(!rows.length)throw new Error('対象期間に児童の記録がありません。');
  const url=URL.createObjectURL(new Blob(['\uFEFF'+toCSV([BACKUP_HEADERS,...rows])],{type:'text/csv;charset=utf-8;'}));const link=document.createElement('a');link.href=url;link.download=`ツリー通信_${office.name}_${date}_${range}.csv`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice(`${rows.length}件を書き出しました。`);
 };
 const loadWeek=()=>Promise.all(Array.from({length:7},(_,i)=>offsetDate(date,-i-1)).map(async day=>({date:day,report:await cs({action:'getReport',date:day,officeId:office.id})})));
 const changeDate=value=>{if(!busy&&!editor){setDirty(false);setDate(value);}};
 const changeOffice=id=>{if(busy||editor)return;const target=offices.find(item=>item.id===id);setDirty(false);setOffice(target);localStorage.setItem('tree_tsushin_v2_selected_office',JSON.stringify(target));};
 const refresh=async()=>{const value=await cs({action:'getReport',date,officeId:office?.id});setReport(value?{...emptyReport(),...value}:emptyReport());setMasterChildren(await cs({action:'getMasterChildren'}));};
 const openModal=name=>{if(!busy&&!editor)setModal(name);},closeModal=()=>{setModal(null);setDirty(false);};
 const currentChild=editor?report.children.find(c=>c.id===editor.id):null;
 if(authLoading)return <main className="cw-loading">スタッフログインを確認しています…</main>;
 if(!user)return <Login />;
 return <ErrorBoundary><div className="communication-app">
  {error&&<div className="cw-error" role="alert">{error}<button onClick={()=>setReload(value=>value+1)}>再読み込み</button></div>}
  {sandbox&&<div className="cw-success">取込み後のデモ表示です。保存はしていません。<button className="cw-back" onClick={()=>setSandbox(null)}>保存済みの記録へ戻る</button></div>}
  <Workspace interactionBlocked={!!editor || !!modal} key={sandbox ? 'sandbox' : scope} initialView={sandbox ? 'operations' : 'record'} report={sandbox?.report || report} attendance={attendance} staff={officeStaff} office={sandbox?.office || office} offices={offices} date={sandbox?.date || date} staffName={staffName} columns={columns} loading={loading} busy={busy>0} disabled={!!error || !!sandbox} browserPreview={browserPreview} onDate={changeDate} onOffice={changeOffice} onEditor={openEditor} onModal={openModal} onSaveChild={saveChild} onRemoveChild={removeChild} onSaveTable={saveTable} onSaveGlobal={saveGlobal} onLoadWeek={loadWeek} onCopy={copySingle} onCopySelected={copySelected} onDirtyChange={setDirty} onLogout={()=>signOut(auth)}/>
  {editor&&currentChild&&createPortal(<div className="cw-editor-overlay"><MemoPanel key={`${scope}/${editor.id}`} child={currentChild} messages={report.messages[editor.id] || []} result={report.results[editor.id] || {}} tags={tags} tagInsertTexts={inserts} selectedDate={date} officeId={office?.id} officeName={office?.name} storageScope={user.uid} storageMode={browserPreview?'browser-preview':'emulator'} staffList={officeStaff} currentStaffName={staffName} activeTab={memoTab} setActiveTab={setMemoTab} onSave={addMemo} onUpdate={editMemo} onDelete={deleteMemo} onSaveTree={saveResult} onClose={closeEditor} onDirtyChange={setDirty} onShowHelpGuide={()=>setModal('help')} programTitle={report.globalLog.programTitle} programSummary={report.globalLog.programSummary} programs={report.globalLog.programs || []} greetingTemplates={greetings} onSaveTemplate={saveGreeting} okWords={okWords} onAddOkWord={addOkWord}/></div>,document.body)}
  <CalendarModal show={modal==='calendar'} onClose={closeModal} setSelectedDate={changeDate} selectedDate={date} existingReportDates={dates}/>
  <AddChildModal show={modal==='add'} onClose={closeModal} masterChildren={masterChildren} currentChildren={report.children} onAddChildren={addChildren} selectedDate={date} officeName={office?.name} onDirtyChange={setDirty}/>
  {modal==='attendance'&&<AttendanceModal onClose={closeModal} selectedDate={date} officeId={office?.id} officeName={office?.name} staffList={officeStaff} onSaved={patch=>setAttendance(previous=>({...previous,...patch}))} onDirtyChange={setDirty}/>}
  {modal==='settings'&&<SettingsModal onClose={closeModal} onDirtyChange={setDirty} tags={tags} tagInsertTexts={inserts} tagColumnMap={columns} onSaveTags={saveTags} onSaveSettings={saveSettings} okWords={okWords} onSaveOkWords={saveOkWords} greetingTemplates={greetings} onSaveGreetingTemplate={saveGreeting} currentStaffName={staffName} staffList={officeStaff} onOpenUpdateModal={()=>setModal('update')} onStartTour={step=>{setTourStep(step);setModal('tour');}}/>}
  <CSVImportModal tagColumnMap={columns} onDirtyChange={setDirty} show={modal==='csv'} onClose={closeModal} masterChildren={masterChildren} offices={offices} selectedOffice={office} selectedDate={date} cs={cs} user={user} currentStaffName={staffName} firestore={firestore} onRefresh={refresh} onImportSandbox={(targetDate,officeId,value)=>{setSandbox({date:targetDate,office:offices.find(item=>item.id===officeId),report:{...emptyReport(),...value}});setModal(null);}}/>
  <BackupImportModal tagColumnMap={columns} onDirtyChange={setDirty} show={modal==='restore'} onClose={closeModal} masterChildren={masterChildren} currentChildren={report.children} selectedDate={date} selectedOffice={office} cs={cs} onRefresh={refresh}/>
  <ExportModal onDirtyChange={setDirty} show={modal==='export'} onClose={closeModal} selectedDate={date} children={report.children} results={report.results} summaryC={report.summaryC} selectedOffice={office} staffList={officeStaff} dailyTable={report.dailyTable} dailyMessages={report.messages} globalLog={report.globalLog} attendance={attendance} onExportBackup={exportBackup} onPrintDay={printDay} tagColumnMap={columns}/>
  <LogModal show={modal==='logs'} onClose={closeModal} logs={logs} selectedDate={date} selectedOffice={office}/>
  {modal==='help'&&<WorkspaceHelp onClose={closeModal} browserPreview={browserPreview}/>}
  <UpdateModal show={modal==='update'} onClose={closeModal} onAcknowledge={()=>localStorage.setItem('tree_tsushin_v2_last_seen_version',APP_VERSION)} onStartTour={step=>{setTourStep(step);setModal('tour');}}/>
  {modal==='tour'&&<WorkspaceHelp onClose={closeModal} mode='tour' startStepId={tourStep} browserPreview={browserPreview}/>}
  {notice&&!editor&&<div className="cw-toast" role="status"><span>{notice}</span><button aria-label="通知を閉じる" onClick={()=>setNotice('')}>×</button></div>}
  {importLock&&<div className="cw-blocker" role="alert"><h2>CSV取込み中</h2><p>{importLock.userName || 'スタッフ'}の取込みが完了するまでお待ちください。</p></div>}
 </div></ErrorBoundary>;
}

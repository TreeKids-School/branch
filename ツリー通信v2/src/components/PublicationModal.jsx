import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Eye, EyeOff, RefreshCw, X } from 'lucide-react';
import { previewExpiry } from '../utils/lineDelivery';
import { publicationLabel, publicationReason } from '../utils/publication';
import './WorkflowModals.css';
import './PublicationModal.css';

const formatTime = value => { const date = new Date(value); return Number.isFinite(date.getTime()) ? date.toLocaleString('ja-JP') : ''; };
const uncertainError = error => ['unavailable','deadline-exceeded','unknown','internal','cancelled'].includes(error.code);
function PublicationText({ body, futurePlan }) {
  return <div className="publication-text"><section><h5>ツリー通信</h5><p>{body || '本文なし'}</p></section><section><h5>今後の予定</h5><p>{futurePlan || '記載なし'}</p></section></div>;
}
function GuardianCount({ count }) {
  return count === 0 ? <p className="publication-no-guardian">今は閲覧できる保護者の紐付けがありません。公開はできますが、親子の紐付けができるまで保護者画面には表示されません。</p> : <p className="publication-guardian-count">{Number.isInteger(count) ? `紐付いた保護者 ${count}名が閲覧できます。` : '予約V2でこの児童に紐付いた保護者が閲覧できます。'}</p>;
}

export default function PublicationModal({ office, date, rows = [], loading, loadError, onRequest, onRefresh, onClose }) {
  const [selected,setSelected]=useState([]),[search,setSearch]=useState(''),[filter,setFilter]=useState('all');
  const [preview,setPreview]=useState(null),[withdraw,setWithdraw]=useState(null),[confirmed,setConfirmed]=useState(false);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[uncertain,setUncertain]=useState(false),[now,setNow]=useState(Date.now());
  const dialogRef=useRef(null),busyRef=useRef(false),closeRef=useRef(onClose),attemptRef=useRef(null);
  closeRef.current=onClose;
  const visible=rows.filter(row=>(row.childName || '').includes(search)&&(filter==='all'||row.state===filter));
  const selectedRows=rows.filter(row=>selected.includes(row.childId)&&row.canPublish);
  const expiresAt=preview?previewExpiry(preview.expiresAt):0;
  const expired=!!preview&&(!Number.isFinite(expiresAt)||expiresAt<=now);
  useEffect(()=>{const timer=preview?setInterval(()=>setNow(Date.now()),1000):null;return()=>{if(timer)clearInterval(timer);};},[preview]);
  useEffect(()=>{
    const previous=document.activeElement;dialogRef.current?.querySelector('button')?.focus();
    const keydown=event=>{
      if(event.key==='Escape'&&!busyRef.current)closeRef.current();
      if(event.key!=='Tab')return;
      const controls=[...dialogRef.current.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),summary,[tabindex="0"]')].filter(element=>element.getClientRects().length);
      const first=controls[0],last=controls.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    };
    document.addEventListener('keydown',keydown);return()=>{document.removeEventListener('keydown',keydown);if(previous instanceof HTMLElement)previous.focus();};
  },[]);
  const run=async action=>{
    if(busyRef.current)return;busyRef.current=true;setBusy(true);setError('');setNotice('');
    try{await action();}catch(reason){setError(reason.message || '操作を完了できませんでした。内容を確認して再試行してください。');}
    finally{busyRef.current=false;setBusy(false);}
  };
  const reset=()=>{setPreview(null);setWithdraw(null);setConfirmed(false);setUncertain(false);attemptRef.current=null;setError('');};
  const openPreview=()=>run(async()=>{const value=await onRequest('preview',{childIds:selectedRows.map(row=>row.childId)});reset();setPreview(value);setNow(Date.now());});
  const openWithdraw=row=>{reset();setWithdraw({childId:row.childId,childName:row.childName,revision:row.revision,published:row.published});};
  const publish=()=>run(async()=>{
    if(!preview||!confirmed||(expired&&!uncertain))return;
    if(!attemptRef.current)attemptRef.current={action:'publish',payload:{previewId:preview.previewId,requestId:crypto.randomUUID(),confirmed:true}};
    try{const value=await onRequest(attemptRef.current.action,attemptRef.current.payload);reset();setSelected([]);setNotice(`${value.count || 0}名のツリー通信を「日々のあしあと」へ公開しました。LINEへの送信は行っていません。`);}
    catch(reason){setUncertain(uncertainError(reason));throw reason;}
  });
  const unpublish=()=>run(async()=>{
    if(!withdraw||!confirmed)return;
    if(!attemptRef.current)attemptRef.current={action:'unpublish',payload:{childId:withdraw.childId,expectedRevision:withdraw.revision,requestId:crypto.randomUUID(),confirmed:true}};
    try{await onRequest(attemptRef.current.action,attemptRef.current.payload);const name=withdraw.childName;reset();setNotice(`${name}さんのツリー通信の公開を取り消しました。保存済みの原文は残っています。`);}
    catch(reason){setUncertain(uncertainError(reason));throw reason;}
  });
  return createPortal(<div className="workflow-overlay publication-overlay"><section className="workflow-dialog publication-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="publication-title">
    <header className="workflow-header"><div><p className="workflow-eyebrow">{office?.name} · {date}</p><h2 id="publication-title">保護者へ公開</h2><p>「日々のあしあと」に、確認したツリー通信を届けます。</p></div><button className="workflow-icon" disabled={busy} onClick={onClose} aria-label="公開画面を閉じる"><X size={22}/></button></header>
    <p className="publication-notice">本文の保存・入力完了・送信済みチェック・LINE送信だけでは公開しません。公開した本文と今後の予定は、再公開するまで変わりません。</p>
    <div className="workflow-body">
      {(error||loadError)&&<p className="workflow-error" role="alert">{error||loadError}</p>}{notice&&<p className="workflow-success" role="status">{notice}</p>}
      {preview?<>
        <button className="workflow-secondary" disabled={busy} onClick={reset}><ArrowLeft size={17}/>対象の選択へ戻る</button><h3 className="publication-section-title">公開する{preview.items?.length || 0}名の内容を確認</h3>
        {(preview.items || []).map(item=><article className="publication-card" key={item.childId}><header><h4>{item.childName}</h4><span>{item.state==='changed'?'再公開する内容':'今回公開する内容'}</span></header><GuardianCount count={item.guardianCount}/><PublicationText body={item.body} futurePlan={item.futurePlan}/></article>)}
        {!!preview.excluded?.length&&<section className="publication-excluded"><h4>今回の公開に含まれない児童</h4>{preview.excluded.map(item=><p key={item.childId}><strong>{rows.find(row=>row.childId===item.childId)?.childName || item.childName || '対象児童'}</strong>：{(item.reasons || []).map(publicationReason).join('・')}</p>)}</section>}
        {expired&&!uncertain&&<p className="workflow-error">確認画面の有効期限が切れました。対象の選択へ戻り、最新の本文で確認してください。</p>}
      </>:withdraw?<>
        <button className="workflow-secondary" disabled={busy} onClick={reset}><ArrowLeft size={17}/>一覧へ戻る</button><h3 className="publication-section-title">{withdraw.childName}さんの公開を取り消す</h3><p className="publication-notice">下の公開内容を保護者の「日々のあしあと」から非表示にします。スタッフが保存した原文と、すでにLINEで送った文章は残ります。</p><article className="publication-card"><header><h4>現在の公開内容</h4><span>{formatTime(withdraw.published?.publishedAt)}</span></header><PublicationText body={withdraw.published?.body} futurePlan={withdraw.published?.futurePlan}/></article>
      </>:<>
        <div className="publication-toolbar"><label>児童を検索<input value={search} disabled={busy} onChange={event=>setSearch(event.target.value)} placeholder="児童名"/></label><label>公開状態<select value={filter} disabled={busy} onChange={event=>setFilter(event.target.value)}><option value="all">すべて</option><option value="unpublished">未公開</option><option value="changed">変更あり・未反映</option><option value="published">保護者公開済み</option></select></label><button className="workflow-secondary" disabled={busy||loading} onClick={()=>run(onRefresh)}><RefreshCw size={16}/>状況を更新</button></div>
        <div className="publication-select-actions"><button className="workflow-secondary" disabled={busy||loading||!visible.some(row=>row.canPublish)} onClick={()=>setSelected(values=>[...new Set([...values,...visible.filter(row=>row.canPublish).map(row=>row.childId)])])}>表示中の公開できる児童を選択</button><button className="workflow-secondary" disabled={busy||!selected.length} onClick={()=>setSelected([])}>選択を解除</button></div>
        {loading&&!rows.length?<p role="status">保存済み本文と公開状況を確認しています…</p>:!visible.length?<p className="workflow-empty">対象の児童がいません。</p>:visible.map(row=><article className="publication-card" key={row.childId}><header><label className="publication-child-select"><input type="checkbox" checked={selected.includes(row.childId)&&row.canPublish} disabled={busy||!row.canPublish} onChange={()=>setSelected(values=>values.includes(row.childId)?values.filter(id=>id!==row.childId):[...values,row.childId])}/><strong>{row.childName}</strong></label><span className={`publication-state ${row.state}`}>{publicationLabel(row.state)}</span></header><GuardianCount count={row.guardianCount}/>
          {row.state==='changed'&&<p className="publication-changed">公開後に保存本文が変更されています。保護者には以前に公開した内容が表示されています。</p>}
          <details className="publication-details"><summary>保存済みの本文・今後の予定を確認</summary><PublicationText body={row.body} futurePlan={row.futurePlan}/></details>
          {row.published&&<details className="publication-details"><summary>現在、保護者に見えている内容</summary><p className="workflow-help">公開日時 {formatTime(row.published.publishedAt)} · 第{row.published.revision}版</p><PublicationText body={row.published.body} futurePlan={row.published.futurePlan}/></details>}
          {!!row.reasons?.length&&<p className="publication-reasons">{row.reasons.map(publicationReason).join('・')}</p>}
          {row.published&&<div className="publication-row-actions"><button className="workflow-secondary" disabled={busy} onClick={()=>openWithdraw(row)}><EyeOff size={16}/>公開を取り消す</button></div>}
        </article>)}
      </>}
      {uncertain&&<p className="workflow-error">操作結果をまだ確認できません。同じ要求として再試行し、重複した公開・取消を防ぎます。</p>}
    </div>
    <footer className="workflow-footer publication-footer">{preview||withdraw?<><label className="publication-confirm"><input type="checkbox" checked={confirmed} disabled={busy||preview&&expired&&!uncertain} onChange={event=>setConfirmed(event.target.checked)}/>{withdraw?'対象児童と、取り消す公開内容を確認しました':'対象児童・公開本文・今後の予定を確認しました'}</label><button className={withdraw?'workflow-secondary publication-withdraw':'workflow-primary'} disabled={busy||!confirmed||preview&&(!(preview.items?.length)||expired&&!uncertain)} onClick={withdraw?unpublish:publish}>{withdraw?<EyeOff size={18}/>:<Eye size={18}/>} {busy?'処理中…':uncertain?'同じ要求で再試行':withdraw?'この通信の公開を取り消す':'確認した内容を保護者へ公開'}</button></>:<><span>{selectedRows.length}名を公開対象に選択</span><button className="workflow-primary" disabled={busy||loading||!selectedRows.length} onClick={openPreview}><Eye size={18}/>{busy?'確認画面を準備中…':'公開前の内容を確認する'}</button></>}</footer>
  </section></div>,document.body);
}

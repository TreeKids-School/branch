import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, CheckCircle2, RefreshCw, Send, X } from 'lucide-react';
import { deliveryReason, isLineAccepted, lineDeliveryStatus, previewExpiry } from '../utils/lineDelivery';
import './LineDeliveryModal.css';

const timeLabel = value => { const time = typeof value === 'number' ? value : Date.parse(value); return Number.isFinite(time) ? new Date(time).toLocaleString('ja-JP') : ''; };
const recipientName = recipient => [recipient.displayName || '連携済みの保護者', recipient.relation].filter(Boolean).join(' · ');

export default function LineDeliveryModal({ office, date, rows = [], loading, loadError, onRequest, onRefresh, onClose }) {
  const [selected, setSelected] = useState([]), [search, setSearch] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [preview, setPreview] = useState(null), [confirmed, setConfirmed] = useState(false), [now, setNow] = useState(Date.now());
  const [sendUncertain, setSendUncertain] = useState(false);
  const dialogRef = useRef(null), sendAttempt = useRef(null), retryAttempts = useRef(new Map()), busyRef = useRef(false);
  const closeRef=useRef(onClose);closeRef.current=onClose;
  const selectedRows = rows.filter(row => selected.includes(row.childId) && row.canSend);
  const visible = rows.filter(row => (row.childName || '').includes(search));
  const expiresAt = preview ? previewExpiry(preview.expiresAt) : 0;
  const expired = !!preview && (!Number.isFinite(expiresAt) || expiresAt <= now);
  useEffect(() => { const timer = preview ? setInterval(() => setNow(Date.now()), 1000) : null; return () => { if (timer) clearInterval(timer); }; }, [preview]);
  useEffect(() => {
    const previous = document.activeElement;
    dialogRef.current?.querySelector('button')?.focus();
    const keydown = event => {
      if (event.key === 'Escape' && !busyRef.current) closeRef.current();
      if (event.key !== 'Tab') return;
      const controls = [...dialogRef.current.querySelectorAll('button:not(:disabled),input:not(:disabled),summary,[tabindex="0"]')].filter(element => element.getClientRects().length);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); if (previous instanceof HTMLElement) previous.focus(); };
  }, []);
  const run = async action => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(''); setNotice('');
    try { await action(); } catch (reason) { setError(reason.message || '操作を完了できませんでした。内容を確認して再試行してください。'); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const toggle = id => setSelected(values => values.includes(id) ? values.filter(value => value !== id) : [...values, id]);
  const review = row => run(async () => {
    await onRequest('review', { childId: row.childId, contentHash: row.contentHash, confirmed: true });
    setNotice(`${row.childName}さんの保存済み本文を確認済みにしました。まだLINEには送信していません。`);
  });
  const makePreview = () => run(async () => {
    const value = await onRequest('preview', { childIds: selectedRows.map(row => row.childId) });
    setPreview(value); setConfirmed(false); setSendUncertain(false); setNow(Date.now()); sendAttempt.current = null;
  });
  const send = () => run(async () => {
    if (!preview || !confirmed || (expired && !sendAttempt.current)) return;
    if (!sendAttempt.current) sendAttempt.current = { previewId: preview.previewId, requestId: crypto.randomUUID(), confirmed: true };
    try {
      const result = await onRequest('send', sendAttempt.current);
      setNotice(`${result.count ?? result.jobIds?.length ?? 0}件を送信待ちに登録しました。LINEの受付状況は下の一覧に反映されます。`);
      setPreview(null); setConfirmed(false); setSelected([]); setSendUncertain(false); sendAttempt.current = null;
    } catch (reason) { setSendUncertain(['unavailable','deadline-exceeded','unknown','internal','cancelled'].includes(reason.code)); throw reason; }
  });
  const retry = job => run(async () => {
    if (!retryAttempts.current.has(job.jobId)) retryAttempts.current.set(job.jobId, crypto.randomUUID());
    await onRequest('retry', { jobId: job.jobId, requestId: retryAttempts.current.get(job.jobId), confirmed: true });
    retryAttempts.current.delete(job.jobId); setNotice('選択した失敗分を再試行待ちにしました。受付済みの宛先には再送しません。');
  });
  return createPortal(<div className="line-delivery-backdrop"><section className="line-delivery" role="dialog" aria-modal="true" aria-labelledby="line-delivery-title" ref={dialogRef}>
    <header><div><small>{office?.name} · {date}</small><h2 id="line-delivery-title">ツリー通信をLINEで送る</h2></div><button disabled={busy} onClick={onClose} aria-label="LINE送信画面を閉じる"><X size={22}/></button></header>
    <p className="line-delivery-note">予約V2で紐付いた保護者のLINEへ送ります。本文の「内容確認済み」と送信操作は別です。「LINE受付済」は既読や配達の確認ではありません。</p>
    <div className="line-delivery-body">
      {(error || loadError) && <div className="line-delivery-error" role="alert">{error || loadError}</div>}
      {notice && <p className="line-delivery-success" role="status">{notice}</p>}
      {preview ? <>
        <button className="line-delivery-back" disabled={busy} onClick={() => { setPreview(null); setConfirmed(false); setSendUncertain(false); sendAttempt.current = null; }}><ArrowLeft size={17}/>対象の選択へ戻る</button>
        <h3>送信前に宛先と本文を確認</h3><p className="line-delivery-hint">児童{preview.items?.length || 0}名 · 送信先のべ{(preview.items || []).reduce((total, item) => total + (item.recipients?.length || 0), 0)}件</p>
        {(preview.items || []).map(item => <section className="line-delivery-preview" key={item.childId}><h4>{item.childName}</h4><div className="line-delivery-recipients"><strong>送信先</strong>{(item.recipients || []).map(recipient => <span key={recipient.recipientId}>{recipientName(recipient)}</span>)}</div>{!!item.excludedRecipients?.length&&<div className="line-delivery-excluded"><strong>今回送れない保護者</strong>{item.excludedRecipients.map(recipient=><p key={recipient.recipientId}>{recipientName(recipient)}：{deliveryReason(recipient.reason)}</p>)}</div>}<pre>{item.text}</pre></section>)}
        {!!preview.excluded?.length && <div className="line-delivery-excluded"><h4>今回の送信対象に含まれない児童</h4>{preview.excluded.map(item => <p key={item.childId}><strong>{rows.find(row => row.childId === item.childId)?.childName || item.childName || '対象児童'}</strong>：{(item.reasons || []).map(deliveryReason).join('・')}</p>)}</div>}
        {expired && !sendUncertain && <p className="line-delivery-error">確認画面の有効期限が切れました。対象の選択へ戻り、最新の宛先と本文を確認してください。</p>}
        {sendUncertain && <p className="line-delivery-error">送信要求の結果をまだ確認できません。同じ要求として再試行し、二重登録を防ぎます。</p>}
      </> : <>
        <div className="line-delivery-toolbar"><label>児童を検索<input value={search} disabled={busy} onChange={event => setSearch(event.target.value)} placeholder="児童名"/></label><button disabled={busy || loading} onClick={() => run(onRefresh)}><RefreshCw size={17}/>状況を更新</button></div>
        <p className="line-delivery-hint">保存済みの本文を開いて確認すると、送信対象に選べます。本文を変更した場合は再確認が必要です。</p>
        <div className="line-delivery-select-all"><button disabled={busy || loading || !rows.some(row => row.canSend)} onClick={() => setSelected(rows.filter(row => row.canSend).map(row => row.childId))}>確認済み・送信可能な児童を選択</button><button disabled={busy || !selected.length} onClick={() => setSelected([])}>選択を解除</button></div>
        {loading && !rows.length ? <p role="status">宛先と送信状況を確認しています…</p> : !visible.length ? <p className="line-delivery-empty">対象の児童がいません。</p> : visible.map(row => <article className="line-delivery-child" key={row.childId}>
          <div className="line-delivery-child-heading"><label><input type="checkbox" checked={selected.includes(row.childId) && row.canSend} disabled={busy || !row.canSend} onChange={() => toggle(row.childId)}/><strong>{row.childName}</strong><span>送信対象</span></label><span className={row.review?.current ? 'is-reviewed' : ''}>{row.review?.current ? '内容確認済み' : '内容を確認'}</span></div>
          <details className="line-delivery-content"><summary>保存済みの本文を開く</summary><pre>{row.text || row.body || '本文は未入力です。'}</pre><label className="line-delivery-review"><input type="checkbox" checked={!!row.review?.current} disabled={busy || !row.canReview || row.review?.current} onChange={event => { if (event.target.checked) review(row); }}/>{row.review?.current ? 'この本文は内容確認済みです' : 'この本文の内容を確認しました'}</label>{row.review?.reviewedAt && <small>確認日時 {timeLabel(row.review.reviewedAt)}</small>}</details>
          <div className="line-delivery-recipients"><strong>紐付いている保護者</strong>{row.recipients?.length ? row.recipients.map(recipient => <div key={recipient.recipientId}><span>{recipientName(recipient)}</span>{!recipient.eligible && <small>{deliveryReason(recipient.reason)}</small>}</div>) : <span>送信できる保護者の紐付けがありません</span>}</div>
          {!!row.reasons?.length && <p className="line-delivery-reasons">{row.reasons.map(deliveryReason).join('・')}</p>}
          {!!row.deliveries?.length && <div className="line-delivery-jobs">{row.deliveries.map(job => <div className={isLineAccepted(job) ? 'is-accepted' : ''} key={job.jobId}><div><strong>{lineDeliveryStatus(job.status)}</strong><span>{recipientName(row.recipients?.find(recipient => recipient.recipientId === job.recipientId) || {})}</span>{job.acceptedAt && <small>{timeLabel(job.acceptedAt)}</small>}{job.errorCode && <small>{deliveryReason(job.errorCode)}</small>}</div>{job.retryable && <button disabled={busy} onClick={() => retry(job)}>この失敗分を再試行</button>}</div>)}</div>}
        </article>)}
      </>}
    </div>
    <footer>{preview ? <><label className="line-delivery-confirm"><input type="checkbox" checked={confirmed} disabled={busy || expired && !sendUncertain} onChange={event => setConfirmed(event.target.checked)}/>上記の宛先と本文を確認しました</label><button className="line-delivery-primary" disabled={busy || !confirmed || !(preview.items?.length) || expired && !sendUncertain} onClick={send}><Send size={18}/>{busy ? '送信要求を処理中…' : sendUncertain ? '同じ送信要求で再試行' : '確認した通信を一斉送信'}</button></> : <><span>{selectedRows.length}名を送信対象に選択</span><button className="line-delivery-primary" disabled={busy || loading || !selectedRows.length} onClick={makePreview}><CheckCircle2 size={18}/>{busy ? '処理中…' : '宛先と本文を確認する'}</button></>}</footer>
  </section></div>, document.body);
}

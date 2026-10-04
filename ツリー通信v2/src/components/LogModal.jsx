import React, { useState } from 'react';
import { X, Copy, Check } from 'lucide-react';
import './WorkflowModals.css';

export default function LogModal({ show, onClose, logs = [], selectedOffice, selectedDate }) {
    const [copiedId, setCopiedId] = useState(null);
    const [filterChildId, setFilterChildId] = useState('');
    const [copyError, setCopyError] = useState('');
    const children = Array.from(new Map(logs.filter(log => log.childId).map(log => [log.childId, { id: log.childId, name: log.childName }])).values());
    const filtered = filterChildId ? logs.filter(log => log.childId === filterChildId) : logs;
    if (!show) return null;
    const copy = async log => {
        setCopyError(''); setCopiedId(null);
        const text = typeof log.restoreValue === 'string' ? log.restoreValue : JSON.stringify(log.restoreValue ?? '', null, 2);
        try { await navigator.clipboard.writeText(text); setCopiedId(log.id); }
        catch { setCopyError('コピーできませんでした。「変更前」の内容を開いて、文字を選択してコピーしてください。'); }
    };
    const comparison = (label, value) => <div><h4>{label}</h4>{String(value || '').length > 220 ? <details><summary>{String(value).slice(0,70)}… 全文を読む</summary><p>{value}</p></details> : <p>{value || '（空欄）'}</p>}</div>;
    return <div className="workflow-overlay" onClick={onClose}><section className="workflow-dialog" role="dialog" aria-modal="true" aria-labelledby="history-title" onClick={e => e.stopPropagation()}>
      <header className="workflow-header"><div><p className="workflow-eyebrow">ツリー通信v2 / 記録を確認</p><h2 id="history-title">変更履歴</h2><p>この日の変更履歴。変更前の内容をコピーして確認できます。</p></div><button className="workflow-icon" onClick={onClose} aria-label="変更履歴を閉じる"><X/></button></header>
      <div className="workflow-context">{selectedOffice?.name || '選択中の事業所'} · {selectedDate || '選択中の日付'}</div>
      <div className="workflow-body"><label className="workflow-field">表示する児童<select value={filterChildId} onChange={e => setFilterChildId(e.target.value)}><option value="">全員 · {logs.length}件</option>{children.map(child => <option value={child.id} key={child.id}>{child.name}</option>)}</select></label>
        {copyError && <p role="alert" className="workflow-error">{copyError}</p>}
        {filtered.length === 0 ? <p className="workflow-empty">{logs.length ? 'この児童の変更履歴はありません。' : 'この日の変更履歴はまだありません。'}</p> : filtered.map(log => <article className="history-card" key={log.id}>
          <div className="history-meta"><time>{log.timestamp ? new Date(log.timestamp).toLocaleString('ja-JP') : ''}</time><span>{log.staffName}</span></div>
          <h3><strong>{log.childName || '日誌'}</strong> · {log.description}</h3>
          <div className="history-comparison">{comparison('変更前', log.prevDisplay)}{comparison('変更後', log.newDisplay)}</div>
          <footer><button className="workflow-secondary" onClick={() => copy(log)}>{copiedId === log.id ? <Check size={18}/> : <Copy size={18}/>}<span role="status">{copiedId === log.id ? '変更前の内容をコピーしました' : '変更前の内容をコピー'}</span></button></footer>
        </article>)}
      </div><footer className="workflow-footer"><p>コピーだけでは現在の記録は変更されません。</p><div className="workflow-actions"><button className="workflow-secondary" onClick={onClose}>業務へ戻る</button></div></footer>
    </section></div>;
}

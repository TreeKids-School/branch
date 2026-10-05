import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '../firebase';
import { ArrowLeft, Search, X } from 'lucide-react';
import './LegacyArchiveModal.css';

const text = value => typeof value === 'string' ? value : '';
const names = { D: '通信本文', tree_comm_text: '通信本文', futurePlan: '今後の予定', future_plan: '今後の予定', text: '本文', externalInfo: '記録', notice: '特記事項', activities: '共有事項', programTitle: 'プログラム', programSummary: 'プログラムの内容' };
function readableSections(source) {
  const sections = [];
  const add = (value, title) => {
    if (!value || typeof value !== 'object') return;
    const fields = Object.entries(names).filter(([key]) => text(value[key]).trim()).map(([key, label]) => ({ label, text: value[key] }));
    if (fields.length) sections.push({ title, fields });
  };
  add(source, source.name || source.childName || '記録');
  add(source.globalLog, '施設日報');
  const children = Array.isArray(source.children) ? source.children : [];
  const childName = id => { const child = children.find(value => value.id === id); return child?.name || [child?.lastName, child?.firstName].filter(Boolean).join(' ') || id; };
  for (const [id, value] of Object.entries(source.results || {})) add(value, childName(id));
  for (const [id, values] of Object.entries(source.messages || {})) {
    if (!Array.isArray(values)) continue;
    const fields = values.filter(value => text(value.text).trim()).map(value => ({ label: ['スタッフメモ', value.staffName, Array.isArray(value.tag) ? value.tag.join('・') : value.tag].filter(Boolean).join(' · '), text: value.text }));
    if (fields.length) sections.push({ title: childName(id), fields });
  }
  return sections;
}

export default function LegacyArchiveModal({ onClose }) {
  const [items, setItems] = useState([]), [count, setCount] = useState(0), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [kind, setKind] = useState(''), [date, setDate] = useState(''), [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null), [record, setRecord] = useState(null), [detailLoading, setDetailLoading] = useState(false), [detailError, setDetailError] = useState('');
  const [reload, setReload] = useState(0);
  const dialog = useRef(null);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    getDoc(doc(firestore, 'meta', 'migration_unresolved_index')).then(snapshot => {
      if (!active) return;
      const value = snapshot.exists() ? snapshot.data() : {};
      setItems(Array.isArray(value.items) ? value.items : []); setCount(value.count || value.items?.length || 0);
    }).catch(reason => { if (active) setError(reason.message || '旧データの一覧を取得できませんでした。'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reload]);
  useEffect(() => {
    if (!selected) { setRecord(null); return; }
    let active = true;
    setRecord(null); setDetailError(''); setDetailLoading(true);
    getDoc(doc(firestore, 'legacyArchive', selected.archiveId)).then(snapshot => {
      if (!active) return;
      if (!snapshot.exists()) throw new Error('選択した旧データが見つかりません。');
      setRecord(snapshot.data());
    }).catch(reason => { if (active) setDetailError(reason.message || '原文を取得できませんでした。'); }).finally(() => { if (active) setDetailLoading(false); });
    return () => { active = false; };
  }, [selected]);
  useEffect(() => {
    const previous = document.activeElement;
    dialog.current?.querySelector('button')?.focus();
    const keys = event => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const controls = [...dialog.current.querySelectorAll('button:not(:disabled),input,select,summary,[tabindex="0"]')];
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keys);
    return () => { document.removeEventListener('keydown', keys); if (previous instanceof HTMLElement) previous.focus(); };
  }, [onClose]);
  const kinds = [...new Set(items.map(item => item.kind).filter(Boolean))].sort();
  const visible = items.filter(item => (!kind || item.kind === kind) && (!date || String(item.date || '').startsWith(date)) && (!search.trim() || [item.label, item.sourcePath, item.reason, item.date].join(' ').toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())));
  const source = record?.sourceData && typeof record.sourceData === 'object' ? record.sourceData : {};
  const sections = useMemo(() => readableSections(source), [record]);
  return createPortal(<div className="legacy-archive-backdrop"><section className="legacy-archive" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="legacy-archive-title">
    <header><div><small>管理者 · 読取り専用</small><h2 id="legacy-archive-title">移行した旧データ・照合保留</h2></div><button onClick={onClose} aria-label="旧データの確認を閉じる"><X size={22}/></button></header>
    <p className="legacy-archive-note">コピー済みの原文を確認する画面です。照合が未確定の記録は当日の一覧に混ぜていません。ここで開いても統合・修正・公開は行いません。</p>
    <div className={`legacy-archive-layout${selected ? ' has-selection' : ''}`}>
      <aside><div className="legacy-archive-filters"><label><Search size={16}/>名称・本文以外の情報で検索<input aria-label="旧データを検索" value={search} onChange={event => setSearch(event.target.value)} placeholder="名称・元の保存先・理由"/></label><label>データ種別<select aria-label="データ種別" value={kind} onChange={event => setKind(event.target.value)}><option value="">すべて</option>{kinds.map(value => <option key={value}>{value}</option>)}</select></label><label>記録日<input aria-label="記録日" type="date" value={date} onChange={event => setDate(event.target.value)}/></label></div>
        <p className="legacy-archive-count">照合保留 {count}件 · 表示 {visible.length}件</p>
        {loading ? <p role="status">一覧を読み込んでいます…</p> : error ? <div role="alert"><p>{error}</p><button onClick={() => setReload(value => value + 1)}>再読み込み</button></div> : !items.length ? <p>照合保留の記録はありません。</p> : !visible.length ? <p>条件に合う記録はありません。</p> : <div className="legacy-archive-list">{visible.map(item => <button key={item.archiveId} aria-pressed={selected?.archiveId === item.archiveId} onClick={() => setSelected(item)}><strong>{item.label || item.date || item.kind || '旧データ'}</strong><span>{item.date || '日付なし'} · {item.kind}</span><small>{item.reason || '対応関係の確認が必要です'}</small></button>)}</div>}
      </aside>
      <main><button className="legacy-archive-back" onClick={() => setSelected(null)}><ArrowLeft size={18}/>一覧に戻る</button>{!selected ? <div className="legacy-archive-empty">一覧から選ぶと、原文を1件ずつ取得して表示します。</div> : detailLoading ? <p role="status">原文を読み込んでいます…</p> : detailError ? <div role="alert"><p>{detailError}</p><button onClick={() => setSelected({ ...selected })}>再読み込み</button></div> : record && <>
        <h3>{selected.label || selected.date || '旧データの原文'}</h3><dl><dt>元の保存先</dt><dd>{record.sourcePath || selected.sourcePath}</dd><dt>元データの更新日時</dt><dd>{text(record.sourceUpdatedAt) || '記録なし'}</dd><dt>照合保留の理由</dt><dd>{record.reason || selected.reason || '対応関係の確認が必要です'}</dd></dl>
        {sections.map((section, index) => <section className="legacy-archive-text" key={index}><h4>{section.title}</h4>{section.fields.map((field, fieldIndex) => <article key={fieldIndex}><strong>{field.label}</strong><p>{field.text}</p></article>)}</section>)}
        <details className="legacy-archive-raw"><summary>{sections.length ? 'その他の項目を含む原文データ' : '原文データを開く'}</summary><pre>{JSON.stringify(source, null, 2)}</pre></details>
      </>}</main>
    </div>
  </section></div>, document.body);
}

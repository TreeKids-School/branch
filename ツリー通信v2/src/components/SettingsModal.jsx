import React, { useState, useEffect } from 'react';
import { X, Save, Plus, Trash2, Check } from 'lucide-react';
import { UPDATE_HISTORY, APP_VERSION } from '../app_constants';
import './WorkflowModals.css';

export default function SettingsModal({ onClose, tags = [], tagInsertTexts = {}, tagColumnMap = {}, onSaveTags, onSaveSettings, okWords = [], onSaveOkWords, onOpenUpdateModal, onStartTour, initialTab = 'greetings', greetingTemplates = {}, onSaveGreetingTemplate, currentStaffName = '', staffList = [], onDirtyChange }) {
    const [activeTab, setActiveTab] = useState(initialTab);
    const [rows, setRows] = useState(() => tags.map((name, index) => ({ id: `tag-${index}`, name, text: tagInsertTexts[name] || '', column: tagColumnMap[name] || '' })));
    const [words, setWords] = useState(okWords);
    const [newWord, setNewWord] = useState('');
    const [staff, setStaff] = useState(currentStaffName || staffList[0]?.name || 'スタッフ');
    const [greetings, setGreetings] = useState({ ...greetingTemplates });
    const [savedGreetings, setSavedGreetings] = useState({ ...greetingTemplates });
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const greetingDirty = Object.keys(greetings).some(name => (greetings[name] || '') !== (savedGreetings[name] || ''));
    const mayLeave = () => !(dirty || greetingDirty || newWord.trim()) || window.confirm('保存していない変更があります。変更を破棄して閉じますか？');
    useEffect(() => { onDirtyChange?.(dirty || greetingDirty || !!newWord.trim() || !!saving); }, [dirty, greetingDirty, newWord, saving, onDirtyChange]);
    useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
    const close = () => { if (!saving && mayLeave()) onClose(); };
    const changeRow = (id, key, value) => { setRows(list => list.map(row => row.id === id ? { ...row, [key]: value } : row)); setDirty(true); setSuccess(''); };
    const saveGreeting = async () => {
        if (saving || !onSaveGreetingTemplate) return;
        setSaving('greeting'); setError(''); setSuccess('');
        const text = greetings[staff] || '';
        try { await onSaveGreetingTemplate(staff, text); setSavedGreetings(prev => ({ ...prev, [staff]: text })); setSuccess(`${staff}の挨拶を保存しました。`); }
        catch (err) { setError(`挨拶を保存できませんでした。${err.message || ''}`); }
        finally { setSaving(''); }
    };
    const saveSettings = async () => {
        if (saving) return;
        setError(''); setSuccess('');
        if (newWord.trim()) { setError('入力中のOKワードを「追加」してから保存してください。'); return; }
        const names = rows.map(row => row.name.trim());
        if (names.some(name => !name)) { setError('空のタグ名があります。名前を入力するか、行を削除してください。'); return; }
        if (new Set(names).size !== names.length) { setError('同じ名前のタグがあります。名前を分けてください。'); return; }
        setSaving('settings');
        try {
            const texts = { ...tagInsertTexts }, columns = { ...tagColumnMap };
            rows.forEach((row, index) => { texts[names[index]] = row.text; columns[names[index]] = row.column; });
            if (onSaveSettings) await onSaveSettings(names, texts, columns, words);
            else { await onSaveTags(names, texts, columns); if (onSaveOkWords) await onSaveOkWords(words); }
            setDirty(false); setSuccess('タグ・OKワードを保存しました。');
            if (!greetingDirty) onClose();
        } catch (err) { setError(`設定を保存できませんでした。入力は残しています。${err.message || ''}`); }
        finally { setSaving(''); }
    };
    const addWord = () => {
        const word = newWord.trim(); if (!word) return;
        if (words.includes(word)) { setError('このOKワードはすでに登録されています。'); return; }
        setWords(list => [...list, word]); setNewWord(''); setDirty(true); setError('');
    };
    const tour = id => { if (mayLeave()) { onClose(); onStartTour(id); } };
    return <div className="workflow-overlay" onClick={close}>
      <section className="workflow-dialog settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title" onClick={e => e.stopPropagation()}>
        <header className="workflow-header"><div><p className="workflow-eyebrow">ツリー通信v2 / 業務設定</p><h2 id="settings-title">設定・定型文</h2><p>メモと、業務表・通信のつながりを整えます。</p></div><button aria-label="設定を閉じる" onClick={close} disabled={!!saving} className="workflow-icon"><X /></button></header>
        <nav className="workflow-tabs" aria-label="設定の種類">{[['greetings','スタッフの挨拶'],['tags','タグ・挿入文'],['okWords','OKワード'],['updates','使い方・更新']].map(([id,label]) => <button key={id} aria-pressed={activeTab === id} onClick={() => setActiveTab(id)}>{label}</button>)}</nav>
        <div className="workflow-body">
          {error && <p role="alert" className="workflow-error">{error}</p>}{success && <p role="status" className="workflow-success"><Check size={18}/>{success}</p>}
          {activeTab === 'greetings' && <section className="workflow-section">
            <h3>スタッフごとの挨拶</h3><p className="workflow-help">挨拶はスタッフごとに保存します。担当スタッフの挨拶として通信へ挿入する文面です。作成済みの通信本文は書き換わりません。</p>
            <label className="workflow-field">スタッフ<select value={staff} disabled={!!saving} onChange={e => { setStaff(e.target.value); setSuccess(''); }}>{Array.from(new Set([currentStaffName, ...staffList.map(s => s.name), staff].filter(Boolean))).map(name => <option key={name}>{name}</option>)}</select></label>
            <label className="workflow-field">{staff}の挨拶<textarea rows={7} value={greetings[staff] || ''} disabled={!!saving} onChange={e => { setGreetings(prev => ({ ...prev, [staff]: e.target.value })); setSuccess(''); }} placeholder="こんにちは。本日のツリー通信です。" /></label>
            <div className="workflow-actions"><span className="workflow-help">改行もそのまま保存します。</span><button className="workflow-primary" disabled={!!saving} onClick={saveGreeting}><Save size={18}/>{saving === 'greeting' ? '保存中…' : 'この挨拶を保存'}</button></div>
          </section>}
          {activeTab === 'tags' && <section className="workflow-section"><h3>メモのタグ・挿入文・表示先</h3><p className="workflow-help">挿入文はタグ選択時にメモへ入ります。表示列を指定したタグのメモは業務表へ反映されます。既存メモのタグ名と表示先は保持します。表示なしを選ぶと、そのタグのメモは業務表から非表示になります。</p>
            <div className="settings-tags">{rows.map(row => <article className="settings-tag" key={row.id}>
              <label className="workflow-field">タグ名<input value={row.name} disabled={!!saving} onChange={e => changeRow(row.id, 'name', e.target.value)} /></label>
              <label className="workflow-field">自動挿入する文<textarea rows={3} value={row.text} disabled={!!saving} onChange={e => changeRow(row.id, 'text', e.target.value)} placeholder="空欄なら文は挿入しません"/><button type="button" className="workflow-text-button" disabled={!!saving} onClick={() => changeRow(row.id, 'text', row.text + '{プログラム内容}')}>＋プログラム内容</button></label>
              <label className="workflow-field">業務表の表示列<select value={row.column} disabled={!!saving} onChange={e => changeRow(row.id, 'column', e.target.value)}><option value="">表示なし</option><option value="learning">学習</option><option value="program">プログラム</option><option value="remarks">備考</option></select></label>
              <button className="workflow-icon workflow-danger" aria-label={`${row.name || '空のタグ'}を削除`} disabled={!!saving} onClick={() => { setRows(list => list.filter(r => r.id !== row.id)); setDirty(true); }}><Trash2 size={19}/></button>
            </article>)}</div><button className="workflow-secondary" disabled={!!saving} onClick={() => { setRows(list => [...list, { id: `new-${Date.now()}`, name: '', text: '', column: '' }]); setDirty(true); }}><Plus size={18}/>タグを追加</button>
          </section>}
          {activeTab === 'okWords' && <section className="workflow-section"><h3>名前チェックのOKワード</h3><p className="workflow-help">登録した語は実名チェックの対象から外れます。児童名の登録や公開許可とは別の設定です。</p><div className="workflow-inline"><input aria-label="追加するOKワード" value={newWord} disabled={!!saving} onChange={e => setNewWord(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); addWord(); } }} placeholder="検出対象から外す語"/><button className="workflow-secondary" onClick={addWord} disabled={!!saving}><Plus size={18}/>追加</button></div><div className="settings-words">{words.map(word => <span key={word}>{word}<button aria-label={`${word}を削除`} disabled={!!saving} onClick={() => { setWords(list => list.filter(w => w !== word)); setDirty(true); }}><X size={17}/></button></span>)}</div>{words.length === 0 && <p className="workflow-help">OKワードは登録されていません。</p>}</section>}
          {activeTab === 'updates' && <section className="workflow-section"><h3>使い方・更新履歴 <small>v{APP_VERSION}</small></h3><div className="workflow-actions">{onStartTour && <button className="workflow-secondary" onClick={() => tour()}>画面で操作を確認</button>}{onOpenUpdateModal && <button className="workflow-text-button" disabled={!!saving} onClick={() => { if (mayLeave()) onOpenUpdateModal(); }}>更新案内を開く</button>}</div>{UPDATE_HISTORY.map(update => <article className="workflow-section" key={update.version}><h4>{update.title} <small>v{update.version} · {update.date}</small></h4>{update.items.map((item,index) => <div className="settings-update" key={item.id || index}><strong>{item.title}</strong><p>{item.description}</p><p className="workflow-help">{item.location} / {item.action}</p>{item.id && onStartTour && <button className="workflow-text-button" onClick={() => tour(item.id)}>この操作を確認</button>}</div>)}</article>)}</section>}
        </div>
        <footer className="workflow-footer"><p>{dirty ? 'タグ・OKワードに未保存の変更があります。' : 'タグ・OKワードは下のボタンで保存します。'}{greetingDirty && ' 挨拶は「この挨拶を保存」で確定してください。'}</p><div className="workflow-actions"><button className="workflow-secondary" onClick={close} disabled={!!saving}>閉じる</button><button className="workflow-primary" onClick={saveSettings} disabled={!!saving}><Save size={18}/>{saving === 'settings' ? '保存中…' : 'タグ・OKワードを保存'}</button></div></footer>
      </section>
    </div>;
}

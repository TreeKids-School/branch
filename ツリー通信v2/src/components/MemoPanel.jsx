import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, CheckCircle2, ChevronDown, Copy, Edit2, FileText, HelpCircle, MessageSquare, Plus, Save, Trash2, X } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { firestore } from '../firebase';
import { copyToClipboard } from '../utils/clipboard';
import { appendEditorText, cleanMemoText, editorDraftKey, editorSavePayload, editorValues, memoTags, orderedMemoText, programTemplateText, reconcileEditor, restoreEditorDraft, scanForNames } from '../utils/communicationEditor';
import './MemoPanel.css';

export default function MemoPanel(props) {
    if (!props.child) return null;
    return <CommunicationEditor key={`${props.storageScope}:${props.officeId}:${props.selectedDate}:${props.child.id}`} {...props} />;
}

function CommunicationEditor({ child, messages = [], tags = [], onSave, onDelete, onUpdate, result = {}, selectedDate, onSaveTree, onClose, onDirtyChange, activeTab = 'tree', setActiveTab, currentStaffName, programTitle = '', programSummary = '', greetingTemplates = {}, okWords = [], onAddOkWord, programs = [], tagInsertTexts = {}, officeId = 'home', officeName = '', storageScope = 'local', storageMode = 'emulator' }) {
    const draftKey = editorDraftKey({ scope: storageScope, officeId, date: selectedDate, childId: child.id });
    const initial = useMemo(() => {
        let draft = null;
        try { draft = JSON.parse(localStorage.getItem(draftKey) || 'null'); } catch { /* An invalid draft never replaces saved data. */ }
        let legacyDraft = null;
        if (storageMode === 'browser-preview' && !draft?.legacyReviewed) {
            try {
                const legacy = JSON.parse(localStorage.getItem(`tree_tsushin_v2_draft_${selectedDate}_${child.id}`) || 'null');
                if (legacy && ((typeof legacy.D === 'string' && legacy.D.trim() && legacy.D !== result.D) || legacy.chatText?.trim())) legacyDraft = legacy;
            } catch { /* Keep unreadable legacy data untouched. */ }
        }
        return { ...restoreEditorDraft(result, draft), draft, legacyDraft };
    }, []);
    const [values, setValues] = useState(initial.values);
    const valuesRef = useRef(initial.values);
    const baseRef = useRef(initial.base);
    const [conflicts, setConflicts] = useState(initial.conflicts);
    const conflictsRef = useRef(initial.conflicts);
    const [completed, setCompleted] = useState(Boolean(result.isCompleted));
    const [saveState, setSaveState] = useState('saved');
    const [saveError, setSaveError] = useState('');
    const [draftError, setDraftError] = useState('');
    const [notice, setNotice] = useState('');
    const [working, setWorking] = useState(false);
    const [chatText, setChatText] = useState(initial.draft?.chatText || '');
    const [selectedTags, setSelectedTags] = useState(Array.isArray(initial.draft?.selectedTags) ? initial.draft.selectedTags : []);
    const [editing, setEditing] = useState(initial.draft?.editing || null);
    const [programPicker, setProgramPicker] = useState(null);
    const [insertPicker, setInsertPicker] = useState(null);
    const [selectedMemos, setSelectedMemos] = useState([]);
    const [showReference, setShowReference] = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    const [copied, setCopied] = useState(false);
    const [pendingOkWord, setPendingOkWord] = useState(null);
    const [legacyReviewed, setLegacyReviewed] = useState(Boolean(initial.draft?.legacyReviewed));
    const [legacyImported, setLegacyImported] = useState(initial.draft?.legacyImported || {});
    const saveQueueRef = useRef(Promise.resolve());
    const inFlightRef = useRef(null);
    const mountedRef = useRef(true);
    const latestCallbacks = useRef({ onSaveTree, result });
    latestCallbacks.current = { onSaveTree, result };
    const textareaRef = useRef(null);
    const dirty = values.D !== baseRef.current.D || values.futurePlan !== baseRef.current.futurePlan;
    const hasConflict = Object.keys(conflicts).length > 0;
    const childName = child.name || [child.lastName, child.firstName].filter(Boolean).join(' ') || '児童';
    const localMode = storageMode === 'browser-preview';
    const sharedMode = storageMode === 'shared-firestore';
    const validPrograms = useMemo(() => (programs.length ? programs : programTitle || programSummary ? [{ title: programTitle, summary: programSummary }] : []).filter(program => program && (program.title?.trim() || program.summary?.trim())), [programs, programTitle, programSummary]);
    const detectedNames = scanForNames(values.D, okWords);
    const isTree = activeTab === 'tree';
    const isFuture = activeTab === 'futurePlan';
    const isChat = !isTree && !isFuture;
    const draftRef = useRef(null);
    draftRef.current = { version: 2, values, base: baseRef.current, chatText, selectedTags, editing, legacyReviewed, legacyImported, updatedAt: Date.now() };

    function persistDraft() {
        try {
            localStorage.setItem(draftKey, JSON.stringify({ ...draftRef.current, values: valuesRef.current, base: baseRef.current, updatedAt: Date.now() }));
            if (mountedRef.current) setDraftError('');
            return true;
        } catch {
            if (mountedRef.current) setDraftError('端末内の下書きを保護できません。保存を確認し、必要なら本文をコピーしてください。');
            return false;
        }
    }

    useEffect(() => { persistDraft(); }, [values, chatText, selectedTags, editing, legacyReviewed, legacyImported]);
    useEffect(() => { onDirtyChange?.(dirty || Boolean(chatText) || selectedTags.length > 0 || Boolean(editing) || hasConflict || working || saveState === 'saving'); }, [dirty, chatText, selectedTags.length, editing, hasConflict, working, saveState, onDirtyChange]);
    useEffect(() => () => onDirtyChange?.(false), []);
    useEffect(() => {
        mountedRef.current = true;
        const backup = () => persistDraft();
        window.addEventListener('pagehide', backup);
        return () => { persistDraft(); mountedRef.current = false; window.removeEventListener('pagehide', backup); };
    }, []);

    function setField(field, value) {
        const next = { ...valuesRef.current, [field]: value };
        valuesRef.current = next;
        setValues(next);
        setSaveState('pending');
        setNotice('');
    }

    function acceptIncoming(incoming) {
        const flight = inFlightRef.current;
        const base = { ...baseRef.current };
        // An echo from our own in-flight save is an acknowledgement, never an instruction to erase newer typing.
        if (flight) for (const field of ['D', 'futurePlan']) if (incoming[field] === flight[field]) base[field] = incoming[field];
        const reconciled = reconcileEditor(valuesRef.current, base, incoming);
        baseRef.current = reconciled.base;
        valuesRef.current = reconciled.values;
        setValues(reconciled.values);
        const nextConflicts = { ...conflictsRef.current };
        for (const field of ['D', 'futurePlan']) {
            if (Object.hasOwn(reconciled.conflicts, field)) nextConflicts[field] = reconciled.conflicts[field];
            else if (reconciled.values[field] === incoming[field]) delete nextConflicts[field];
        }
        conflictsRef.current = nextConflicts;
        setConflicts(nextConflicts);
    }

    useEffect(() => { acceptIncoming(editorValues(result)); setCompleted(Boolean(result.isCompleted)); }, [result.D, result.futurePlan, result.isCompleted]);
    useEffect(() => {
        if (!firestore || !selectedDate) return undefined;
        const communicationId = officeId ? `${officeId}_${selectedDate}` : selectedDate;
        return onSnapshot(doc(firestore, 'children', child.id, 'app_categories', '書類管理', 'tree_communications', communicationId), snapshot => {
            if (!snapshot.exists()) return;
            const data = snapshot.data();
            if (data.officeId && data.officeId !== officeId) return;
            const external = data.future_plan ?? data.futurePlan;
            if (typeof external !== 'string' || external === baseRef.current.futurePlan || external === inFlightRef.current?.futurePlan) return;
            if (valuesRef.current.futurePlan !== baseRef.current.futurePlan) {
                const next = { ...conflictsRef.current, futurePlan: external };
                conflictsRef.current = next; setConflicts(next);
            } else {
                // Keep the daily report in sync with its linked communication document through the same save path.
                setField('futurePlan', external);
            }
        }, error => { console.warn('今後の予定の変更監視に失敗しました。', error); });
    }, [child.id, selectedDate, officeId]);

    async function persist(extra = {}, force = false) {
        const task = async () => {
            if (Object.keys(conflictsRef.current).length) throw new Error('保存内容を比較し、残す内容を選んでください。');
            const snapshot = { ...valuesRef.current };
            const { patch, expected } = editorSavePayload(snapshot, baseRef.current, extra, force);
            if (!Object.keys(patch).length) return;
            if (Object.hasOwn(extra, 'isCompleted')) expected.isCompleted = Boolean(latestCallbacks.current.result.isCompleted);
            inFlightRef.current = patch;
            if (mountedRef.current) { setSaveState('saving'); setSaveError(''); }
            try {
                await latestCallbacks.current.onSaveTree(child.id, patch, expected);
                for (const field of ['D', 'futurePlan']) if (Object.hasOwn(patch, field)) baseRef.current[field] = patch[field];
                persistDraft();
                if (mountedRef.current) {
                    if (Object.hasOwn(extra, 'isCompleted')) setCompleted(extra.isCompleted);
                    setSaveState(valuesRef.current.D === baseRef.current.D && valuesRef.current.futurePlan === baseRef.current.futurePlan ? 'saved' : 'pending');
                }
            } catch (error) {
                if (mountedRef.current) { setSaveState('error'); setSaveError(error.message || '保存できませんでした。入力内容を残しています。'); }
                throw error;
            } finally { inFlightRef.current = null; }
        };
        const queued = saveQueueRef.current.then(task, task);
        saveQueueRef.current = queued.catch(() => {});
        return queued;
    }

    useEffect(() => {
        if (!dirty || hasConflict || saveState === 'error') return undefined;
        const timer = setTimeout(() => { persist().catch(() => {}); }, 900);
        return () => clearTimeout(timer);
    }, [values.D, values.futurePlan, hasConflict, dirty, saveState === 'error']);

    async function saveAndClose(completion) {
        if (working || hasConflict) return;
        if (completion === true && !window.confirm(`${childName}さんの通信を入力完了にします。\n本文と今後の予定を確認しましたか？\n入力完了だけでは保護者に公開・送信されません。`)) return;
        setWorking(true);
        try {
            await persist(completion === undefined ? {} : { isCompleted: completion });
            if (Object.keys(conflictsRef.current).length) throw new Error('別の変更が届きました。保存内容を比較してから閉じてください。');
            if (!persistDraft() && (chatText || selectedTags.length || editing)) throw new Error('入力中のメモを保護できません。メモを保存するか、内容を控えてから閉じてください。');
            await onClose();
        } catch (error) { setSaveError(error.message || '保存できませんでした。入力内容はこの画面に残っています。'); }
        finally { if (mountedRef.current) setWorking(false); }
    }

    async function runMemoAction(action) {
        if (working) return false;
        setWorking(true); setSaveError('');
        try { await action(); return true; }
        catch (error) { setSaveError(error.message || '保存できませんでした。入力内容を残しています。'); return false; }
        finally { if (mountedRef.current) setWorking(false); }
    }

    async function postMemo() {
        if (!chatText.trim()) return;
        const success = await runMemoAction(() => onSave(child.id, chatText, selectedTags.join(' ') || null));
        if (success) { setChatText(''); setSelectedTags([]); setProgramPicker(null); setNotice('メモを保存しました。'); }
    }
    async function saveMemoEdit() {
        if (!editing?.text.trim()) return;
        const success = await runMemoAction(() => onUpdate(child.id, editing.id, editing.text, editing.tags.join(' ') || null));
        if (success) { setEditing(null); setNotice('メモの変更を保存しました。'); }
    }
    function insertProgram(tag, mode, target = 'new') {
        const text = programTemplateText(tag, tagInsertTexts, validPrograms, mode);
        if (text.trim()) {
            if (target === 'edit') setEditing(previous => ({ ...previous, text: text + (previous.text ? `\n${previous.text}` : '') }));
            else setChatText(previous => text + (previous ? `\n${previous}` : ''));
        }
        setProgramPicker(null);
    }
    function toggleTag(tag, target = 'new') {
        const current = target === 'edit' ? editing.tags : selectedTags;
        const alreadySelected = current.includes(tag);
        const next = alreadySelected ? current.filter(value => value !== tag) : [...current, tag];
        if (target === 'edit') setEditing(previous => ({ ...previous, tags: next })); else setSelectedTags(next);
        if (alreadySelected) return;
        const template = tagInsertTexts[tag] || '';
        if (tag.includes('プログラム') || /\{プログラム内容\}|\{program\}/.test(template)) setProgramPicker({ tag, target });
        else if (target === 'new') insertProgram(tag, 0, target);
    }
    function append(field, text) { setField(field, appendEditorText(valuesRef.current[field], text)); }
    async function copyText(text) {
        try { await copyToClipboard(text); setCopied(true); setNotice('コピーしました。送信はまだ行っていません。'); setTimeout(() => setCopied(false), 2400); }
        catch { setSaveError('コピーできませんでした。本文を選択して端末のコピー操作をお使いください。'); textareaRef.current?.focus(); textareaRef.current?.select(); }
    }
    function resolveConflict(field, useSaved) {
        const saved = conflictsRef.current[field];
        // The daily report is authoritative. A linked-document update may not yet be in that report.
        baseRef.current = { ...baseRef.current, [field]: editorValues(latestCallbacks.current.result)[field] };
        if (useSaved) setField(field, saved);
        const next = { ...conflictsRef.current }; delete next[field];
        conflictsRef.current = next; setConflicts(next); setSaveState('pending');
        if (!Object.keys(next).length) persist({}, true).catch(() => {});
    }

    const tagsControl = (target = 'new') => <div className="comm-tags" aria-label="メモのタグ">{tags.map(tag => <button type="button" key={tag} disabled={working} aria-pressed={(target === 'edit' ? editing.tags : selectedTags).includes(tag)} onClick={() => toggleTag(tag, target)}>{tag}</button>)}</div>;
    const reference = (field = null) => <div className="comm-reference-list">{!messages.length ? <p className="comm-empty">まだメモがありません。気づいたことを一つずつ記録できます。</p> : messages.map((memo, index) => <article className="comm-reference-card" key={memo.id || index}><div className="comm-meta"><span>{memo.staffName || 'スタッフ'}</span><time>{new Date(memo.timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}</time><span>{memoTags(memo.tag).join(' ')}</span></div><p>{memo.text}</p>{field && <button type="button" className="comm-button small" disabled={working} onClick={() => append(field, cleanMemoText(memo.text, tags))}><Plus size={16} />{field === 'D' ? '本文' : '予定'}へ反映</button>}</article>)}</div>;

    return <section className={`communication-editor ${isChat ? 'mode-memo' : isFuture ? 'mode-future' : 'mode-tree'}`} aria-label={`${childName}の通信編集`}>
        <header className="comm-editor-header">
            <div className="comm-editor-top"><button type="button" className="comm-back" onClick={() => saveAndClose()} disabled={working || hasConflict}><ArrowLeft size={18} />業務へ戻る</button><span>予約V2内 · ツリー通信v2</span><button type="button" className="comm-icon" onClick={() => setShowHelp(true)} aria-label="編集のヘルプ"><HelpCircle size={20} /></button></div>
            <div className="comm-editor-identity"><div><h2>{childName}<small>さん</small></h2><p>{officeName || officeId} <span aria-hidden="true">／</span> {selectedDate}</p></div><span className={`comm-completion ${completed ? 'complete' : ''}`}>{completed ? <CheckCircle2 size={15} /> : <Edit2 size={15} />}{completed ? '入力完了済み' : '作成中'}</span></div>
            <div className="comm-storage-note">{sharedMode ? '予約V2に共有保存 · 保護者公開・LINE送信は確認後' : localMode ? 'このブラウザーに仮保存 · スタッフ間共有・保護者公開は未接続' : '開発環境に保存 · 保護者には公開されません'}</div>
        </header>
        <nav className="comm-editor-tabs" aria-label="編集内容">{[['chat', 'スタッフメモ', MessageSquare], ['tree', 'ツリー通信', FileText], ['futurePlan', '今後の予定', ChevronDown]].map(([tab, label, Icon]) => <button type="button" key={tab} aria-current={(isChat ? 'chat' : activeTab) === tab ? 'page' : undefined} onClick={() => setActiveTab(tab)}><Icon size={17} />{label}</button>)}</nav>
        {(saveError || draftError) && <div className="comm-error" role="alert"><p>{saveError || draftError}</p><p>入力内容を残しています。確認して再度保存してください。</p>{saveState === 'error' && <button type="button" className="comm-button" disabled={working || hasConflict} onClick={() => persist().catch(() => {})}>もう一度保存</button>}</div>}
        {notice && <div className="comm-notice" role="status">{notice}</div>}
        {initial.legacyDraft && !legacyReviewed && <details className="comm-legacy-draft"><summary>前の画面で保存した端末内の下書きがあります</summary><div><p>この下書きには事業所の記録がありません。児童・事業所・日付を確認してから必要な文章を取り込んでください。保存済みの本文は置き換えません。</p>{initial.legacyDraft.D && <><strong>通信本文の下書き</strong><pre>{initial.legacyDraft.D}</pre><button type="button" className="comm-button" disabled={working || legacyImported.body} onClick={() => { append('D', initial.legacyDraft.D); setActiveTab('tree'); setLegacyImported(previous => ({ ...previous, body: true })); }}>本文の末尾に取り込む</button></>}{initial.legacyDraft.chatText && <><strong>未投稿メモの下書き</strong><pre>{initial.legacyDraft.chatText}</pre><button type="button" className="comm-button" disabled={working || legacyImported.memo} onClick={() => { setChatText(previous => appendEditorText(previous, initial.legacyDraft.chatText)); setSelectedTags(previous => [...new Set([...previous, ...memoTags(initial.legacyDraft.selectedTags)])]); setActiveTab('chat'); setLegacyImported(previous => ({ ...previous, memo: true })); }}>未投稿メモへ取り込む</button></>}<button type="button" className="comm-button subtle" onClick={() => setLegacyReviewed(true)}>下書きの確認を終える</button></div></details>}
        {editing && !messages.some(memo => memo.id === editing.id) && <div className="comm-error" role="alert"><p>編集中のメモが保存済み一覧に見つかりません。入力していた文章は残っています。</p><button type="button" className="comm-button" disabled={working} onClick={() => { setChatText(previous => appendEditorText(previous, editing.text)); setSelectedTags(previous => [...new Set([...previous, ...memoTags(editing.tags)])]); setEditing(null); setActiveTab('chat'); }}>入力内容を新しいメモの下書きへ戻す</button></div>}
        {hasConflict && <section className="comm-conflicts" role="alert"><h3>別の保存内容が見つかりました</h3><p>入力した内容と保存済みの内容を比較し、残す方を選んでください。選ぶまで自動保存と入力完了を止めています。</p>{Object.entries(conflicts).map(([field, saved]) => <div className="comm-conflict-field" key={field}><h4>{field === 'D' ? 'ツリー通信' : '今後の予定'}</h4><div className="comm-compare"><article><strong>編集中の内容</strong><p>{values[field] || '（空欄）'}</p><button type="button" className="comm-button primary" onClick={() => resolveConflict(field, false)}>自分の内容を残す</button></article><article><strong>保存済みの内容</strong><p>{saved || '（空欄）'}</p><button type="button" className="comm-button" onClick={() => resolveConflict(field, true)}>保存済みの内容を取り込む</button></article></div></div>)}</section>}
        <div className="comm-editor-body">
            {isChat ? <div className="comm-memo-layout">
                <section className="comm-memo-compose"><div className="comm-section-heading"><div><h3>今日の気づきを記録</h3><p>短い言葉でも大丈夫。あとで通信に反映できます。</p></div><span className="comm-subtle">{currentStaffName}</span></div>{tagsControl()}{selectedTags.includes('【共有】') && <p className="comm-inline-note">このメモは日報の「共有事項」にも追記されます。後からメモを編集・削除しても、追記済みの共有事項は変わりません。</p>}<label className="comm-field-label" htmlFor="guide-chat-textarea">スタッフメモ</label><textarea id="guide-chat-textarea" value={chatText} onChange={event => setChatText(event.target.value)} disabled={working} onKeyDown={event => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); postMemo(); } }} placeholder="取り組んだこと、子どもの言葉、心に残った様子…" rows={5} /><div className="comm-compose-actions"><button type="button" className="comm-button subtle" disabled={working || (!chatText && !selectedTags.length)} onClick={() => { if (chatText && !window.confirm('入力中のメモを消しますか？保存済みのメモは消えません。')) return; setChatText(''); setSelectedTags([]); setProgramPicker(null); }}><Trash2 size={16} />入力をクリア</button><button type="button" className="comm-button primary" disabled={working || !chatText.trim()} onClick={postMemo}><Save size={17} />{working ? '保存中…' : 'メモを保存'}</button></div></section>
                <section className="comm-memo-history"><div className="comm-section-heading"><h3>保存したメモ <span>{messages.length}</span></h3><button type="button" className="comm-button small" onClick={() => setActiveTab('tree')}>通信を書く →</button></div>{!messages.length && <p className="comm-empty">保存したメモはここに並びます。</p>}{messages.map((memo, index) => <article className={`comm-memo-card ${editing?.id === memo.id ? 'editing' : ''}`} key={memo.id || index}><div className="comm-meta"><strong>{memo.staffName || 'スタッフ'}</strong><time>{new Date(memo.timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}</time></div>{editing?.id === memo.id ? <><h4>メモを編集</h4>{tagsControl('edit')}<label className="comm-field-label" htmlFor={`edit-memo-${memo.id}`}>メモ本文</label><textarea id={`edit-memo-${memo.id}`} value={editing.text} disabled={working} onChange={event => setEditing(previous => ({ ...previous, text: event.target.value }))} rows={5} /><p className="comm-inline-note">日報へ追記済みの共有事項は、この変更では更新されません。</p><div className="comm-compose-actions"><button type="button" className="comm-button" disabled={working} onClick={() => { setEditing(null); setProgramPicker(null); }}>取消</button><button type="button" className="comm-button primary" disabled={working || !editing.text.trim()} onClick={saveMemoEdit}><Check size={17} />変更を保存</button></div></> : <><div className="comm-saved-tags">{memoTags(memo.tag).map(tag => <span key={tag}>{tag}</span>)}</div><p>{memo.text}</p><div className="comm-memo-actions"><button type="button" onClick={() => { if (editing && !window.confirm('別のメモを編集します。編集中の変更を取り消しますか？')) return; setEditing({ id: memo.id, text: memo.text || '', tags: memoTags(memo.tag) }); }} disabled={working}><Edit2 size={15} />編集</button><button type="button" onClick={() => { if (window.confirm('このメモを削除しますか？日報へ追記済みの共有事項は残ります。')) runMemoAction(() => onDelete(child.id, memo.id)); }} disabled={working}><Trash2 size={15} />削除</button></div></>}</article>)}</section>
            </div> : <div className="comm-writing-layout"><section className="comm-writing-main">
                <div className="comm-section-heading"><div><h3>{isFuture ? '今後の予定' : 'ツリー通信の本文'}</h3><p>{isFuture ? '次の関わりにつながる見通しを残します。' : '今日の様子を、ご家庭に伝わる言葉で。'}</p></div><span className="comm-subtle">{currentStaffName ? `編集：${currentStaffName}` : ''}</span></div>
                {isTree && <div className="comm-insert-toolbar"><button type="button" className="comm-button" onClick={() => { setSelectedMemos([]); setInsertPicker('memos'); }}><MessageSquare size={17} />メモから反映</button><button type="button" className="comm-button" onClick={() => setInsertPicker('programs')}><Plus size={17} />プログラム</button><button type="button" className="comm-button" onClick={() => { const text = greetingTemplates[currentStaffName] || ''; if (text.trim()) append('D', text); else setNotice('挨拶が未登録です。「業務・設定」の挨拶設定から、このスタッフの挨拶を保存してください。'); }}>挨拶を挿入</button></div>}
                <label className="comm-field-label" htmlFor={isFuture ? 'comm-future-plan' : 'guide-tree-textarea'}>{isFuture ? '予定・次回への見通し' : '通信本文'}</label><textarea id={isFuture ? 'comm-future-plan' : 'guide-tree-textarea'} ref={textareaRef} disabled={working} className={`comm-main-textarea ${isFuture ? 'future' : ''}`} value={isFuture ? values.futurePlan : values.D} onChange={event => setField(isFuture ? 'futurePlan' : 'D', event.target.value)} placeholder={isFuture ? '次回大切にしたいことや、本人と相談したことを記入…' : '今日の活動や、印象に残った場面を記入…'} rows={isFuture ? 8 : 14} /><div className="comm-text-meta"><span>{isFuture ? '通信本文とは別の項目に保存されます。' : 'コピー・送信前に、宛先と本文を確認してください。'}</span><span>{isFuture ? `${values.futurePlan.length}文字（80文字は目安）` : `${values.D.length}文字`}</span></div>
                {isTree && detectedNames.length > 0 && <div className="comm-name-warning"><strong>名前が含まれている可能性があります</strong><p>本文の該当箇所を確認してください。名前をすべて検出できる機能ではありません。</p><div>{detectedNames.map(name => <span className="comm-warning-word" key={name}><mark>{name}</mark><button type="button" disabled={!onAddOkWord} onClick={() => setPendingOkWord(name)}>OKワードに登録</button></span>)}</div></div>}
                {isFuture && <p className="comm-inline-note">予定を保存するだけでは、予約の追加・変更や保護者への公開は行いません。公開後の修正は、確認して再公開すると保護者へ反映されます。</p>}
                <button type="button" className="comm-reference-toggle" aria-expanded={showReference} onClick={() => setShowReference(!showReference)}><MessageSquare size={17} />参考メモを見る <span>{messages.length}件</span><ChevronDown size={17} /></button><div className={`comm-mobile-reference ${showReference ? 'open' : ''}`}>{reference(isFuture ? 'futurePlan' : 'D')}</div>
            </section><aside className="comm-writing-reference"><div className="comm-section-heading"><h3>今日のメモ</h3><span>{messages.length}件</span></div>{reference(isFuture ? 'futurePlan' : 'D')}<button type="button" className="comm-button" onClick={() => setActiveTab('chat')}><Edit2 size={17} />メモを記録・編集</button></aside></div>}
        </div>
        <footer className="comm-editor-footer"><div className="comm-save-status" role="status"><span className={`comm-save-dot ${saveState}`} /><span>{hasConflict ? '保存内容の確認が必要です' : saveState === 'saving' ? '保存中…' : saveState === 'error' ? '保存できていません' : draftError ? '端末内下書きの保護に失敗' : (chatText || editing || selectedTags.length) ? '未投稿メモを端末内の下書きに保護' : dirty ? '入力内容を保存待ち' : sharedMode ? '予約V2に共有保存済み' : localMode ? 'このブラウザーに仮保存済み' : '保存済み'}</span></div><div className="comm-footer-actions">{!isChat && <button type="button" className="comm-button" disabled={hasConflict || !(isFuture ? values.futurePlan : values.D).trim()} onClick={() => copyText(isFuture ? values.futurePlan : `${childName}さん\n${values.D}`)}>{copied ? <Check size={17} /> : <Copy size={17} />}{copied ? 'コピー済み' : 'コピー'}</button>}<button type="button" className="comm-button" onClick={() => saveAndClose()} disabled={working || hasConflict}>{working ? '保存中…' : '保存して閉じる'}</button>{!isChat && <button type="button" className={`comm-button ${completed ? '' : 'primary'}`} onClick={() => saveAndClose(!completed)} disabled={working || hasConflict}><CheckCircle2 size={17} />{completed ? '完了を解除' : '入力を完了'}</button>}</div></footer>
        {(programPicker || insertPicker || showHelp || pendingOkWord) && <div className="comm-sheet-backdrop" onClick={event => { if (event.target === event.currentTarget) { setProgramPicker(null); setInsertPicker(null); setShowHelp(false); setPendingOkWord(null); } }}><section className="comm-sheet" role="dialog" aria-modal="true" aria-label={showHelp ? '編集のヘルプ' : pendingOkWord ? 'OKワード登録の確認' : insertPicker === 'memos' ? 'メモを選んで反映' : 'プログラムを選択'}><header><div><h3>{showHelp ? '通信を書くときのヒント' : pendingOkWord ? 'OKワードに登録' : insertPicker === 'memos' ? 'メモを選んで反映' : 'プログラムを選択'}</h3><p>{insertPicker === 'memos' ? '本文に入れたい順に選んでください。' : programPicker ? '文字を入れず、タグだけ付けることもできます。' : ''}</p></div><button type="button" className="comm-icon" aria-label="閉じる" onClick={() => { setProgramPicker(null); setInsertPicker(null); setShowHelp(false); setPendingOkWord(null); }}><X size={22} /></button></header><div className="comm-sheet-content">
            {showHelp ? <div className="comm-help"><p>① スタッフメモに、その日の気づきを記録します。タグに応じて業務表の学習・プログラム・備考にも表示されます。</p><p>② 通信本文は「メモから反映」で、選んだ順に挿入できます。本文に反映した後のメモ編集は、本文を自動で書き換えません。</p><p>③ 今後の予定は別欄に保存します。入力完了、コピー、送信済みの確認、保護者への公開はそれぞれ別の操作です。</p><p>{sharedMode ? '保存した記録は同じ事業所のスタッフと共有されます。「保護者へ公開」で本文と今後の予定を確認すると、「日々のあしあと」へ公開できます。公開後の修正は再公開するまで反映されません。LINE送信は別の画面で本文と宛先を確認して行います。入力完了やコピーだけでは公開・送信しません。' : localMode ? '現在は利用者別のブラウザー内仮保存です。他のスタッフや他の端末とは共有されません。' : '現在は開発環境です。保護者には公開されません。'}</p></div> : pendingOkWord ? <><p>「{pendingOkWord}」を、今後の名前チェックから除外する言葉として保存します。</p><p>今回だけの無視ではありません。本文に含めてもよい言葉か確認してください。</p><button type="button" className="comm-button primary" disabled={working} onClick={async () => { const success = await runMemoAction(() => onAddOkWord(pendingOkWord)); if (success) { setPendingOkWord(null); setNotice('OKワードを保存しました。'); } }}>登録する</button></> : insertPicker === 'memos' ? <>{!messages.length && <p className="comm-empty">保存したメモがありません。</p>}{messages.map((memo, index) => { const id = memo.id || String(memo.timestamp); const order = selectedMemos.indexOf(id); return <button type="button" className={`comm-memo-choice ${order >= 0 ? 'selected' : ''}`} key={id || index} aria-pressed={order >= 0} onClick={() => setSelectedMemos(previous => previous.includes(id) ? previous.filter(value => value !== id) : [...previous, id])}><span className="comm-order">{order >= 0 ? order + 1 : ''}</span><span><span className="comm-meta">{memo.staffName} · {memoTags(memo.tag).join(' ')}</span><span>{cleanMemoText(memo.text, tags)}</span></span></button>; })}</> : <>{!validPrograms.length && <p className="comm-empty">この日のプログラムは未登録です。日報から登録できます。</p>}{validPrograms.map((program, index) => <button type="button" className="comm-program-choice" key={index} onClick={() => { if (programPicker) insertProgram(programPicker.tag, index, programPicker.target); else { append('D', program.summary || program.title || ''); setInsertPicker(null); } }}><strong>{program.title || `プログラム${index + 1}`}<small>{program.staff}</small></strong><span>{program.summary || '（内容未入力）'}</span><span className="comm-link">このプログラムを挿入 →</span></button>)}</>}
        </div>{insertPicker === 'memos' && <footer><button type="button" className="comm-button" onClick={() => setSelectedMemos([])}>選択を解除</button><button type="button" className="comm-button primary" disabled={!selectedMemos.length} onClick={() => { append('D', orderedMemoText(messages, selectedMemos, tags)); setSelectedMemos([]); setInsertPicker(null); }}>{selectedMemos.length}件を本文に反映</button></footer>}{programPicker && <footer><button type="button" className="comm-button" onClick={() => setProgramPicker(null)}>文字挿入なし（タグのみ）</button><button type="button" className="comm-button primary" disabled={!validPrograms.length} onClick={() => insertProgram(programPicker.tag, 'all', programPicker.target)}>すべて挿入</button></footer>}</section></div>}
    </section>;
}

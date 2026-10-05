import React, { useEffect, useRef, useState } from 'react';
import { X, UserPlus, Search, Check, Clock, AlertCircle } from 'lucide-react';
import { availableChildren, childDisplayName, hasChildCandidateOverlap } from '../utils/childSelection.js';

export default function AddChildModal({ show, onClose, masterChildren = [], currentChildren = [], onAddChildren, selectedDate, officeName, onDirtyChange }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIds, setSelectedIds] = useState([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const busyRef = useRef(false);
    useEffect(() => { if (show) { setSelectedIds([]); setSearchQuery(''); setError(''); setSaving(false); busyRef.current = false; } }, [show]);
    useEffect(() => { if (show) onDirtyChange?.(selectedIds.length > 0 || saving); }, [show, selectedIds.length, saving, onDirtyChange]);
    useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
    if (!show) return null;
    const available = availableChildren(masterChildren, currentChildren, '');
    const selected = available.filter(child => selectedIds.includes(child.id));
    const candidates = availableChildren(masterChildren, currentChildren, searchQuery).filter(child => selectedIds.includes(child.id) || !selected.some(item => hasChildCandidateOverlap(item, child)));
    const toggle = id => { if (!busyRef.current) { setSelectedIds(previous => previous.includes(id) ? previous.filter(item => item !== id) : [...previous, id]); setError(''); } };
    const close = () => { if (!busyRef.current) onClose(); };
    const submit = async isWaitlist => {
        if (busyRef.current || !selected.length) return;
        busyRef.current = true; setSaving(true); setError('');
        try {
            const result = await onAddChildren(selected, isWaitlist);
            if (result === false) throw new Error('保存を完了できませんでした。');
            onClose();
        } catch (failure) {
            setError('追加できませんでした。選択を残しています。' + (failure.message || 'もう一度お試しください。'));
        } finally { busyRef.current = false; setSaving(false); }
    };
    return <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/45 p-0 md:p-6" role="presentation">
        <div className="absolute inset-0" onClick={close} />
        <section role="dialog" aria-modal="true" aria-labelledby="add-child-title" className="relative w-full max-w-3xl h-[100dvh] md:h-auto md:max-h-[92dvh] bg-slate-50 md:rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <header className="px-5 py-4 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
                <div><p className="text-xs text-slate-500 mb-1">ツリー通信v2 / 当日の業務</p><h2 id="add-child-title" className="font-bold text-xl text-slate-800">児童を追加</h2><p className="text-sm text-slate-600 mt-1">{officeName || '選択中の事業所'}{selectedDate ? ' · ' + selectedDate : ''}</p></div>
                <button onClick={close} disabled={saving} aria-label="児童追加を閉じる" className="min-h-[44px] min-w-[44px] rounded-xl hover:bg-slate-100"><X className="w-5 h-5 mx-auto" /></button>
            </header>
            <div className="p-4 md:p-6 bg-white border-b border-slate-200 shrink-0">
                <label htmlFor="child-search" className="font-semibold text-sm text-slate-700">名前・読み仮名で検索</label>
                <div className="relative mt-2"><Search className="w-5 h-5 absolute top-3.5 left-3 text-slate-400" />
                    <input id="child-search" type="search" value={searchQuery} disabled={saving} onChange={event => setSearchQuery(event.target.value)} placeholder="例：やまだ、ヤマダ" autoComplete="off" className="w-full min-h-[48px] pl-10 pr-4 text-base bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-tree-500 focus:outline-none" />
                </div>
                {!!selected.length && <div className="mt-3"><p className="text-sm font-semibold text-tree-800 mb-2">{selected.length}名を選択中</p>
                    <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto">{selected.map(child => <button key={child.id} onClick={() => toggle(child.id)} disabled={saving} aria-label={childDisplayName(child) + 'の選択を解除'} className="min-h-[44px] bg-tree-50 border border-tree-200 rounded-xl px-3 text-sm text-tree-800 flex items-center gap-2">{childDisplayName(child)}<X className="w-4 h-4" /></button>)}</div>
                </div>}
            </div>
            <div className="flex-1 overflow-y-auto min-h-0 p-4 md:p-6">
                {error && <p role="alert" className="mb-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex gap-2"><AlertCircle className="w-5 h-5 shrink-0" />{error}</p>}
                <p className="text-sm text-slate-500 mb-3">当日一覧にいない児童 · {candidates.length}名</p>
                {masterChildren.some(child=>child.identityReview)&&<p className="text-xs text-amber-800 mb-3">照合保留の児童と、その予約名簿の候補は同時に追加できません。当日一覧や選択中に片方がある場合、もう片方は表示しません。</p>}
                {!candidates.length ? <div className="bg-white border border-dashed border-slate-300 rounded-xl p-8 text-center"><p className="font-semibold text-slate-700">{!masterChildren.length ? '児童名簿がまだありません' : '追加できる児童が見つかりません'}</p><p className="text-sm text-slate-500 mt-2">{!masterChildren.length ? '利用できる児童名簿がありません。事業所と登録状態を確認してください。' : '検索条件を変えるか、すでに当日一覧にいないか確認してください。'}</p></div>
                    : <div className="grid md:grid-cols-2 gap-2">{candidates.map(child => {
                        const checked = selectedIds.includes(child.id);
                        const reading = child.nameFurigana || [child.lastNameFurigana, child.firstNameFurigana].filter(Boolean).join(' ') || child.yomi;
                        return <button key={child.id} role="checkbox" aria-checked={checked} onClick={() => toggle(child.id)} disabled={saving} className={'min-h-[72px] rounded-xl border px-4 py-3 flex gap-3 items-center text-left ' + (checked ? 'bg-tree-50 border-tree-600' : 'bg-white border-slate-200 hover:border-tree-400')}>
                            <span className={'w-6 h-6 shrink-0 rounded-md border flex items-center justify-center ' + (checked ? 'bg-tree-700 border-tree-700 text-white' : 'bg-white border-slate-300')}>{checked && <Check className="w-4 h-4" />}</span>
                            <span className="min-w-0"><span className="block font-bold text-base text-slate-800">{childDisplayName(child)}</span>{reading && <span className="block text-sm text-slate-500 mt-0.5">{reading}</span>}{child.identityReview&&<span className="block mt-1 text-xs text-amber-800"><span className="inline-block rounded border border-amber-300 bg-amber-50 px-2 py-0.5 font-semibold">照合保留</span><span className="block mt-1">{child.identityReview==='birth-conflict'?'生年月日相違':'旧データの対応確認が必要です'}</span></span>}</span>
                        </button>;
                    })}</div>}
            </div>
            <footer className="shrink-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-white border-t border-slate-200">
                <p className="text-sm text-slate-600 mb-3">{saving ? '当日一覧へ保存しています…' : selected.length + '名を当日一覧へ追加します。児童名簿は変更しません。'}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button onClick={() => submit(false)} disabled={saving || !selected.length} className="min-h-[48px] bg-tree-700 rounded-xl text-white font-bold disabled:opacity-40 flex items-center justify-center gap-2"><UserPlus className="w-5 h-5" />通常児童として追加</button>
                    <button onClick={() => submit(true)} disabled={saving || !selected.length} className="min-h-[48px] bg-white border border-amber-300 rounded-xl text-amber-800 font-semibold disabled:opacity-40 flex items-center justify-center gap-2"><Clock className="w-5 h-5" />キャンセル待ちとして追加</button>
                </div>
            </footer>
        </section>
    </div>;
}

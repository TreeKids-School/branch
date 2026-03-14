import { useState, useEffect } from 'react';
import { Printer, Download, Edit2, Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import { parseForceSheet, buildForceSheet } from '../utils/parseForceSheet';
import { printChildDocument } from '../utils/print';

export default function DocViewer({ child, result, selectedDate, onSaveResult }) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState({
        D: '', B_result: '', B_plan: '', B_item: '',
        force: { learning: '', play: '', program: '', snack: '' }
    });
    const [expanded, setExpanded] = useState({ plan: true, comm: true, force: true, summary: true });

    useEffect(() => {
        if (result) {
            setDraft({
                D: result.D || '',
                B_result: result.B_result || '',
                B_plan: result.B_plan || '',
                B_item: result.B_item || '',
                force: parseForceSheet(result.K_sheet || ''),
            });
        }
    }, [result, child]);

    if (!child) {
        return (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 text-center text-slate-400 text-sm">
                児童を選択してください
            </div>
        );
    }

    if (!result) {
        return (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 text-center text-slate-400 text-sm">
                <p className="font-medium text-slate-500 mb-1">{child.name}</p>
                <p>まだ書類が生成されていません</p>
                <p className="text-xs mt-1">左のパネルでメモを入力し、「書類生成」ボタンを押してください</p>
            </div>
        );
    }

    const handleSave = () => {
        const newResult = {
            ...result,
            D: draft.D,
            B_result: draft.B_result,
            B_plan: draft.B_plan,
            B_item: draft.B_item,
            K_sheet: child.forceSheet ? buildForceSheet(draft.force) : result.K_sheet,
        };
        onSaveResult(child.id, newResult);
        setEditing(false);
    };

    const Section = ({ title, sectionKey, children }) => (
        <div className="border border-slate-100 rounded-xl overflow-hidden">
            <button
                onClick={() => setExpanded(p => ({ ...p, [sectionKey]: !p[sectionKey] }))}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors"
            >
                <span className="font-bold text-slate-700 text-sm">{title}</span>
                {expanded[sectionKey] ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>
            {expanded[sectionKey] && <div className="p-4">{children}</div>}
        </div>
    );

    const Field = ({ label, value, draftKey, multiline = true }) => (
        <div className="mb-4 last:mb-0">
            <div className="text-xs text-slate-400 mb-1">{label}</div>
            {editing ? (
                multiline ? (
                    <textarea
                        value={draft[draftKey]}
                        onChange={e => setDraft(p => ({ ...p, [draftKey]: e.target.value }))}
                        className="w-full text-sm border border-indigo-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                        rows={4}
                    />
                ) : (
                    <input
                        type="text"
                        value={draft[draftKey]}
                        onChange={e => setDraft(p => ({ ...p, [draftKey]: e.target.value }))}
                        className="w-full text-sm border border-indigo-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                )
            ) : (
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{value || '---'}</p>
            )}
        </div>
    );

    const force = parseForceSheet(result.K_sheet || '');

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <div>
                    <h3 className="font-bold text-slate-700 text-sm">{child.name} の書類</h3>
                    <p className="text-[10px] text-slate-400">{selectedDate}</p>
                </div>
                <div className="flex items-center gap-2">
                    {editing ? (
                        <>
                            <button onClick={handleSave} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700">
                                <Check className="w-3.5 h-3.5" />保存
                            </button>
                            <button onClick={() => setEditing(false)} className="flex items-center gap-1 px-3 py-1.5 bg-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-300">
                                <X className="w-3.5 h-3.5" />キャンセル
                            </button>
                        </>
                    ) : (
                        <>
                            <button onClick={() => setEditing(true)} className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200">
                                <Edit2 className="w-3.5 h-3.5" />編集
                            </button>
                            <button onClick={() => printChildDocument(child, result, selectedDate)} className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700">
                                <Printer className="w-3.5 h-3.5" />印刷
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="p-4 space-y-3 overflow-y-auto custom-scrollbar flex-1">
                <Section title="専門的支援実施計画" sectionKey="plan">
                    <Field label="実施した支援の内容・結果" value={result.B_result} draftKey="B_result" />
                    <Field label="今後の支援の予定" value={result.B_plan} draftKey="B_plan" />
                    <Field label="該当項目" value={result.B_item} draftKey="B_item" multiline={false} />
                </Section>

                <Section title="ツリー通信" sectionKey="comm">
                    <Field label="内容" value={result.D} draftKey="D" />
                </Section>

                {result.K_sheet && (
                    <Section title="強行シート" sectionKey="force">
                        {editing ? (
                            ['learning', 'play', 'program', 'snack'].map((key, i) => {
                                const labels = ['学習', '自由遊び', 'プログラム', 'おやつ'];
                                return (
                                    <div key={key} className="mb-3 last:mb-0">
                                        <div className="text-xs text-slate-400 mb-1">{labels[i]}</div>
                                        <textarea
                                            value={draft.force[key]}
                                            onChange={e => setDraft(p => ({ ...p, force: { ...p.force, [key]: e.target.value } }))}
                                            className="w-full text-sm border border-indigo-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                                            rows={2}
                                        />
                                    </div>
                                );
                            })
                        ) : (
                            [['学習', force.learning], ['自由遊び', force.play], ['プログラム', force.program], ['おやつ', force.snack]].map(([label, val]) => (
                                <div key={label} className="mb-3 last:mb-0">
                                    <div className="text-xs text-slate-400 mb-1">{label}</div>
                                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{val || '該当なし'}</p>
                                </div>
                            ))
                        )}
                    </Section>
                )}
            </div>
        </div>
    );
}

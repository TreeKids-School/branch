import { useState, useEffect } from 'react';
import { Printer, Download, Edit2, Check, X, ChevronDown, ChevronUp, FileText, LayoutPanelLeft, MessageSquare, Info, Sparkles } from 'lucide-react';
import { parseForceSheet, buildForceSheet } from '../utils/parseForceSheet';
import { printChildDocument } from '../utils/print';

const APP_VERSION = "2.4.0"; // Placeholder

export default function DocViewer({ child, result, selectedDate, onSaveResult, onClose }) {
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
            <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-6 md:space-y-8 animate-in fade-in duration-700 bg-white/60 backdrop-blur-3xl">
                <div className="p-8 md:p-12 bg-white rounded-[3rem] md:rounded-[4rem] shadow-premium text-tree-200 ring-4 ring-tree-50/50">
                    <LayoutPanelLeft className="w-16 h-16 md:w-20 md:h-20 stroke-[1.2]" />
                </div>
                <div className="space-y-2 md:space-y-3">
                    <p className="text-xl md:text-2xl font-black text-slate-800 uppercase tracking-widest leading-none">児童を選択してください</p>
                    <p className="text-[10px] md:text-sm text-slate-400 font-bold uppercase tracking-[0.2em] opacity-60">記録データからプレビューを表示します</p>
                </div>
            </div>
        );
    }

    if (!result) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-8 md:space-y-10 animate-in fade-in duration-700 bg-white/60 backdrop-blur-3xl">
                <div className="p-10 md:p-12 bg-apple-50 rounded-[3.5rem] md:rounded-[4rem] shadow-premium text-apple-500 ring-8 ring-apple-100/50">
                    <Sparkles className="w-16 h-16 md:w-20 md:h-20 stroke-[1.2] animate-pulse" />
                </div>
                <div className="space-y-3 md:space-y-4">
                  <p className="font-black text-slate-900 text-3xl md:text-4xl tracking-tight leading-none">{child.name}</p>
                  <div className="px-6 py-2 bg-apple-500 rounded-full shadow-lg text-[10px] font-black text-white uppercase tracking-[0.3em] inline-block">AI連携待ち</div>
                </div>
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

    const Section = ({ title, sectionKey, icon: Icon, colorClass, children }) => (
        <div className="bg-white rounded-[2.5rem] md:rounded-[4rem] overflow-hidden shadow-premium hover:shadow-2xl transition-all duration-700 border border-slate-100 ring-1 ring-slate-100/50">
            <button
                onClick={() => setExpanded(p => ({ ...p, [sectionKey]: !p[sectionKey] }))}
                className={`w-full flex items-center justify-between px-6 md:px-10 py-6 md:py-8 transition-all duration-500 ${expanded[sectionKey] ? 'bg-slate-50 border-b border-slate-100' : 'hover:bg-slate-50'}`}
            >
                <div className="flex items-center gap-4 md:gap-6">
                    <div className={`p-3 md:p-4 rounded-2xl md:rounded-[1.5rem] ${colorClass} bg-opacity-20 ${colorClass.replace('text-', 'bg-')} shadow-sm ring-2 ring-white`}>
                        <Icon className="w-5 h-5 md:w-6 md:h-6" />
                    </div>
                    <span className="font-black text-slate-800 text-[11px] md:text-sm uppercase tracking-[0.2em]">{title}</span>
                </div>
                {expanded[sectionKey] ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
            </button>
            <div className={`transition-all duration-700 ${expanded[sectionKey] ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0 pointer-events-none'}`}>
              <div className="p-6 md:p-12 space-y-8 md:space-y-10 bg-white/60">{children}</div>
            </div>
        </div>
    );

    const Field = ({ label, value, draftKey, multiline = true }) => (
        <div className="group space-y-4 md:space-y-5">
            <div className="text-[10px] md:text-[12px] font-black text-slate-400 uppercase tracking-[0.25em] pl-4 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-slate-200 shadow-inner" />
                {label}
            </div>
            {editing ? (
                multiline ? (
                    <textarea
                        value={draft[draftKey]}
                        onChange={e => setDraft(p => ({ ...p, [draftKey]: e.target.value }))}
                        className="w-full text-[14px] md:text-[15px] bg-slate-50 border-2 border-slate-100 rounded-[2rem] md:rounded-[3.5rem] p-6 md:p-8 focus:border-tree-500 focus:bg-white focus:ring-8 md:focus:ring-[15px] focus:ring-tree-50 outline-none transition-all shadow-inner leading-relaxed resize-none cursor-text font-medium text-slate-800"
                        rows={5}
                    />
                ) : (
                    <input
                        type="text"
                        value={draft[draftKey]}
                        onChange={e => setDraft(p => ({ ...p, [draftKey]: e.target.value }))}
                        className="w-full text-[14px] md:text-[15px] bg-slate-50 border-2 border-slate-100 rounded-full px-6 md:px-8 py-4 md:py-5 focus:border-tree-500 focus:bg-white focus:ring-8 md:focus:ring-[15px] focus:ring-tree-50 outline-none transition-all shadow-inner font-bold text-slate-800"
                    />
                )
            ) : (
                <div className="w-full p-6 md:p-8 rounded-[2rem] md:rounded-[3.5rem] bg-white text-[14px] md:text-[15px] text-slate-700 leading-relaxed border border-slate-50 group-hover:border-tree-100 transition-all shadow-sm whitespace-pre-wrap font-medium">
                  {value || <span className="italic text-slate-300 font-black opacity-60 uppercase tracking-widest text-[9px]">Awaiting Core Input</span>}
                </div>
            )}
        </div>
    );

    const currentForce = parseForceSheet(result.K_sheet || '');

    return (
        <div className="bg-slate-50 flex flex-col h-full overflow-hidden animate-in fade-in duration-500 relative border-l border-slate-200 shadow-2xl">
            {/* Header - Brand Integration Responsive */}
            <div className="flex items-center justify-between px-6 md:px-10 py-5 md:py-8 border-b border-slate-100 bg-white sticky top-0 z-20 flex-shrink-0 shadow-lg">
                <div className="flex items-center gap-4 md:gap-6 truncate">
                    <div className="p-3 md:p-4 bg-tree-500 rounded-2xl md:rounded-3xl text-white shadow-xl shadow-tree-100 flex-shrink-0">
                        <FileText className="w-6 h-6 md:w-7 md:h-7" />
                    </div>
                    <div className="truncate">
                        <h3 className="font-black text-lg md:text-2xl leading-none tracking-tight text-slate-800 truncate">{child.name}</h3>
                        <div className="flex items-center gap-2 md:gap-3 mt-1.5 md:mt-2.5">
                            <p className="text-[9px] md:text-[11px] text-tree-600 uppercase tracking-[0.2em] font-black italic opacity-60 truncate">{selectedDate}</p>
                            <div className="h-3 w-px bg-slate-200 flex-shrink-0" />
                            <p className="hidden xs:block text-[9px] md:text-[11px] text-apple-500 uppercase tracking-[0.2em] font-black italic opacity-60">アーカイブ</p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {editing ? (
                        <>
                            <button onClick={handleSave} className="flex items-center gap-2 px-5 md:px-10 py-3 md:py-5 bg-tree-600 text-white rounded-full text-[10px] md:text-[12px] font-black shadow-lg shadow-tree-100 hover:bg-tree-700 active:scale-95 transition-all uppercase tracking-widest">
                                <Check className="w-4 h-4 md:w-5 md:h-5" /> <span className="hidden sm:inline">保存</span>
                            </button>
                            <button onClick={() => setEditing(false)} className="p-3 md:p-5 bg-slate-50 hover:bg-slate-100 text-slate-400 rounded-2xl transition-all shadow-sm">
                                <X className="w-5 h-5 md:w-6 md:h-6" />
                            </button>
                        </>
                    ) : (
                        <>
                            <button onClick={() => setEditing(true)} className="p-3 md:p-5 bg-slate-50 hover:bg-slate-100 text-slate-400 rounded-2xl transition-all shadow-sm border border-slate-100 group">
                                <Edit2 className="w-5 h-5 md:w-6 md:h-6 group-hover:rotate-12 transition-transform" />
                            </button>
                            <button onClick={() => printChildDocument(child, result, selectedDate)} className="flex items-center gap-2 px-5 md:px-10 py-3 md:py-5 bg-wood-700 text-white rounded-full text-[10px] md:text-[12px] font-black shadow-lg shadow-wood-100 hover:bg-wood-800 active:scale-95 transition-all">
                                <Printer className="w-4 h-4 md:w-5 md:h-5" /> <span className="hidden sm:inline">印刷</span>
                            </button>
                            <button onClick={onClose} className="p-3 md:p-5 bg-slate-50 hover:bg-slate-100 text-slate-400 rounded-2xl transition-all">
                                <X className="w-6 h-6 md:w-7 md:h-7" />
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-10 space-y-8 md:space-y-12 pb-32 md:pb-24">
                <Section title="保護者様への連絡" sectionKey="comm" icon={MessageSquare} colorClass="text-wood-600">
                    <Field label="今日の様子・連絡事項" value={result.D} draftKey="D" />
                </Section>
            </div>

            {/* Brand Footer Responsive */}
            <div className="px-8 md:px-12 py-6 md:py-8 bg-white border-t border-slate-100 flex items-center justify-between shadow-2xl flex-shrink-0">
                <div className="flex items-center gap-3 opacity-40">
                    <div className="w-2 h-2 rounded-full bg-tree-500" />
                    <p className="text-[9px] text-slate-600 font-black uppercase tracking-[0.2em]">校内アーカイブ</p>
                </div>
                <div className="px-4 py-1.5 bg-slate-50 border border-slate-100 rounded-full text-[9px] font-black text-slate-400 tracking-tighter italic">V{APP_VERSION} / 2026</div>
            </div>
        </div>
    );
}

import { useState, useEffect } from 'react';
import { MessageSquare, ChevronDown, ChevronUp, Save, X, Info, Send, FileText } from 'lucide-react';

export default function TreeCommPanel({ child, result, messages, onSave, onClose }) {
    const [draftD, setDraftD] = useState('');
    const [draftPlan, setDraftPlan] = useState('');
    const [showMemos, setShowMemos] = useState(false);

    useEffect(() => {
        if (result) {
            setDraftD(result.D || '');
            setDraftPlan(result.B_plan || '');
        }
    }, [result, child]);

    const handleSave = () => {
        onSave(child.id, { ...result, D: draftD, B_plan: draftPlan });
        onClose();
    };

    if (!child) return null;

    return (
        <div className="h-full flex flex-col bg-white md:bg-slate-50 animate-in slide-in-from-right duration-500 shadow-2xl border-l border-slate-200">
            {/* Header - Brand Wood Brown Theme */}
            <header className="flex items-center justify-between p-5 md:p-7 text-white shadow-xl flex-shrink-0 z-20" style={{ backgroundColor: '#8B5E3C' }}>
                <div className="flex items-center gap-4 md:gap-5">
                    <div className="p-2.5 md:p-3 bg-white/10 rounded-xl md:rounded-2xl backdrop-blur-md ring-2 ring-white/20">
                        <FileText className="w-6 h-6 md:w-7 md:h-7" />
                    </div>
                    <div className="truncate">
                        <h3 className="font-black text-xl md:text-2xl leading-none drop-shadow-md truncate">{child.name}</h3>
                        <p className="text-[9px] md:text-[11px] font-black opacity-90 mt-1.5 md:mt-2 uppercase tracking-[0.2em] leading-none text-wood-50">ツリー通信録</p>
                    </div>
                </div>
                <button onClick={onClose} className="p-3 md:p-4 hover:bg-white/10 rounded-xl md:rounded-2xl transition-all shadow-sm active:scale-95">
                    <X className="w-5 h-5 md:w-6 md:h-6" />
                </button>
            </header>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-10 space-y-8 md:space-y-12 bg-wood-50/10">
                {/* Reference Memos (Wood Style) */}
                <div className="bg-white rounded-[2.5rem] md:rounded-[3.5rem] shadow-premium border border-wood-100/50 overflow-hidden group transition-all duration-500">
                    <button 
                        onClick={() => setShowMemos(!showMemos)}
                        className={`w-full px-6 md:px-10 py-5 md:py-6 flex items-center justify-between font-black text-[10px] md:text-xs transition-all ${showMemos ? 'bg-wood-600 text-white' : 'bg-wood-50 text-wood-700 hover:bg-wood-100'}`}
                    >
                        <div className="flex items-center gap-3">
                            <Info className={`w-4 h-4 md:w-5 md:h-5 ${showMemos ? 'text-white' : 'text-wood-400'}`} />
                            <span className="uppercase tracking-[0.15em]">メモ履歴 ({messages.length})</span>
                        </div>
                        {showMemos ? <ChevronUp className="w-4 h-4 md:w-5 md:h-5" /> : <ChevronDown className="w-4 h-4 md:w-5 md:h-5" />}
                    </button>
                    {showMemos && (
                        <div className="p-4 md:p-8 max-h-[300px] overflow-y-auto space-y-4 bg-white/40 animate-in fade-in slide-in-from-top-4 duration-500">
                            {messages.length === 0 ? (
                                <p className="text-center py-8 text-[9px] text-wood-300 italic font-black uppercase tracking-widest">履歴データがありません</p>
                            ) : (
                                messages.map((m, i) => (
                                    <div key={i} className="p-5 bg-white border border-wood-50 rounded-3xl text-[12px] md:text-[13px] text-slate-700 leading-relaxed shadow-sm">
                                        <div className="flex items-start gap-3">
                                            <div className="w-2 h-2 rounded-full bg-wood-400 mt-1.5 shadow-inner flex-shrink-0" />
                                            {m.text}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>

                {/* Tree Communication Input */}
                <div className="space-y-4 md:space-y-6 px-2">
                    <label className="block text-[10px] md:text-[12px] font-black text-wood-600 uppercase tracking-[0.25em] flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-tree-500 border-2 border-white shadow-lg animate-pulse" />
                        家庭とのツリー通信
                    </label>
                    <textarea
                        value={draftD}
                        onChange={(e) => setDraftD(e.target.value)}
                        placeholder="メッセージを入力..."
                        className="w-full min-h-[220px] md:min-h-[250px] p-6 md:p-8 text-[14px] md:text-[15px] bg-white border-2 border-wood-100/50 rounded-[2.5rem] md:rounded-[3.5rem] focus:border-wood-500 focus:ring-8 focus:ring-wood-50 outline-none transition-all shadow-inner leading-relaxed resize-none cursor-text font-medium text-slate-700"
                    />
                </div>

                {/* Future Plan Input */}
                <div className="space-y-4 md:space-y-6 px-2 pb-6">
                    <label className="block text-[10px] md:text-[12px] font-black text-wood-600 uppercase tracking-[0.25em] flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-apple-500 border-2 border-white shadow-lg" />
                        今後の支援の予定
                    </label>
                    <textarea
                        value={draftPlan}
                        onChange={(e) => setDraftPlan(e.target.value)}
                        placeholder="予定を共有..."
                        className="w-full min-h-[160px] md:min-h-[180px] p-6 md:p-8 text-[14px] md:text-[15px] bg-white border-2 border-wood-100/50 rounded-[2.5rem] md:rounded-[3.5rem] focus:border-wood-500 focus:ring-8 focus:ring-wood-50 outline-none transition-all shadow-inner leading-relaxed resize-none cursor-text font-medium text-slate-700"
                    />
                </div>
            </div>

            {/* Action Footer - Wood Thema */}
            <div className="p-6 md:p-10 bg-white border-t border-wood-50 flex flex-col gap-4 md:gap-5 shadow-[0_-20px_50px_rgba(0,0,0,0.02)] flex-shrink-0">
                <button 
                    onClick={handleSave}
                    className="w-full py-5 md:py-7 bg-wood-700 hover:bg-wood-800 text-white rounded-[2rem] md:rounded-[3rem] font-black text-xs md:text-sm shadow-premium shadow-wood-100 flex items-center justify-center gap-3 md:gap-4 transition-all active:scale-95 group/btn uppercase tracking-widest"
                >
                    <Save className="w-5 h-5 md:w-6 md:h-6 group-hover/btn:scale-110 transition-transform" />
                    保存して記録を確定
                </button>
                <div className="flex items-center justify-center gap-2 opacity-50">
                    <Info className="w-3.5 h-3.5 text-wood-400" />
                    <p className="text-[9px] text-wood-500 font-black uppercase tracking-[0.15em] text-center">
                        保護者ポータルと自動同期されます
                    </p>
                </div>
            </div>
        </div>
    );
}

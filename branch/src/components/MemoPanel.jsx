import { useState } from 'react';
import { Send, X, MessageCircle, Clock, CheckCircle2, Tags } from 'lucide-react';

export default function MemoPanel({ child, messages, tags, onSave, onClose }) {
    const [text, setText] = useState('');

    const handleSend = () => {
        if (!text.trim()) return;
        onSave(child.id, text);
        setText('');
    };

    const addTag = (tag) => {
        setText(prev => tag + prev);
    };

    if (!child) return null;

    return (
        <div className="h-full flex flex-col bg-slate-50 animate-in slide-in-from-right duration-500 shadow-2xl border-l border-slate-200">
            {/* Header - Brand Tree Green */}
            <div className="flex items-center justify-between p-5 md:p-7 text-white shadow-xl flex-shrink-0 z-20" style={{ backgroundColor: '#21913c' }}>
                <div className="flex items-center gap-4 md:gap-5">
                    <div className="p-2.5 md:p-3 bg-white/20 rounded-xl md:rounded-2xl backdrop-blur-md ring-2 ring-white/30">
                        <MessageCircle className="w-6 h-6 md:w-7 md:h-7" />
                    </div>
                    <div className="truncate">
                        <h3 className="font-black text-xl md:text-2xl leading-none drop-shadow-md truncate">{child.name}</h3>
                        <p className="text-[9px] md:text-[11px] font-black opacity-90 mt-1.5 md:mt-2 uppercase tracking-[0.2em] leading-none text-tree-50">チャットメモ</p>
                    </div>
                </div>
                <button onClick={onClose} className="p-3 md:p-4 hover:bg-white/10 rounded-xl md:rounded-2xl transition-all shadow-sm active:scale-90">
                    <X className="w-5 h-5 md:w-6 md:h-6" />
                </button>
            </div>

            {/* Chat List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 md:p-8 space-y-6 md:space-y-8">
                {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center opacity-30 space-y-4 md:space-y-6">
                        <div className="p-8 md:p-12 bg-white rounded-[3rem] md:rounded-[4rem] shadow-premium ring-4 ring-tree-50/50">
                            <MessageCircle className="w-16 h-16 md:w-20 md:h-20 text-tree-100" />
                        </div>
                        <p className="text-[10px] md:text-sm font-black text-tree-800 uppercase tracking-widest">最初の記録を待機中</p>
                    </div>
                ) : (
                    messages.map((m, i) => (
                        <div key={i} className={`flex flex-col ${m.included ? 'items-end' : 'items-start opacity-70'}`}>
                            <div className={`max-w-[90%] md:max-w-[85%] p-4 md:p-6 rounded-[1.8rem] md:rounded-[2.5rem] shadow-lg text-[13px] md:text-[14px] leading-relaxed font-bold ${m.included ? 'bg-tree-600 text-white rounded-tr-none shadow-tree-100' : 'bg-white text-slate-700 rounded-tl-none border border-slate-100 shadow-sm'}`}>
                                {m.text}
                            </div>
                            <div className="flex items-center gap-2 mt-2 md:mt-3 px-4 md:px-6">
                                <span className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                                    {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                {m.included && <CheckCircle2 className="w-3.5 h-3.5 md:w-4 h-4 text-tree-500" />}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Input Area - Responsive Tag Chips */}
            <div className="p-5 md:p-8 bg-white border-t border-slate-100 space-y-5 md:space-y-6 shadow-[0_-20px_50px_rgba(0,0,0,0.03)]">
                {/* Visual Tag Selector - Optimized for wrap */}
                <div className="flex flex-wrap gap-2 px-1">
                    {tags.map(t => (
                        <button
                            key={t}
                            onClick={() => addTag(t)}
                            className="px-3 py-1.5 md:px-4 md:py-2 bg-tree-50 hover:bg-tree-100 text-tree-600 rounded-full text-[10px] md:text-[11px] font-black tracking-tight border border-tree-100 transition-all active:scale-95 shadow-sm"
                        >
                            {t}
                        </button>
                    ))}
                </div>

                <div className="relative group">
                    <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend(); }}
                        placeholder="サポート内容を入力..."
                        className="w-full min-h-[140px] md:min-h-[160px] p-6 md:p-8 text-[14px] md:text-[15px] bg-tree-50/20 border-2 border-tree-100/50 rounded-[2.5rem] md:rounded-[3rem] outline-none focus:border-tree-500 focus:bg-white focus:ring-8 md:focus:ring-12 focus:ring-tree-50 transition-all shadow-inner leading-relaxed resize-none cursor-text font-medium text-slate-800"
                    />
                    <button 
                        onClick={handleSend}
                        disabled={!text.trim()}
                        className="absolute bottom-5 right-5 p-4 md:p-5 bg-tree-500 hover:bg-tree-600 text-white rounded-2xl md:rounded-[1.5rem] shadow-2xl shadow-tree-200 transition-all active:scale-90 disabled:grayscale group/btn"
                    >
                        <Send className="w-5 h-5 md:w-6 md:h-6 group-hover/btn:translate-x-1 group-hover/btn:-translate-y-1 transition-transform" />
                    </button>
                </div>
                
                <div className="flex items-center justify-center gap-3 px-6 py-3 md:py-4 bg-tree-50/50 rounded-2xl md:rounded-[2rem] border border-tree-100/30 shadow-sm">
                    <div className="w-2 h-2 rounded-full bg-tree-500 shadow-md animate-pulse" />
                    <p className="text-[9px] md:text-[11px] font-black text-tree-700 uppercase tracking-[0.2em] text-center">
                        AI自動連携モード
                    </p>
                </div>
            </div>
        </div>
    );
}

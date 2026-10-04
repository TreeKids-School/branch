import React from 'react';
import { X, FileText } from 'lucide-react';

export default function NoticeModal({ show, onClose, notice, onSave }) {
    if (!show) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 animate-in fade-in duration-300">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={onClose} />
            
            {/* Modal Box */}
            <div className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col border border-white animate-in zoom-in-95 duration-500 max-h-[90vh]">
                {/* Header */}
                <div className="p-5 bg-tree-600 flex items-center justify-between shadow-lg flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                            <FileText className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="font-black text-lg text-white tracking-tight">全体的な様子・特記事項</h3>
                            <p className="text-[9px] font-bold text-tree-100 uppercase tracking-widest opacity-80">自動保存 · Auto Saved</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-all text-white/80 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 bg-slate-50/50 flex-1 flex flex-col gap-3 overflow-y-auto">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        本日の様子や業務上の特記事項を入力してください：
                    </label>
                    <textarea
                        value={notice || ''}
                        onChange={(e) => onSave(e.target.value)}
                        placeholder="ここに入力した内容は、印刷レイアウトの日誌に自動反映されます..."
                        style={{ fontSize: '16px' }}
                        className="w-full min-h-[260px] p-5 bg-white border border-slate-200 rounded-2xl focus:border-tree-400 focus:ring-4 focus:ring-tree-50 outline-none transition-all text-sm font-medium leading-relaxed shadow-inner resize-none text-slate-700"
                        autoFocus
                    />
                </div>

                {/* Footer */}
                <div className="p-4 bg-white border-t border-slate-100 flex justify-end flex-shrink-0">
                    <button 
                        onClick={onClose}
                        className="px-8 py-3 bg-tree-600 hover:bg-tree-700 text-white rounded-xl font-black text-xs shadow-md transition-all active:scale-95 uppercase tracking-widest"
                    >
                        閉じる
                    </button>
                </div>
            </div>
        </div>
    );
}

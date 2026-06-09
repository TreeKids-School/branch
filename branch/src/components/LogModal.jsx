import React from 'react';
import { X, Clock, RotateCcw, User } from 'lucide-react';

export default function LogModal({ show, onClose, logs = [], onRestore }) {
    if (!show) return null;

    const formatDateTime = (ts) => {
        if (!ts) return '';
        const d = new Date(ts);
        const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
        const timeStr = d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        return `${dateStr} ${timeStr}`;
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 animate-in fade-in duration-300">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={onClose} />
            
            {/* Modal Box */}
            <div className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col border border-white animate-in zoom-in-95 duration-500 max-h-[85vh]">
                {/* Header */}
                <div className="p-5 bg-slate-700 flex items-center justify-between shadow-lg flex-shrink-0 text-white">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                            <Clock className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="font-black text-lg tracking-tight">本日の変更履歴（直近10件）</h3>
                            <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest opacity-80">Change Log & Restore</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-all text-white/80 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 bg-slate-50 flex-1 overflow-y-auto space-y-4">
                    <p className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">
                        編集内容の履歴です。右側の「復元」ボタンを押すと、その変更の直前の状態に戻すことができます。
                    </p>
                    
                    {logs.length === 0 ? (
                        <div className="py-16 flex flex-col items-center justify-center text-slate-400 bg-white rounded-[2rem] border border-slate-100 shadow-sm">
                            <Clock className="w-12 h-12 text-slate-300 mb-3 animate-pulse" />
                            <p className="text-sm font-bold">本日の変更履歴はまだありません。</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {logs.map((log) => (
                                <div key={log.id} className="p-4 bg-white rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                                    <div className="flex-1 space-y-2.5 min-w-0 w-full">
                                        {/* Metadata header */}
                                        <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold">
                                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                                                {formatDateTime(log.timestamp)}
                                            </span>
                                            <span className="flex items-center gap-1 text-slate-500">
                                                <User className="w-3.5 h-3.5 text-slate-400" />
                                                {log.staffName}
                                            </span>
                                            <span className="text-slate-300">|</span>
                                            <span className="text-tree-700">
                                                {log.childName}
                                            </span>
                                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full border border-slate-200">
                                                {log.description}
                                            </span>
                                        </div>
                                        
                                        {/* Before / After comparison */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                                            <div className="p-2.5 bg-red-50/40 rounded-xl border border-red-100/50">
                                                <span className="text-[9px] font-black text-red-500 block mb-0.5">変更前:</span>
                                                <p className="font-medium text-slate-600 break-all whitespace-pre-wrap max-h-[100px] overflow-y-auto">
                                                    {log.prevDisplay}
                                                </p>
                                            </div>
                                            <div className="p-2.5 bg-green-50/40 rounded-xl border border-green-100/50">
                                                <span className="text-[9px] font-black text-green-600 block mb-0.5">変更後:</span>
                                                <p className="font-medium text-slate-700 break-all whitespace-pre-wrap max-h-[100px] overflow-y-auto">
                                                    {log.newDisplay}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action button */}
                                    <button
                                        onClick={() => onRestore(log)}
                                        className="w-full md:w-auto px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5 flex-shrink-0"
                                    >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                        <span>復元する</span>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-white border-t border-slate-100 flex justify-end flex-shrink-0">
                    <button 
                        onClick={onClose}
                        className="px-8 py-3 bg-slate-700 hover:bg-slate-800 text-white rounded-xl font-black text-xs shadow-md transition-all active:scale-95 uppercase tracking-widest"
                    >
                        閉じる
                    </button>
                </div>
            </div>
        </div>
    );
}

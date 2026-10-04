import React, { useState } from 'react';
import { X, Sparkles, MapPin, MousePointerClick, History, Check, Calendar, Bookmark } from 'lucide-react';
import { UPDATE_HISTORY, APP_VERSION } from '../app_constants';

export default function UpdateModal({ show, onClose, onAcknowledge, onStartTour }) {
    const [selectedVersion, setSelectedVersion] = useState(UPDATE_HISTORY[0]?.version || APP_VERSION);

    if (!show) return null;

    const currentUpdate = UPDATE_HISTORY.find(u => u.version === selectedVersion) || UPDATE_HISTORY[0];

    const handleClose = (dontShowAgain = true) => {
        if (dontShowAgain && onAcknowledge) {
            onAcknowledge();
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 md:p-6 animate-in fade-in duration-200">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => handleClose(false)} />

            {/* Modal Window */}
            <div className="relative w-full max-w-2xl max-h-[92vh] bg-white rounded-3xl md:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col border border-white/80 animate-in zoom-in-95 duration-300 z-10">
                
                {/* Header */}
                <div className="px-6 py-5 bg-gradient-to-r from-tree-600 via-tree-700 to-emerald-700 text-white flex items-center justify-between shadow-md flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-white/15 rounded-2xl backdrop-blur-md ring-1 ring-white/30 shadow-inner">
                            <Sparkles className="w-6 h-6 text-yellow-300 animate-pulse" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-black text-lg md:text-xl tracking-tight text-white">アップデートのご案内</h3>
                                <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-black tracking-wide border border-white/30">
                                    v{APP_VERSION}
                                </span>
                            </div>
                            <p className="text-[11px] text-emerald-100 font-bold opacity-90 mt-0.5">
                                最新の機能改善と使い方ガイド
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={() => handleClose(false)}
                        className="p-2 hover:bg-white/15 rounded-xl transition-all text-white/80 hover:text-white cursor-pointer"
                        title="閉じる"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Version Selector Tabs */}
                <div className="flex items-center gap-2 px-6 py-2.5 bg-slate-100/80 border-b border-slate-200/60 overflow-x-auto custom-scrollbar-hidden flex-shrink-0">
                    <div className="flex items-center gap-1.5 text-xs font-black text-slate-500 mr-1 flex-shrink-0">
                        <History className="w-3.5 h-3.5" />
                        <span>バージョン:</span>
                    </div>
                    {UPDATE_HISTORY.map((u, idx) => {
                        const isSelected = u.version === selectedVersion;
                        const isLatest = idx === 0;
                        return (
                            <button
                                key={u.version}
                                onClick={() => setSelectedVersion(u.version)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap cursor-pointer ${
                                    isSelected
                                        ? 'bg-tree-600 text-white shadow-sm'
                                        : 'bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200/80'
                                }`}
                            >
                                <span>v{u.version}</span>
                                {isLatest && (
                                    <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-black uppercase ${
                                        isSelected ? 'bg-yellow-400 text-tree-950' : 'bg-tree-100 text-tree-700'
                                    }`}>
                                        最新
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Content Body */}
                <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-5 custom-scrollbar bg-slate-50/40">
                    {/* Version Theme Card */}
                    <div className="p-4 bg-white rounded-2xl border border-slate-200/70 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2 text-xs font-black text-slate-400 mb-0.5">
                                <Calendar className="w-3.5 h-3.5" />
                                <span>リリース日: {currentUpdate.date}</span>
                            </div>
                            <h4 className="font-black text-slate-800 text-sm md:text-base">
                                {currentUpdate.title}
                            </h4>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            {onStartTour && (
                                <button
                                    onClick={() => {
                                        onClose();
                                        onStartTour();
                                    }}
                                    className="px-3.5 py-2 bg-gradient-to-r from-tree-600 to-emerald-600 hover:from-tree-700 hover:to-emerald-700 text-white rounded-xl text-xs font-black shadow-md flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                                >
                                    <Sparkles className="w-3.5 h-3.5 text-yellow-300 animate-pulse" />
                                    <span>画面で操作ツアーを見る</span>
                                </button>
                            )}
                            <div className="hidden sm:flex items-center gap-1 px-3 py-2 bg-tree-50 text-tree-700 rounded-xl text-xs font-black border border-tree-200">
                                <Bookmark className="w-3.5 h-3.5" />
                                <span>{currentUpdate.items.length}件</span>
                            </div>
                        </div>
                    </div>

                    {/* Update Items */}
                    <div className="space-y-4">
                        {currentUpdate.items.map((item, idx) => {
                            const isNew = item.badge === 'new';
                            return (
                                <div 
                                    key={idx}
                                    className="bg-white rounded-2xl md:rounded-3xl border border-slate-200/80 p-4 md:p-5 shadow-xs hover:shadow-md transition-shadow space-y-3.5"
                                >
                                    {/* Item Header */}
                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                                isNew 
                                                     ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                                                     : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                                            }`}>
                                                {isNew ? '✨ 新機能' : '⚡ 改善'}
                                            </span>
                                            <h5 className="font-black text-slate-800 text-sm md:text-base">
                                                {item.title}
                                            </h5>
                                        </div>

                                        {item.id && onStartTour && (
                                            <button
                                                onClick={() => {
                                                    onClose();
                                                    onStartTour(item.id);
                                                }}
                                                className="px-3 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80 rounded-xl text-[11px] font-black flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-xs"
                                                title="画面上でどこを押してどうなるかを確認"
                                            >
                                                <MousePointerClick className="w-3.5 h-3.5 text-amber-600" />
                                                <span>画面で確認</span>
                                            </button>
                                        )}
                                    </div>

                                    {/* Action Guide: どこで & どんな操作で */}
                                    <div className="grid grid-cols-1 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200/60">
                                        {/* Location */}
                                        <div className="flex items-start gap-2.5">
                                            <div className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg flex-shrink-0 mt-0.5">
                                                <MapPin className="w-3.5 h-3.5" />
                                            </div>
                                            <div className="flex-1 text-xs">
                                                <span className="font-black text-slate-400 block text-[10px] uppercase tracking-wider">どこで（場所）</span>
                                                <span className="font-black text-slate-800 leading-snug">{item.location}</span>
                                            </div>
                                        </div>

                                        <div className="h-px bg-slate-200/60 my-0.5" />

                                        {/* Action */}
                                        <div className="flex items-start gap-2.5">
                                            <div className="p-1.5 bg-indigo-100 text-indigo-800 rounded-lg flex-shrink-0 mt-0.5">
                                                <MousePointerClick className="w-3.5 h-3.5" />
                                            </div>
                                            <div className="flex-1 text-xs">
                                                <span className="font-black text-slate-400 block text-[10px] uppercase tracking-wider">どんな操作で（手順）</span>
                                                <span className="font-black text-indigo-950 leading-snug">{item.action}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Description */}
                                    <p className="text-xs text-slate-600 font-bold leading-relaxed px-1">
                                        {item.description}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 flex-shrink-0">
                    <p className="text-xs text-slate-400 font-bold text-center sm:text-left">
                        ※ この画面は「設定（歯車）」の「アップデート履歴」からいつでも確認できます。
                    </p>
                    <button
                        onClick={() => handleClose(true)}
                        className="w-full sm:w-auto px-7 py-3 bg-tree-600 hover:bg-tree-700 text-white rounded-2xl font-black text-xs shadow-lg shadow-tree-100 transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                    >
                        <Check className="w-4 h-4" />
                        <span>確認しました（閉じる）</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
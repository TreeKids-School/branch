import React, { useState } from 'react';
import { X, PlusCircle, UserPlus, Search } from 'lucide-react';

export default function AddChildModal({ show, onClose, masterChildren, currentChildren, onAddChild }) {
    const [searchQuery, setSearchQuery] = useState('');
    if (!show) return null;

    const availableChildren = masterChildren
        .filter(m => !currentChildren.some(c => c.id === m.id))
        .filter(m => {
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            return (m.name || '').toLowerCase().includes(q) || (m.yomi || '').toLowerCase().includes(q);
        })
        .sort((a, b) => {
            const aStr = a.yomi || a.name || '';
            const bStr = b.yomi || b.name || '';
            return aStr.localeCompare(bStr, 'ja');
        });

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={onClose} />
            <div className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col border border-white animate-in zoom-in-95 duration-500">
                
                {/* Header */}
                <div className="p-6 bg-tree-600 flex items-center justify-between shadow-lg">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                            <UserPlus className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="font-black text-xl text-white tracking-tight">児童を選択</h3>
                            <p className="text-[9px] font-bold text-tree-100 uppercase tracking-widest opacity-80">Add child to daily report</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-all text-white/80 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Search Bar */}
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-100">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                            type="text" 
                            placeholder="名前や読み仮名で検索..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-[13px] font-bold text-slate-600 focus:outline-none focus:border-tree-400 focus:ring-4 focus:ring-tree-50 transition-all shadow-sm"
                        />
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar space-y-3 bg-slate-50/50">
                    {availableChildren.length === 0 ? (
                        <div className="text-center py-12 space-y-4">
                            <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto">
                                <PlusCircle className="w-8 h-8 text-slate-300" />
                            </div>
                            <p className="font-bold text-slate-400 text-sm">全ての児童が既に追加されています</p>
                        </div>
                    ) : (
                        availableChildren.map(child => (
                            <button 
                                key={child.id} 
                                onClick={() => { onAddChild(child); onClose(); }}
                                className="w-full p-4 bg-white hover:bg-tree-50 border border-slate-100 rounded-2xl flex items-center justify-between group transition-all active:scale-95 shadow-sm hover:shadow-md"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-tree-50 rounded-full flex items-center justify-center text-tree-600 font-black text-sm group-hover:bg-tree-100 transition-colors">
                                        {child.name[0]}
                                    </div>
                                    <span className="font-black text-slate-700 tracking-tight">{child.name}</span>
                                </div>
                                <PlusCircle className="w-5 h-5 text-slate-200 group-hover:text-tree-500 transition-colors" />
                            </button>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 bg-white border-t border-slate-100 flex justify-center">
                    <button 
                        onClick={onClose}
                        className="px-8 py-3 font-black text-xs text-slate-400 hover:text-slate-600 uppercase tracking-widest transition-all"
                    >
                        キャンセル
                    </button>
                </div>
            </div>
        </div>
    );
}

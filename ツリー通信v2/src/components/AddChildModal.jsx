import React, { useState, useEffect, useRef } from 'react';
import { X, PlusCircle, UserPlus, Search, Check, Clock } from 'lucide-react';

export default function AddChildModal({ show, onClose, masterChildren, currentChildren, onAddChildren }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedToAdd, setSelectedToAdd] = useState([]);
    const inputRef = useRef(null);

    // Autofocus input when modal opens, and clear selections
    useEffect(() => {
        if (show) {
            setSelectedToAdd([]);
            setSearchQuery('');
            // Small timeout to guarantee DOM is rendered
            setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
        }
    }, [show]);

    if (!show) return null;

    // Filter master list to find children that are:
    // 1. Not already in current daily list (currentChildren)
    // 2. Not already in the modal's select list (selectedToAdd)
    const availableChildren = masterChildren
        .filter(m => !currentChildren.some(c => c.id === m.id))
        .filter(m => !selectedToAdd.some(s => s.id === m.id))
        .filter(m => {
            if (!searchQuery) return true;
            
            const toKatakana = (str) => {
                return str.replace(/[\u3041-\u3096]/g, (match) => {
                    return String.fromCharCode(match.charCodeAt(0) + 0x60);
                });
            };

            const toHiragana = (str) => {
                return str.replace(/[\u30a1-\u30f6]/g, (match) => {
                    return String.fromCharCode(match.charCodeAt(0) - 0x60);
                });
            };
            
            const q = searchQuery.toLowerCase().trim();
            const qKata = toKatakana(q);
            const qHira = toHiragana(q);
            
            const nameStr = (m.name || '').toLowerCase();
            const fullNameStr = `${m.lastName || ''}${m.firstName || ''}`.toLowerCase();
            const furiganaStr = `${m.lastNameFurigana || ''}${m.firstNameFurigana || ''}`.toLowerCase();
            const nameFuriStr = (m.nameFurigana || '').toLowerCase();
            const yomiStr = (m.yomi || '').toLowerCase();
            
            const targets = [
                nameStr, 
                fullNameStr, 
                furiganaStr, 
                nameFuriStr, 
                yomiStr,
                toKatakana(furiganaStr),
                toHiragana(furiganaStr),
                toKatakana(nameFuriStr),
                toHiragana(nameFuriStr),
                toKatakana(yomiStr),
                toHiragana(yomiStr)
            ];
            
            return targets.some(target => target.includes(q) || target.includes(qKata) || target.includes(qHira));
        })
        .sort((a, b) => {
            const aStr = a.yomi || a.name || '';
            const bStr = b.yomi || b.name || '';
            return aStr.localeCompare(bStr, 'ja');
        });

    const handleSelectChild = (child) => {
        setSelectedToAdd(prev => [...prev, child]);
        setSearchQuery(''); // reset search query so user can type next child name
        inputRef.current?.focus();
    };

    const handleDeselectChild = (childId) => {
        setSelectedToAdd(prev => prev.filter(c => c.id !== childId));
        inputRef.current?.focus();
    };

    const handleAddSubmit = (isWaitlist = false) => {
        onAddChildren(selectedToAdd, isWaitlist);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={onClose} />
            <div className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col border border-white animate-in zoom-in-95 duration-500 max-h-[90vh]">
                
                {/* Header */}
                <div className="p-6 bg-tree-600 flex items-center justify-between shadow-lg flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                            <UserPlus className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="font-black text-xl text-white tracking-tight">児童を選択して追加</h3>
                            <p className="text-[9px] font-bold text-tree-100 uppercase tracking-widest opacity-80">Add children to daily report</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-all text-white/80 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Main Body (Flex column) */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-slate-50/50 flex flex-col gap-4">
                    
                    {/* Part 1: Pool of children to be added */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex-shrink-0">
                        <h4 className="font-black text-[10px] text-slate-400 uppercase tracking-widest mb-2 flex items-center justify-between">
                            <span>追加予定の児童 ({selectedToAdd.length} 名)</span>
                            {selectedToAdd.length > 0 && <span className="text-[9px] text-tree-600 font-bold bg-tree-50 px-2 py-0.5 rounded-full border border-tree-100 shadow-sm">追加待機中</span>}
                        </h4>
                        
                        {selectedToAdd.length === 0 ? (
                            <p className="text-center py-6 text-xs text-slate-400 font-bold italic bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                                下の検索欄から児童を検索し、タップして選択してください。
                            </p>
                        ) : (
                            <div className="flex flex-wrap gap-2 max-h-[120px] overflow-y-auto custom-scrollbar p-1">
                                {selectedToAdd.map(child => (
                                    <div 
                                        key={child.id}
                                        className="bg-tree-50 text-tree-700 font-bold border border-tree-200 pl-3 pr-1 py-1 rounded-full flex items-center gap-1.5 shadow-sm text-xs animate-in zoom-in-95 duration-200"
                                    >
                                        <span>{child.lastName ? `${child.lastName} ${child.firstName}` : child.name}</span>
                                        <button 
                                            onClick={() => handleDeselectChild(child.id)}
                                            className="p-1 hover:bg-tree-100 rounded-full text-tree-500 transition-colors"
                                            title="除外する"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Part 2: Search suggestion list (Shown ABOVE search input) */}
                    <div className="flex-1 min-h-[180px] bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col overflow-hidden">
                        <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">検索結果候補</span>
                            <span className="text-[9px] font-bold text-slate-400 bg-white px-2 py-0.5 rounded-full border border-slate-150 shadow-inner">
                                {searchQuery ? `${availableChildren.length} 件一致` : '全件表示中'}
                            </span>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1 bg-white">
                            {availableChildren.length === 0 ? (
                                <div className="text-center py-10 space-y-2">
                                    <p className="font-bold text-slate-300 text-xs">見つかりませんでした</p>
                                    <p className="text-[10px] text-slate-400">名前または読み仮名を入力し直してください</p>
                                </div>
                            ) : (
                                availableChildren.map(child => (
                                    <button 
                                        key={child.id} 
                                        onClick={() => handleSelectChild(child)}
                                        className="w-full p-2.5 bg-slate-50/50 hover:bg-tree-50 border border-slate-100 rounded-xl flex items-center justify-between group transition-all active:scale-98 shadow-sm hover:shadow-md"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-7 h-7 bg-tree-50 rounded-full flex items-center justify-center text-tree-600 font-black text-xs group-hover:bg-tree-100 transition-colors flex-shrink-0">
                                                {(child.lastName || child.name || '?')[0]}
                                            </div>
                                            <div className="text-left min-w-0">
                                                <span className="font-black text-slate-700 tracking-tight text-xs block truncate">
                                                    {child.lastName ? `${child.lastName} ${child.firstName}` : child.name}
                                                </span>
                                                {(child.lastNameFurigana || child.nameFurigana) && (
                                                    <span className="text-[8px] text-slate-400 font-bold block truncate opacity-70">
                                                        {child.lastNameFurigana ? `${child.lastNameFurigana} ${child.firstNameFurigana}` : child.nameFurigana}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <PlusCircle className="w-4.5 h-4.5 text-slate-300 group-hover:text-tree-500 transition-colors flex-shrink-0" />
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Part 3: Search input (At the bottom of content) */}
                    <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex-shrink-0">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                            <input 
                                ref={inputRef}
                                type="text" 
                                placeholder="名前や読み仮名で検索して追加予定に追加..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{ fontSize: '16px' }} // Prevent iOS Zoom
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 focus:outline-none focus:border-tree-400 focus:ring-4 focus:ring-tree-50 transition-all shadow-sm placeholder:text-slate-400"
                            />
                            {searchQuery && (
                                <button 
                                    onClick={() => { setSearchQuery(''); inputRef.current?.focus(); }}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-200 rounded-full text-slate-400 transition-colors"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 bg-white border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 flex-shrink-0">
                    <button 
                        onClick={onClose}
                        className="px-6 py-2.5 font-black text-xs text-slate-400 hover:text-slate-600 uppercase tracking-widest transition-all w-full sm:w-auto text-center"
                    >
                        キャンセル
                    </button>
                    <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                        <button
                            onClick={() => handleAddSubmit(true)}
                            disabled={selectedToAdd.length === 0}
                            className="px-4 py-3 bg-wood-500 hover:bg-wood-600 text-white rounded-xl font-black text-xs shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 uppercase tracking-widest w-full sm:w-auto"
                        >
                            <Clock className="w-4 h-4" />
                            <span>キャンセル待ちとして追加</span>
                        </button>
                        <button
                            onClick={() => handleAddSubmit(false)}
                            disabled={selectedToAdd.length === 0}
                            className="px-4 py-3 bg-tree-600 hover:bg-tree-700 text-white rounded-xl font-black text-xs shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 uppercase tracking-widest w-full sm:w-auto"
                        >
                            <Check className="w-4 h-4" />
                            <span>通常児童として追加</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

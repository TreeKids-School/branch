import React, { useState, useEffect } from 'react';
import { X, Save, UserPlus, Trash2, User, MapPin, Search, Check, Plus } from 'lucide-react';
import { callStorage } from '../hooks/useStorage';

export default function MasterListModal({ onClose, onSelect }) {
    const [masterList, setMasterList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newName, setNewName] = useState('');
    const [newPickup, setNewPickup] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const fetchMaster = async () => {
            const list = await callStorage({ action: 'getMasterChildren' });
            setMasterList(list || []);
            setLoading(false);
        };
        fetchMaster();
    }, []);

    const handleAdd = async () => {
        if (!newName.trim()) return;
        const newChild = {
            id: crypto.randomUUID(),
            name: newName.trim(),
            defaultPickupLocation: newPickup.trim(),
            timestamp: Date.now()
        };
        const newList = [...masterList, newChild];
        setMasterList(newList);
        await callStorage({ action: 'saveMasterChildren', data: newList });
        setNewName('');
        setNewPickup('');
    };

    const handleDelete = async (id) => {
        if (!confirm('マスタから削除しますか？')) return;
        const newList = masterList.filter(c => c.id !== id);
        setMasterList(newList);
        await callStorage({ action: 'saveMasterChildren', data: newList });
    };

    const filteredList = masterList.filter(c => 
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" onClick={onClose} />
            
            <div className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-[3rem] md:rounded-[4rem] shadow-2xl overflow-hidden flex flex-col border border-white animate-in zoom-in-95 duration-500">
                {/* Header - Purple Theme for Master List */}
                <div className="p-8 md:p-10 bg-indigo-600 flex items-center justify-between shadow-xl flex-shrink-0 z-10">
                    <div className="flex items-center gap-5">
                        <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md ring-2 ring-white/20">
                            <User className="w-7 h-7 text-white" />
                        </div>
                        <div>
                            <h3 className="font-black text-2xl text-white tracking-tight">児童マスタ管理</h3>
                            <p className="text-[10px] font-black text-indigo-100 uppercase tracking-[0.2em] mt-1.5 opacity-80">Master Database</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-4 hover:bg-white/10 rounded-2xl transition-all text-white/80 hover:text-white">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                    {/* Left: Add New Form */}
                    <div className="w-full md:w-1/3 p-8 border-b md:border-b-0 md:border-r border-slate-100 bg-slate-50/50">
                        <h4 className="font-black text-[11px] text-slate-400 uppercase tracking-[0.25em] mb-8 flex items-center gap-2">
                            <UserPlus className="w-4 h-4 text-indigo-500" /> 新規登録
                        </h4>
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-3">児童氏名</label>
                                <input
                                    type="text"
                                    value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                    placeholder="名前を入力..."
                                    className="w-full px-6 py-4 bg-white border-2 border-slate-100 rounded-2xl focus:border-indigo-500 outline-none transition-all text-sm font-bold shadow-inner"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-3">デフォルト迎え場所</label>
                                <div className="relative">
                                    <MapPin className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                                    <input
                                        type="text"
                                        value={newPickup}
                                        onChange={e => setNewPickup(e.target.value)}
                                        placeholder="学校名など..."
                                        className="w-full pl-12 pr-6 py-4 bg-white border-2 border-slate-100 rounded-2xl focus:border-indigo-500 outline-none transition-all text-sm font-bold shadow-inner"
                                    />
                                </div>
                            </div>
                            <button
                                onClick={handleAdd}
                                className="w-full py-5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-2xl font-black text-xs shadow-lg shadow-indigo-100 transition-all active:scale-95 flex items-center justify-center gap-2 uppercase tracking-widest"
                            >
                                <Plus className="w-4 h-4" /> 追加する
                            </button>
                        </div>
                    </div>

                    {/* Right: List and Selection */}
                    <div className="flex-1 p-8 flex flex-col min-h-0 bg-white">
                        <div className="relative mb-6">
                            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="児童を検索..."
                                className="w-full pl-14 pr-8 py-5 bg-slate-50 border-2 border-slate-100 rounded-3xl focus:border-indigo-500 focus:bg-white outline-none transition-all text-sm font-bold"
                            />
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                            {loading ? (
                                <div className="flex items-center justify-center h-full opacity-30 italic font-black uppercase text-xs tracking-widest">Loading Master...</div>
                            ) : filteredList.length === 0 ? (
                                <div className="flex items-center justify-center h-full opacity-20 italic font-black uppercase text-xs tracking-widest">No entries found</div>
                            ) : (
                                filteredList.map(child => (
                                    <div key={child.id} className="group flex items-center justify-between p-5 bg-slate-50 hover:bg-indigo-50 rounded-3xl border border-transparent hover:border-indigo-100 transition-all cursor-pointer" onClick={() => onSelect(child)}>
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center font-black text-indigo-600 border border-slate-100 group-hover:scale-110 transition-transform">
                                                {child.name[0]}
                                            </div>
                                            <div>
                                                <h5 className="font-black text-slate-700">{child.name}</h5>
                                                {child.defaultPickupLocation && (
                                                    <p className="text-[9px] font-bold text-slate-400 mt-0.5 flex items-center gap-1">
                                                        <MapPin className="w-2.5 h-2.5" /> {child.defaultPickupLocation}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-2 transition-opacity">
                                                <div className="px-4 py-2 bg-white text-indigo-600 rounded-full text-[9px] font-black border border-indigo-100 shadow-sm">
                                                    本日のリストに追加
                                                </div>
                                                <button onClick={(e) => { e.stopPropagation(); handleDelete(child.id); }} className="p-3 text-slate-300 hover:text-apple-500 transition-colors">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <Check className="w-5 h-5 text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end">
                    <button onClick={onClose} className="px-10 py-5 bg-slate-800 hover:bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95">
                        閉じる
                    </button>
                </div>
            </div>
        </div>
    );
}

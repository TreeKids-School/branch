import React, { useState, useEffect } from 'react';
import { X, Save, Settings, Key, Tag, Plus, Trash2, Cpu } from 'lucide-react';

export default function SettingsModal({ onClose, config, onSaveConfig, tags, onSaveTags }) {
    const [localConfig, setLocalConfig] = useState(config);
    const [localTags, setLocalTags] = useState(tags);
    const [newTag, setNewTag] = useState('');

    useEffect(() => {
        setLocalConfig(config);
        setLocalTags(tags);
    }, [config, tags]);

    const handleSave = () => {
        onSaveConfig(localConfig);
        onSaveTags(localTags);
        onClose();
    };

    const addTag = () => {
        if (!newTag.trim() || localTags.includes(newTag.trim())) return;
        setLocalTags([...localTags, newTag.trim()]);
        setNewTag('');
    };

    const removeTag = (tag) => {
        setLocalTags(localTags.filter(t => t !== tag));
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" onClick={onClose} />
            
            <div className="relative w-full max-w-2xl bg-white rounded-[4rem] shadow-2xl overflow-hidden flex flex-col border border-white animate-in zoom-in-95 duration-500">
                {/* Header - Apple Red Brand */}
                <div className="p-8 md:p-10 bg-apple-600 flex items-center justify-between shadow-xl flex-shrink-0 z-10">
                    <div className="flex items-center gap-5">
                        <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md ring-2 ring-white/20">
                            <Settings className="w-7 h-7 text-white" />
                        </div>
                        <div>
                            <h3 className="font-black text-2xl text-white tracking-tight">システム設定</h3>
                            <p className="text-[10px] font-black text-apple-100 uppercase tracking-[0.2em] mt-1.5 opacity-80">AI & Environment Config</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-4 hover:bg-white/10 rounded-2xl transition-all text-white/80 hover:text-white">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 md:p-12 space-y-12 custom-scrollbar bg-slate-50/30">
                    {/* AI Configuration Section */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-3 px-2">
                            <div className="w-2 h-2 rounded-full bg-apple-500 shadow-md animate-pulse" />
                            <h4 className="font-black text-[11px] text-slate-400 uppercase tracking-[0.25em]">基本構成</h4>
                        </div>
                        <div className="glass-card p-8 md:p-10 rounded-[3.5rem] border border-white shadow-premium space-y-8">
                            <div className="space-y-5">
                                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest pl-3 flex items-center gap-2">
                                    <Key className="w-3.5 h-3.5 text-apple-400" /> AI APIキー設定
                                </label>
                                <input
                                    type="password"
                                    value={localConfig.apiKey}
                                    onChange={e => setLocalConfig(p => ({ ...p, apiKey: e.target.value }))}
                                    placeholder="sk-..."
                                    className="w-full px-8 py-5 bg-slate-50 border-2 border-slate-100 rounded-full focus:border-apple-500 focus:bg-white focus:ring-8 md:focus:ring-[15px] focus:ring-apple-50 outline-none transition-all font-mono text-sm shadow-inner"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Tag Management Section */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-3 px-2">
                            <div className="w-2 h-2 rounded-full bg-tree-500 shadow-md" />
                            <h4 className="font-black text-[11px] text-slate-400 uppercase tracking-[0.25em]">チャットメモ用タグ管理</h4>
                        </div>
                        <div className="glass-card p-8 md:p-10 rounded-[3.5rem] border border-white shadow-premium space-y-10">
                            <div className="flex flex-wrap gap-3">
                                {localTags.map(tag => (
                                    <div key={tag} className="flex items-center gap-2 px-5 py-2.5 bg-tree-50 text-tree-700 rounded-full text-xs font-black border border-tree-100 shadow-sm animate-in zoom-in-95 group hover:bg-tree-100 transition-colors">
                                        {tag}
                                        <button onClick={() => removeTag(tag)} className="p-0.5 hover:text-apple-500 transition-colors">
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <div className="flex gap-3">
                                <div className="relative flex-1">
                                    <Tag className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                                    <input
                                        type="text"
                                        value={newTag}
                                        onChange={e => setNewTag(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && addTag()}
                                        placeholder="新しいタグを追加..."
                                        className="w-full pl-14 pr-8 py-5 bg-slate-50 border-2 border-slate-100 rounded-full focus:border-tree-500 focus:bg-white focus:ring-8 focus:ring-tree-50 outline-none transition-all text-sm font-bold shadow-inner"
                                    />
                                </div>
                                <button onClick={addTag} className="p-5 bg-tree-500 hover:bg-tree-600 text-white rounded-full shadow-lg shadow-tree-100 transition-all active:scale-90">
                                    <Plus className="w-6 h-6" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-8 md:p-10 bg-slate-50/80 backdrop-blur-sm border-t border-slate-100 flex items-center justify-end gap-6 flex-shrink-0">
                    <button onClick={onClose} className="px-8 py-4 font-black text-xs text-slate-400 hover:text-slate-600 transition-all uppercase tracking-[0.2em]">
                        キャンセル
                    </button>
                    <button onClick={handleSave} className="px-12 py-5 bg-apple-600 hover:bg-apple-700 text-white rounded-full font-black text-xs md:text-sm shadow-2xl shadow-apple-100 transition-all active:scale-95 flex items-center gap-4 uppercase tracking-[0.15em]">
                        <Save className="w-5 h-5 md:w-6 md:h-6" />
                        設定を保存
                    </button>
                </div>
            </div>
        </div>
    );
}

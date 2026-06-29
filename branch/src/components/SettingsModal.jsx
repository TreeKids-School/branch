import React, { useState, useEffect } from 'react';
import { X, Save, Settings, Tag, Plus, Trash2, CheckCircle2 } from 'lucide-react';

export default function SettingsModal({ onClose, tags, onSaveTags, okWords = [], onSaveOkWords }) {
    const [localTags, setLocalTags] = useState(tags);
    const [newTag, setNewTag] = useState('');

    const [localOkWords, setLocalOkWords] = useState(okWords);
    const [newOkWord, setNewOkWord] = useState('');

    const [activeTab, setActiveTab] = useState('tags'); // 'tags' or 'okWords'

    useEffect(() => {
        setLocalTags(tags);
    }, [tags]);

    useEffect(() => {
        setLocalOkWords(okWords);
    }, [okWords]);

    const handleSave = () => {
        onSaveTags(localTags);
        if (onSaveOkWords) {
            onSaveOkWords(localOkWords);
        }
        onClose();
    };

    // Tags actions
    const addTag = () => {
        if (!newTag.trim() || localTags.includes(newTag.trim())) return;
        setLocalTags([...localTags, newTag.trim()]);
        setNewTag('');
    };

    const removeTag = (tag) => {
        setLocalTags(localTags.filter(t => t !== tag));
    };

    // OK Words actions
    const addOkWord = () => {
        if (!newOkWord.trim() || localOkWords.includes(newOkWord.trim())) return;
        setLocalOkWords([...localOkWords, newOkWord.trim()]);
        setNewOkWord('');
    };

    const removeOkWord = (word) => {
        setLocalOkWords(localOkWords.filter(w => w !== word));
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" onClick={onClose} />
            
            <div className="relative w-full max-w-2xl max-h-[95vh] bg-white rounded-[2rem] md:rounded-[4rem] shadow-2xl overflow-hidden flex flex-col border border-white animate-in zoom-in-95 duration-500">
                {/* Header - Apple Red Brand */}
                <div className="p-8 md:p-10 bg-apple-600 flex items-center justify-between shadow-xl flex-shrink-0 z-10">
                    <div className="flex items-center gap-5">
                        <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md ring-2 ring-white/20">
                            <Settings className="w-7 h-7 text-white" />
                        </div>
                        <div>
                            <h3 className="font-black text-2xl text-white tracking-tight">システム設定</h3>
                            <p className="text-[10px] font-black text-apple-100 uppercase tracking-[0.2em] mt-1.5 opacity-80 font-mono">Environment Config</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-4 hover:bg-white/10 rounded-2xl transition-all text-white/80 hover:text-white">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Tab Navigation */}
                <div className="flex border-b border-slate-100 bg-slate-50/50 px-8 flex-shrink-0 z-10 shadow-sm">
                    <button
                        onClick={() => setActiveTab('tags')}
                        className={`flex items-center gap-2 py-4 px-6 text-xs font-black tracking-wider uppercase border-b-2 transition-all ${
                            activeTab === 'tags'
                                ? 'border-apple-600 text-apple-600'
                                : 'border-transparent text-slate-400 hover:text-slate-600'
                        }`}
                    >
                        <Tag className="w-4 h-4" />
                        <span>タグ管理</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('okWords')}
                        className={`flex items-center gap-2 py-4 px-6 text-xs font-black tracking-wider uppercase border-b-2 transition-all ${
                            activeTab === 'okWords'
                                ? 'border-apple-600 text-apple-600'
                                : 'border-transparent text-slate-400 hover:text-slate-600'
                        }`}
                    >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>OKワード管理</span>
                    </button>
                </div>

                {/* Tab Contents */}
                <div className="flex-1 overflow-y-auto p-8 md:p-12 space-y-12 custom-scrollbar bg-slate-50/30">
                    {activeTab === 'tags' ? (
                        /* Tag Management Section */
                        <div className="space-y-6 animate-in fade-in duration-300">
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
                                    {localTags.length === 0 && (
                                        <span className="text-xs text-slate-400 font-bold p-2">タグが登録されていません。</span>
                                    )}
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
                                    <button onClick={addTag} className="p-5 bg-tree-500 hover:bg-tree-600 text-white rounded-full shadow-lg shadow-tree-100 transition-all active:scale-90 flex-shrink-0">
                                        <Plus className="w-6 h-6" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* OK Words Management Section */
                        <div className="space-y-6 animate-in fade-in duration-300">
                            <div className="flex items-center gap-3 px-2">
                                <div className="w-2 h-2 rounded-full bg-apple-500 shadow-md" />
                                <h4 className="font-black text-[11px] text-slate-400 uppercase tracking-[0.25em]">共有OKワード管理 (スキャン除外)</h4>
                            </div>
                            <div className="glass-card p-8 md:p-10 rounded-[3.5rem] border border-white shadow-premium space-y-10">
                                <p className="text-xs text-slate-500 font-bold leading-relaxed px-2">
                                    ここに登録された単語は、ツリー通信の個人情報（実名）自動検知チェックの対象外となり、赤マーカー警告が表示されなくなります。お母さん、皆さんなどの他に、固有名詞や一般的な敬称付き単語を登録できます。
                                </p>
                                <div className="flex flex-wrap gap-3">
                                    {localOkWords.map(word => (
                                        <div key={word} className="flex items-center gap-2 px-5 py-2.5 bg-apple-50 text-apple-700 rounded-full text-xs font-black border border-apple-100 shadow-sm animate-in zoom-in-95 group hover:bg-apple-100 transition-colors">
                                            {word}
                                            <button onClick={() => removeOkWord(word)} className="p-0.5 hover:text-red-500 transition-colors">
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                    {localOkWords.length === 0 && (
                                        <span className="text-xs text-slate-400 font-bold p-2">登録済みのOKワードはありません。</span>
                                    )}
                                </div>
                                <div className="flex gap-3">
                                    <div className="relative flex-1">
                                        <CheckCircle2 className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                                        <input
                                            type="text"
                                            value={newOkWord}
                                            onChange={e => setNewOkWord(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && addOkWord()}
                                            placeholder="OKワード（例：山田さん、太郎くん）を追加..."
                                            className="w-full pl-14 pr-8 py-5 bg-slate-50 border-2 border-slate-100 rounded-full focus:border-apple-500 focus:bg-white focus:ring-8 focus:ring-apple-50 outline-none transition-all text-sm font-bold shadow-inner"
                                        />
                                    </div>
                                    <button onClick={addOkWord} className="p-5 bg-apple-600 hover:bg-apple-700 text-white rounded-full shadow-lg shadow-apple-100 transition-all active:scale-90 flex-shrink-0">
                                        <Plus className="w-6 h-6" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-8 md:p-10 bg-slate-50/80 backdrop-blur-sm border-t border-slate-100 flex items-center justify-end gap-6 flex-shrink-0">
                    <button onClick={onClose} className="px-6 py-4 font-black text-[10px] md:text-xs text-slate-400 hover:text-slate-600 transition-all uppercase tracking-[0.2em]">
                        閉じる（保存しない）
                    </button>
                    <button onClick={handleSave} className="px-8 md:px-12 py-5 bg-apple-600 hover:bg-apple-700 text-white rounded-full font-black text-[10px] md:text-sm shadow-2xl shadow-apple-100 transition-all active:scale-95 flex items-center gap-2 md:gap-4 uppercase tracking-[0.15em]">
                        <Save className="w-5 h-5 md:w-6 md:h-6" />
                        保存して閉じる
                    </button>
                </div>
            </div>
        </div>
    );
}

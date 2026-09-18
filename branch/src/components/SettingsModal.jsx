import React, { useState, useEffect } from 'react';
import { X, Save, Settings, Tag, Plus, Trash2, CheckCircle2 } from 'lucide-react';

export default function SettingsModal({ onClose, tags, tagInsertTexts = {}, onSaveTags, okWords = [], onSaveOkWords }) {
    const [localTags, setLocalTags] = useState(tags);
    const [localTagInsertTexts, setLocalTagInsertTexts] = useState(tagInsertTexts);
    const [newTag, setNewTag] = useState('');
    const [newTagInsertText, setNewTagInsertText] = useState('');

    const [localOkWords, setLocalOkWords] = useState(okWords);
    const [newOkWord, setNewOkWord] = useState('');

    const [activeTab, setActiveTab] = useState('tags'); // 'tags' or 'okWords'

    useEffect(() => {
        setLocalTags(tags);
    }, [tags]);

    useEffect(() => {
        setLocalTagInsertTexts(tagInsertTexts);
    }, [tagInsertTexts]);

    useEffect(() => {
        setLocalOkWords(okWords);
    }, [okWords]);

    const handleSave = () => {
        const cleanedTags = localTags.map(t => t.trim()).filter(Boolean);
        const uniqueTags = Array.from(new Set(cleanedTags));
        onSaveTags(uniqueTags, localTagInsertTexts);
        if (onSaveOkWords) {
            onSaveOkWords(localOkWords);
        }
        onClose();
    };

    // Tags actions
    const addTag = () => {
        const trimmed = newTag.trim();
        if (!trimmed || localTags.includes(trimmed)) return;
        setLocalTags([...localTags, trimmed]);
        if (newTagInsertText.trim()) {
            setLocalTagInsertTexts(prev => ({ ...prev, [trimmed]: newTagInsertText.trim() }));
        }
        setNewTag('');
        setNewTagInsertText('');
    };

    const removeTag = (tag) => {
        setLocalTags(localTags.filter(t => t !== tag));
        setLocalTagInsertTexts(prev => {
            const next = { ...prev };
            delete next[tag];
            return next;
        });
    };

    const handleUpdateTagName = (index, newName) => {
        const oldTag = localTags[index];
        setLocalTags(prev => {
            const next = [...prev];
            next[index] = newName;
            return next;
        });
        if (oldTag && oldTag !== newName) {
            setLocalTagInsertTexts(prev => {
                const next = { ...prev };
                if (oldTag in next) {
                    next[newName] = next[oldTag];
                    delete next[oldTag];
                }
                return next;
            });
        }
    };

    const handleUpdateInsertText = (tag, text) => {
        setLocalTagInsertTexts(prev => ({
            ...prev,
            [tag]: text
        }));
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
                            <div className="glass-card p-6 md:p-8 rounded-[2.5rem] border border-white shadow-premium space-y-6">
                                <p className="text-xs text-slate-500 font-bold leading-relaxed px-1">
                                    タグを選択した際に、チャットメモ入力欄の先頭へ自動挿入される文字を設定できます。<br className="hidden md:inline" />
                                    <span className="text-indigo-600 font-black">「＋プログラム内容」</span>ボタンを押すと、その日のプログラム概要が自動挿入されます。空欄にすると文字は自動挿入されません。
                                </p>

                                {/* Tag List with Auto-Insert Text Config */}
                                <div className="space-y-3 max-h-[42vh] overflow-y-auto custom-scrollbar pr-1">
                                    {localTags.length > 0 && (
                                        <div className="hidden md:flex items-center gap-2.5 px-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                            <span className="w-44">タグの名称（直接変更可）</span>
                                            <span className="flex-1">自動挿入する文字</span>
                                        </div>
                                    )}
                                    {localTags.map((tag, idx) => {
                                        const currentVal = localTagInsertTexts[tag] ?? '';
                                        return (
                                            <div 
                                                key={idx} 
                                                className="p-3.5 md:p-4 bg-slate-50/80 hover:bg-slate-50 rounded-2xl border border-slate-200/70 transition-all flex flex-col md:flex-row md:items-center gap-2.5 shadow-xs group"
                                            >
                                                <div className="flex items-center justify-between md:w-44 flex-shrink-0 gap-1.5">
                                                    <div className="relative w-full">
                                                        <input
                                                            type="text"
                                                            value={tag}
                                                            onChange={e => handleUpdateTagName(idx, e.target.value)}
                                                            placeholder="例: 【宿題】"
                                                            className="w-full px-3 py-2 bg-white border border-tree-200 rounded-xl text-xs font-black text-tree-800 placeholder:text-slate-300 focus:border-tree-500 focus:ring-2 focus:ring-tree-50 outline-none transition-all shadow-2xs"
                                                            title="タグ名を変更できます"
                                                        />
                                                    </div>
                                                    <button 
                                                        type="button"
                                                        onClick={() => removeTag(tag)} 
                                                        className="md:hidden text-slate-400 hover:text-rose-500 p-1 transition-colors flex-shrink-0"
                                                        title="タグを削除"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                                
                                                <div className="flex-1 flex items-center gap-2">
                                                    <div className="relative flex-1">
                                                        <input
                                                            type="text"
                                                            value={currentVal}
                                                            onChange={e => handleUpdateInsertText(tag, e.target.value)}
                                                            placeholder="自動挿入文字（空欄で自動挿入なし）"
                                                            className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 placeholder:text-slate-300 focus:border-tree-500 focus:ring-2 focus:ring-tree-50 outline-none transition-all shadow-2xs"
                                                        />
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleUpdateInsertText(tag, '{プログラム内容}')}
                                                        title="本日のプログラム概要を挿入する設定にします"
                                                        className="px-2.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-[10px] font-black border border-indigo-200 transition-all active:scale-95 whitespace-nowrap shadow-2xs"
                                                    >
                                                        ＋プログラム内容
                                                    </button>
                                                    <button 
                                                        type="button"
                                                        onClick={() => removeTag(tag)} 
                                                        className="hidden md:flex text-slate-300 hover:text-rose-500 p-2 rounded-xl hover:bg-rose-50 transition-all flex-shrink-0"
                                                        title="タグを削除"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {localTags.length === 0 && (
                                        <div className="text-center py-6 text-xs text-slate-400 font-bold">
                                            登録されているタグはありません。下のフォームから追加してください。
                                        </div>
                                    )}
                                </div>

                                {/* Add New Tag Form */}
                                <div className="p-4 bg-tree-50/40 rounded-2xl border border-tree-100/80 space-y-2.5">
                                    <div className="text-[10px] font-black text-tree-700 uppercase tracking-wider px-1">新しいタグを追加</div>
                                    <div className="flex flex-col md:flex-row gap-2">
                                        <div className="relative md:w-44 flex-shrink-0">
                                            <Tag className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                                            <input
                                                type="text"
                                                value={newTag}
                                                onChange={e => setNewTag(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && addTag()}
                                                placeholder="例: 【宿題】"
                                                className="w-full pl-10 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:border-tree-500 focus:ring-2 focus:ring-tree-50 outline-none text-xs font-bold text-slate-700 transition-all shadow-2xs"
                                            />
                                        </div>
                                        <input
                                            type="text"
                                            value={newTagInsertText}
                                            onChange={e => setNewTagInsertText(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && addTag()}
                                            placeholder="自動挿入文字（任意）"
                                            className="flex-1 px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:border-tree-500 focus:ring-2 focus:ring-tree-50 outline-none text-xs font-bold text-slate-700 transition-all shadow-2xs"
                                        />
                                        <button 
                                            type="button"
                                            onClick={addTag} 
                                            className="px-5 py-2.5 bg-tree-500 hover:bg-tree-600 text-white rounded-xl text-xs font-black shadow-md shadow-tree-100 transition-all active:scale-95 flex items-center justify-center gap-1.5 flex-shrink-0"
                                        >
                                            <Plus className="w-4 h-4" />
                                            <span>タグ追加</span>
                                        </button>
                                    </div>
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

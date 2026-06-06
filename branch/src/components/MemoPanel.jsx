import { 
    Send, X, MessageCircle, Clock, CheckCircle2, Tags, Edit2, 
    Trash2, Check, HelpCircle, FileText, ChevronDown, ChevronUp, User, Copy, MessageSquare
} from 'lucide-react';
import { callStorage } from '../hooks/useStorage';
import { getRoleFromPost } from '../app_constants';

import { useState, useEffect, useRef } from 'react';

export default function MemoPanel({ 
    child, 
    messages = [], 
    tags = [], 
    onSave, 
    onDelete, 
    onUpdate, 
    result, 
    selectedDate: propSelectedDate, 
    staffList = [], 
    onSaveTree, 
    onClose,
    activeTab = 'tree',
    setActiveTab,
    onShowHelpGuide,
    currentStaffName,
    programTitle = '',
    programSummary = ''
}) {
    const treeTextareaRef = useRef(null);

    const handleClose = () => {
        const currentD = result?.D || '';
        if (treeContent !== currentD && child?.id) {
            onSaveTree(child.id, { 
                ...result, 
                D: treeContent
            });
        }
        onClose();
    };
        // ==========================================
        // === チャットメモ（赤）用 State / ロジック ===
        // ==========================================
        const [chatText, setChatText] = useState('');
        const [editingChatId, setEditingChatId] = useState(null);
        const [editChatContent, setEditChatContent] = useState('');
        const [showHelpChat, setShowHelpChat] = useState(false);
        const [selectedTag, setSelectedTag] = useState(null);

        const handleChatSend = () => {
            if (!chatText.trim()) return;
            onSave(child.id, chatText, selectedTag);
            setChatText('');
            setSelectedTag(null);
        };

        const handleChatEditSave = (msgId) => {
            if (!editChatContent.trim()) return;
            onUpdate(child.id, msgId, editChatContent);
            setEditingChatId(null);
            setEditChatContent('');
        };

        const toggleTag = (tag) => {
            setSelectedTag(prev => prev === tag ? null : tag);
        };


    // ==========================================
    // === ツリー通信（緑）用 State / ロジック ===
    // ==========================================
    const [copiedEditor, setCopiedEditor] = useState(false);
    const [treeContent, setTreeContent] = useState('');
    const [isMemoExpanded, setIsMemoExpanded] = useState(false);
    const [showHelpTree, setShowHelpTree] = useState(false);

    const handleCopyEditor = () => {
        if (!treeContent.trim()) return;
        const textToCopy = `${child.name}さん\n${treeContent}`;
        navigator.clipboard.writeText(textToCopy)
            .then(() => {
                setCopiedEditor(true);
                setTimeout(() => setCopiedEditor(false), 2000);
            });
    };

    // ロード時に初期設定
    const [prevChildId, setPrevChildId] = useState(child?.id);

    useEffect(() => {
        const isChildChanged = child?.id !== prevChildId;
        setPrevChildId(child?.id);

        // 同一児童の編集中の場合は外部からのリアルタイム同期による上書きをブロックする（フォーカス時のみ）
        if (!isChildChanged && document.activeElement && document.activeElement.id === 'guide-tree-textarea') {
            return;
        }
        if (result?.D) {
            setTreeContent(result.D);
        } else {
            setTreeContent('');
        }
    }, [child, result]);

    // リアルタイム自動保存 (800msデバウンス)
    useEffect(() => {
        if (!child?.id) return;
        const currentD = result?.D || '';
        
        if (treeContent !== currentD) {
            const timer = setTimeout(() => {
                onSaveTree(child.id, { 
                    ...result, 
                    D: treeContent
                });
            }, 800);
            return () => clearTimeout(timer);
        }
    }, [treeContent, child?.id, onSaveTree, result]);


    // 児童が選択されていない場合は非表示
    if (!child) return null;

    // 現在のタブに応じたテーマカラーとアイコン
    const isTree = activeTab === 'tree';
    const headerBgColor = isTree ? '#21913c' : '#DC3545'; // ツリー通信＝緑、チャットメモ＝赤
    const headerTitle = isTree ? 'ツリー通信' : 'チャットメモ';

    return (
        <div 
            className="h-full flex flex-col bg-slate-50 shadow-2xl border-l border-slate-200 overflow-hidden"
        >
            {/* Header */}
            <div 
                className="flex items-center justify-between p-2 md:p-3 text-white shadow-lg flex-shrink-0 z-20 transition-colors duration-300" 
                style={{ backgroundColor: headerBgColor }}
            >
                <div className="flex items-center gap-2 md:gap-3">
                    <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-sm ring-1 ring-white/30">
                        {isTree ? <FileText className="w-4.5 h-4.5 md:w-5 md:h-5" /> : <MessageCircle className="w-4.5 h-4.5 md:w-5 md:h-5" />}
                    </div>
                    <div className="truncate">
                        <h3 className="font-black text-sm md:text-base leading-none drop-shadow-md truncate">{child.name}</h3>
                        <p className="text-[7px] md:text-[8px] font-black opacity-90 mt-1 uppercase tracking-[0.2em] leading-none">
                            {headerTitle}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button 
                        onClick={() => {
                            if (typeof onShowHelpGuide === 'function') {
                                onShowHelpGuide(isTree ? 'guide-tree-textarea' : 'guide-chat-textarea');
                            } else {
                                isTree ? setShowHelpTree(true) : setShowHelpChat(true);
                            }
                        }} 
                        className="p-1.5 hover:bg-white/10 rounded-lg transition-all active:scale-90 text-white"
                    >
                        <HelpCircle className="w-4 h-4 md:w-4.5 md:h-4.5" />
                    </button>
                    <button onClick={handleClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-all shadow-sm active:scale-90 text-white">
                        <X className="w-4 h-4 md:w-4.5 md:h-4.5" />
                    </button>
                </div>
            </div>

            {/* Help Modals */}
            {showHelpChat && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2.5rem] md:rounded-[3rem] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-300">
                        <div className="p-6 md:p-8 flex items-center justify-between border-b border-slate-100 bg-slate-50/50">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-red-100 rounded-xl">
                                    <HelpCircle className="w-5 h-5 text-red-600" />
                                </div>
                                <h4 className="font-black text-slate-800 text-sm md:text-base tracking-tight uppercase">操作ガイド：チャットメモ</h4>
                            </div>
                            <button onClick={() => setShowHelpChat(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                                <X className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>
                        <div className="p-6 md:p-8 space-y-6">
                            <p className="text-xs font-bold text-slate-500 leading-relaxed">スタッフ間でその日の様子を記録するメモチャットです（赤テーマ）。入力内容はツリー通信の作成時に参照できます。</p>
                        </div>
                        <div className="p-6 md:p-8 bg-slate-50 border-t border-slate-100">
                            <button onClick={() => setShowHelpChat(false)} className="w-full py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-xs md:text-sm shadow-lg transition-all active:scale-95 uppercase tracking-widest">
                                わかった！
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showHelpTree && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2.5rem] md:rounded-[3rem] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-300">
                        <div className="p-6 md:p-8 flex items-center justify-between border-b border-slate-100 bg-slate-50/50">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-tree-100 rounded-xl">
                                    <HelpCircle className="w-5 h-5 text-tree-600" />
                                </div>
                                <h4 className="font-black text-slate-800 text-sm md:text-base tracking-tight uppercase">操作ガイド：ツリー通信作成</h4>
                            </div>
                            <button onClick={() => setShowHelpTree(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                                <X className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>
                        <div className="p-6 md:p-8 space-y-6">
                            <p className="text-xs font-bold text-slate-500 leading-relaxed">ご家庭に連絡する日報（ツリー通信）を作成・保存します（緑テーマ）。チャットメモを参照しながら作成できます。</p>
                        </div>
                        <div className="p-6 md:p-8 bg-slate-50 border-t border-slate-100">
                            <button onClick={() => setShowHelpTree(false)} className="w-full py-4 bg-tree-600 hover:bg-tree-700 text-white rounded-2xl font-black text-xs md:text-sm shadow-lg transition-all active:scale-95 uppercase tracking-widest">
                                わかった！
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Tab Switches (Tree vs Chat) */}
            <div className="flex border-b border-slate-200 bg-white flex-shrink-0 z-20">
                <button 
                    onClick={() => setActiveTab('tree')}
                    className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all ${isTree ? 'text-tree-600 border-b-4 border-tree-600 bg-tree-50/20' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    ツリー通信
                </button>
                <button 
                    onClick={() => setActiveTab('chat')}
                    className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all ${!isTree ? 'text-red-600 border-b-4 border-red-600 bg-red-50/20' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    チャットメモ ({messages.length})
                </button>
            </div>

            {/* TAB CONTENTS */}
            {isTree ? (
                // ============================
                // === ツリー通信タブ (緑) ===
                // ============================
                <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
                    
                    {/* Chat Memo Reference Section (Collapsible) */}
                    <div className="border-b border-slate-200 bg-white">
                        <button 
                            onClick={() => setIsMemoExpanded(!isMemoExpanded)}
                            className="w-full px-4 py-2 flex items-center justify-between text-slate-500 hover:bg-slate-50/80 transition-all font-black text-[9px] uppercase tracking-widest"
                        >
                            <div className="flex items-center gap-2">
                                <MessageSquare className="w-3.5 h-3.5 text-red-500" />
                                <span>チャットメモの内容を参照</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="text-[8px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded-full">{messages.length} 件</span>
                                {isMemoExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </div>
                        </button>
                        
                        <div className={`overflow-hidden transition-all duration-300 ${isMemoExpanded ? 'max-h-[160px] border-t border-slate-100 bg-slate-50/50' : 'max-h-0'}`}>
                            <div className="p-3 space-y-2 overflow-y-auto max-h-[150px] custom-scrollbar">
                                {messages.length === 0 ? (
                                    <p className="text-center py-4 text-[9px] font-bold text-slate-300 uppercase tracking-widest">メッセージなし</p>
                                ) : (
                                    messages.map((m, i) => (
                                        <div key={m.id || i} className="bg-white p-2.5 rounded-xl shadow-sm border border-slate-100 flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5 mb-0.5 opacity-40 justify-between w-full">
                                                    <div className="flex items-center gap-1">
                                                        <Clock className="w-2.5 h-2.5 text-red-500" />
                                                        <span className="text-[8px] font-black">{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        {m.tag && (
                                                            <span className="text-[8px] font-black text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-100">{m.tag}</span>
                                                        )}
                                                        {m.staffName && (
                                                            <span className="text-[8px] font-black text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">{m.staffName}</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <p className="text-xs font-bold text-slate-700 leading-relaxed break-words">{m.text}</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    let cleanedText = m.text.trim();
                                                    // Remove exact tag prefix from tags list
                                                    for (const tag of tags) {
                                                        if (cleanedText.startsWith(tag)) {
                                                            cleanedText = cleanedText.substring(tag.length).trim();
                                                            break;
                                                        }
                                                    }
                                                    // Fallback regex to strip leading 【...】 or [...] brackets
                                                    cleanedText = cleanedText.replace(/^(?:【[^】]+】|\[[^\]]+\])\s*/, '');

                                                    const textarea = treeTextareaRef.current;
                                                    if (textarea) {
                                                        const start = textarea.selectionStart;
                                                        const end = textarea.selectionEnd;
                                                        const before = treeContent.substring(0, start);
                                                        const after = treeContent.substring(end);
                                                        const newContent = before + cleanedText + after;
                                                        setTreeContent(newContent);
                                                        
                                                        setTimeout(() => {
                                                            textarea.focus();
                                                            const newCursorPos = start + cleanedText.length;
                                                            textarea.setSelectionRange(newCursorPos, newCursorPos);
                                                        }, 0);
                                                    } else {
                                                        setTreeContent(prev => {
                                                            if (!prev.trim()) return cleanedText;
                                                            return prev + '\n' + cleanedText;
                                                        });
                                                    }
                                                }}
                                                className="px-2 py-1 bg-tree-50 hover:bg-tree-100 text-tree-700 hover:text-tree-800 rounded-lg text-[9px] font-black tracking-wider transition-colors flex-shrink-0 flex items-center gap-1 border border-tree-200"
                                                title="ツリーに反映"
                                            >
                                                <Copy className="w-3 h-3" />
                                                <span>反映</span>
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <div className="p-3 md:p-4 flex-1 flex flex-col gap-2 justify-between">
                        <div className="space-y-2 flex-1 flex flex-col">
                            <div className="space-y-1 flex-1 flex flex-col">
                                <div className="flex items-center justify-between">
                                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                        <Edit2 className="w-3 h-3" /> ツリー通信 内容入力
                                    </label>
                                    <div className="flex items-center gap-1.5">
                                        {currentStaffName && (
                                            <span className="text-[9px] font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200/50">
                                                編集者: {currentStaffName}
                                            </span>
                                        )}
                                        {result?.staffName && (
                                            <span className="text-[9px] font-black text-tree-600 bg-tree-50 px-2 py-0.5 rounded-full border border-tree-100/50 shadow-sm">
                                                最終編集: {result.staffName}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {programSummary && (
                                    <div className="bg-wood-50/50 border border-wood-100 p-2.5 rounded-xl flex items-center justify-between gap-3 text-[11px] mb-1 animate-in slide-in-from-top-2">
                                        <div className="min-w-0">
                                            <span className="font-black text-wood-700 block truncate text-[10px]">本日のプログラム: {programTitle || '登録あり'}</span>
                                            <span className="font-medium text-slate-500 block truncate text-[9px]">{programSummary}</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const textarea = treeTextareaRef.current;
                                                if (textarea) {
                                                    const start = textarea.selectionStart;
                                                    const end = textarea.selectionEnd;
                                                    const before = treeContent.substring(0, start);
                                                    const after = treeContent.substring(end);
                                                    const newContent = before + programSummary + after;
                                                    setTreeContent(newContent);
                                                    setTimeout(() => {
                                                        textarea.focus();
                                                        const newCursorPos = start + programSummary.length;
                                                        textarea.setSelectionRange(newCursorPos, newCursorPos);
                                                    }, 0);
                                                } else {
                                                    setTreeContent(prev => prev ? prev + '\n' + programSummary : programSummary);
                                                }
                                            }}
                                            className="px-2.5 py-1.5 bg-wood-500 hover:bg-wood-600 text-white rounded-lg text-[9px] font-black tracking-wider transition-all active:scale-95 flex items-center gap-1 flex-shrink-0 shadow-sm"
                                        >
                                            <Copy className="w-3.5 h-3.5 text-white" />
                                            <span>概要を反映</span>
                                        </button>
                                    </div>
                                )}
                                <textarea
                                    id="guide-tree-textarea"
                                    ref={treeTextareaRef}
                                    value={treeContent}
                                    onChange={(e) => setTreeContent(e.target.value)}
                                    placeholder="ご家庭向けのツリー通信をリアルタイム自動保存します..."
                                    className="w-full min-h-[100px] flex-1 p-3 text-xs md:text-sm bg-white border-2 border-slate-100 rounded-2xl focus:border-tree-400 focus:ring-4 focus:ring-tree-50 outline-none transition-all leading-relaxed resize-none font-medium text-slate-700 shadow-inner"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between gap-3 mt-1 pt-2 border-t border-slate-100 flex-shrink-0">
                            <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping" />
                                自動保存中
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleCopyEditor}
                                    disabled={!treeContent.trim()}
                                    className={`px-5 py-2.5 rounded-xl font-black text-xs shadow-sm flex items-center justify-center gap-2 transition-all active:scale-95 border ${
                                        copiedEditor 
                                            ? 'bg-green-50 border-green-200 text-green-600' 
                                            : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600 disabled:opacity-50 disabled:pointer-events-none'
                                    }`}
                                    title="クリップボードにコピー"
                                >
                                    {copiedEditor ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                    <span>コピー</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    className="px-5 py-2.5 bg-tree-600 hover:bg-tree-700 text-white rounded-xl font-black text-xs shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5"
                                >
                                    <Check className="w-4 h-4" />
                                    <span>保存して閉じる</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                // ============================
                // === チャットメモタブ (赤) ===
                // ============================
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Chat Messages Scroll */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-5 md:p-8 space-y-6">
                        {messages.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center opacity-30 space-y-4">
                                <div className="p-8 bg-white rounded-[3.5rem] shadow-premium ring-4 ring-red-50/50">
                                    <MessageCircle className="w-14 h-14 text-red-200" />
                                </div>
                                <p className="text-[10px] font-black text-red-800 uppercase tracking-widest">最初の記録を待機中</p>
                            </div>
                        ) : (
                            messages.map((m, i) => (
                                <div key={m.id || i} className={`group flex flex-col ${m.included ? 'items-end' : 'items-start opacity-70'}`}>
                                    {editingChatId === m.id ? (
                                        <div className="w-full max-w-[90%] bg-white p-4 rounded-3xl border-2 border-red-400 shadow-xl space-y-3">
                                            <textarea
                                                value={editChatContent}
                                                onChange={(e) => setEditChatContent(e.target.value)}
                                                className="w-full text-sm font-medium text-slate-800 rounded-xl p-2 bg-slate-50 outline-none focus:bg-white transition-all resize-none"
                                                rows={3}
                                            />
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => setEditingChatId(null)} className="px-4 py-2 text-[10px] font-black text-slate-400 hover:text-slate-600 uppercase">キャンセル</button>
                                                <button onClick={() => handleChatEditSave(m.id)} className="px-4 py-2 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase flex items-center gap-2">
                                                    <Check className="w-3 h-3" /> 保存
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            {(m.staffName || m.tag) && (
                                                <div className="flex items-center gap-1.5 mb-1 px-3">
                                                    {m.staffName && (
                                                        <span className="text-[10px] font-black text-slate-400">
                                                            {m.staffName}
                                                        </span>
                                                    )}
                                                    {m.tag && (
                                                        <span className="text-[9px] font-black bg-red-100 text-red-600 px-2 py-0.5 rounded-full border border-red-150">
                                                            {m.tag}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                            <div className="relative group/msg max-w-[90%]">
                                                <div className={`p-4 rounded-[1.8rem] shadow-lg text-[13px] md:text-[14px] leading-relaxed font-bold ${m.included ? 'bg-red-500 text-white rounded-tr-none shadow-red-100' : 'bg-white text-slate-700 rounded-tl-none border border-slate-100 shadow-sm'}`}>
                                                    {m.text}
                                                </div>
                                                {/* Hover Actions */}
                                                <div className={`absolute -bottom-2 ${m.included ? '-left-8' : '-right-8'} flex flex-col gap-1 opacity-0 group-hover/msg:opacity-100 transition-opacity`}>
                                                    <button 
                                                        onClick={() => { setEditingChatId(m.id); setEditChatContent(m.text); }}
                                                        className="p-1.5 bg-white text-slate-400 hover:text-red-600 rounded-full shadow-md border border-slate-100 transition-colors"
                                                    >
                                                        <Edit2 className="w-3 h-3" />
                                                    </button>
                                                    <button 
                                                        onClick={() => onDelete(child.id, m.id)}
                                                        className="p-1.5 bg-white text-slate-400 hover:text-red-500 rounded-full shadow-md border border-slate-100 transition-colors"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 mt-1 px-3">
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                                                    {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                                {m.included && <CheckCircle2 className="w-3.5 h-3.5 text-red-500" />}
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))
                        )}
                    </div>

                    {/* Chat Input Area */}
                    <div className="p-5 bg-white border-t border-slate-100 space-y-4 shadow-[0_-20px_50px_rgba(0,0,0,0.02)]">
                        {/* Tag selectors */}
                        <div className="flex flex-wrap gap-1.5">
                            {tags.map(t => {
                                const isSelected = selectedTag === t;
                                return (
                                    <button
                                        key={t}
                                        onClick={() => toggleTag(t)}
                                        className={`px-3 py-1.5 rounded-full text-[10px] font-black tracking-tight border transition-all active:scale-95 shadow-sm ${
                                            isSelected 
                                                ? 'bg-red-600 border-red-600 text-white' 
                                                : 'bg-red-50 hover:bg-red-100 border-red-100 text-red-600'
                                        }`}
                                    >
                                        {t}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="relative group">
                            <textarea
                                id="guide-chat-textarea"
                                value={chatText}
                                onChange={(e) => setChatText(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleChatSend(); }}
                                placeholder="チャットメモを入力（スタッフ間共有用）..."
                                className="w-full min-h-[100px] p-5 pb-16 text-[14px] bg-red-50/10 border-2 border-red-100/50 rounded-[2rem] outline-none focus:border-red-500 focus:bg-white focus:ring-8 focus:ring-red-50 transition-all shadow-inner leading-relaxed resize-none font-medium text-slate-800"
                            />
                            <div className="absolute bottom-4 right-4 flex items-center gap-2">
                                <button 
                                    onClick={handleClose}
                                    className="p-3 bg-white hover:bg-slate-50 text-slate-600 rounded-xl border border-slate-200 shadow-lg transition-all active:scale-90 flex items-center gap-1"
                                    type="button"
                                >
                                    <X className="w-4 h-4" />
                                    <span className="text-xs font-black">閉じる</span>
                                </button>
                                <button 
                                    onClick={handleChatSend}
                                    disabled={!chatText.trim()}
                                    className="p-3 bg-red-500 hover:bg-red-600 text-white rounded-xl shadow-2xl transition-all active:scale-90 disabled:grayscale"
                                    type="button"
                                >
                                    <Send className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

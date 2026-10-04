import { 
    Send, X, MessageCircle, Clock, CheckCircle2, Tags, Edit2, 
    Trash2, Check, HelpCircle, FileText, ChevronDown, ChevronUp, User, Copy, MessageSquare,
    Sparkles, Settings, ClipboardList
} from 'lucide-react';
import { callStorage } from '../hooks/useStorage';
import { getRoleFromPost } from '../app_constants';

import { useState, useEffect, useRef, useMemo } from 'react';
import { firestore } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';

// Smart name detection helper (excluding common stop words)
const scanForNames = (text, okWords = []) => {
    if (!text) return [];
    const regex = /([^ 　\n\r\t、。！？()（）「」『』【】“”"'’‘:;,.\-\+=\/\\*&^%$#@!\[\]]+(?:さん|くん|ちゃん|君))/g;
    const matches = text.match(regex) || [];
    
    const exclusions = [
        'お母さん', 'お父さん', 'お兄さん', 'お姉さん', '皆さん', 'みなさん',
        '看護師さん', 'お医者さん', '保育士さん', '運転手さん', '警察官さん',
        '屋さん', 'くんさん', 'おじさん', 'おばさん', 'おじいさん', 'おばあさん'
    ];
    
    const uniqueMatches = Array.from(new Set(matches));
    return uniqueMatches.filter(match => {
        const isExcluded = exclusions.some(exc => match.includes(exc));
        const isOkWord = okWords.includes(match);
        return !isExcluded && !isOkWord;
    });
};

// Generates HTML with red marks overlay behind text
const getHighlightedTextHTML = (text, names) => {
    if (!text) return '&nbsp;';
    
    let escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
        
    if (names.length === 0) {
        return escaped.endsWith('\n') ? escaped + '&nbsp;' : escaped;
    }
    
    const escapedNames = names.map(n => n.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
    const regex = new RegExp(`(${escapedNames.join('|')})`, 'g');
    
    const parts = escaped.split(regex);
    const html = parts.map(part => {
        if (names.includes(part)) {
            return `<mark style="background-color: rgba(239, 68, 68, 0.25); color: transparent; border-bottom: 2px solid rgb(239, 68, 68); border-radius: 4px; padding: 1px 0px; font-weight: bold;">${part}</mark>`;
        }
        return part;
    }).join('');
    
    return html.endsWith('\n') ? html + '&nbsp;' : html;
};

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
    programSummary = '',
    greetingTemplates = {},
    onSaveTemplate,
    okWords = [],
    onAddOkWord,
    programs = [],
    tagInsertTexts = {}
}) {
    const treeTextareaRef = useRef(null);
    const highlightDivRef = useRef(null);

    // ==========================================
    // === 今後の予定（茶）用 State / ロジック ===
    // ==========================================
    const [futurePlanContent, setFuturePlanContent] = useState('');
    const [copiedFuturePlanEditor, setCopiedFuturePlanEditor] = useState(false);
    const initialFutureTextRef = useRef('');

    // ── 端末内下書き保護（手元ボード）用ヘルパー ──
    const getDraftKey = (childId) => {
        const datePart = propSelectedDate || new Date().toISOString().slice(0, 10);
        return `tree_tsushin_v2_draft_${datePart}_${childId}`;
    };
    const clearDraft = (childId) => {
        if (!childId) return;
        try {
            localStorage.removeItem(getDraftKey(childId));
        } catch (e) {
            console.warn('[Draft] Failed to clear draft', e);
        }
    };

    const handleClose = () => {
        if (child?.id) {
            const updates = {
                ...result,
                D: treeContent,
                futurePlan: futurePlanContent
            };
            onSaveTree(child.id, updates);
            // clearDraft(child.id); // 下書きは残す
        }
        onClose();
    };

    // ==========================================
    // === チャットメモ（赤）用 State / ロジック ===
    // ==========================================
        const [chatText, setChatText] = useState('');
        const [editingChatId, setEditingChatId] = useState(null);
        const [editChatContent, setEditChatContent] = useState('');
        const [editChatTags, setEditChatTags] = useState([]); // 編集中メッセージのタグ
        const [showHelpChat, setShowHelpChat] = useState(false);
        const [selectedTags, setSelectedTags] = useState([]); // 複数タグ対応
        const [programSelectPopover, setProgramSelectPopover] = useState(null); // 複数プログラム選択ポップオーバー { tag }

        // 有効なプログラムリストの取得（複数プログラム対応）
        const validPrograms = useMemo(() => {
            const list = (programs && programs.length > 0)
                ? programs
                : (programTitle || programSummary ? [{ title: programTitle, summary: programSummary }] : []);
            return list.filter(p => p && ((p.title && p.title.trim()) || (p.summary && p.summary.trim())));
        }, [programs, programTitle, programSummary]);

        const isProgramTag = (t) => {
            if (!t) return false;
            if (t.includes('プログラム')) return true;
            const tmpl = tagInsertTexts ? tagInsertTexts[t] : undefined;
            return tmpl && (tmpl.includes('{プログラム内容}') || tmpl.includes('{program}'));
        };

        const insertTagTemplateWithProgram = (tag, selectedProgMode) => {
            if (selectedProgMode === 'none') {
                return;
            }

            let template = tagInsertTexts ? tagInsertTexts[tag] : undefined;
            if (template === undefined) {
                if (tag.includes('プログラム')) {
                    template = '{プログラム内容}';
                } else if (tag.includes('ツリー式学習')) {
                    template = 'ツリー式学習';
                } else {
                    template = '';
                }
            }

            if (!template) return;

            let textToInsert = template;
            if (textToInsert.includes('{プログラム内容}') || textToInsert.includes('{program}')) {
                let progSummaryText = '';
                if (selectedProgMode === 'all') {
                    // 全プログラム連結
                    const parts = validPrograms.map((p, idx) => {
                        const titleStr = p.title ? `【${p.title}】` : `【プログラム${idx + 1}】`;
                        const summaryStr = p.summary || '';
                        return summaryStr ? `${titleStr}\n${summaryStr}` : titleStr;
                    });
                    progSummaryText = parts.filter(Boolean).join('\n\n');
                } else if (typeof selectedProgMode === 'number') {
                    const p = validPrograms[selectedProgMode];
                    if (p) {
                        progSummaryText = p.summary || p.title || '';
                    }
                } else {
                    // フォールバック: 最初のプログラム
                    const p = validPrograms[0];
                    progSummaryText = (p && (p.summary || p.title)) || programSummary || '';
                }

                textToInsert = textToInsert
                    .replace(/\{プログラム内容\}/g, progSummaryText)
                    .replace(/\{program\}/g, progSummaryText);
            }

            if (textToInsert.trim()) {
                setChatText(current => textToInsert + (current ? '\n' + current : ''));
            }
        };

        const handleStartEdit = (m) => {
            setEditingChatId(m.id);
            setEditChatContent(m.text || '');
            const existingTags = m.tag ? (Array.isArray(m.tag) ? m.tag : String(m.tag).split(/\s+/).filter(Boolean)) : [];
            setEditChatTags(existingTags);
        };

        const handleCancelEdit = () => {
            setEditingChatId(null);
            setEditChatContent('');
            setEditChatTags([]);
        };

        const toggleEditTag = (tag) => {
            setEditChatTags(prev => 
                prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
            );
        };

        const handleChatSend = () => {
            if (!chatText.trim()) return;
            const tagString = selectedTags.length > 0 ? selectedTags.join(' ') : null;
            onSave(child.id, chatText, tagString);
            setChatText('');
            setSelectedTags([]);
            setProgramSelectPopover(null);
        };

        const handleChatEditSave = (msgId) => {
            if (!editChatContent.trim()) return;
            const tagString = editChatTags.length > 0 ? editChatTags.join(' ') : null;
            onUpdate(child.id, msgId, editChatContent, tagString);
            setEditingChatId(null);
            setEditChatContent('');
            setEditChatTags([]);
        };

        const toggleTag = (tag) => {
            const isAlreadySelected = selectedTags.includes(tag);

            if (isAlreadySelected) {
                // すでに選択中のタグを解除
                setSelectedTags(prev => prev.filter(t => t !== tag));
                if (programSelectPopover?.tag === tag) {
                    setProgramSelectPopover(null);
                }
                return;
            }

            // タグを新規追加
            setSelectedTags(prev => [...prev, tag]);

            // プログラム関連タグかつ複数プログラムがある場合は選択ポップオーバーを表示（案A）
            if (isProgramTag(tag) && validPrograms.length > 1) {
                setProgramSelectPopover({ tag });
            } else {
                // プログラムが1つ以下または通常タグは即座に挿入
                insertTagTemplateWithProgram(tag, 0);
            }
        };

        const handleClearChatText = () => {
            setChatText('');
            setSelectedTags([]);
            setProgramSelectPopover(null);
        };


    // ==========================================
    // === ツリー通信（緑）用 State / ロジック ===
    // ==========================================
    const [copiedEditor, setCopiedEditor] = useState(false);
    const [treeContent, setTreeContent] = useState('');
    const [isEditingTemplate, setIsEditingTemplate] = useState(false);
    const [templateDraft, setTemplateDraft] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const [activeToolbarMenu, setActiveToolbarMenu] = useState(null); // 'memo' | 'program' | 'template' | null

    // チャットメモ反映モーダル & 選択順序管理 (①, ②, ③...)
    const [showChatImportModal, setShowChatImportModal] = useState(false);
    const [selectedMemoOrder, setSelectedMemoOrder] = useState([]);

    // 入力完了状態管理
    const [isCompleted, setIsCompleted] = useState(!!result?.isCompleted);

    useEffect(() => {
        setIsCompleted(!!result?.isCompleted);
    }, [result?.isCompleted]);

    // Conflict detection states
    const [hasConflict, setHasConflict] = useState(false);
    const [conflictingDbText, setConflictingDbText] = useState('');
    const initialTextRef = useRef('');

    const detectedNames = scanForNames(treeContent, okWords);

    const handleTextareaScroll = (e) => {
        if (highlightDivRef.current) {
            highlightDivRef.current.scrollTop = e.target.scrollTop;
            highlightDivRef.current.scrollLeft = e.target.scrollLeft;
        }
    };

    // 常に一番下（末尾）に挿入する
    const appendTextToEnd = (textToInsert) => {
        if (!textToInsert) return;
        setTreeContent(prev => {
            if (!prev || !prev.trim()) {
                return textToInsert;
            }
            return prev.trimEnd() + '\n' + textToInsert;
        });
        setTimeout(() => {
            const textarea = treeTextareaRef.current;
            if (textarea) {
                textarea.focus();
                const len = textarea.value.length;
                textarea.setSelectionRange(len, len);
                textarea.scrollTop = textarea.scrollHeight;
            }
        }, 50);
    };

    const handleInsertTemplate = () => {
        const template = greetingTemplates[currentStaffName] || '';
        if (!template.trim()) {
            alert(`【${currentStaffName || 'スタッフ'}】の挨拶テンプレがまだ登録されていません。\n画面右上の「設定（歯車）」＞「挨拶設定」タブから登録・編集できます。`);
            return;
        }
        appendTextToEnd(template);
    };

    // チャットメモ一括反映ロジック（選択順に \n\n で結合して挿入）
    const toggleSelectMemo = (msgId) => {
        setSelectedMemoOrder(prev => {
            if (prev.includes(msgId)) {
                return prev.filter(id => id !== msgId);
            } else {
                return [...prev, msgId];
            }
        });
    };

    const handleInsertSelectedMemos = () => {
        if (selectedMemoOrder.length === 0) return;
        const textsToInsert = selectedMemoOrder.map(msgId => {
            const msg = messages.find(m => (m.id || String(m.timestamp)) === msgId);
            if (!msg) return '';
            let cleaned = (msg.text || '').trim();
            for (const tag of tags) {
                if (cleaned.startsWith(tag)) {
                    cleaned = cleaned.substring(tag.length).trim();
                    break;
                }
            }
            cleaned = cleaned.replace(/^(?:【[^】]+】|\[[^\]]+\])\s*/, '');
            return cleaned;
        }).filter(Boolean);

        if (textsToInsert.length > 0) {
            appendTextToEnd(textsToInsert.join('\n\n'));
        }
        setSelectedMemoOrder([]);
        setShowChatImportModal(false);
    };

    // 入力を完了して保存（赤色ボタン・書き終えたかの確認ダイアログ付き）
    const handleSaveCompleted = (completedStatus = true) => {
        if (completedStatus) {
            const childDisplayName = child?.lastName ? `${child.lastName} ${child.firstName}` : (child?.name || '児童');
            const ok = window.confirm(`【${childDisplayName}】のツリー通信の入力を完了として保存します。\n\n本当に通信を書き終えましたか？`);
            if (!ok) return;
        }
        const updates = {
            ...result,
            D: treeContent,
            futurePlan: futurePlanContent,
            isCompleted: completedStatus
        };
        setIsCompleted(completedStatus);
        if (child?.id) {
            onSaveTree(child.id, updates);
            // clearDraft(child.id); // 下書きは残す
        }
        onClose();
    };

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
    const [prevChildId, setPrevChildId] = useState(null);
    const skipSaveRef = useRef(false);

    useEffect(() => {
        const isChildChanged = child?.id !== prevChildId;
        setPrevChildId(child?.id);

        if (isChildChanged) {
            skipSaveRef.current = true;
            setHasConflict(false);
            setConflictingDbText('');

            const dbD = result?.D || '';
            const dbFuture = result?.futurePlan || '';
            let initialD = dbD;
            let initialFuture = dbFuture;

            // ── 手元ボード（LocalStorage）からの自動復元チェック ──
            if (child?.id) {
                try {
                    const savedDraftStr = localStorage.getItem(getDraftKey(child.id));
                    if (savedDraftStr) {
                        const savedDraft = JSON.parse(savedDraftStr);
                        // ツリー通信(D)は1人が執筆するため手元ボードから最優先で復元！
                        if (savedDraft.D !== undefined && savedDraft.D !== dbD && savedDraft.D.trim()) {
                            console.log(`[Draft Board] Restored local draft for child: ${child.name || child.id}`);
                            initialD = savedDraft.D;
                        }
                        if (savedDraft.chatText !== undefined) {
                            setChatText(savedDraft.chatText);
                        } else {
                            setChatText('');
                        }
                        if (savedDraft.selectedTags !== undefined) {
                            setSelectedTags(savedDraft.selectedTags);
                        } else {
                            setSelectedTags([]);
                        }
                        // ※ 今後の予定(futurePlan)は他アプリからも編集されるため、LocalStorageで上書きせずDB最新値を優先
                    } else {
                        setChatText('');
                        setSelectedTags([]);
                    }
                } catch (e) {
                    console.warn('[Draft Board] Failed to restore local draft', e);
                    setChatText('');
                    setSelectedTags([]);
                }
            }

            initialTextRef.current = initialD;
            setTreeContent(initialD);

            initialFutureTextRef.current = initialFuture;
            setFuturePlanContent(initialFuture);
        } else {
            const isSavedBySelf = currentStaffName && result?.staffName === currentStaffName;
            const dbVal = result?.D || '';
            if (dbVal !== initialTextRef.current) {
                if (isSavedBySelf) {
                    initialTextRef.current = dbVal;
                } else if (dbVal === treeContent) {
                    initialTextRef.current = dbVal;
                } else if (treeContent && treeContent !== initialTextRef.current) {
                    // 手元で入力中の場合は絶対に自動消去せず競合警告を表示
                    setHasConflict(true);
                    setConflictingDbText(dbVal);
                } else if (!treeContent && dbVal) {
                    // 手元が空でDBに内容がある場合のみ反映
                    setTreeContent(dbVal);
                    initialTextRef.current = dbVal;
                } else if (treeContent && !dbVal) {
                    // DB側が空で手元にテキストがある場合は消去をブロック
                    console.warn('[Safety Guard] Blocked empty DB overwrite on treeContent');
                } else {
                    setTreeContent(dbVal);
                    initialTextRef.current = dbVal;
                }
            }

            const dbFuture = result?.futurePlan || '';
            if (dbFuture !== initialFutureTextRef.current) {
                // 今後の予定は他アプリからも編集されるため、外部からの変更を即座に画面へ反映
                setFuturePlanContent(dbFuture);
                initialFutureTextRef.current = dbFuture;
            }
        }
    }, [child, result, prevChildId, treeContent, futurePlanContent, currentStaffName]);

    // ── 外部アプリ連携: tree_communications ドキュメントのリアルタイム監視 ──
    useEffect(() => {
        if (!child?.id || !propSelectedDate || !firestore) return;
        const commDocRef = doc(firestore, 'children', child.id, 'app_categories', '書類管理', 'tree_communications', propSelectedDate);
        const unsub = onSnapshot(commDocRef, (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                const extFuture = data.future_plan !== undefined ? data.future_plan : (data.futurePlan !== undefined ? data.futurePlan : null);
                if (extFuture !== null && extFuture !== initialFutureTextRef.current) {
                    console.log('[External App Sync] Detected future_plan change from tree_communications doc:', extFuture);
                    setFuturePlanContent(extFuture);
                    initialFutureTextRef.current = extFuture;
                    if (onSaveTree) {
                        onSaveTree(child.id, {
                            ...result,
                            futurePlan: extFuture
                        });
                    }
                }
            }
        }, (err) => {
            console.warn('[External App Sync] tree_communications onSnapshot error:', err);
        });
        return () => unsub();
    }, [child?.id, propSelectedDate]);

    // ── 端末内LocalStorageへのリアルタイム即時バックアップ（手元ボードへの書き込み：ツリー通信のみ） ──
    useEffect(() => {
        if (!child?.id) return;
        
        if (skipSaveRef.current) {
            skipSaveRef.current = false;
            return;
        }

        if (treeContent || chatText || selectedTags.length > 0) {
            try {
                localStorage.setItem(getDraftKey(child.id), JSON.stringify({
                    D: treeContent,
                    chatText: chatText,
                    selectedTags: selectedTags,
                    updatedAt: Date.now()
                }));
            } catch (e) {
                console.warn('[Draft Board] Failed to save draft', e);
            }
        } else {
            clearDraft(child.id);
        }
    }, [treeContent, chatText, selectedTags, child?.id]);

    // クラウドへの自動同期 (2000ms: タイピング一段落時に安全にクラウドへ反映)
    useEffect(() => {
        if (!child?.id || hasConflict) return;
        const currentD = result?.D || '';
        
        if (treeContent !== currentD) {
            const timer = setTimeout(() => {
                onSaveTree(child.id, { 
                    ...result, 
                    D: treeContent
                });
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [treeContent, child?.id, onSaveTree, result, hasConflict]);

    useEffect(() => {
        if (!child?.id) return;
        const currentFuture = result?.futurePlan || '';
        
        if (futurePlanContent !== currentFuture) {
            const timer = setTimeout(() => {
                onSaveTree(child.id, {
                    ...result,
                    futurePlan: futurePlanContent
                });
            }, 800);
            return () => clearTimeout(timer);
        }
    }, [futurePlanContent, child?.id, onSaveTree, result]);


    // 児童が選択されていない場合は非表示
    if (!child) return null;

    // 現在のタブに応じたテーマカラーとアイコン
    const isTree = activeTab === 'tree';
    const isFuturePlan = activeTab === 'futurePlan';
    let headerBgColor = '#DC3545'; // チャットメモ（赤）
    let headerTitle = 'チャットメモ';
    if (isTree) {
        headerBgColor = '#21913c'; // ツリー通信（緑）
        headerTitle = 'ツリー通信';
    } else if (isFuturePlan) {
        headerBgColor = '#8B5A2B'; // 今後の予定（茶色）
        headerTitle = '今後の予定';
    }

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

            {/* Chat Memo Import Modal */}
            {showChatImportModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 md:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-300">
                        {/* Modal Header */}
                        <div className="p-4 md:p-5 flex items-center justify-between border-b border-slate-100 bg-red-50/50 flex-shrink-0">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-red-100 text-red-600 rounded-xl">
                                    <MessageSquare className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="font-black text-slate-800 text-sm md:text-base leading-tight">
                                        チャットメモから反映
                                    </h4>
                                    <p className="text-[10px] text-slate-500 font-bold mt-0.5">
                                        挿入したい順にタップしてください（①, ②, ③...）。メモ間に1行改行を入れて順番に挿入されます。
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowChatImportModal(false);
                                    setSelectedMemoOrder([]);
                                }}
                                className="p-1.5 hover:bg-slate-200 rounded-full transition-colors text-slate-400 hover:text-slate-600"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body: Memo List */}
                        <div className="p-3 md:p-5 overflow-y-auto custom-scrollbar flex-1 space-y-2 bg-slate-50/30">
                            {messages.length === 0 ? (
                                <div className="text-center py-12 text-slate-400 flex flex-col items-center gap-2">
                                    <MessageCircle className="w-10 h-10 text-slate-300" />
                                    <span className="text-xs font-bold">チャットメモがありません</span>
                                </div>
                            ) : (
                                messages.map((m, idx) => {
                                    const msgId = m.id || String(m.timestamp);
                                    const orderIndex = selectedMemoOrder.indexOf(msgId);
                                    const isSelected = orderIndex !== -1;
                                    let cleanedText = (m.text || '').trim();
                                    for (const tag of tags) {
                                        if (cleanedText.startsWith(tag)) {
                                            cleanedText = cleanedText.substring(tag.length).trim();
                                            break;
                                        }
                                    }
                                    cleanedText = cleanedText.replace(/^(?:【[^】]+】|\[[^\]]+\])\s*/, '');

                                    return (
                                        <div
                                            key={msgId || idx}
                                            onClick={() => toggleSelectMemo(msgId)}
                                            className={`p-3 rounded-2xl border-2 transition-all cursor-pointer select-none flex items-start gap-3 relative ${
                                                isSelected
                                                    ? 'bg-red-50/70 border-red-500 shadow-sm'
                                                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                                            }`}
                                        >
                                            {/* 順番バッジ */}
                                            <div className="flex-shrink-0 pt-0.5">
                                                {isSelected ? (
                                                    <div className="w-6 h-6 rounded-full bg-red-600 text-white font-black text-xs flex items-center justify-center shadow-sm">
                                                        {orderIndex + 1}
                                                    </div>
                                                ) : (
                                                    <div className="w-6 h-6 rounded-full border-2 border-slate-300 flex items-center justify-center text-[10px] text-slate-400 font-bold">
                                                        -
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                    {m.staffName && (
                                                        <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold">
                                                            {m.staffName}
                                                        </span>
                                                    )}
                                                    {m.tag && (
                                                        <span className="text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold">
                                                            {m.tag}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs font-bold text-slate-800 whitespace-pre-wrap leading-relaxed">
                                                    {cleanedText}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-3 md:p-4 bg-white border-t border-slate-100 flex items-center justify-between gap-2 flex-shrink-0">
                            <div>
                                {selectedMemoOrder.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setSelectedMemoOrder([])}
                                        className="text-xs font-bold text-slate-500 hover:text-slate-800 underline px-2 py-1"
                                    >
                                        選択をすべてクリア
                                    </button>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowChatImportModal(false);
                                        setSelectedMemoOrder([]);
                                    }}
                                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                                >
                                    キャンセル
                                </button>
                                <button
                                    type="button"
                                    onClick={handleInsertSelectedMemos}
                                    disabled={selectedMemoOrder.length === 0}
                                    className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black shadow-md transition-all active:scale-95 flex items-center gap-1.5"
                                >
                                    <Check className="w-4 h-4" />
                                    <span>選択したメモを挿入 ({selectedMemoOrder.length}件)</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Tab Switches (Only Tree vs futurePlan when NOT in chat mode) */}
            {activeTab !== 'chat' && (
                <div className="flex border-b border-slate-200 bg-white flex-shrink-0 z-20">
                    <button 
                        onClick={() => setActiveTab('tree')}
                        className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all ${isTree ? 'text-tree-600 border-b-4 border-tree-600 bg-tree-50/20' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        ツリー通信
                    </button>
                    <button 
                        onClick={() => setActiveTab('futurePlan')}
                        className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all ${isFuturePlan ? 'text-wood-600 border-b-4 border-wood-600 bg-wood-50/20' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        今後の予定
                    </button>
                </div>
            )}


            {/* TAB CONTENTS */}
            {isTree ? (
                // ============================
                // === ツリー通信タブ (緑) ===
                // ============================
                <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
                    
                    {/* === 3-Button Toolbar === */}
                    <div className="border-b border-slate-200 bg-white flex-shrink-0">
                        {/* Popover: プログラム */}
                        {activeToolbarMenu === 'program' && (
                            <div className="max-h-[200px] overflow-y-auto bg-white p-2 border-b border-slate-200 flex flex-col gap-1.5 custom-scrollbar animate-in slide-in-from-top-2 duration-200">
                                <div className="flex justify-between items-center px-2 py-1 text-[9px] font-black text-slate-400 uppercase">
                                    <span>挿入するプログラム内容を選択</span>
                                    <button onClick={() => setActiveToolbarMenu(null)} className="text-slate-500 hover:text-slate-800">閉じる</button>
                                </div>
                                {(() => {
                                    const programsList = (programs && programs.length > 0)
                                        ? programs
                                        : (programTitle || programSummary ? [{ title: programTitle, summary: programSummary }] : []);
                                    const validProgs = programsList.filter(p => p.title || p.summary);
                                    return validProgs.length === 0 ? (
                                        <p className="text-center py-4 text-xs text-slate-400">プログラムが登録されていません</p>
                                    ) : validProgs.map((prog, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => {
                                                // タイトルは不要、内容（summary）のみ末尾に反映
                                                const textToInsert = prog.summary || prog.title || '';
                                                appendTextToEnd(textToInsert);
                                                setActiveToolbarMenu(null);
                                            }}
                                            className="text-left p-2 hover:bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-700 active:scale-95 transition-all"
                                        >
                                            {prog.title && <span className="font-black text-wood-700 block text-[11px] mb-0.5">{prog.title}</span>}
                                            <span className="text-slate-600 text-xs">{prog.summary || '（内容未入力）'}</span>
                                        </button>
                                    ));
                                })()}
                            </div>
                        )}

                        {/* Main 3 Buttons */}
                        <div className="flex items-center p-2 gap-2">
                            <button 
                                type="button" 
                                onClick={() => setShowChatImportModal(true)} 
                                className="flex-1 py-2 bg-white hover:bg-red-50 text-red-600 rounded-xl text-xs font-black shadow-sm border border-red-200 transition-all active:scale-95 flex items-center justify-center gap-1 cursor-pointer"
                                title="チャットメモを選択してツリー通信に一括挿入"
                            >
                                <MessageSquare className="w-3.5 h-3.5" />
                                <span>チャットメモから反映</span>
                            </button>
                            <button 
                                type="button" 
                                onClick={() => setActiveToolbarMenu(prev => prev === 'program' ? null : 'program')} 
                                className={`flex-1 py-2 rounded-xl text-xs font-black shadow-sm border transition-all active:scale-95 flex items-center justify-center gap-1 cursor-pointer ${activeToolbarMenu === 'program' ? 'bg-wood-500 text-white border-wood-600' : 'bg-white text-wood-700 border-wood-200'}`}
                            >
                                <FileText className="w-3.5 h-3.5" />
                                <span>プログラム</span>
                            </button>

                            {/* 挨拶テンプレ: タップで末尾即座挿入（編集は設定から） */}
                            <button 
                                type="button" 
                                onClick={handleInsertTemplate}
                                className="flex-1 py-2 bg-tree-600 hover:bg-tree-700 text-white rounded-xl text-xs font-black shadow-sm border border-tree-700 transition-all active:scale-95 flex items-center justify-center gap-1 cursor-pointer select-none"
                                title="タップで挨拶テンプレを末尾に即座挿入（変更は設定から）"
                            >
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>挨拶テンプレ</span>
                            </button>
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <div className="p-3 md:p-4 flex-1 flex flex-col gap-2 justify-between">
                        <div className="space-y-2 flex-1 flex flex-col">
                            <div className="space-y-1 flex-1 flex flex-col">
                                <div className="flex items-center justify-end gap-1.5 mb-1">
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
                                                                                                {hasConflict && (
                                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col gap-1.5 text-amber-800 animate-in fade-in duration-300 mb-2">
                                        <div className="flex items-center gap-1.5 text-[9px] font-black tracking-wider uppercase">
                                            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                                            <span>⚠️ 同時編集による競合を検知しました</span>
                                        </div>
                                        <p className="text-[10px] font-bold leading-normal text-amber-700">
                                            他ユーザーがこのツリー通信を保存しました。どちらの入力を残すか選択してください。
                                        </p>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1">
                                            <div className="p-2.5 bg-white border border-amber-100 rounded-xl flex flex-col gap-1">
                                                <span className="text-[9px] font-black text-amber-800 bg-amber-100/50 px-1.5 py-0.5 rounded-full w-fit">自分の内容（編集中の下書き）</span>
                                                <p className="text-[10px] text-slate-700 whitespace-pre-wrap break-all font-medium bg-slate-50 p-1.5 rounded-lg border border-slate-100 min-h-[45px] max-h-[80px] overflow-y-auto">{treeContent || '（空）'}</p>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        onSaveTree(child.id, { ...result, D: treeContent });
                                                        initialTextRef.current = treeContent;
                                                        setHasConflict(false);
                                                        setConflictingDbText('');
                                                    }}
                                                    className="mt-1 w-full py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[9px] font-black shadow-sm transition-all active:scale-95 text-center"
                                                >
                                                    自分の内容を強制保存
                                                </button>
                                            </div>
                                            <div className="p-2.5 bg-white border border-amber-100 rounded-xl flex flex-col gap-1">
                                                <span className="text-[9px] font-black text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded-full w-fit">他ユーザーの内容（データベース側）</span>
                                                <p className="text-[10px] text-slate-700 whitespace-pre-wrap break-all font-medium bg-slate-50 p-1.5 rounded-lg border border-slate-100 min-h-[45px] max-h-[80px] overflow-y-auto">{conflictingDbText || '（空）'}</p>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setTreeContent(conflictingDbText);
                                                        initialTextRef.current = conflictingDbText;
                                                        setHasConflict(false);
                                                        setConflictingDbText('');
                                                    }}
                                                    className="mt-1 w-full py-1 bg-slate-600 hover:bg-slate-700 text-white rounded-lg text-[9px] font-black shadow-sm transition-all active:scale-95 text-center"
                                                >
                                                    他ユーザーの内容を取り込む
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div className="relative w-full min-h-[120px] flex-1 flex flex-col bg-white border-2 border-slate-100 rounded-2xl focus-within:border-tree-400 focus-within:ring-4 focus-within:ring-tree-50 transition-all shadow-inner overflow-hidden">
                                                                        {/* Highlights Overlay Layer */}
                                    <div
                                        ref={highlightDivRef}
                                        className="absolute inset-0 p-3 text-xs md:text-sm leading-relaxed whitespace-pre-wrap break-all select-none pointer-events-none font-medium text-transparent overflow-y-auto"
                                        dangerouslySetInnerHTML={{ __html: getHighlightedTextHTML(treeContent, detectedNames) }}
                                    />
                                    {/* Actual Textarea */}
                                    <textarea
                                        id="guide-tree-textarea"
                                        ref={treeTextareaRef}
                                        value={treeContent}
                                        onChange={(e) => setTreeContent(e.target.value)}
                                        onScroll={handleTextareaScroll}
                                        onFocus={() => setIsFocused(true)}
                                        onBlur={() => setTimeout(() => setIsFocused(false), 500)}
                                        placeholder="ご家庭向けのツリー通信をリアルタイム自動保存します..."
                                        className="w-full h-full p-3 text-xs md:text-sm bg-transparent border-0 outline-none transition-all leading-relaxed resize-none font-medium text-slate-700 overflow-y-auto block flex-1 relative z-10"
                                    />
                                </div>
                                
                                {/* Detected Names Warning Alert Box */}
                                {detectedNames.length > 0 && (
                                    <div className="p-3 bg-red-50/70 border border-red-200/60 rounded-2xl flex flex-col gap-1.5 text-red-700 animate-in fade-in duration-300">
                                        <div className="flex items-center gap-1.5 text-[9px] font-black tracking-wider uppercase">
                                            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping" />
                                            <span>⚠️ 個人情報（名前）入力の可能性</span>
                                        </div>
                                        <p className="text-[10px] font-bold leading-normal text-red-600/90">
                                            児童の実名（さん・くん・ちゃん・君）が入力されている可能性があります。誤送信を防ぐため、確認・修正してください：
                                        </p>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {detectedNames.map((name, idx) => (
                                                <div key={idx} className="flex items-center gap-1 pl-2 pr-1 py-0.5 bg-red-100/80 text-red-800 border border-red-200/50 rounded-lg text-[9px] font-black shadow-sm group">
                                                    <span>{name}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => onAddOkWord && onAddOkWord(name)}
                                                        className="p-0.5 hover:bg-red-200 rounded text-red-600 hover:text-red-950 transition-all flex items-center justify-center"
                                                        title="このワードを一時的にOKに登録"
                                                    >
                                                        <Check className="w-2.5 h-2.5" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center justify-between gap-3 mt-1 pt-2 border-t border-slate-100 flex-shrink-0">
                            <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1.5" title="端末内にリアルタイム下書き保護されています（閉じても復元されます）">
                                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                                下書き保護中
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleCopyEditor}
                                    disabled={!treeContent.trim() || hasConflict}
                                    className={`px-4 py-2.5 rounded-xl font-black text-xs shadow-sm flex items-center justify-center gap-1.5 transition-all active:scale-95 border ${
                                        copiedEditor 
                                            ? 'bg-green-50 border-green-200 text-green-600' 
                                            : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600 disabled:opacity-50 disabled:pointer-events-none'
                                    }`}
                                    title={hasConflict ? '競合を解決するまでコピーできません' : 'クリップボードにコピー'}
                                >
                                    {copiedEditor ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                    <span>コピー</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    disabled={hasConflict}
                                    className={`px-4 py-2.5 rounded-xl font-black text-xs shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5 ${hasConflict ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200 shadow-none' : 'bg-slate-600 hover:bg-slate-700 text-white shadow-md'}`}
                                    title="現在の内容を保存して閉じます"
                                >
                                    <Check className="w-4 h-4" />
                                    <span>保存して閉じる</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleSaveCompleted(!isCompleted)}
                                    disabled={hasConflict}
                                    className={`px-4 py-2.5 rounded-xl font-black text-xs shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5 border ${
                                        isCompleted
                                            ? 'bg-red-800 hover:bg-red-900 text-white border-red-900 ring-2 ring-red-400/50'
                                            : 'bg-red-600 hover:bg-red-700 text-white border-red-700'
                                    } ${hasConflict ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    title={isCompleted ? 'クリックで完了状態を解除して保存します' : 'ツリー通信の入力を完了として保存します'}
                                >
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span>{isCompleted ? '完了済み（解除）' : '入力を完了して保存'}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : isFuturePlan ? (
                // ============================
                // === 今後の予定タブ (茶) ===
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
                                        <div 
                                            key={m.id || i} 
                                            className="bg-white p-2.5 rounded-xl shadow-sm border border-slate-100 flex items-start justify-between gap-2"
                                            style={m.tag === '【備考】' ? { border: '2px solid #8B4513' } : {}}
                                        >
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
                                                    for (const tag of tags) {
                                                        if (cleanedText.startsWith(tag)) {
                                                            cleanedText = cleanedText.substring(tag.length).trim();
                                                            break;
                                                        }
                                                    }
                                                    cleanedText = cleanedText.replace(/^(?:【[^】]+】|\[[^\]]+\])\s*/, '');
                                                    setFuturePlanContent(prev => prev ? prev + '\n' + cleanedText : cleanedText);
                                                }}
                                                className="px-2 py-1 bg-wood-50 hover:bg-wood-100 text-wood-700 hover:text-wood-800 rounded-lg text-[9px] font-black tracking-wider transition-colors flex-shrink-0 flex items-center gap-1 border border-wood-200"
                                                title="今後の予定に反映"
                                            >
                                                <Copy className="w-3.5 h-3.5" />
                                                <span>反映</span>
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="p-3 md:p-4 flex-1 flex flex-col gap-2 justify-between">
                        <div className="space-y-2 flex-1 flex flex-col">
                            <div className="space-y-1 flex-1 flex flex-col">
                                <div className="flex items-center justify-between mb-1 px-1">
                                    <span className="text-[10px] text-slate-500 font-bold">今後の予定</span>
                                    <span className={`text-[10px] font-bold ${futurePlanContent.length > 80 ? 'text-red-500' : 'text-slate-400'}`}>
                                        {futurePlanContent.length} / 80文字
                                    </span>
                                </div>
                                <div className="relative w-full min-h-[120px] flex-1 flex flex-col bg-white border-2 border-slate-100 rounded-2xl focus-within:border-wood-400 focus-within:ring-4 focus-within:ring-wood-50 transition-all shadow-inner overflow-hidden">
                                    <textarea
                                        value={futurePlanContent}
                                        onChange={(e) => setFuturePlanContent(e.target.value)}
                                        placeholder="児童の今後の予定を入力します。リアルタイム自動保存されます..."
                                        className="w-full h-full p-3 text-xs md:text-sm bg-transparent border-0 outline-none transition-all leading-relaxed resize-none font-medium text-slate-700 overflow-y-auto block flex-1 relative z-10"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between gap-3 mt-1 pt-2 border-t border-slate-100 flex-shrink-0">
                            <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1.5" title="端末内にリアルタイム下書き保護されています（閉じても復元されます）">
                                <span className="w-1.5 h-1.5 bg-wood-500 rounded-full animate-ping" />
                                下書き保護中
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    className="px-5 py-2.5 rounded-xl font-black text-xs shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5 bg-wood-600 hover:bg-wood-700 text-white shadow-md"
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
                                <div key={m.id || i} className={`group flex flex-col ${m.staffName && currentStaffName ? (m.staffName === currentStaffName ? 'items-end' : 'items-start') : (m.included ? 'items-end' : 'items-start opacity-70')}`}>
                                    {editingChatId === m.id ? (
                                        <div className="w-full max-w-[95%] bg-white p-4 rounded-3xl border-2 border-red-400 shadow-xl space-y-3">
                                            {/* タグ選択チップ一覧 */}
                                            <div className="space-y-1">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[10px] font-black text-slate-400">タグを変更:</span>
                                                    {editChatTags.length > 0 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setEditChatTags([])}
                                                            className="text-[10px] font-bold text-slate-400 hover:text-red-500 underline cursor-pointer"
                                                        >
                                                            タグ解除
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto custom-scrollbar p-0.5">
                                                    {tags.map(t => {
                                                        const isSelected = editChatTags.includes(t);
                                                        return (
                                                            <button
                                                                key={t}
                                                                type="button"
                                                                onClick={() => toggleEditTag(t)}
                                                                className={`px-2.5 py-1 rounded-full text-[10px] font-black transition-all border cursor-pointer active:scale-95 ${
                                                                    isSelected
                                                                        ? 'bg-red-500 text-white border-red-600 shadow-xs'
                                                                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                                                }`}
                                                            >
                                                                {t}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            <textarea
                                                value={editChatContent}
                                                onChange={(e) => setEditChatContent(e.target.value)}
                                                className="w-full text-sm font-medium text-slate-800 rounded-xl p-2.5 bg-slate-50 border border-slate-200 outline-none focus:bg-white focus:border-red-400 transition-all resize-none shadow-inner"
                                                rows={3}
                                                placeholder="メッセージ内容を入力..."
                                            />
                                            <div className="flex justify-end gap-2">
                                                <button 
                                                    type="button" 
                                                    onClick={handleCancelEdit} 
                                                    className="px-4 py-2 text-[10px] font-black text-slate-400 hover:text-slate-600 uppercase cursor-pointer"
                                                >
                                                    キャンセル
                                                </button>
                                                <button 
                                                    type="button" 
                                                    onClick={() => handleChatEditSave(m.id)} 
                                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[10px] font-black uppercase flex items-center gap-1.5 shadow-md shadow-red-100 transition-all active:scale-95 cursor-pointer"
                                                >
                                                    <Check className="w-3.5 h-3.5" /> 保存
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
                                                <div 
                                                    className={`p-4 rounded-[1.8rem] shadow-lg text-[13px] md:text-[14px] leading-relaxed font-bold ${m.staffName && currentStaffName ? (m.staffName === currentStaffName ? 'bg-red-500 text-white rounded-tr-none shadow-red-100' : 'bg-white text-slate-700 rounded-tl-none border border-slate-100 shadow-sm') : (m.included ? 'bg-red-500 text-white rounded-tr-none shadow-red-100' : 'bg-white text-slate-700 rounded-tl-none border border-slate-100 shadow-sm')}`}
                                                    style={m.tag === '【備考】' ? { border: '2px solid #8B4513' } : {}}
                                                >
                                                    {m.text}
                                                </div>
                                                {/* Hover Actions */}
                                                <div className={`absolute -bottom-2 ${m.staffName && currentStaffName ? (m.staffName === currentStaffName ? '-left-8' : '-right-8') : (m.included ? '-left-8' : '-right-8')} flex flex-col gap-1 opacity-0 group-hover/msg:opacity-100 transition-opacity`}>
                                                    <button 
                                                        onClick={() => handleStartEdit(m)}
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
                    <div className="p-5 bg-white border-t border-slate-100 space-y-3 shadow-[0_-20px_50px_rgba(0,0,0,0.02)]">
                        {/* 複数プログラム選択ポップオーバー（案A） */}
                        {programSelectPopover && (
                            <div className="p-3 bg-purple-50/95 border border-purple-200 rounded-2xl shadow-md flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-black text-purple-900 flex items-center gap-1.5">
                                        <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                                        挿入するプログラムを選択
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setProgramSelectPopover(null)}
                                        className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-purple-100/60 transition-colors cursor-pointer"
                                        title="閉じる"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                                    {validPrograms.map((p, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => {
                                                insertTagTemplateWithProgram(programSelectPopover.tag, idx);
                                                setProgramSelectPopover(null);
                                            }}
                                            className="p-2 bg-white hover:bg-purple-100/70 border border-purple-100 rounded-xl text-left transition-all active:scale-98 shadow-2xs flex flex-col gap-0.5 group cursor-pointer"
                                        >
                                            <div className="flex items-center justify-between gap-1">
                                                <span className="text-[11px] font-black text-purple-900 group-hover:text-purple-700">
                                                    {idx + 1}. {p.title || '（タイトル未設定）'}
                                                </span>
                                                {p.staff && (
                                                    <span className="text-[9px] px-1.5 py-0.2 bg-purple-100 text-purple-800 rounded-full font-bold flex-shrink-0">
                                                        {p.staff}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[10.5px] text-slate-500 line-clamp-2 leading-relaxed">
                                                {p.summary || '（内容なし）'}
                                            </p>
                                        </button>
                                    ))}
                                </div>
                                <div className="flex items-center justify-between pt-1 border-t border-purple-100/80">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            insertTagTemplateWithProgram(programSelectPopover.tag, 'none');
                                            setProgramSelectPopover(null);
                                        }}
                                        className="text-[10px] font-bold text-slate-400 hover:text-slate-600 px-1.5 py-0.5 transition-colors cursor-pointer"
                                    >
                                        文字挿入なし（タグのみ）
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            insertTagTemplateWithProgram(programSelectPopover.tag, 'all');
                                            setProgramSelectPopover(null);
                                        }}
                                        className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[10px] font-black transition-all active:scale-95 shadow-2xs flex items-center gap-1 cursor-pointer"
                                    >
                                        <span>すべて挿入</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Tag selectors */}
                        <div className="flex flex-wrap gap-1.5 w-full">
                            {tags.map(t => {
                                const isSelected = selectedTags.includes(t);
                                return (
                                    <button
                                        key={t}
                                        onClick={() => toggleTag(t)}
                                        className={`px-3 py-1.5 rounded-full text-[10px] font-black tracking-tight border transition-all active:scale-95 shadow-sm cursor-pointer ${
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

                        {/* Input Area: [削除ボタン] [textarea] [送信ボタン] */}
                        <div className="flex items-end gap-2 w-full">
                            {/* 削除ボタン（文字入力欄の左に常設） */}
                            <button
                                type="button"
                                onClick={handleClearChatText}
                                disabled={!chatText && selectedTags.length === 0}
                                className={`h-12 w-11 rounded-xl border flex flex-col items-center justify-center gap-0.5 transition-all flex-shrink-0 cursor-pointer ${
                                    chatText || selectedTags.length > 0
                                        ? 'bg-white border-slate-200 text-slate-500 hover:text-red-500 hover:bg-red-50 hover:border-red-200 active:scale-90 shadow-sm'
                                        : 'bg-slate-50/50 border-slate-100 text-slate-300 opacity-40 cursor-not-allowed'
                                }`}
                                title="入力文字と選択タグをすべて削除"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span className="text-[8px] font-black leading-none">削除</span>
                            </button>

                            <div className="flex-1">
                                <textarea
                                    id="guide-chat-textarea"
                                    value={chatText}
                                    onChange={(e) => setChatText(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleChatSend(); }}
                                    placeholder="チャットメモを入力（スタッフ間共有用）..."
                                    className="w-full min-h-[90px] max-h-[150px] p-4 text-[14px] bg-red-50/10 border-2 border-red-100/50 rounded-2xl outline-none focus:border-red-500 focus:bg-white focus:ring-4 focus:ring-red-50 transition-all shadow-inner leading-relaxed resize-none font-medium text-slate-800"
                                />
                            </div>
                            <button 
                                onClick={handleChatSend}
                                disabled={!chatText.trim()}
                                className="h-12 w-12 bg-red-500 hover:bg-red-600 text-white rounded-xl shadow-lg transition-all active:scale-90 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none flex items-center justify-center flex-shrink-0 cursor-pointer"
                                type="button"
                            >
                                <Send className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

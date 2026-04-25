import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
    PlusCircle, MessageSquare, Send, FileSpreadsheet, Printer, 
    Trash2, Clock, CheckCircle2, AlertCircle, Loader2, Sparkles,
    ChevronDown, ChevronUp, ChevronLeft, FileText, LayoutPanelLeft, UserCheck, 
    FileEdit, X, Calendar as CalendarIcon, Settings, LogOut, HelpCircle
} from 'lucide-react';
import MemoPanel from './components/MemoPanel';
import DocViewer from './components/DocViewer';
import TreeCommPanel from './components/TreeCommPanel';
import HelpGuide from './components/HelpGuide';
import Login from './components/Login';
import { auth, firestore } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { callStorage } from './hooks/useStorage';
import { APP_VERSION, DAILY_LIMIT, parseForceSheet, buildForceSheet, getStaffInstruction } from './app_constants';
import { defaultPrompts } from './constants/defaultPrompts';
import { CopyButton, ErrorBoundary } from './components/Shared';
import CalendarModal from './components/CalendarModal';
import SettingsModal from './components/SettingsModal';
import ExportModal from './components/ExportModal';
import AddChildModal from './components/AddChildModal';
import { printAllDocuments } from './utils/print';



// ── メインアプリケーション ──────────────────────────────────────────────────
export default function App() {
    // 1. All States (Restored and gathered at the very top)
    const [user, setUser] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [children, setChildren] = useState([]);
    const [toast, setToast] = useState(null);
    const [results, setResults] = useState({});
    const [summaryC, setSummaryC] = useState('');
    const [dailyMessages, setDailyMessages] = useState({});
    const [dailyTable, setDailyTable] = useState({});
    const [globalLog, setGlobalLog] = useState({ admin: '', supervisor: '', notice: '', activities: '' });
    const [selectedChildId, setSelectedChildId] = useState(null); 
    const [selectedTreeChildId, setSelectedTreeChildId] = useState(null); 
    const [selectedDocChildId, setSelectedDocChildId] = useState(null); 
    const [isTransportExpanded, setIsTransportExpanded] = useState(false);
    const [isNotesExpanded, setIsNotesExpanded] = useState(false);
    const [isWaitlistExpanded, setIsWaitlistExpanded] = useState(false); 
    const [isSyncing, setIsSyncing] = useState(false);
    const [showCalendarModal, setShowCalendarModal] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [showAddChildModal, setShowAddChildModal] = useState(false);
    const [sortConfig, setSortConfig] = useState({ key: 'default', direction: 'asc' });
    const [masterChildren, setMasterChildren] = useState([]);
    const [existingReportDates, setExistingReportDates] = useState([]); 
    const [showHelpGuide, setShowHelpGuide] = useState(false);
    const [staffList, setStaffList] = useState([]);

    const [isPanelClosing, setIsPanelClosing] = useState(false);
    const [lastPanelData, setLastPanelData] = useState(null);

    // Track the last active panel to keep content stable during exit animation
    useEffect(() => {
        if (selectedChildId || selectedTreeChildId || selectedDocChildId) {
            setLastPanelData({
                memo: selectedChildId,
                tree: selectedTreeChildId,
                doc: selectedDocChildId
            });
        }
    }, [selectedChildId, selectedTreeChildId, selectedDocChildId]);

    const handlePanelClose = () => {
        setIsPanelClosing(true);
        setTimeout(() => {
            setSelectedChildId(null);
            setSelectedTreeChildId(null);
            setSelectedDocChildId(null);
            setIsPanelClosing(false);
        }, 500);
    };

    // Prevent background scrolling when panel is open
    useEffect(() => {
        const isAnyPanelOpen = !!(selectedChildId || selectedTreeChildId || selectedDocChildId || isPanelClosing);
        if (isAnyPanelOpen) {
            document.body.style.overflow = 'hidden';
            document.body.style.touchAction = 'none'; // Further restrict gestures on body
        } else {
            document.body.style.overflow = '';
            document.body.style.touchAction = '';
        }
        return () => {
            document.body.style.overflow = '';
            document.body.style.touchAction = '';
        };
    }, [selectedChildId, selectedTreeChildId, selectedDocChildId, isPanelClosing]);
    

    const [tags, setTags] = useState(() => {
        const defaultTags = ['【ツリー式学習】', '【宿題】', '【プリント】', '【プログラム】', '【おやつ】', '【自由時間】'];
        try {
            const saved = localStorage.getItem('care_pro_tags');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (!parsed.includes('【自由時間】')) {
                    const newTags = [...parsed, '【自由時間】'];
                    localStorage.setItem('care_pro_tags', JSON.stringify(newTags));
                    return newTags;
                }
                return parsed;
            }
        } catch (e) { console.error('Tags load error', e); }
        return defaultTags;
    });

    // --- Hooks (MUST be called before any early returns) ---
    
    // Storage helper
    const cs = useCallback((p) => callStorage(p, () => {}, () => {}), []);

    // 1. Data Fetching Callback
    const fetchDailyData = useCallback(async (dateString) => {
        const data = await cs({ action: 'getReport', date: dateString });
        if (data && typeof data === 'object') {
            setResults(data.results || {});
            setSummaryC(data.summaryC || '');
            setDailyMessages(data.messages || {});
            setChildren(Array.isArray(data.children) ? data.children : []);
            setDailyTable(data.dailyTable || {});
            setGlobalLog(data.globalLog || { admin: '', supervisor: '', notice: '', activities: '' });
        } else {
            setResults({}); setSummaryC(''); setDailyMessages({}); setChildren([]);
            setDailyTable({}); setGlobalLog({ admin: '', supervisor: '', notice: '', activities: '' });
        }
    }, [cs]);

    // 1.5 Fetch Master Children
    const fetchMasterChildren = useCallback(async () => {
        const list = await cs({ action: 'getMasterChildren' });
        setMasterChildren(list || []);
    }, [cs]);

    // 1.6 Fetch Staff Names
    const fetchStaffNames = useCallback(async () => {
        const list = await cs({ action: 'getStaffNames' });
        setStaffList(list || []);
    }, [cs]);

    // 2. Auth Listener
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (u) => {
            setUser(u);
            setAuthLoading(false);
            if (u) {
                fetchMasterChildren();
                fetchStaffNames();
            }
        });
        return () => unsubscribe();
    }, [fetchMasterChildren, fetchStaffNames]);

    useEffect(() => { 
        if (user) fetchDailyData(selectedDate); 
    }, [selectedDate, fetchDailyData, user]);

    // 5. Normal Functions & Handlers
    const handleUpdateTags = (newTags) => {
        setTags(newTags);
        localStorage.setItem('care_pro_tags', JSON.stringify(newTags));
    };

    const handleLogout = async () => {
        if (!confirm('ログアウトしますか？')) return;
        await signOut(auth);
    };

    const SLOT_LIMIT = 10;
    const sortedChildren = [...children].sort((a, b) => {
        if (sortConfig.key === 'transportTime') {
            const timeA = dailyTable[a.id]?.transportTime || '';
            const timeB = dailyTable[b.id]?.transportTime || '';
            if (!timeA && timeB) return 1;
            if (timeA && !timeB) return -1;
            if (timeA === timeB) return (a.timestamp || 0) - (b.timestamp || 0);
            return sortConfig.direction === 'asc' ? timeA.localeCompare(timeB) : timeB.localeCompare(timeA);
        } else if (sortConfig.key === 'endTime') {
            const timeA = dailyTable[a.id]?.endTime || '';
            const timeB = dailyTable[b.id]?.endTime || '';
            if (!timeA && timeB) return 1;
            if (timeA && !timeB) return -1;
            if (timeA === timeB) return (a.timestamp || 0) - (b.timestamp || 0);
            return sortConfig.direction === 'asc' ? timeA.localeCompare(timeB) : timeB.localeCompare(timeA);
        }
        return (a.timestamp || 0) - (b.timestamp || 0);
    });
    const regularChildren = sortedChildren.slice(0, SLOT_LIMIT);
    const waitlistChildren = sortedChildren.slice(SLOT_LIMIT);
    const displayRegular = [...regularChildren];
    while (displayRegular.length < SLOT_LIMIT) {
        displayRegular.push({ id: `empty-${displayRegular.length}`, name: '未設定', isPlaceholder: true });
    }

    const saveDailyData = async (date, ch, msgs, res, sum, table, global) => {
        setIsSyncing(true);
        const dailyData = { children: ch, messages: msgs, results: res, summaryC: sum, dailyTable: table || dailyTable, globalLog: global || globalLog, updatedAt: new Date().toISOString() };
        
        // 1. Save traditional daily bulk report
        await cs({ action: 'saveReport', date, data: dailyData });

        // 2. Save individual child communications for cross-app synchronization
        // Path: children/{childId}/tree_communications/{date}
        for (const child of ch) {
            if (child.isPlaceholder) continue;
            
            const childResult = res[child.id] || {};
            const childTable = (table || dailyTable)[child.id] || {};
            
            const individualData = {
                name: child.name,
                tree_comm_text: childResult.D || '',
                pickupLocation: childTable.pickupLocation || '',
                endTime: childTable.endTime || '',
                transportTime: childTable.transportTime || '',
                notes: childTable.notes || ''
            };

            await cs({ 
                action: 'saveIndividualTreeComm', 
                childId: child.id, 
                date: date, 
                data: individualData 
            });
        }
        
        setIsSyncing(false);
    };

    const updateGlobalLog = async (field, value) => {
        const newLog = { ...globalLog, [field]: value };
        setGlobalLog(newLog);
        await saveDailyData(selectedDate, children, dailyMessages, results, summaryC, dailyTable, newLog);
    };

    const handleAddFromMaster = async (masterChild) => {
        if (children.some(c => c.id === masterChild.id)) {
            showToast(`${masterChild.name}さんは既に追加されています。`);
            return;
        }
        const newChild = { ...masterChild, timestamp: Date.now() };
        const newList = [...children, newChild];
        setChildren(newList);
        const newTable = { ...dailyTable, [newChild.id]: { ...(dailyTable[newChild.id] || {}), pickupLocation: masterChild.defaultPickupLocation || '' } };
        setDailyTable(newTable);
        await saveDailyData(selectedDate, newList, dailyMessages, results, summaryC, newTable, globalLog);
        showToast(`${masterChild.name}さんを本日のリストに追加しました。`);
    };

    const updateDailyTable = async (childId, data) => {
        const newTable = { ...dailyTable, [childId]: { ...(dailyTable[childId] || {}), ...data } };
        setDailyTable(newTable);
        await saveDailyData(selectedDate, children, dailyMessages, results, summaryC, newTable, globalLog);
    };

    const removeChild = async (id) => {
        if (!confirm('削除しますか？')) return;
        const newList = children.filter(c => c.id !== id);
        setChildren(newList);
        await saveDailyData(selectedDate, newList, dailyMessages, results, summaryC, dailyTable, globalLog);
    };

    const handleSort = (key) => {
        setSortConfig(prev => {
            if (prev.key === key) {
                if (prev.direction === 'asc') return { key, direction: 'desc' };
                return { key: 'default', direction: 'asc' }; // Reset to manual order
            }
            return { key, direction: 'asc' };
        });
    };

    const sendMessage = async (childId, text) => {
        const newMsg = { id: crypto.randomUUID(), text, timestamp: new Date().toISOString(), included: true };
        const newMessages = { ...dailyMessages, [childId]: [...(dailyMessages[childId] || []), newMsg] };
        setDailyMessages(newMessages);
        await saveDailyData(selectedDate, children, newMessages, results, summaryC, dailyTable, globalLog);
    };

    const deleteMessage = async (childId, msgId) => {
        if (!confirm('メッセージを削除しますか？')) return;
        const newMsgs = (dailyMessages[childId] || []).filter(m => m.id !== msgId);
        const newMessages = { ...dailyMessages, [childId]: newMsgs };
        setDailyMessages(newMessages);
        await saveDailyData(selectedDate, children, newMessages, results, summaryC, dailyTable, globalLog);
    };

    const updateMessage = async (childId, msgId, newText) => {
        const newMsgs = (dailyMessages[childId] || []).map(m => m.id === msgId ? { ...m, text: newText } : m);
        const newMessages = { ...dailyMessages, [childId]: newMsgs };
        setDailyMessages(newMessages);
        await saveDailyData(selectedDate, children, newMessages, results, summaryC, dailyTable, globalLog);
    };

    const saveResults = async (res, sum) => { 
        setResults(res); setSummaryC(sum); 
        await saveDailyData(selectedDate, children, dailyMessages, res, sum, dailyTable, globalLog); 
    };

    const showToast = (message) => {
        setToast(message);
        setTimeout(() => setToast(null), 5000);
    };

    // タグ抽出
    const getStudyText = (childId) => {
        const msgs = dailyMessages[childId] || [];
        return msgs.filter(m => m.text.includes('【ツリー式学習】') || m.text.includes('【学習】') || m.text.includes('【宿題】') || m.text.includes('【プリント】'))
            .map(m => m.text.trim()).filter(t => t).join('\n');
    };
    const getProgramText = (childId) => {
        const msgs = dailyMessages[childId] || [];
        return msgs.filter(m => m.text.includes('【プログラム】'))
            .map(m => m.text.trim()).filter(t => t).join(' / ');
    };

    // 6. JSX Return (Conditional inside to keep hook order)
    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-10 h-10 text-tree-500 animate-spin" />
                    <p className="font-black text-slate-400 uppercase tracking-widest text-xs">Authenticating...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return <Login onLoginSuccess={() => {}} />;
    }

    return (
        <div className="min-h-screen p-3 md:p-6 pb-24 space-y-4 md:space-y-6 max-w-[1800px] mx-auto overflow-x-hidden">
            {/* Ultra Compact Responsive Header */}
            <header className="sticky top-0 z-[60] bg-white/70 backdrop-blur-xl rounded-2xl md:rounded-[2.5rem] flex items-center justify-between px-4 py-2.5 md:px-6 md:py-3.5 mb-6 border border-white/40 shadow-premium no-print">
                {/* Left Side: Logo, Title, Date */}
                <div className="flex items-center gap-3 md:gap-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-tree-600 rounded-xl shadow-lg flex-shrink-0">
                            <FileText className="w-4 h-4 md:w-5 md:h-5 text-white" />
                        </div>
                        <h1 className="hidden sm:block text-sm md:text-xl font-black text-slate-800 tracking-tighter">Tree Kids School</h1>
                    </div>

                    <div id="guide-date-picker" onClick={() => setShowCalendarModal(true)} className="flex items-center gap-2 px-3 py-2 bg-slate-50/80 hover:bg-tree-50 rounded-full border border-slate-100 cursor-pointer transition-all group">
                        <CalendarIcon className="w-3.5 h-3.5 text-tree-600 group-hover:scale-110 transition-transform" />
                        <span className="font-black text-slate-700 text-[10px] md:text-xs tracking-tight">{selectedDate}</span>
                        <ChevronDown className="w-3 h-3 text-slate-300" />
                    </div>
                </div>

                {/* Right Side: Action Buttons */}
                <div className="flex items-center gap-2 md:gap-4">
                    <div className="flex items-center gap-2 mr-2">
                        <button 
                            id="guide-add-child"
                            onClick={() => setShowAddChildModal(true)}
                            className="px-3 py-2 md:px-5 md:py-2.5 bg-tree-600 hover:bg-tree-700 text-white rounded-full font-black text-[10px] md:text-sm shadow-md transition-all active:scale-95 flex items-center gap-2"
                        >
                            <PlusCircle className="w-4 h-4" />
                            <span className="hidden sm:inline">児童追加</span>
                        </button>

                        <button 
                            id="guide-print" 
                            onClick={() => printAllDocuments(children, results, summaryC, selectedDate, dailyTable, dailyMessages, globalLog)} 
                            className="px-3 py-2 md:px-5 md:py-2.5 bg-wood-600 hover:bg-wood-700 text-white rounded-full font-black text-[10px] md:text-sm shadow-md transition-all active:scale-95 flex items-center gap-2"
                        >
                            <Printer className="w-4 h-4" /> 
                            <span className="hidden sm:inline">一括印刷</span>
                        </button>

                        <button 
                            onClick={() => setShowExportModal(true)} 
                            className="p-2 text-slate-400 hover:text-tree-600 transition-all active:scale-90"
                            title="データ出力"
                        >
                            <FileSpreadsheet className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="w-px h-6 bg-slate-200 hidden md:block" />

                    <div className="flex items-center gap-1">
                        <button id="guide-help" onClick={() => setShowHelpGuide(true)} className="p-2 hover:bg-tree-50 rounded-xl transition-all active:scale-95 group">
                            <HelpCircle className="w-4.5 h-4.5 text-tree-600 group-hover:scale-110 transition-transform" />
                        </button>
                        <button onClick={() => setShowSettingsModal(true)} className="p-2 hover:bg-tree-50 rounded-xl transition-all active:scale-95 group">
                            <Settings id="guide-settings" className="w-4.5 h-4.5 text-slate-400 group-hover:rotate-45 transition-transform" />
                        </button>
                        <button onClick={handleLogout} className="p-2 hover:bg-apple-50 rounded-xl transition-all active:scale-95 group">
                            <LogOut className="w-4.5 h-4.5 text-slate-400 group-hover:text-apple-500" />
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Information Bento */}
            <div className="flex flex-col lg:flex-row gap-6 animate-in fade-in duration-1000">
                <div className="flex-1 min-w-0">
                    <div className="bg-white/90 backdrop-blur-3xl rounded-[2.5rem] md:rounded-[3.5rem] shadow-premium border border-white/60 overflow-hidden hover:shadow-2xl transition-all duration-700">
                        <div className="overflow-x-auto custom-scrollbar-hidden md:custom-scrollbar">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/50 border-b border-slate-100">
                                        <th className="sticky left-0 z-30 bg-slate-50 border-r border-slate-100 w-32 md:w-44 min-w-[120px] md:min-w-[180px] p-4 md:p-6 text-[10px] md:text-[12px] font-black text-slate-400 uppercase tracking-[0.2em] text-left">児童氏名</th>
                                        <th className="border-r border-slate-100 w-16 md:w-24 p-3 md:p-6 text-[10px] md:text-[12px] font-black text-slate-400 text-center relative bg-slate-50/20">
                                            <span className="whitespace-nowrap">ツリー通信</span>
                                            <button 
                                                id="guide-transport-toggle"
                                                onClick={() => setIsTransportExpanded(!isTransportExpanded)}
                                                className={`absolute top-2 -right-3 md:top-4 md:-right-5 z-40 p-2 md:px-4 md:py-2.5 rounded-xl md:rounded-2xl flex items-center gap-2 transition-all shadow-premium active:scale-90 ${isTransportExpanded ? 'bg-wood-500 text-white ring-4 md:ring-8 ring-wood-50' : 'bg-white text-wood-500 hover:bg-wood-50 border border-wood-100'}`}
                                            >
                                                {isTransportExpanded ? <><ChevronLeft className="hidden md:inline w-4 h-4" /> <span className="text-[8px] md:text-[10px] font-extrabold uppercase">OFF</span></> : <Clock className="w-4 h-4 md:w-5 md:h-5" />}
                                            </button>
                                        </th>
                                        <th onClick={() => handleSort('transportTime')} className={`animate-col p-2 md:p-4 text-[10px] md:text-[11px] font-black text-wood-600 border-r border-t-4 border-wood-200 cursor-pointer hover:bg-wood-50/50 transition-colors ${!isTransportExpanded ? 'col-collapsed' : 'w-16 md:w-24 text-center bg-wood-50/30'}`}>
                                            送迎時間 {sortConfig.key === 'transportTime' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                        </th>
                                        <th onClick={() => handleSort('endTime')} className={`animate-col p-2 md:p-4 text-[10px] md:text-[11px] font-black text-wood-600 border-r border-t-4 border-wood-200 cursor-pointer hover:bg-wood-50/50 transition-colors ${!isTransportExpanded ? 'col-collapsed' : 'w-16 md:w-24 text-center bg-wood-50/30'}`}>
                                            終了時間 {sortConfig.key === 'endTime' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                        </th>
                                        <th className={`animate-col text-[10px] md:text-[11px] font-black text-wood-600 border-t-4 border-wood-200 ${!isTransportExpanded ? 'col-collapsed' : 'p-2 w-24 md:w-36 bg-wood-50/30 border-r-2 font-bold'}`}>迎え場所</th>
                                        
                                        <th className="p-3 md:p-4 text-[10px] md:text-[12px] font-black text-slate-400 w-[140px] md:w-[220px] border-r border-slate-100 bg-slate-50/10 text-center">学習</th>
                                        <th className={`p-4 md:p-6 text-[10px] md:text-[12px] font-black text-slate-400 w-[140px] md:w-[220px] border-r border-slate-100 relative bg-slate-50/10 text-center`}>
                                            <span>プログラム</span>
                                            <button 
                                                id="guide-program-toggle"
                                                onClick={() => setIsNotesExpanded(!isNotesExpanded)}
                                                className={`absolute top-2 -right-3 md:top-4 md:-right-5 z-40 p-2 md:px-4 md:py-2.5 rounded-xl md:rounded-2xl flex items-center gap-2 transition-all shadow-premium active:scale-90 ${isNotesExpanded ? 'bg-tree-600 text-white ring-4 md:ring-8 ring-tree-50' : 'bg-white text-tree-600 hover:bg-tree-50 border border-tree-100'}`}
                                            >
                                                {isNotesExpanded ? <><ChevronLeft className="hidden md:inline w-4 h-4" /> <span className="text-[8px] md:text-[10px] font-extrabold uppercase">OFF</span></> : <MessageSquare className="w-4 h-4 md:w-5 md:h-5" />}
                                            </button>
                                        </th>
                                        <th className={`animate-col p-4 md:p-6 text-[10px] md:text-[12px] font-black text-slate-400 border-t-4 border-tree-200 ${!isNotesExpanded ? 'col-collapsed' : 'w-[200px] md:w-[300px] bg-tree-50/20'}`}>自由記述 (スタッフメモ)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {displayRegular.map((child, index) => {
                                        const row = dailyTable[child.id] || {};
                                        const isPlaceholder = !!child.isPlaceholder;
                                        return (
                                            <tr key={child.id} className={`border-b border-slate-100 group transition-all ${isPlaceholder ? 'row-placeholder bg-slate-50/10 no-print' : selectedChildId === child.id ? 'bg-tree-50/30' : 'hover:bg-slate-50/20'}`}>
                                                <td className={`sticky left-0 z-10 p-4 md:p-6 font-black border-r border-slate-100 ${selectedChildId === child.id ? 'bg-tree-100/40' : 'bg-white group-hover:bg-slate-50'} ${isPlaceholder ? 'text-[10px] py-2' : 'text-[12px] md:text-sm'}`}>
                                                    <button 
                                                        id={index === 0 ? "guide-child-name" : undefined}
                                                        onClick={() => !isPlaceholder && setSelectedChildId(child.id)} 
                                                        className={`w-full text-left truncate transition-colors text-ellipsis overflow-hidden ${isPlaceholder ? 'text-slate-300' : 'hover:text-tree-600'}`}>{child.name ?? '名称未設定'}</button>
                                                </td>
                                                <td className="p-0 border-r border-slate-100 text-center relative" id={index === 0 ? "guide-tree-comm" : undefined}>
                                                    {!isPlaceholder && (
                                                        <button 
                                                            onClick={() => { setSelectedTreeChildId(child.id); setSelectedChildId(null); setSelectedDocChildId(null); }} className={`w-full h-full p-4 md:p-5 flex items-center justify-center transition-all ${results[child.id]?.D ? 'text-tree-600 bg-tree-50/50' : 'text-slate-200 hover:text-tree-500'}`}>
                                                            <FileEdit className="w-5 h-5 md:w-6 md:h-6 font-bold" />
                                                        </button>
                                                    )}
                                                </td>
                                                <td className={`animate-col p-0 border-r border-slate-100 transition-all ${!isTransportExpanded ? 'col-collapsed' : 'bg-wood-50/20'}`}>
                                                    {!isPlaceholder && <input type="time" value={row.transportTime || ''} onChange={e => updateDailyTable(child.id, { transportTime: e.target.value })} className="w-full h-full p-4 md:p-6 text-[10px] border-none bg-transparent outline-none text-center font-black text-tree-600" />}
                                                </td>
                                                <td className={`animate-col p-0 border-r border-slate-100 transition-all ${!isTransportExpanded ? 'col-collapsed' : 'bg-wood-50/10'}`}>
                                                    {!isPlaceholder && <input type="time" value={row.endTime || ''} onChange={e => updateDailyTable(child.id, { endTime: e.target.value })} className="w-full h-full p-4 md:p-6 text-[10px] border-none bg-transparent outline-none text-center font-bold text-slate-500" />}
                                                </td>
                                                <td className={`animate-col p-0 border-r border-slate-100 transition-all ${!isTransportExpanded ? 'col-collapsed' : 'bg-wood-50/10'}`}>
                                                    {!isPlaceholder && <input value={row.pickupLocation || ''} onChange={e => updateDailyTable(child.id, { pickupLocation: e.target.value })} className="w-full h-full p-4 md:p-6 text-[10px] md:text-[12px] border-none bg-transparent outline-none font-black text-wood-700" placeholder="---" />}
                                                </td>
                                                <td onClick={() => { if(!isPlaceholder) { setSelectedChildId(child.id); setSelectedTreeChildId(null); setSelectedDocChildId(null); } }} className="p-3 md:p-5 text-[10px] md:text-[12px] text-slate-600 border-r border-slate-100 leading-relaxed font-bold align-top cursor-pointer hover:bg-slate-50 transition-colors">
                                                    {!isPlaceholder && (
                                                        getStudyText(child.id) ? (
                                                            <div className="text-tree-600 tracking-tight whitespace-pre-wrap">{getStudyText(child.id)}</div>
                                                        ) : <div className="opacity-0 italic text-center text-[10px]">---</div>
                                                    )}
                                                </td>
                                                <td onClick={() => { if(!isPlaceholder) { setSelectedChildId(child.id); setSelectedTreeChildId(null); setSelectedDocChildId(null); } }} className="p-3 md:p-5 text-[10px] md:text-[12px] text-slate-600 border-r border-slate-100 leading-relaxed font-bold align-top cursor-pointer hover:bg-slate-50 transition-colors">
                                                    {!isPlaceholder && (
                                                        getProgramText(child.id) ? (
                                                            <div className="text-wood-600 tracking-tight whitespace-pre-wrap">{getProgramText(child.id)}</div>
                                                        ) : <div className="opacity-0 italic text-center text-[10px]">---</div>
                                                    )}
                                                </td>
                                                <td className={`animate-col p-0 ${!isNotesExpanded ? 'col-collapsed' : ''}`}>
                                                    {!isPlaceholder && <textarea value={row.notes || ''} onChange={e => updateDailyTable(child.id, { notes: e.target.value })} className="w-full h-full p-4 md:p-6 text-[10px] md:text-[12px] border-none bg-transparent outline-none resize-none min-h-[50px] md:min-h-[60px] font-medium leading-relaxed text-slate-600" placeholder="..." />}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div className="bg-slate-50/30 p-4">
                            <button onClick={() => setIsWaitlistExpanded(!isWaitlistExpanded)} className="w-full py-4 text-[12px] font-black text-slate-400 hover:bg-white hover:text-wood-600 transition-all rounded-[2rem] border-2 border-dashed border-slate-200 uppercase tracking-widest">
                                {isWaitlistExpanded ? '待機リストを非表示' : `待機児童を表示 (${waitlistChildren.length} 名)`}
                            </button>
                            {isWaitlistExpanded && waitlistChildren.map(child => (
                                <div key={child.id} className="mt-3 p-5 rounded-[2rem] flex items-center justify-between bg-white border border-slate-100 shadow-sm animate-in slide-in-from-top-4">
                                    <span className="text-xs font-black text-slate-600">{child.name} <span className="text-[10px] text-wood-400 font-bold ml-2">定員超過</span></span>
                                    <button onClick={() => removeChild(child.id)} className="p-3 text-slate-200 hover:text-apple-500 transition-colors"><Trash2 className="w-5 h-5" /></button>
                                </div>
                            ))}
                        </div>
                        
                        {/* Global Notes Section */}
                        <div className="bg-white/50 p-6 md:p-8 mt-4 border-t border-slate-100 flex flex-col gap-4">
                            <div className="flex items-center gap-3 px-4">
                                <div className="w-1.5 h-6 bg-apple-500 rounded-full" />
                                <h3 className="text-[12px] md:text-sm font-black text-slate-800 uppercase tracking-widest">【全体的な様子、特記事項】</h3>
                            </div>
                            <textarea
                                value={globalLog.notice || ''}
                                onChange={(e) => updateGlobalLog('notice', e.target.value)}
                                placeholder="本日の全体的な様子や特記事項を入力してください（印刷用日誌に反映されます）"
                                className="w-full min-h-[120px] p-6 md:p-8 bg-white/80 border-2 border-slate-100 rounded-[2.5rem] focus:border-apple-500 focus:ring-8 focus:ring-apple-50 focus:bg-white outline-none transition-all text-[13px] md:text-[15px] font-medium leading-relaxed shadow-inner resize-none"
                            />
                        </div>
                    </div>
                </div>

            {/* Floating Action Panels */}
            {(selectedChildId || selectedTreeChildId || selectedDocChildId || isPanelClosing) && (
                <div className="fixed inset-y-0 right-0 z-[100] w-full md:w-[540px] p-4 flex">
                    <div className={`glass-card w-full h-full rounded-[4rem] shadow-2xl overflow-hidden flex flex-col border-white shadow-tree-100 ${isPanelClosing ? 'animate-out-right' : 'animate-right'}`}>
                        {(selectedChildId || (isPanelClosing && lastPanelData?.memo)) && !selectedTreeChildId && !selectedDocChildId && (
                            <MemoPanel
                                child={children.find(c => c.id === (selectedChildId || lastPanelData?.memo))}
                                messages={dailyMessages[selectedChildId || lastPanelData?.memo] || []}
                                tags={tags}
                                onSave={sendMessage}
                                onDelete={deleteMessage}
                                onUpdate={updateMessage}
                                onClose={handlePanelClose}
                            />
                        )}
                        {(selectedTreeChildId || (isPanelClosing && lastPanelData?.tree)) && !selectedDocChildId && (
                            <TreeCommPanel
                                child={children.find(c => c.id === (selectedTreeChildId || lastPanelData?.tree))}
                                messages={dailyMessages[selectedTreeChildId || lastPanelData?.tree] || []}
                                tags={tags}
                                result={results[selectedTreeChildId || lastPanelData?.tree] || {}}
                                selectedDate={selectedDate}
                                staffList={staffList}
                                onSave={(id, res) => saveResults({ ...results, [id]: res }, summaryC)}
                                onClose={handlePanelClose}
                            />
                        )}
                        {(selectedDocChildId || (isPanelClosing && lastPanelData?.doc)) && (
                            <DocViewer
                                child={children.find(c => c.id === (selectedDocChildId || lastPanelData?.doc))}
                                result={results[selectedDocChildId || lastPanelData?.doc]}
                                selectedDate={selectedDate}
                                onSaveResult={(id, res) => saveResults({ ...results, [id]: res }, summaryC)}
                                onClose={handlePanelClose}
                            />
                        )}
                    </div>
                </div>
            )}
            </div>

            {/* Modals */}
            <CalendarModal show={showCalendarModal} onClose={() => setShowCalendarModal(false)} setSelectedDate={setSelectedDate} selectedDate={selectedDate} existingReportDates={existingReportDates} />
            <AddChildModal show={showAddChildModal} onClose={() => setShowAddChildModal(false)} masterChildren={masterChildren} currentChildren={children} onAddChild={handleAddFromMaster} />
            {showSettingsModal && (
                <SettingsModal 
                    onClose={() => setShowSettingsModal(false)} 
                    tags={tags} 
                    onSaveTags={handleUpdateTags} 
                />
            )}
            <ExportModal show={showExportModal} onClose={() => setShowExportModal(false)} selectedDate={selectedDate} children={children} results={results} summaryC={summaryC} />
            
            {showHelpGuide && (
                <HelpGuide onClose={() => setShowHelpGuide(false)} />
            )}
        
            {/* Custom Toast Notification */}
            {toast && (
                <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[110] bg-slate-800 text-white px-8 py-5 rounded-2xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-top-4 fade-in duration-300 max-w-[90%] md:max-w-xl border-l-8 border-apple-500">
                    <AlertCircle className="w-8 h-8 md:w-10 md:h-10 text-apple-400 flex-shrink-0" />
                    <p className="font-bold text-xs md:text-sm leading-relaxed tracking-wide drop-shadow-sm">{toast}</p>
                    <button onClick={() => setToast(null)} className="p-2 ml-4 rounded-full bg-white/10 hover:bg-white/20 transition-colors flex-shrink-0">
                        <X className="w-5 h-5" />
                    </button>
                </div>
            )}
        </div>
    );
}

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
    PlusCircle, MessageSquare, Send, FileSpreadsheet, Printer, 
    Trash2, Clock, CheckCircle2, AlertCircle, Loader2, Sparkles,
    ChevronDown, ChevronUp, ChevronLeft, FileText, LayoutPanelLeft, UserCheck, 
    FileEdit, X, Calendar as CalendarIcon, Settings
} from 'lucide-react';
import MemoPanel from './components/MemoPanel';
import DocViewer from './components/DocViewer';
import TreeCommPanel from './components/TreeCommPanel';
import { callStorage } from './hooks/useStorage';
import { STAFF_OPTIONS, APP_VERSION, DAILY_LIMIT, parseForceSheet, buildForceSheet, getStaffInstruction } from './constants';
import { defaultPrompts } from './constants/defaultPrompts';
import { CopyButton, ErrorBoundary } from './components/Shared';
import CalendarModal from './components/CalendarModal';
import SettingsModal from './components/SettingsModal';
import ExportModal from './components/ExportModal';
import { printAllDocuments } from './utils/print';

// ── AI 通信 ────────────────────────────────────────────────────────────────
const fetchAI = async (prompt, isJson) => {
    const callGeminiDirectly = async (apiKey, prompt, isJson) => {
        const MODEL = 'gemini-2.0-flash';
        const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;
        const response = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7 } })
        });
        if (!response.ok) throw new Error('AI連携に失敗しました。');
        const json = await response.json();
        const text = json.candidates[0].content.parts[0].text;
        if (!isJson) return text;
        const match = text.match(/\{[\s\S]*\}/);
        return match ? JSON.parse(match[0]) : null;
    };
    const savedKey = localStorage.getItem('care_pro_api_key');
    if (!savedKey) { alert('APIキーが設定されていません'); return null; }
    try { return await callGeminiDirectly(savedKey, prompt, isJson); }
    catch (e) { alert('通信エラー: ' + e.message); return null; }
};

// ── メインアプリケーション ──────────────────────────────────────────────────
export default function App() {
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [children, setChildren] = useState([]);
    const [results, setResults] = useState({});
    const [summaryC, setSummaryC] = useState('');
    const [dailyMessages, setDailyMessages] = useState({});
    const [dailyTable, setDailyTable] = useState({});
    const [globalLog, setGlobalLog] = useState({ admin: '', supervisor: '', notice: '', activities: '' });
    
    const [selectedChildId, setSelectedChildId] = useState(null);
    const [selectedDocChildId, setSelectedDocChildId] = useState(null);
    const [selectedTreeChildId, setSelectedTreeChildId] = useState(null);
    
    const [loading, setLoading] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [existingReportDates, setExistingReportDates] = useState([]);
    const [showCalendarModal, setShowCalendarModal] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [selectedGenerateIds, setSelectedGenerateIds] = useState([]);
    const [isTransportExpanded, setIsTransportExpanded] = useState(true);
    const [isNotesExpanded, setIsNotesExpanded] = useState(false);
    const [isWaitlistExpanded, setIsWaitlistExpanded] = useState(false);
    const [config, setConfig] = useState(() => ({
        apiKey: localStorage.getItem('care_pro_api_key') || ''
    }));

    // Dynamic Tags State
    const [tags, setTags] = useState(() => {
        try {
            const saved = localStorage.getItem('care_pro_tags');
            if (saved) return JSON.parse(saved);
        } catch (e) { console.error('Tags load error', e); }
        return ['【ツリー式学習】', '【宿題】', '【プリント】', '【プログラム】', '【おやつ】'];
    });

    const handleUpdateTags = (newTags) => {
        setTags(newTags);
        localStorage.setItem('care_pro_tags', JSON.stringify(newTags));
    };

    const handleUpdateConfig = (newConfig) => {
        setConfig(newConfig);
        localStorage.setItem('care_pro_api_key', newConfig.apiKey);
    };

    const SLOT_LIMIT = 10;
    const sortedChildren = [...children].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    const regularChildren = sortedChildren.slice(0, SLOT_LIMIT);
    const waitlistChildren = sortedChildren.slice(SLOT_LIMIT);

    const displayRegular = [...regularChildren];
    while (displayRegular.length < SLOT_LIMIT) {
        displayRegular.push({ id: `empty-${displayRegular.length}`, name: '未設定', isPlaceholder: true });
    }

    const cs = (p) => callStorage(p, () => {}, () => {});

    // 保存と取得
    const saveDailyData = async (date, ch, msgs, res, sum, table, global) => {
        setIsSyncing(true);
        const data = { children: ch, messages: msgs, results: res, summaryC: sum, dailyTable: table || dailyTable, globalLog: global || globalLog, updatedAt: new Date().toISOString() };
        await cs({ action: 'saveReport', date, data });
        setIsSyncing(false);
    };

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
    }, []);

    useEffect(() => { fetchDailyData(selectedDate); }, [selectedDate, fetchDailyData]);

    // ハンドラー
    const addChild = async () => {
        const newChild = { id: crypto.randomUUID(), name: '新規児童', timestamp: Date.now() };
        const newList = [...children, newChild];
        setChildren(newList);
        setSelectedGenerateIds(prev => [...prev, newChild.id]);
        await saveDailyData(selectedDate, newList, dailyMessages, results, summaryC, dailyTable, globalLog);
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

    const sendMessage = async (childId, text) => {
        const newMsg = { id: crypto.randomUUID(), text, timestamp: new Date().toISOString(), included: true };
        const newMessages = { ...dailyMessages, [childId]: [...(dailyMessages[childId] || []), newMsg] };
        setDailyMessages(newMessages);
        await saveDailyData(selectedDate, children, newMessages, results, summaryC, dailyTable, globalLog);
    };

    const saveResults = async (res, sum) => { 
        setResults(res); setSummaryC(sum); 
        await saveDailyData(selectedDate, children, dailyMessages, res, sum, dailyTable, globalLog); 
    };

    const toggleChildGenerate = (id) => setSelectedGenerateIds(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);

    const generateDocuments = async () => {
        const toGenerate = children.filter(c => selectedGenerateIds.includes(c.id));
        if (toGenerate.length === 0) return;
        setLoading(true);
        try {
            const processedResults = { ...results };
            for (const child of toGenerate) {
                const msgs = (dailyMessages[child.id] || []).filter(m => m.included !== false).map(m => m.text).join('\n');
                const template = child.forceSheet ? '{"B_result": "...", "B_item": "...", "K_sheet": "..."}' : '{"B_result": "...", "B_item": "..."}';
                const prompt = `児童メモを元に療育支援記録(B_result)と項目(B_item)を作成してください。\nメモ: ${msgs}\nJSON形式: ${template}`;
                const response = await fetchAI(prompt, true);
                if (response) {
                    const existing = results[child.id] || {};
                    processedResults[child.id] = { ...existing, ...response, D: existing.D || '', B_plan: existing.B_plan || '' };
                }
            }
            await saveResults(processedResults, summaryC);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    // タグ抽出
    const getStudyText = (childId) => {
        const msgs = dailyMessages[childId] || [];
        return msgs.filter(m => m.text.includes('【ツリー式学習】') || m.text.includes('【学習】') || m.text.includes('【宿題】') || m.text.includes('【プリント】'))
            .map(m => m.text.replace(/【.*?】/g, '').trim()).filter(t => t).join(' / ');
    };
    const getProgramText = (childId) => {
        const msgs = dailyMessages[childId] || [];
        return msgs.filter(m => m.text.includes('【プログラム】'))
            .map(m => m.text.replace(/【.*?】/g, '').trim()).filter(t => t).join(' / ');
    };

    return (
        <div className="min-h-screen p-3 md:p-8 pb-32 space-y-6 md:space-y-8 max-w-[1800px] mx-auto overflow-x-hidden">
            {/* Responsive Header */}
            <header className="sticky top-0 z-[60] py-3 px-4 md:py-4 md:px-6 glass-card rounded-[1.5rem] md:rounded-[2rem] flex items-center justify-between mb-4 md:mb-8 animate-in fade-in slide-in-from-top-4 duration-700">
                <div className="flex items-center gap-3 md:gap-4 truncate">
                    <div className="p-2 md:p-3 bg-tree-500 rounded-xl md:rounded-2xl shadow-xl shadow-tree-100 flex-shrink-0">
                        <FileText className="w-5 h-5 md:w-6 md:h-6 text-white" />
                    </div>
                    <div className="truncate">
                        <h1 className="text-lg md:text-2xl font-black text-slate-800 tracking-tight truncate leading-tight">Tree Kids School</h1>
                        <p className="hidden xs:block text-[9px] md:text-[10px] text-tree-600 font-bold uppercase tracking-[0.2em] opacity-80">支援管理システム</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 md:gap-4">
                    <div className="hidden sm:flex flex-col items-end">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">稼働中</span>
                        <div className="flex items-center gap-1.5 mt-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-tree-500 animate-pulse" />
                            <span className="text-[10px] font-bold text-slate-600">同期済み</span>
                        </div>
                    </div>
                    <button onClick={() => setShowSettingsModal(true)} className="p-2.5 md:p-3 bg-white hover:bg-tree-50 rounded-xl md:rounded-2xl shadow-sm border border-slate-100 transition-all active:scale-95 group flex-shrink-0">
                        <Settings className="w-5 h-5 text-slate-400 group-hover:rotate-90 transition-transform duration-500" />
                    </button>
                </div>
            </header>

            {/* Bento Controls - Responsive Stack */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 animate-in fade-in duration-700">
                {/* Date Selection Card */}
                <div className="lg:col-span-4 glass-card p-4 md:p-6 rounded-[2.5rem] md:rounded-[3rem] flex items-center gap-4 md:gap-6 shadow-premium">
                    <div onClick={() => setShowCalendarModal(true)} className="flex-1 bg-white border-2 border-slate-50 hover:border-tree-200 p-4 md:p-5 rounded-[2rem] md:rounded-[2.5rem] flex items-center gap-4 md:gap-5 cursor-pointer transition-all shadow-inner">
                        <div className="p-3 md:p-4 bg-tree-50 rounded-xl md:rounded-2xl text-tree-500">
                            <CalendarIcon className="w-5 h-5 md:w-6 md:h-6" />
                        </div>
                        <div>
                            <p className="text-[9px] md:text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">対象日</p>
                            <span className="font-black text-slate-800 text-lg md:text-xl tracking-tight">{selectedDate}</span>
                        </div>
                    </div>
                    <button onClick={addChild} className="h-16 md:h-[72px] px-6 md:px-8 bg-tree-500 hover:bg-tree-600 text-white rounded-[1.5rem] md:rounded-[2rem] flex flex-col items-center justify-center gap-1 font-black shadow-xl shadow-tree-100 transition-all active:scale-95 group/btn">
                        <PlusCircle className="w-6 h-6 md:w-7 md:h-7 group-hover/btn:rotate-90 transition-transform" />
                    </button>
                </div>

                {/* Batch Actions Card */}
                <div className="lg:col-span-8 glass-card p-4 md:p-6 rounded-[2.5rem] md:rounded-[3rem] flex flex-col sm:flex-row items-center justify-between gap-4 shadow-premium">
                    <div className="flex items-center gap-4 md:gap-8 sm:pl-4 w-full sm:w-auto overflow-hidden">
                        <div className="flex -space-x-3 overflow-hidden flex-shrink-0">
                            {children.slice(0, 4).map((c, i) => (
                                <div key={i} className="inline-block h-10 w-10 md:h-12 md:w-12 rounded-full ring-4 ring-white bg-tree-50 flex items-center justify-center text-[10px] md:text-[12px] font-black text-tree-600 shadow-md">{c.name[0]}</div>
                            ))}
                        </div>
                        <div className="truncate">
                            <p className="text-[9px] md:text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">登録されている児童</p>
                            <span className="text-lg md:text-xl font-black text-slate-700 tracking-tight">{children.length} 名の記録</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 md:gap-4 w-full sm:w-auto">
                        <button onClick={() => setShowExportModal(true)} className="flex-1 sm:flex-none p-4 md:p-5 bg-white hover:bg-slate-50 rounded-2xl md:rounded-[2rem] border border-slate-100 shadow-sm transition-all active:scale-95 text-slate-400">
                            <FileSpreadsheet className="w-6 h-6 md:w-7 md:h-7" />
                        </button>
                        <button onClick={generateDocuments} disabled={loading} className="flex-[3] sm:flex-none px-6 md:px-12 h-16 md:h-[72px] bg-apple-500 hover:bg-apple-600 text-white rounded-[1.8rem] md:rounded-[2rem] font-black shadow-2xl shadow-apple-100 flex items-center justify-center gap-3 md:gap-4 transition-all active:scale-95 disabled:grayscale">
                            {loading ? <Loader2 className="w-6 h-6 md:w-7 md:h-7 animate-spin" /> : <Sparkles className="w-6 h-6 md:w-7 md:h-7" />}
                            <span className="text-xs md:text-sm tracking-tight uppercase">AI生成</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Information Bento */}
            <div className="flex flex-col lg:flex-row gap-10 animate-in fade-in duration-1000">
                <div className="flex-1 min-w-0">
                    <div className="bg-white/90 backdrop-blur-3xl rounded-[2.5rem] md:rounded-[3.5rem] shadow-premium border border-white/60 overflow-hidden hover:shadow-2xl transition-all duration-700">
                        <div className="overflow-x-auto custom-scrollbar-hidden md:custom-scrollbar">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/50 border-b border-slate-100">
                                        <th className="p-3 md:p-6 text-center w-12 md:w-16 flex-shrink-0">
                                            <input type="checkbox" checked={selectedGenerateIds.length === children.length && children.length > 0} onChange={e => setSelectedGenerateIds(e.target.checked ? children.map(c=>c.id) : [])} className="w-5 h-5 md:w-6 md:h-6 rounded-lg accent-tree-600" />
                                        </th>
                                        <th className="sticky left-0 z-30 bg-slate-50 border-r border-slate-100 w-32 md:w-44 min-w-[120px] md:min-w-[180px] p-4 md:p-6 text-[10px] md:text-[12px] font-black text-slate-400 uppercase tracking-[0.2em] text-left">児童氏名</th>
                                        <th className="border-r border-slate-100 w-16 md:w-24 p-3 md:p-6 text-[10px] md:text-[12px] font-black text-slate-400 text-center relative bg-slate-50/20">
                                            <span>支援</span>
                                            <button 
                                                onClick={() => setIsTransportExpanded(!isTransportExpanded)}
                                                className={`absolute top-2 -right-3 md:top-4 md:-right-5 z-40 p-2 md:px-4 md:py-2.5 rounded-xl md:rounded-2xl flex items-center gap-2 transition-all shadow-premium active:scale-90 ${isTransportExpanded ? 'bg-wood-500 text-white ring-4 md:ring-8 ring-wood-50' : 'bg-white text-wood-500 hover:bg-wood-50 border border-wood-100'}`}
                                            >
                                                {isTransportExpanded ? <><ChevronLeft className="hidden md:inline w-4 h-4" /> <span className="text-[8px] md:text-[10px] font-extrabold uppercase">OFF</span></> : <Clock className="w-4 h-4 md:w-5 md:h-5" />}
                                            </button>
                                        </th>
                                        <th className={`animate-col text-[10px] md:text-[11px] font-black text-wood-600 border-r border-t-4 border-wood-200 ${!isTransportExpanded ? 'col-collapsed' : 'p-2 w-24 md:w-36 bg-wood-50/30'}`}>迎え場所</th>
                                        <th className={`animate-col p-2 md:p-4 text-[10px] md:text-[11px] font-black text-wood-600 border-r border-t-4 border-wood-200 ${!isTransportExpanded ? 'col-collapsed' : 'w-16 md:w-24 text-center bg-wood-50/30'}`}>終了</th>
                                        <th className={`animate-col p-2 md:p-4 text-[10px] md:text-[11px] font-black text-wood-600 border-t-4 border-wood-200 ${!isTransportExpanded ? 'col-collapsed' : 'w-16 md:w-24 text-center bg-wood-50/30 border-r-2 font-bold'}`}>送迎</th>
                                        
                                        <th className="p-3 md:p-4 text-[10px] md:text-[12px] font-black text-slate-400 w-[140px] md:w-[220px] border-r border-slate-100 bg-slate-50/10 text-center">学習</th>
                                        <th className={`p-4 md:p-6 text-[10px] md:text-[12px] font-black text-slate-400 w-[140px] md:w-[220px] border-r border-slate-100 relative bg-slate-50/10 text-center`}>
                                            <span>プログラム</span>
                                            <button 
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
                                    {displayRegular.map((child) => {
                                        const row = dailyTable[child.id] || {};
                                        const isPlaceholder = !!child.isPlaceholder;
                                        return (
                                            <tr key={child.id} className={`border-b border-slate-100 group transition-all ${selectedChildId === child.id ? 'bg-tree-50/30' : 'hover:bg-slate-50/20'}`}>
                                                <td className="p-3 md:p-5 text-center">
                                                    {!isPlaceholder && <input type="checkbox" checked={selectedGenerateIds.includes(child.id)} onChange={() => toggleChildGenerate(child.id)} className="w-5 h-5 rounded-lg accent-tree-600" />}
                                                </td>
                                                <td className={`sticky left-0 z-10 p-4 md:p-6 font-black text-[12px] md:text-sm border-r border-slate-100 ${selectedChildId === child.id ? 'bg-tree-100/40' : 'bg-white group-hover:bg-slate-50'}`}>
                                                    <button onClick={() => !isPlaceholder && setSelectedChildId(child.id)} className="w-full text-left truncate hover:text-tree-600 transition-colors text-ellipsis overflow-hidden">{child.name}</button>
                                                    {!isPlaceholder && results[child.id] && <div className="text-[8px] bg-apple-500 text-white px-2 py-0.5 mt-1 rounded-full w-fit font-black shadow-sm tracking-tighter uppercase">AI同期済み</div>}
                                                </td>
                                                <td className="p-0 border-r border-slate-100 text-center">
                                                    {!isPlaceholder && (
                                                        <button onClick={() => { setSelectedTreeChildId(child.id); setSelectedChildId(null); setSelectedDocChildId(null); }} className={`w-full h-full p-4 md:p-5 flex items-center justify-center transition-all ${results[child.id]?.D ? 'text-tree-600 bg-tree-50/50' : 'text-slate-200 hover:text-tree-500'}`}>
                                                            <FileEdit className="w-5 h-5 md:w-6 md:h-6 font-bold" />
                                                        </button>
                                                    )}
                                                </td>
                                                <td className={`animate-col p-0 border-r border-slate-100 transition-all ${!isTransportExpanded ? 'col-collapsed' : 'bg-wood-50/10'}`}>
                                                    {!isPlaceholder && <input value={row.pickupLocation || ''} onChange={e => updateDailyTable(child.id, { pickupLocation: e.target.value })} className="w-full h-full p-4 md:p-6 text-[10px] md:text-[12px] border-none bg-transparent outline-none font-black text-wood-700" placeholder="---" />}
                                                </td>
                                                <td className={`animate-col p-0 border-r border-slate-100 transition-all ${!isTransportExpanded ? 'col-collapsed' : 'bg-wood-50/10'}`}>
                                                    {!isPlaceholder && <input type="time" value={row.endTime || ''} onChange={e => updateDailyTable(child.id, { endTime: e.target.value })} className="w-full h-full p-4 md:p-6 text-[10px] border-none bg-transparent outline-none text-center font-bold text-slate-500" />}
                                                </td>
                                                <td className={`animate-col p-0 border-r border-slate-100 transition-all ${!isTransportExpanded ? 'col-collapsed' : 'bg-wood-50/20'}`}>
                                                    {!isPlaceholder && <input type="time" value={row.transportTime || ''} onChange={e => updateDailyTable(child.id, { transportTime: e.target.value })} className="w-full h-full p-4 md:p-6 text-[10px] border-none bg-transparent outline-none text-center font-black text-tree-600" />}
                                                </td>
                                                <td className="p-3 md:p-5 text-[10px] md:text-[12px] text-slate-600 border-r border-slate-100 leading-relaxed font-bold align-top">
                                                    {!isPlaceholder && (
                                                        getStudyText(child.id) ? (
                                                            <div className="text-tree-600 tracking-tight gap-1.5"><div className="inline-block w-1.5 h-3 bg-tree-500 rounded-full mr-1 translate-y-[2px]" /> {getStudyText(child.id)}</div>
                                                        ) : <div className="opacity-20 italic text-center text-[10px]">---</div>
                                                    )}
                                                </td>
                                                <td className="p-3 md:p-5 text-[10px] md:text-[12px] text-slate-600 border-r border-slate-100 leading-relaxed font-bold align-top">
                                                    {!isPlaceholder && (
                                                        getProgramText(child.id) ? (
                                                            <div className="text-wood-600 tracking-tight gap-1.5"><div className="inline-block w-1.5 h-3 bg-wood-400 rounded-full mr-1 translate-y-[2px]" /> {getProgramText(child.id)}</div>
                                                        ) : <div className="opacity-20 italic text-center text-[10px]">---</div>
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
                    </div>
                </div>

                {/* Floating Action Panels */}
                {(selectedChildId || selectedTreeChildId || selectedDocChildId) && (
                    <div className="fixed inset-y-0 right-0 z-[100] w-full md:w-[540px] p-4 flex">
                        <div className="glass-card w-full h-full rounded-[4rem] shadow-2xl overflow-hidden flex flex-col border-white animate-in slide-in-from-right duration-500 shadow-tree-100">
                            {selectedChildId && (
                                <MemoPanel
                                    child={children.find(c => c.id === selectedChildId)}
                                    messages={dailyMessages[selectedChildId] || []}
                                    tags={tags}
                                    onSave={sendMessage}
                                    onClose={() => setSelectedChildId(null)}
                                />
                            )}
                            {selectedTreeChildId && (
                                <TreeCommPanel
                                    child={children.find(c => c.id === selectedTreeChildId)}
                                    result={results[selectedTreeChildId] || {}}
                                    messages={dailyMessages[selectedTreeChildId] || []}
                                    onSave={(id, res) => saveResults({ ...results, [id]: res }, summaryC)}
                                    onClose={() => setSelectedTreeChildId(null)}
                                />
                            )}
                            {selectedDocChildId && (
                                <DocViewer
                                    child={children.find(c => c.id === selectedDocChildId)}
                                    result={results[selectedDocChildId]}
                                    selectedDate={selectedDate}
                                    onSaveResult={(id, res) => saveResults({ ...results, [id]: res }, summaryC)}
                                    onClose={() => setSelectedDocChildId(null)}
                                />
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Floating Bar - Ultra Responsive */}
            <div className="fixed bottom-4 md:bottom-10 left-1/2 -translate-x-1/2 z-[80] glass-card px-4 md:px-10 py-3 md:py-6 rounded-full flex items-center gap-4 md:gap-8 transition-all hover:scale-105 active:scale-95 shadow-2xl no-print border-white/60 w-[95%] max-w-[600px] justify-center">
                <button onClick={() => printAllDocuments(children, results, summaryC, selectedDate)} className="flex-1 md:flex-none flex items-center justify-center gap-2 md:gap-3 px-6 md:px-10 py-4 md:py-5 bg-tree-600 text-white rounded-full font-black text-[10px] md:text-xs shadow-2xl shadow-tree-100 transition-all hover:bg-tree-700 uppercase tracking-widest truncate">
                    <Printer className="w-4 h-4 md:w-5 md:h-5" /> <span>一括印刷</span>
                </button>
                <div className="hidden xs:block w-px h-8 md:h-10 bg-slate-200/50" />
                <button onClick={() => setSelectedDocChildId(children[0]?.id)} className="flex-1 md:flex-none flex items-center justify-center gap-2 md:gap-3 px-6 md:px-10 py-4 md:py-5 bg-white hover:bg-slate-50 text-slate-600 border border-slate-100 rounded-full font-black text-[10px] md:text-xs transition-all shadow-premium uppercase tracking-widest truncate">
                    <LayoutPanelLeft className="w-4 h-4 md:w-5 md:h-5" /> <span>内容確認</span>
                </button>
            </div>

            {/* Modals */}
            <CalendarModal show={showCalendarModal} onClose={() => setShowCalendarModal(false)} setSelectedDate={setSelectedDate} selectedDate={selectedDate} existingReportDates={existingReportDates} />
            {showSettingsModal && (
                <SettingsModal 
                    onClose={() => setShowSettingsModal(false)} 
                    config={config}
                    onSaveConfig={handleUpdateConfig}
                    tags={tags} 
                    onSaveTags={handleUpdateTags} 
                />
            )}
            <ExportModal show={showExportModal} onClose={() => setShowExportModal(false)} selectedDate={selectedDate} children={children} results={results} summaryC={summaryC} />
        </div>
    );
}

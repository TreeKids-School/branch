import { useState, useEffect, useCallback } from 'react';
import { Save, X, FileText, Trash2, Calendar, User, History, Plus, Edit2, AlertCircle, MessageSquare, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { callStorage } from '../hooks/useStorage';

export default function TreeCommPanel({ child, messages = [], tags = [], result, selectedDate: propSelectedDate, staffList = [], onSave, onClose }) {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [staffName, setStaffName] = useState(localStorage.getItem('last_staff_name') || '');
    const [content, setContent] = useState('');
    const [selectedDate, setSelectedDate] = useState(propSelectedDate);
    const [view, setView] = useState('editor'); // 'editor' or 'history'
    const [isMemoExpanded, setIsMemoExpanded] = useState(true);

    const fetchHistory = useCallback(async () => {
        if (!child?.id) return;
        setLoading(true);
        const data = await callStorage({ action: 'getDailyReports', childId: child.id });
        setHistory(data || []);
        setLoading(false);
    }, [child?.id]);

    useEffect(() => {
        fetchHistory();
        setSelectedDate(propSelectedDate);
        if (result?.D) {
            setContent(result.D);
        }
    }, [child, fetchHistory, result, propSelectedDate]);

    const handleSave = async () => {
        if (!content.trim()) return;
        setLoading(true);
        
        const payload = {
            action: 'saveDailyReport',
            data: {
                id: editingId,
                childId: child.id,
                date: selectedDate,
                externalInfo: content,
                staffName: staffName
            }
        };

        await callStorage(payload);
        localStorage.setItem('last_staff_name', staffName);
        onSave(child.id, { ...result, D: content });
        
        setContent('');
        setEditingId(null);
        fetchHistory();
        setView('history');
        setLoading(false);
    };

    const handleEdit = (report) => {
        setEditingId(report.id);
        setContent(report.externalInfo);
        setStaffName(report.staffName);
        setSelectedDate(report.date);
        setView('editor');
    };

    const handleDelete = async (id) => {
        if (!confirm('この記録を削除しますか？')) return;
        setLoading(true);
        await callStorage({ action: 'deleteDailyReport', id });
        fetchHistory();
        setLoading(false);
    };

    const [touchStart, setTouchStart] = useState(null);
    const [touchEnd, setTouchEnd] = useState(null);

    const handleTouchStart = (e) => {
        setTouchEnd(null);
        setTouchStart(e.targetTouches[0].clientX);
    };

    const handleTouchMove = (e) => {
        setTouchEnd(e.targetTouches[0].clientX);
    };

    const handleTouchEnd = () => {
        if (!touchStart || !touchEnd) return;
        const distance = touchEnd - touchStart;
        const isLeftToRight = distance > 100;
        if (isLeftToRight) {
            onClose();
        }
    };

    if (!child) return null;

    return (
        <div 
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="h-full flex flex-col bg-slate-50 shadow-2xl border-l border-slate-200 overflow-hidden"
        >
            {/* Header - Apple Red (Unified) */}
            <header className="flex items-center justify-between p-5 md:p-7 text-white shadow-xl flex-shrink-0 z-30" style={{ backgroundColor: '#DC3545' }}>
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-md ring-2 ring-white/20">
                        <FileText className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-black text-lg md:text-xl leading-none">{child.name}</h3>
                        <p className="text-[9px] font-bold opacity-80 mt-1.5 tracking-widest uppercase">ツリー通信作成</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setView(view === 'editor' ? 'history' : 'editor')}
                        className="p-2.5 hover:bg-white/10 rounded-xl transition-all active:scale-95"
                    >
                        {view === 'editor' ? <History className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                    </button>
                    <button onClick={onClose} className="p-2.5 hover:bg-white/10 rounded-xl transition-all active:scale-95">
                        <X className="w-6 h-6" />
                    </button>
                </div>
            </header>

            {/* View Toggle Tabs */}
            <div className="flex border-b border-slate-200 bg-white flex-shrink-0 z-20">
                <button 
                    onClick={() => setView('editor')}
                    className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all ${view === 'editor' ? 'text-apple-600 border-b-4 border-apple-600 bg-apple-50/30' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    {editingId ? '編集' : '作成'}
                </button>
                <button 
                    onClick={() => setView('history')}
                    className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all ${view === 'history' ? 'text-apple-600 border-b-4 border-apple-600 bg-apple-50/30' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    作成履歴 ({history.length})
                </button>
            </div>

            {/* Combined Scroll Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
                
                {/* 1. Chat Memo Reference Section (Collapsible) */}
                {view === 'editor' && (
                    <div className="border-b border-slate-200 bg-white">
                        <button 
                            onClick={() => setIsMemoExpanded(!isMemoExpanded)}
                            className="w-full px-6 py-4 flex items-center justify-between text-slate-500 hover:bg-slate-50 transition-all font-black text-[11px] uppercase tracking-widest"
                        >
                            <div className="flex items-center gap-3">
                                <MessageSquare className="w-4 h-4 text-tree-600" />
                                <span>チャットメモの内容を参照</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] bg-tree-50 text-tree-600 px-2 py-0.5 rounded-full">{messages.length} 件</span>
                                {isMemoExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </div>
                        </button>
                        
                        <div className={`overflow-hidden transition-all duration-300 ${isMemoExpanded ? 'max-h-[400px] border-t border-slate-100 bg-slate-50/50' : 'max-h-0'}`}>
                            <div className="p-4 space-y-3 overflow-y-auto max-h-[350px] custom-scrollbar">
                                {messages.length === 0 ? (
                                    <p className="text-center py-8 text-[10px] font-bold text-slate-300 uppercase tracking-widest">メッセージなし</p>
                                ) : (
                                    messages.map((m, i) => (
                                        <div key={m.id || i} className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
                                            <div className="flex items-center gap-2 mb-1.5 opacity-40">
                                                <Clock className="w-3 h-3" />
                                                <span className="text-[9px] font-black">{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                            <p className="text-xs font-bold text-slate-700 leading-relaxed">{m.text}</p>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. Main content area for Editor/History */}
                <div className="p-6 md:p-8 flex-1">
                    {view === 'editor' ? (
                            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <User className="w-3 h-3" /> 担当者
                                    </label>
                                    <select 
                                        value={staffName}
                                        onChange={(e) => setStaffName(e.target.value)}
                                        className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 outline-none focus:border-apple-400 appearance-none"
                                    >
                                        <option value="">選択してください</option>
                                        {staffList.map((s, idx) => (
                                            <option key={idx} value={s}>{s}</option>
                                        ))}
                                    </select>
                                </div>

                            <div className="space-y-3">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <Edit2 className="w-3 h-3" /> ツリー通信 内容入力
                                </label>
                                <textarea
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                    placeholder="本日の記録を入力..."
                                    className="w-full min-h-[300px] p-6 text-[14px] bg-white border-2 border-slate-100 rounded-[2rem] focus:border-apple-400 focus:ring-8 focus:ring-apple-50 outline-none transition-all leading-relaxed resize-none font-medium text-slate-700 shadow-inner"
                                />
                            </div>

                            <button
                                onClick={handleSave}
                                disabled={loading || !content.trim()}
                                className="w-full py-5 bg-apple-600 hover:bg-apple-700 disabled:opacity-50 text-white rounded-2xl font-black text-sm shadow-xl flex items-center justify-center gap-3 transition-all active:scale-95 tracking-widest uppercase"
                            >
                                <Save className="w-5 h-5" />
                                {editingId ? '更新して保存' : '記録を保存'}
                            </button>
                        </div>
                    ) : (
                        /* History view remains similar but with red theme */
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {loading && (
                                <div className="flex justify-center py-12">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-apple-600"></div>
                                </div>
                            )}
                            {!loading && history.length === 0 && (
                                <div className="text-center py-20 px-8 opacity-40">
                                    <AlertCircle className="w-12 h-12 mx-auto mb-4" />
                                    <p className="text-sm font-bold">履歴がありません</p>
                                </div>
                            )}
                            {history.map((report) => (
                                <div 
                                    key={report.id}
                                    className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-all group relative"
                                >
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="px-3 py-1 bg-apple-50 text-apple-600 rounded-full text-[10px] font-black tracking-widest">
                                                {report.date}
                                            </div>
                                            <div className="flex items-center gap-1.5 text-slate-400">
                                                <User className="w-3 h-3" />
                                                <span className="text-[10px] font-bold">{report.staffName || '---'}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleEdit(report)} className="p-2 hover:bg-slate-50 text-slate-400 hover:text-apple-600 rounded-lg transition-colors"><Edit2 className="w-4 h-4" /></button>
                                            <button onClick={() => handleDelete(report.id)} className="p-2 hover:bg-slate-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                    <p className="text-[14px] text-slate-600 leading-relaxed font-medium whitespace-pre-wrap">{report.externalInfo}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

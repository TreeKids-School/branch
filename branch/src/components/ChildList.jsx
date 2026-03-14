import { useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp, MessageSquare, FileText, CheckSquare, Square } from 'lucide-react';

const STAFF_OPTIONS = ['ブラック', 'スタッフA', 'スタッフB', 'スタッフC'];

export default function ChildList({
    children, selectedChildId, selectedGenerateIds,
    onSelectChild, onAddChild, onRemoveChild, onUpdateChild,
    onToggleGenerate, results, dailyMessages
}) {
    const [expandedId, setExpandedId] = useState(null);

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <h2 className="font-bold text-slate-700 text-sm">児童一覧</h2>
                <button
                    onClick={onAddChild}
                    className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors"
                >
                    <Plus className="w-3.5 h-3.5" />
                    追加
                </button>
            </div>

            <div className="divide-y divide-slate-50 max-h-[60vh] overflow-y-auto custom-scrollbar">
                {children.length === 0 && (
                    <div className="p-6 text-center text-slate-400 text-sm">
                        児童を追加してください
                    </div>
                )}
                {children.map(child => {
                    const msgCount = (dailyMessages[child.id] || []).length;
                    const hasResult = !!results[child.id];
                    const isSelected = selectedChildId === child.id;
                    const isExpanded = expandedId === child.id;
                    const isChecked = selectedGenerateIds.includes(child.id);

                    return (
                        <div key={child.id} className={`transition-colors ${isSelected ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}>
                            <div className="flex items-center gap-2 px-3 py-2.5">
                                {/* Generate checkbox */}
                                <button onClick={() => onToggleGenerate(child.id)} className="flex-shrink-0">
                                    {isChecked
                                        ? <CheckSquare className="w-4 h-4 text-indigo-600" />
                                        : <Square className="w-4 h-4 text-slate-300" />
                                    }
                                </button>

                                {/* Child name - click to select */}
                                <button
                                    onClick={() => onSelectChild(child.id)}
                                    className="flex-1 text-left"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-slate-800 text-sm">{child.name}</span>
                                        {hasResult && <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" title="書類生成済み" />}
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-[10px] text-slate-400">{child.staff || '未設定'}</span>
                                        {msgCount > 0 && (
                                            <span className="flex items-center gap-0.5 text-[10px] text-slate-400">
                                                <MessageSquare className="w-2.5 h-2.5" />
                                                {msgCount}
                                            </span>
                                        )}
                                        {child.forceSheet && (
                                            <span className="text-[10px] bg-amber-100 text-amber-700 px-1 rounded">強行</span>
                                        )}
                                    </div>
                                </button>

                                {/* Expand/collapse */}
                                <button
                                    onClick={() => setExpandedId(isExpanded ? null : child.id)}
                                    className="p-1 text-slate-400 hover:text-slate-600"
                                >
                                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </button>
                            </div>

                            {/* Expanded settings */}
                            {isExpanded && (
                                <div className="px-3 pb-3 space-y-2 bg-slate-50">
                                    <div className="flex items-center gap-2">
                                        <label className="text-xs text-slate-500 w-16">名前</label>
                                        <input
                                            type="text"
                                            value={child.name}
                                            onChange={e => onUpdateChild(child.id, { name: e.target.value })}
                                            className="flex-1 text-sm border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <label className="text-xs text-slate-500 w-16">担当</label>
                                        <select
                                            value={child.staff || ''}
                                            onChange={e => onUpdateChild(child.id, { staff: e.target.value })}
                                            className="flex-1 text-sm border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                        >
                                            <option value="">未設定</option>
                                            {STAFF_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <label className="text-xs text-slate-500 w-16">強行シート</label>
                                        <input
                                            type="checkbox"
                                            checked={!!child.forceSheet}
                                            onChange={e => onUpdateChild(child.id, { forceSheet: e.target.checked })}
                                            className="w-4 h-4 accent-indigo-600"
                                        />
                                    </div>
                                    <button
                                        onClick={() => onRemoveChild(child.id)}
                                        className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 mt-1"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                        削除
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

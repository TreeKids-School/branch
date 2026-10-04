import React from 'react';
import { X, ClipboardList, CheckSquare, Square } from 'lucide-react';

export const GROUP1_ITEMS = [
    { id: 'g1_1', label: '① 今月のプログラム計画' },
    { id: 'g1_2', label: '② 来月以降のプログラム計画' },
    { id: 'g1_3', label: '③ 次回個別支援の計画' },
    { id: 'g1_4', label: '④ 個別支援記録' },
    { id: 'g1_5', label: '⑤ 環境整備業務（清掃等）' },
    { id: 'g1_6', label: '⑥ プログラム準備' },
    { id: 'g1_7', label: '⑦ 業務管理日誌記録' },
    { id: 'g1_8', label: '⑧ その他（雑務）' },
];

export const GROUP2_ITEMS = [
    { id: 'g2_1', label: '❶ 支援プログラムの充実化' },
    { id: 'g2_2', label: '❷ 支援ツールの充実化' },
    { id: 'g2_3', label: '❸ 業務知識の習得' },
    { id: 'g2_4', label: '❹ 業務改善' },
    { id: 'g2_5', label: '❺ 認知度の向上' },
    { id: 'g2_6', label: '❻ 吉根小学校の児童獲得' },
    { id: 'g2_7', label: '❼ 保護者の満足度の向上' },
    { id: 'g2_8', label: '❽ 業務マニュアルなどの作成' },
    { id: 'g2_9', label: '❾ 意識向上、理念理解など' },
    { id: 'g2_10', label: '❿ その他' },
];

export default function ActivitiesModal({ show, onClose, activities, onSave }) {
    if (!show) return null;

    let parsed = { group1: [], group2: [] };
    if (activities) {
        if (typeof activities === 'object') {
            parsed = activities;
        } else {
            try {
                parsed = JSON.parse(activities);
            } catch (e) {
                // ignore
            }
        }
    }

    const group1 = parsed.group1 || [];
    const group2 = parsed.group2 || [];

    const handleToggle = (groupKey, itemId) => {
        const list = groupKey === 'group1' ? [...group1] : [...group2];
        const index = list.indexOf(itemId);
        if (index > -1) {
            list.splice(index, 1);
        } else {
            list.push(itemId);
        }
        
        onSave(JSON.stringify({
            group1: groupKey === 'group1' ? list : group1,
            group2: groupKey === 'group2' ? list : group2
        }));
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={onClose} />
            <div className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col border border-white animate-in zoom-in-95 duration-500 max-h-[90vh]">
                
                {/* Header */}
                <div className="p-6 bg-tree-600 flex items-center justify-between shadow-lg flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                            <ClipboardList className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="font-black text-xl text-white tracking-tight">業務・活動内容の登録</h3>
                            <p className="text-[9px] font-bold text-tree-100 uppercase tracking-widest opacity-80">Select performed activities for today</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-all text-white/80 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto custom-scrollbar bg-slate-50/50 flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Group 1 */}
                    <div className="space-y-3 bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm">
                        <h4 className="font-black text-sm text-slate-800 border-b pb-2 mb-3 flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-tree-500" />
                            <span>業務活動内容 (①〜⑧)</span>
                        </h4>
                        <div className="space-y-2">
                            {GROUP1_ITEMS.map(item => {
                                const isChecked = group1.includes(item.id);
                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => handleToggle('group1', item.id)}
                                        className={`w-full p-3 rounded-xl flex items-center gap-3 border text-left transition-all active:scale-98 ${
                                            isChecked 
                                                ? 'bg-tree-50/50 border-tree-200 text-tree-700 font-bold' 
                                                : 'bg-slate-50/30 border-slate-100 text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        {isChecked ? (
                                            <CheckSquare className="w-4 h-4 text-tree-600 flex-shrink-0" />
                                        ) : (
                                            <Square className="w-4 h-4 text-slate-300 flex-shrink-0" />
                                        )}
                                        <span className="text-xs">{item.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Group 2 */}
                    <div className="space-y-3 bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm">
                        <h4 className="font-black text-sm text-slate-800 border-b pb-2 mb-3 flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-wood-500" />
                            <span>重点課題・目標 (❶〜❿)</span>
                        </h4>
                        <div className="space-y-2">
                            {GROUP2_ITEMS.map(item => {
                                const isChecked = group2.includes(item.id);
                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => handleToggle('group2', item.id)}
                                        className={`w-full p-3 rounded-xl flex items-center gap-3 border text-left transition-all active:scale-98 ${
                                            isChecked 
                                                ? 'bg-wood-50/40 border-wood-200 text-wood-700 font-bold' 
                                                : 'bg-slate-50/30 border-slate-100 text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        {isChecked ? (
                                            <CheckSquare className="w-4 h-4 text-wood-600 flex-shrink-0" />
                                        ) : (
                                            <Square className="w-4 h-4 text-slate-300 flex-shrink-0" />
                                        )}
                                        <span className="text-xs">{item.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 bg-white border-t border-slate-100 flex justify-end">
                    <button 
                        onClick={onClose}
                        className="px-8 py-3 bg-tree-600 hover:bg-tree-700 text-white rounded-xl font-black text-xs shadow-md transition-all active:scale-95 uppercase tracking-widest"
                    >
                        決定
                    </button>
                </div>
            </div>
        </div>
    );
}

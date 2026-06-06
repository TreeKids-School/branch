import { LayoutPanelLeft, X, UserCheck } from 'lucide-react';
import { buildStaffTableHTML } from '../utils/print';
import { GROUP1_ITEMS, GROUP2_ITEMS } from '../utils/print';

/**
 * DashboardView
 * ─────────────────────────────────────────────────────────
 * PC幅で日誌の情報を一画面に並べて表示するダッシュボードビュー。
 * 印刷プレビューではなく、画面上でそのまま確認するためのレイアウト。
 *
 * Layout (3-column grid):
 *   左上   : 職員配置（スタッフ勤怠）
 *   右上   : 全体的な様子 ＋ 業務・活動内容
 *   下段全幅: 児童リスト
 */
export default function DashboardView({
    selectedDate,
    children = [],
    dailyTable = {},
    dailyMessages = {},
    globalLog = {},
    summaryC = '',
    attendance = {},
    staffList = [],
    getStudyText,
    getProgramText,
    onClose,
}) {
    const dateObj = new Date(selectedDate);
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    const dateStr = `${dateObj.getFullYear()}年${dateObj.getMonth() + 1}月${dateObj.getDate()}日（${dayNames[dateObj.getDay()]}）`;

    // --- 業務・活動内容 ---
    const activities = globalLog.activities || '';
    let parsed = { group1: [], group2: [] };
    if (activities) {
        if (typeof activities === 'object') {
            parsed = activities;
        } else {
            try { parsed = JSON.parse(activities); } catch { /* ignore */ }
        }
    }
    const group1 = parsed.group1 || [];
    const group2 = parsed.group2 || [];
    const selectedLabels = [];
    GROUP1_ITEMS.forEach(item => { if (group1.includes(item.id)) selectedLabels.push(item.label); });
    GROUP2_ITEMS.forEach(item => { if (group2.includes(item.id)) selectedLabels.push(item.label); });

    // --- スタッフを役職別に整理 ---
    const getRole = (staff) => {
        const post = staff.post || staff.role || '';
        const posts = Array.isArray(post) ? post : [post];
        if (posts.some(p => p === '管理者' || p === 'admin')) return '管理者';
        if (posts.some(p => p === '児発管' || p === 'supervisor')) return '児発管';
        if (posts.some(p => p === '指導員' || p === 'assistant')) return '指導員';
        return '児童指導員・保育士';
    };

    const roleOrder = ['管理者', '児発管', '児童指導員・保育士', '指導員'];
    const groupedStaff = {};
    roleOrder.forEach(r => { groupedStaff[r] = []; });
    staffList.forEach(staff => {
        const role = getRole(staff);
        const record = attendance[staff.id] || { type: 'work', startTime: '09:30', endTime: '18:30' };
        const typeLabel = record.type === 'public_holiday' ? '公休'
            : record.type === 'paid_leave' ? '有給'
            : `${record.startTime || '09:30'}〜${record.endTime || '18:30'}`;
        (groupedStaff[role] || groupedStaff['児童指導員・保育士']).push({
            name: staff.name,
            typeLabel,
            isOff: record.type !== 'work',
        });
    });

    // --- 児童リスト (placeholder除く) ---
    const displayRows = children.filter(c => !c.isPlaceholder);

    return (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex flex-col overflow-hidden no-print">
            {/* ── ヘッダーバー ── */}
            <div className="flex items-center justify-between px-6 py-3 bg-white/95 border-b border-slate-200 shadow-sm flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-tree-600 rounded-lg">
                        <LayoutPanelLeft className="w-4 h-4 text-white" />
                    </div>
                    <span className="font-black text-slate-800 text-sm">日誌ダッシュボード</span>
                    <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-full">{dateStr}</span>
                </div>
                <button
                    onClick={onClose}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs transition-all active:scale-95"
                >
                    <X className="w-3.5 h-3.5" />
                    入力画面に戻る
                </button>
            </div>

            {/* ── メインコンテンツ ── */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">

                {/* 上段: 2カラム（左=職員、右=様子＋業務） */}
                <div className="grid grid-cols-[auto_1fr_200px] gap-3 items-start">

                    {/* 左: 職員配置 */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden min-w-[260px]">
                        <div className="flex items-center gap-2 px-4 py-2.5 bg-tree-50 border-b border-tree-100">
                            <UserCheck className="w-3.5 h-3.5 text-tree-600" />
                            <span className="text-[11px] font-black text-tree-700 uppercase tracking-widest">職員配置</span>
                        </div>
                        <div className="p-3 space-y-2">
                            {roleOrder.map(role => {
                                const staffInRole = groupedStaff[role] || [];
                                if (staffInRole.length === 0) {
                                    staffInRole.push({ name: '—', typeLabel: '', isOff: false });
                                }
                                return (
                                    <div key={role} className="flex gap-0 text-[11px]">
                                        <div className="w-[90px] flex-shrink-0 bg-slate-50 border border-slate-200 rounded-l-lg px-2 py-1 font-black text-slate-500 text-[10px] flex items-center">
                                            {role}
                                        </div>
                                        <div className="flex-1 border border-l-0 border-slate-200 rounded-r-lg divide-y divide-slate-100">
                                            {staffInRole.map((s, i) => (
                                                <div key={i} className={`flex items-center justify-between px-2 py-1 ${s.isOff ? 'opacity-40' : ''}`}>
                                                    <span className="font-bold text-slate-700 truncate">{s.name}</span>
                                                    <span className={`text-[10px] font-bold ml-2 flex-shrink-0 ${s.isOff ? 'text-slate-400' : 'text-tree-600'}`}>
                                                        {s.typeLabel}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* 中: 全体的な様子 */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden h-full">
                        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                            <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">全体的な様子・特記事項</span>
                        </div>
                        <div className="p-4 text-[12px] text-slate-700 leading-relaxed font-medium whitespace-pre-wrap break-words min-h-[80px]">
                            {globalLog.notice || summaryC || (
                                <span className="text-slate-300 italic">（未入力）</span>
                            )}
                        </div>
                    </div>

                    {/* 右: 業務・活動内容 */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden h-full">
                        <div className="px-4 py-2.5 bg-wood-50 border-b border-wood-100">
                            <span className="text-[11px] font-black text-wood-600 uppercase tracking-widest">業務・活動内容</span>
                        </div>
                        <div className="p-3 text-[11px] text-slate-700 leading-relaxed space-y-1 min-h-[80px]">
                            {selectedLabels.length > 0 ? selectedLabels.map((label, i) => (
                                <div key={i} className="font-bold">{label}</div>
                            )) : (
                                <span className="text-slate-300 italic text-[11px]">（未登録）</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* 下段: 児童リスト */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                        <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">児童リスト（本日）</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-[11px]">
                            <thead>
                                <tr className="bg-slate-50/80 border-b border-slate-200">
                                    <th className="px-3 py-2 text-left font-black text-slate-400 w-8 text-center">No.</th>
                                    <th className="px-3 py-2 text-left font-black text-slate-400 min-w-[110px]">氏名</th>
                                    <th className="px-3 py-2 font-black text-slate-400 w-[70px] text-center">終了</th>
                                    <th className="px-3 py-2 font-black text-slate-400 w-[80px] text-center">送迎時間</th>
                                    <th className="px-3 py-2 font-black text-slate-400 w-[90px] text-center">迎え場所</th>
                                    <th className="px-3 py-2 text-left font-black text-slate-400 w-[220px]">学習</th>
                                    <th className="px-3 py-2 text-left font-black text-slate-400 w-[180px]">プログラム</th>
                                    <th className="px-3 py-2 text-left font-black text-slate-400">備考</th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="py-8 text-center text-slate-300 font-bold">本日の児童データがありません</td>
                                    </tr>
                                ) : displayRows.map((child, i) => {
                                    const row = dailyTable[child.id] || {};
                                    const studyText = getStudyText ? getStudyText(child.id) : '';
                                    const progText = getProgramText ? getProgramText(child.id) : '';
                                    return (
                                        <tr key={child.id} className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'} hover:bg-tree-50/20 transition-colors`}>
                                            <td className="px-3 py-2 text-center text-slate-400 font-bold">{i + 1}</td>
                                            <td className="px-3 py-2 font-black text-slate-800">
                                                {child.lastName ? `${child.lastName} ${child.firstName}` : (child.name || '—')}
                                            </td>
                                            <td className="px-3 py-2 text-center text-slate-600 font-bold">{row.endTime || ''}</td>
                                            <td className="px-3 py-2 text-center text-slate-600 font-bold">{row.transportTime || ''}</td>
                                            <td className="px-3 py-2 text-center text-slate-600 font-bold text-[10px]">{row.pickupLocation || ''}</td>
                                            <td className="px-3 py-2 text-slate-700 font-medium leading-snug whitespace-pre-wrap break-words max-w-[220px]">{studyText}</td>
                                            <td className="px-3 py-2 text-slate-700 font-medium leading-snug whitespace-pre-wrap break-words max-w-[180px]">{progText}</td>
                                            <td className="px-3 py-2 text-slate-600 font-medium text-[10px] leading-snug whitespace-pre-wrap break-words">{row.notes || ''}</td>
                                        </tr>
                                    );
                                })}
                                {/* 空行パディング（最低10行） */}
                                {Array.from({ length: Math.max(0, 10 - displayRows.length) }).map((_, i) => (
                                    <tr key={`empty-${i}`} className="border-b border-slate-50">
                                        <td className="px-3 py-1.5 text-center text-slate-200 text-[10px]">{displayRows.length + i + 1}</td>
                                        <td colSpan={7} className="px-3 py-1.5"></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

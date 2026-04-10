import { FileSpreadsheet, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import { parseForceSheet } from '../app_constants';

export default function ExportModal({ show, onClose, children, results, selectedDate, summaryC }) {
    if (!show) return null;

    const exportToExcel = () => {
        const childrenWithResults = children.filter(c => results[c.id]);
        if (childrenWithResults.length === 0) { alert('エクスポートするデータがありません。'); return; }
        const wb = XLSX.utils.book_new();
        const planData = [['専門的支援実施計画', '', '', ''], ['日付', selectedDate, '', ''], [], ['児童名', '実施した支援の内容・結果', '今後の支援の予定', '該当項目']];
        childrenWithResults.forEach(child => {
            const r = results[child.id] || {};
            planData.push([child.name, r.B_result || '', r.B_plan || '', r.B_item || '']);
        });
        const planSheet = XLSX.utils.aoa_to_sheet(planData);
        planSheet['!cols'] = [{ wch: 15 }, { wch: 40 }, { wch: 25 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(wb, planSheet, '専門的支援実施計画');
        const commData = [['ツリー通信', ''], ['日付', selectedDate], [], ['児童名', '内容']];
        childrenWithResults.forEach(child => { const r = results[child.id] || {}; commData.push([child.name, r.D || '']); });
        const commSheet = XLSX.utils.aoa_to_sheet(commData);
        commSheet['!cols'] = [{ wch: 15 }, { wch: 80 }];
        XLSX.utils.book_append_sheet(wb, commSheet, 'ツリー通信');
        const forceRows = childrenWithResults.filter(c => (results[c.id] || {}).K_sheet);
        if (forceRows.length > 0) {
            const forceData = [['強行シート', '', '', '', ''], ['日付', selectedDate], [], ['児童名', '学習', '自由遊び', 'プログラム', 'おやつ']];
            forceRows.forEach(child => {
                const force = parseForceSheet((results[child.id] || {}).K_sheet || '');
                forceData.push([child.name, force.learning || '該当なし', force.play || '該当なし', force.program || '該当なし', force.snack || '該当なし']);
            });
            const forceSheet = XLSX.utils.aoa_to_sheet(forceData);
            forceSheet['!cols'] = [{ wch: 15 }, { wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 30 }];
            XLSX.utils.book_append_sheet(wb, forceSheet, '強行シート');
        }
        if (summaryC) {
            const summaryData = [['全体の様子（反省）'], ['日付', selectedDate], [], ['内容'], [summaryC]];
            const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
            summarySheet['!cols'] = [{ wch: 100 }];
            XLSX.utils.book_append_sheet(wb, summarySheet, '全体の様子');
        }
        XLSX.writeFile(wb, `日報_${selectedDate}.xlsx`);
        onClose();
    };

    const exportToCSV = () => {
        const childrenWithResults = children.filter(c => results[c.id]);
        if (childrenWithResults.length === 0) { alert('エクスポートするデータがありません。'); return; }
        let csv = '\ufeff"児童名","日付","支援内容・結果","今後の予定","該当項目","ツリー通信","強行_学習","強行_自由遊び","強行_プログラム","強行_おやつ"\n';
        childrenWithResults.forEach(child => {
            const r = results[child.id] || {};
            const force = parseForceSheet(r.K_sheet || '');
            const row = [child.name, selectedDate, r.B_result || '', r.B_plan || '', r.B_item || '', r.D || '', force.learning || '', force.play || '', force.program || '', force.snack || '']
                .map(f => `"${(f || '').replace(/"/g, '""')}"`).join(',');
            csv += row + '\n';
        });
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.setAttribute('download', `書類一括出力_${selectedDate}.csv`);
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-slate-800 mb-4 text-center">出力形式を選択</h3>
                <div className="space-y-3">
                    <button onClick={exportToExcel} className="w-full py-4 bg-emerald-50 hover:bg-emerald-100 border-2 border-emerald-200 rounded-xl flex items-center justify-center gap-3 transition-colors group">
                        <FileSpreadsheet className="w-8 h-8 text-emerald-600 group-hover:scale-110 transition-transform" />
                        <div className="text-left"><p className="font-bold text-emerald-900">Excel形式 (.xlsx)</p><p className="text-xs text-emerald-600">レイアウトが整った標準形式</p></div>
                    </button>
                    <button onClick={exportToCSV} className="w-full py-4 bg-slate-50 hover:bg-slate-100 border-2 border-slate-200 rounded-xl flex items-center justify-center gap-3 transition-colors group">
                        <FileText className="w-8 h-8 text-slate-600 group-hover:scale-110 transition-transform" />
                        <div className="text-left"><p className="font-bold text-slate-900">CSV形式 (.csv)</p><p className="text-xs text-slate-500">データ加工に適したテキスト形式</p></div>
                    </button>
                </div>
                <button onClick={onClose} className="mt-6 w-full py-2 text-slate-400 hover:text-slate-600 text-sm font-bold">キャンセル</button>
            </div>
        </div>
    );
}

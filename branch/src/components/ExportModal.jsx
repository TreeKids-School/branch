import { useState } from 'react';
import { FileSpreadsheet, FileText, Printer, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { parseForceSheet } from '../app_constants';
import { callStorage } from '../hooks/useStorage';
import { printMonthlyDocuments } from '../utils/print';

export default function ExportModal({ show, onClose, children, results, selectedDate, summaryC, selectedOffice, staffList = [] }) {
    const [targetMonth, setTargetMonth] = useState(selectedDate ? selectedDate.substring(0, 7) : new Date().toISOString().substring(0, 7));
    const [isPrinting, setIsPrinting] = useState(false);

    if (!show) return null;

    const officeId = selectedOffice?.id;

    const handleMonthlyPDF = async () => {
        if (isPrinting) return;
        setIsPrinting(true);
        try {
            const datesIndex = await callStorage({ action: 'getReportIndex', officeId });
            if (!datesIndex || datesIndex.length === 0) {
                alert('登録されているデータがありません。');
                setIsPrinting(false);
                return;
            }
            
            const targetDates = datesIndex.filter(d => d.startsWith(targetMonth)).sort();
            if (targetDates.length === 0) {
                alert(`${targetMonth} のデータが見つかりませんでした。`);
                setIsPrinting(false);
                return;
            }

            const fetchPromises = targetDates.map(async (date) => {
                const [data, attendance] = await Promise.all([
                    callStorage({ action: 'getReport', date, officeId }),
                    callStorage({ action: 'getAttendance', date, officeId }),
                ]);
                return { date, data: data ? { ...data, attendance: attendance || {} } : null };
            });
            const results = await Promise.all(fetchPromises);
            
            const validResults = results.filter(r => r.data !== null);
            if (validResults.length === 0) {
                alert(`${targetMonth} の有効なデータが見つかりませんでした。`);
                setIsPrinting(false);
                return;
            }

            printMonthlyDocuments(targetMonth, validResults, staffList);
            onClose();
        } catch (error) {
            console.error('Monthly PDF Generation Error:', error);
            alert('月間PDFの生成中にエラーが発生しました: ' + error.message);
        } finally {
            setIsPrinting(false);
        }
    };

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
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-black text-slate-800 mb-6 text-center">書類一括出力 / 印刷</h3>
                
                <div className="space-y-5">
                    {/* 単一日のエクスポートセクション */}
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 pl-1">本日 ({selectedDate}) のデータ出力</p>
                        <div className="space-y-2">
                            <button onClick={exportToExcel} className="w-full py-3.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-150 rounded-xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] group">
                                <FileSpreadsheet className="w-6 h-6 text-emerald-600 group-hover:scale-110 transition-transform" />
                                <div className="text-left">
                                    <p className="font-bold text-sm text-emerald-900">Excel形式 (.xlsx)</p>
                                    <p className="text-[11px] text-emerald-600">本日の日報を複数シートで出力</p>
                                </div>
                            </button>
                            <button onClick={exportToCSV} className="w-full py-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-150 rounded-xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] group">
                                <FileText className="w-6 h-6 text-slate-600 group-hover:scale-110 transition-transform" />
                                <div className="text-left">
                                    <p className="font-bold text-sm text-slate-900">CSV形式 (.csv)</p>
                                    <p className="text-[11px] text-slate-500">データ連携用のテキスト形式</p>
                                </div>
                            </button>
                        </div>
                    </div>

                    <div className="border-t border-slate-100 my-4"></div>

                    {/* 月間一括印刷セクション */}
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 pl-1">月間業務管理日誌の一括PDF出力</p>
                        <div className="bg-slate-50 p-4 rounded-xl space-y-3 border border-slate-100">
                            <div className="flex items-center justify-between gap-4">
                                <label className="text-xs font-bold text-slate-600">対象の月:</label>
                                <input 
                                    type="month" 
                                    value={targetMonth} 
                                    onChange={e => setTargetMonth(e.target.value)} 
                                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-bold outline-none focus:border-tree-500"
                                />
                            </div>
                            
                            <button 
                                onClick={handleMonthlyPDF} 
                                disabled={isPrinting}
                                className="w-full py-3.5 bg-tree-600 hover:bg-tree-700 disabled:bg-tree-300 text-white rounded-xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] font-bold text-sm shadow-md shadow-tree-100"
                            >
                                {isPrinting ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <Printer className="w-5 h-5" />
                                )}
                                <span>{isPrinting ? 'データを取得中...' : '月間PDFを一括印刷'}</span>
                            </button>
                        </div>
                    </div>
                </div>

                <button onClick={onClose} className="mt-6 w-full py-2 text-slate-400 hover:text-slate-600 text-sm font-bold">閉じる</button>
            </div>
        </div>
    );
}

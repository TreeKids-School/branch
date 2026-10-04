import { useState } from 'react';
import { FileSpreadsheet, FileText, Printer, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { parseForceSheet, getRoleFromPost } from '../app_constants';
import { callStorage } from '../hooks/useStorage';
import { printMonthlyDocuments, extractNotesText, extractStudyText, extractProgramText } from '../utils/print';

export default function ExportModal({ 
    show, 
    onClose, 
    children, 
    results, 
    selectedDate, 
    summaryC, 
    selectedOffice, 
    staffList = [],
    dailyTable = {},
    dailyMessages = {},
    globalLog = {},
    attendance = {}
}) {
    const [targetMonth, setTargetMonth] = useState(selectedDate ? selectedDate.substring(0, 7) : new Date().toISOString().substring(0, 7));
    const [isPrinting, setIsPrinting] = useState(false);
    const [isExportingAll, setIsExportingAll] = useState(false);

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

    const [isSavingExcel, setIsSavingExcel] = useState(false);

    const processExcelAndSave = async (data, fileName, fileHandle) => {
        const wb = XLSX.read(data, { type: 'array' });
        
        const dateObj = new Date(selectedDate);
        const day = dateObj.getDate();
        const month = dateObj.getMonth() + 1;
        const possibleSheetNames = [
            `${day}`,
            `${day}日`,
            `${month}月${day}日`,
            `${month}-${day}`,
            `${month}/${day}`,
            selectedDate
        ];

        let targetSheetName = null;
        for (const name of possibleSheetNames) {
            if (wb.SheetNames.includes(name)) {
                targetSheetName = name;
                break;
            }
        }

        if (!targetSheetName) {
            targetSheetName = wb.SheetNames.find(name => 
                name.includes(`${day}日`) || name.includes(`${day}`)
            );
        }

        if (!targetSheetName) {
            const confirmed = window.confirm(`日付に一致するシート名（「${day}日」など）が見つかりません。最初のシート「${wb.SheetNames[0]}」に上書きしますか？`);
            if (!confirmed) return;
            targetSheetName = wb.SheetNames[0];
        }

        const sheet = wb.Sheets[targetSheetName];

        // 1. 日付
        const y = dateObj.getFullYear();
        const formattedDateStr = `${y}年${month}月 ${day}日`;
        let dateCellRef = 'I1';
        for (const cellRef in sheet) {
            if (cellRef[0] === '!') continue;
            const val = sheet[cellRef]?.v;
            if (typeof val === 'string' && val.includes('年') && val.includes('月') && val.includes('日')) {
                dateCellRef = cellRef;
                break;
            }
        }
        sheet[dateCellRef] = { t: 's', v: formattedDateStr };

        // 2. スタッフ勤務表
        const staffMap = {};
        staffList.forEach(s => {
            if (s.name) {
                staffMap[s.name] = s.post || s.role || '';
            }
        });

        const allRecords = [];
        if (staffList.length > 0) {
            staffList.forEach(staff => {
                const record = attendance[staff.id] || attendance[staff.name];
                if (record) {
                    allRecords.push({
                        ...record,
                        name: staff.name,
                        role: staffMap[staff.name] || record.post || record.role || ''
                    });
                } else {
                    allRecords.push({
                        name: staff.name,
                        type: 'work',
                        startTime: '09:30',
                        endTime: '18:30',
                        role: staffMap[staff.name] || ''
                    });
                }
            });
        } else {
            Object.values(attendance).forEach(record => {
                if (record && record.name) {
                    allRecords.push({
                        ...record,
                        role: record.post || record.role || ''
                    });
                }
            });
        }

        const formatAttendance = (record) => {
            if (!record) return { name: '', timeStr: '', timeEnd: '' };
            const name = record.name || '';
            if (record.type === 'public_holiday') return { name, timeStr: '公休', timeEnd: '' };
            if (record.type === 'paid_leave')    return { name, timeStr: '有給', timeEnd: '' };
            return { name, timeStr: record.startTime || '9:30', timeEnd: record.endTime || '18:30' };
        };

        const admins = [];
        const supervisors = [];
        const workers = [];
        const assistants = [];

        allRecords.forEach(record => {
            let roleVal = staffMap[record.name] || record.role || record.post || '';
            const rawRoles = Array.isArray(roleVal) ? roleVal : [roleVal];
            const fmt = formatAttendance(record);
            const resolvedRoles = [];
            rawRoles.forEach(r => {
                const mapped = getRoleFromPost(r);
                if (mapped) resolvedRoles.push(mapped);
                else if (r && r !== 'staff' && r !== 'admin') resolvedRoles.push(r);
            });
            if (resolvedRoles.length === 0) resolvedRoles.push('児童指導員・保育士');
            const uniqueRoles = Array.from(new Set(resolvedRoles));
            uniqueRoles.forEach(role => {
                if (role === '管理者') admins.push(fmt);
                else if (role === '児発管') supervisors.push(fmt);
                else if (role === '指導員') assistants.push(fmt);
                else workers.push(fmt);
            });
        });

        const writeStaff = (list, startRow, maxRows) => {
            for (let i = 0; i < maxRows; i++) {
                const r = startRow + i;
                const staff = list[i] || { name: '', timeStr: '', timeEnd: '' };
                sheet[`B${r}`] = { t: 's', v: staff.name };
                sheet[`C${r}`] = { t: 's', v: staff.timeStr };
                sheet[`D${r}`] = { t: 's', v: staff.timeEnd };
            }
        };

        writeStaff(admins, 3, 1);
        writeStaff(supervisors, 4, 1);
        writeStaff(workers, 5, 4);
        writeStaff(assistants, 9, 2);

        // 3. 特記事項
        sheet['E4'] = { t: 's', v: globalLog.notice || summaryC || '' };

        // 4. 業務内容 (共有事項)
        const GROUP1_ITEMS = [
            { id: 'g1_1', label: '①今月のプログラム計画' },
            { id: 'g1_2', label: '②来月以降のプログラム計画' },
            { id: 'g1_3', label: '③次回個別支援の計画' },
            { id: 'g1_4', label: '④個別支援記録' },
            { id: 'g1_5', label: '⑤環境整備業務（清掃等）' },
            { id: 'g1_6', label: '⑥プログラム準備' },
            { id: 'g1_7', label: '⑦業務管理日誌記録' },
            { id: 'g1_8', label: '⑧その他（雑務）' },
        ];
        const GROUP2_ITEMS = [
            { id: 'g2_1', label: '❶支援プログラムの充実化' },
            { id: 'g2_2', label: '❷支援ツールの充実化' },
            { id: 'g2_3', label: '❸業務知識 of 習得' }, // 実際は「業務知識の習得」
            { id: 'g2_4', label: '❹業務改善' },
            { id: 'g2_5', label: '❺認知度の向上' },
            { id: 'g2_6', label: '❻吉根小学校の児童獲得' },
            { id: 'g2_7', label: '❼保護者の満足度の向上' },
            { id: 'g2_8', label: '❽業務マニュアルなどの作成' },
            { id: 'g2_9', label: '❾意識向上、理念理解など' },
            { id: 'g2_10', label: '❿その他' },
        ];
        // typoをここで修正します
        GROUP2_ITEMS[2].label = '❸業務知識の習得';

        const activities = globalLog.activities || '';
        let activityText = '';
        if (activities) {
            let parsed = null;
            if (typeof activities === 'object') {
                parsed = activities;
            } else if (activities.trim().startsWith('{')) {
                try { parsed = JSON.parse(activities); } catch(e){}
            }
            if (parsed) {
                const group1 = parsed.group1 || [];
                const group2 = parsed.group2 || [];
                const selectedLabels = [];
                GROUP1_ITEMS.forEach(item => { if (group1.includes(item.id)) selectedLabels.push(item.label); });
                GROUP2_ITEMS.forEach(item => { if (group2.includes(item.id)) selectedLabels.push(item.label); });
                activityText = selectedLabels.join('\n');
            } else {
                activityText = activities;
            }
        }
        sheet['H4'] = { t: 's', v: activityText };

        // 5. 児童データテーブル (行13〜)
        const displayRows = children.filter(c => !c.isPlaceholder);
        const maxRowsInSheet = 15; 

        for (let i = 0; i < maxRowsInSheet; i++) {
            const r = 13 + i;
            if (i < displayRows.length) {
                const child = displayRows[i];
                const rowData = dailyTable[child.id] || {};
                const msgs = dailyMessages[child.id] || [];

                const hasHomework = msgs.some(m => m.tag === '【宿題】' || m.text.includes('【宿題】'));
                const hasPrint = msgs.some(m => m.tag === '【プリント】' || m.text.includes('【プリント】'));
                const hasTree = msgs.some(m => m.tag === '【ツリー式学習】' || m.tag === '【学習】' || m.text.includes('【ツリー式学習】') || m.text.includes('【学習】'));
                const hasProg = msgs.some(m => m.tag === '【プログラム】' || m.text.includes('【プログラム】'));
                const hasLine = !!rowData.sentChecked;

                sheet[`A${r}`] = { t: 'n', v: i + 1 };
                sheet[`B${r}`] = { t: 's', v: child.name };
                sheet[`C${r}`] = { t: 's', v: '' }; 
                sheet[`D${r}`] = { t: 's', v: rowData.endTime || '' };
                sheet[`E${r}`] = { t: 's', v: rowData.pickupLocation || '' };
                sheet[`F${r}`] = { t: 's', v: rowData.transportTime || '' };
                sheet[`G${r}`] = { t: 's', v: hasHomework ? '〇' : '' };
                sheet[`H${r}`] = { t: 's', v: hasPrint ? '〇' : '' };
                sheet[`I${r}`] = { t: 's', v: hasTree ? '〇' : '' };
                sheet[`J${r}`] = { t: 's', v: hasProg ? '〇' : '' };
                sheet[`K${r}`] = { t: 's', v: hasLine ? '〇' : '' };
                sheet[`L${r}`] = { t: 's', v: extractNotesText(dailyMessages, dailyTable, child.id) };
            } else {
                sheet[`A${r}`] = { t: 's', v: '' };
                sheet[`B${r}`] = { t: 's', v: '' };
                sheet[`C${r}`] = { t: 's', v: '' };
                sheet[`D${r}`] = { t: 's', v: '' };
                sheet[`E${r}`] = { t: 's', v: '' };
                sheet[`F${r}`] = { t: 's', v: '' };
                sheet[`G${r}`] = { t: 's', v: '' };
                sheet[`H${r}`] = { t: 's', v: '' };
                sheet[`I${r}`] = { t: 's', v: '' };
                sheet[`J${r}`] = { t: 's', v: '' };
                sheet[`K${r}`] = { t: 's', v: '' };
                sheet[`L${r}`] = { t: 's', v: '' };
            }
        }

        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

        if (fileHandle) {
            const writable = await fileHandle.createWritable();
            await writable.write(wbout);
            await writable.close();
            alert(`「${targetSheetName}」シートへ本日のデータを上書き保存しました。`);
        } else {
            const blob = new Blob([wbout], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', fileName);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            alert(`編集後のファイル「${fileName}」をダウンロードしました。`);
        }
        onClose();
    };

    const handleOverwriteExcel = async () => {
        if (isSavingExcel) return;
        setIsSavingExcel(true);
        try {
            let fileHandle = null;
            let fileData = null;
            let isFileSystemAPI = false;

            if (window.showOpenFilePicker) {
                try {
                    const [handle] = await window.showOpenFilePicker({
                        types: [{
                            description: 'Excel Files',
                            accept: {
                                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
                            }
                        }],
                        excludeAcceptAllOption: true,
                        multiple: false
                    });
                    fileHandle = handle;
                    const file = await fileHandle.getFile();
                    const arrayBuffer = await file.arrayBuffer();
                    fileData = new Uint8Array(arrayBuffer);
                    isFileSystemAPI = true;
                } catch (e) {
                    if (e.name === 'AbortError') {
                        setIsSavingExcel(false);
                        return;
                    }
                    console.warn('showOpenFilePicker failed, falling back to input file:', e);
                }
            }

            if (!isFileSystemAPI) {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.xlsx';
                input.onchange = async (e) => {
                    const file = e.target.files[0];
                    if (!file) {
                        setIsSavingExcel(false);
                        return;
                    }
                    const reader = new FileReader();
                    reader.onload = async (evt) => {
                        try {
                            const arrayBuffer = evt.target.result;
                            const data = new Uint8Array(arrayBuffer);
                            await processExcelAndSave(data, file.name, null);
                        } catch (err) {
                            console.error(err);
                            alert('エクセルの処理中にエラーが発生しました: ' + err.message);
                        } finally {
                            setIsSavingExcel(false);
                        }
                    };
                    reader.readAsArrayBuffer(file);
                };
                input.click();
                return;
            }

            if (fileData) {
                await processExcelAndSave(fileData, fileHandle.name, fileHandle);
            }
        } catch (error) {
            console.error('Excel Overwrite Error:', error);
            alert('上書き保存中にエラーが発生しました: ' + error.message);
        } finally {
            setIsSavingExcel(false);
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

    const handleAllDataExportCSV = async () => {
        if (isExportingAll) return;
        setIsExportingAll(true);
        try {
            const datesIndex = await callStorage({ action: 'getReportIndex', officeId });
            if (!datesIndex || datesIndex.length === 0) {
                alert('登録されているデータがありません。');
                setIsExportingAll(false);
                return;
            }

            const sortedDates = [...datesIndex].sort();
            const batchSize = 20;
            const allReports = [];
            
            for (let i = 0; i < sortedDates.length; i += batchSize) {
                const batchDates = sortedDates.slice(i, i + batchSize);
                const promises = batchDates.map(async (date) => {
                    const data = await callStorage({ action: 'getReport', date, officeId });
                    return { date, data };
                });
                const batchResults = await Promise.all(promises);
                allReports.push(...batchResults);
            }

            let csv = '\ufeff"児童名","日付","学習","プログラム","ツリー通信","送迎時間","終了時間","迎え場所","復元用データ","日次データ"\n';

            allReports.forEach(({ date, data }) => {
                if (!data) return;

                const childrenList = data.children || [];
                const resultsObj = data.results || {};
                const messagesObj = data.messages || {};
                const dailyTableObj = data.dailyTable || {};
                const summaryCVal = data.summaryC || '';
                const globalLogVal = data.globalLog || {};

                const dailyDataStr = JSON.stringify({
                    summaryC: summaryCVal,
                    globalLog: globalLogVal
                });

                const activeChildIds = new Set([
                    ...childrenList.filter(c => c && c.id && !c.isPlaceholder).map(c => c.id),
                    ...Object.keys(resultsObj),
                    ...Object.keys(messagesObj),
                    ...Object.keys(dailyTableObj)
                ]);

                const childMap = {};
                childrenList.forEach(c => { if (c && c.id) childMap[c.id] = c; });

                activeChildIds.forEach(childId => {
                    const child = childMap[childId] || staffList.find(s => s.id === childId) || { id: childId, name: '不明な児童' };
                    if (child.isPlaceholder) return;

                    const r = resultsObj[childId] || {};
                    const t = dailyTableObj[childId] || {};
                    const m = messagesObj[childId] || [];

                    const studyText = m.filter(msg => msg.tag === '【宿題】' || msg.tag === '【プリント】' || msg.tag === '【学習】').map(msg => msg.text).join('；');
                    const progText = m.filter(msg => msg.tag === '【プログラム】').map(msg => msg.text).join('；');

                    const treeComm = r.D || '';
                    const transportTime = t.transportTime || '';
                    const endTime = t.endTime || '';
                    const pickupLocation = t.pickupLocation || '';

                    const restoreStr = JSON.stringify({
                        m: m,
                        r: r,
                        t: t
                    });

                    const row = [
                        child.name || '不明な児童',
                        date,
                        studyText,
                        progText,
                        treeComm,
                        transportTime,
                        endTime,
                        pickupLocation,
                        restoreStr,
                        dailyDataStr
                    ].map(f => `"${(f || '').replace(/"/g, '""')}"`).join(',');

                    csv += row + '\n';
                });
            });

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            const todayStr = new Date().toISOString().split('T')[0];
            link.href = url;
            link.setAttribute('download', `全期間データバックアップ_${todayStr}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            alert(`全期間データ（${sortedDates.length}日分）のエクスポートが完了しました。`);
        } catch (error) {
            console.error('All data export error:', error);
            alert('全期間データのエクスポート中にエラーが発生しました: ' + error.message);
        } finally {
            setIsExportingAll(false);
        }
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
                            <button 
                                onClick={handleOverwriteExcel} 
                                disabled={isSavingExcel}
                                className="w-full py-3.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-150 rounded-xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] group"
                            >
                                {isSavingExcel ? (
                                    <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
                                ) : (
                                    <FileSpreadsheet className="w-6 h-6 text-indigo-600 group-hover:scale-110 transition-transform" />
                                )}
                                <div className="text-left">
                                    <p className="font-bold text-sm text-indigo-900">業務管理日誌エクセルを上書き保存</p>
                                    <p className="text-[11px] text-indigo-600">既存ファイルを選択して本日のデータを上書き</p>
                                </div>
                            </button>
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

                    {/* 移行用バックアップセクション */}
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 pl-1">データ移行用（全期間バックアップ）</p>
                        <div className="space-y-2">
                            <button 
                                onClick={handleAllDataExportCSV} 
                                disabled={isExportingAll}
                                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white border border-indigo-700 rounded-xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] group shadow-md shadow-indigo-100"
                            >
                                {isExportingAll ? (
                                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                                ) : (
                                    <FileText className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
                                )}
                                <div className="text-left">
                                    <p className="font-bold text-sm text-white">全期間データバックアップ (.csv)</p>
                                    <p className="text-[11px] text-indigo-200">全日付の児童データ・日誌を1つのCSVで出力</p>
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

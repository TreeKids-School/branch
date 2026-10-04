import { useState, useEffect } from 'react';
import { FileSpreadsheet, FileText, Printer, Loader2, X, Download } from 'lucide-react';
import './WorkflowModals.css';
import * as XLSX from 'xlsx';
import { parseForceSheet, getRoleFromPost } from '../app_constants';
import { callStorage } from '../hooks/useStorage';
import { printMonthlyDocuments } from '../utils/print';
import { columnText, DEFAULT_COLUMNS } from '../utils/communicationFlow';

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
    attendance = {},
    onExportBackup, onPrintDay, tagColumnMap = DEFAULT_COLUMNS, onDirtyChange
}) {
    const [targetMonth, setTargetMonth] = useState(selectedDate ? selectedDate.substring(0, 7) : new Date().toISOString().substring(0, 7));
    const [isPrinting, setIsPrinting] = useState(false);
    const [isExportingAll, setIsExportingAll] = useState(false);

    const [isSavingExcel, setIsSavingExcel] = useState(false);
    const [backupRange, setBackupRange] = useState('day');
    const [exportError, setExportError] = useState('');
    const [fileStatus, setFileStatus] = useState('');
    useEffect(() => { if (show && selectedDate) setTargetMonth(selectedDate.substring(0, 7)); }, [show, selectedDate]);
    const busy = isSavingExcel || isExportingAll || isPrinting;
    useEffect(() => { onDirtyChange?.(busy); }, [busy, onDirtyChange]);
    useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
    const close = () => { if (!busy) onClose(); };
    if (!show) return null;

    const officeId = selectedOffice?.id;
    const handlePrintDay = () => {
        setExportError('');
        setFileStatus('');
        try {
            onPrintDay();
            setFileStatus('当日日誌の印刷画面を開きました。PDF保存は印刷画面で選んでください。');
        } catch (error) {
            setExportError('当日日誌の印刷画面を開けませんでした: ' + error.message);
        }
    };

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

            printMonthlyDocuments(targetMonth, validResults, staffList, tagColumnMap);
            setFileStatus(`${targetMonth}の印刷画面を開きました。PDF保存は印刷画面で選んでください。`);
        } catch (error) {
            console.error('Monthly PDF Generation Error:', error);
            setExportError('月間日誌の印刷画面を開けませんでした: ' + error.message);
        } finally {
            setIsPrinting(false);
        }
    };

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

        setFileStatus(`${fileName} / ${targetSheetName} シートへ反映中…`);
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
        const programsText = (Array.isArray(globalLog.programs) ? globalLog.programs : globalLog.programTitle ? [{title:globalLog.programTitle,staff:globalLog.programStaff,summary:globalLog.programSummary}] : []).map(program => [program.title, program.staff, program.summary].filter(Boolean).join(' / ')).join('\n');
        sheet['H4'] = { t: 's', v: [activityText, programsText ? `【プログラム】\n${programsText}` : ''].filter(Boolean).join('\n\n') };

        // 5. 児童データテーブル (行13〜)
        const displayRows = children.filter(c => !c.isPlaceholder);
        const maxRowsInSheet = 15;
        if (displayRows.length > maxRowsInSheet) throw new Error('この日誌Excelの児童欄は15名分です。16名以上の記録を省略しないため反映を停止しました。日誌の印刷または書類Excelを利用してください。');

        for (let i = 0; i < maxRowsInSheet; i++) {
            const r = 13 + i;
            if (i < displayRows.length) {
                const child = displayRows[i];
                const rowData = dailyTable[child.id] || {};
                const msgs = dailyMessages[child.id] || [];

                const hasHomework = msgs.some(m => (m.tag || '').split(' ').includes('【宿題】') || (m.text || '').includes('【宿題】'));
                const hasPrint = msgs.some(m => (m.tag || '').split(' ').includes('【プリント】') || (m.text || '').includes('【プリント】'));
                const hasTree = msgs.some(m => (m.tag || '').split(' ').some(tag => tagColumnMap[tag] === 'learning') || (m.text || '').includes('【ツリー式学習】') || (m.text || '').includes('【学習】'));
                const hasProg = msgs.some(m => (m.tag || '').split(' ').some(tag => tagColumnMap[tag] === 'program') || (m.text || '').includes('【プログラム】'));
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
                sheet[`L${r}`] = { t: 's', v: [columnText(dailyMessages[child.id] || [], 'remarks', tagColumnMap), dailyTable[child.id]?.notes || ''].filter(Boolean).join(' / ') };
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
            setFileStatus(`「${fileName}」の「${targetSheetName}」シートへ上書き保存しました。`);
        } else {
            const blob = new Blob([wbout], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', fileName);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            setFileStatus(`編集後の「${fileName}」のダウンロードを開始しました。元ファイルは変更していません。`);
        }
    };

    const handleOverwriteExcel = async () => {
        if (isSavingExcel) return;
        setIsSavingExcel(true); setExportError(''); setFileStatus('');
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
                const file = await new Promise(resolve => {
                    const input = document.createElement('input');
                    input.type = 'file'; input.accept = '.xlsx';
                    input.onchange = () => resolve(input.files?.[0] || null);
                    input.oncancel = () => resolve(null);
                    input.click();
                });
                if (file) await processExcelAndSave(new Uint8Array(await file.arrayBuffer()), file.name, null);
                return;
            }

            if (fileData) {
                await processExcelAndSave(fileData, fileHandle.name, fileHandle);
            }
        } catch (error) {
            console.error('Excel Overwrite Error:', error);
            setExportError('Excelの保存に失敗しました: ' + error.message);
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
        const commData = [['ツリー通信', ''], ['日付', selectedDate], [], ['児童名', '内容', '今後の予定']];
        childrenWithResults.forEach(child => { const r = results[child.id] || {}; commData.push([child.name, r.D || '', r.futurePlan || '']); });
        const commSheet = XLSX.utils.aoa_to_sheet(commData);
        commSheet['!cols'] = [{ wch: 15 }, { wch: 80 }, { wch: 40 }];
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
        let csv = '\ufeff"児童名","日付","支援内容・結果","今後の予定","該当項目","ツリー通信","強行_学習","強行_自由遊び","強行_プログラム","強行_おやつ","通信_今後の予定"\n';
        childrenWithResults.forEach(child => {
            const r = results[child.id] || {};
            const force = parseForceSheet(r.K_sheet || '');
            const row = [child.name, selectedDate, r.B_result || '', r.B_plan || '', r.B_item || '', r.D || '', force.learning || '', force.play || '', force.program || '', force.snack || '', r.futurePlan || '']
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

                    const studyText = columnText(m, 'learning', tagColumnMap);
                    const progText = columnText(m, 'program', tagColumnMap);

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

    const rangeEnd = new Date(`${selectedDate}T12:00:00`);
    const rangeStart = new Date(rangeEnd);
    if (backupRange === 'week') rangeStart.setDate(rangeStart.getDate() - 6);
    if (backupRange === 'month') rangeStart.setMonth(rangeStart.getMonth() - 1);
    if (backupRange === 'year') rangeStart.setFullYear(rangeStart.getFullYear() - 1);
    const dateLabel = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const backup = async () => {
        if (busy) return;
        if (!onExportBackup) { await handleAllDataExportCSV(); return; }
        setIsExportingAll(true); setExportError('');
        try { await onExportBackup(backupRange); }
        catch (error) { setExportError(`書出しに失敗しました。${error.message || ''}`); }
        finally { setIsExportingAll(false); }
    };
    return <div className="workflow-overlay" onClick={close}>
      <section className="workflow-dialog export-dialog" role="dialog" aria-modal="true" aria-labelledby="export-title" onClick={e => e.stopPropagation()}>
        <header className="workflow-header"><div><p className="workflow-eyebrow">ツリー通信v2 / 記録を持ち出す</p><h2 id="export-title">書出し・日誌の印刷</h2><p>ファイル保存と、ブラウザーの印刷を選べます。</p></div><button className="workflow-icon" onClick={close} disabled={busy} aria-label="書出しを閉じる"><X/></button></header>
        <div className="workflow-context">{selectedOffice?.name} · 対象日 {selectedDate}</div>
        <div className="workflow-body">
          {exportError && <p className="workflow-error" role="alert">{exportError}</p>}{fileStatus && <p className="workflow-success" role="status">{fileStatus}</p>}
          <section className="workflow-section"><h3>バックアップCSV</h3><p className="workflow-help">通信本文・メモ・予定・送迎・日誌の復元用データを含みます。</p><label className="workflow-field">対象期間<select value={backupRange} disabled={busy} onChange={e => setBackupRange(e.target.value)}><option value="day">選択日のみ</option><option value="week">直近7日</option><option value="month">選択日の1か月前から</option><option value="year">選択日の1年前から</option><option value="all">全記録</option></select></label><div className="workflow-actions"><p>{backupRange === 'all' ? '保存されている全日付' : `${dateLabel(rangeStart)} 〜 ${selectedDate}`}</p><button className="workflow-primary" disabled={busy} onClick={backup}>{isExportingAll ? <Loader2 size={18} className="animate-spin"/> : <Download size={18}/>}CSVを書き出す</button></div></section>
          <section className="workflow-section"><h3>既存の日誌Excelへ反映</h3><p className="workflow-help">ファイルを選び、対象日のシートへ反映します。対応するPCブラウザーでは元ファイルへ保存し、スマホなどでは編集後ファイルをダウンロードします。</p><div className="workflow-actions"><p className="workflow-help">対象: {selectedDate} / 日誌・児童・スタッフ勤務</p><button className="workflow-secondary" onClick={handleOverwriteExcel} disabled={busy}>{isSavingExcel ? <Loader2 size={18} className="animate-spin"/> : <FileSpreadsheet size={18}/>}日誌Excelを選ぶ</button></div></section>
          <section className="workflow-section"><h3>選択日の書類</h3><p className="workflow-help">保存されている支援項目・通信などを書き出します。書類CSVはバックアップCSVと異なる形式です。</p><div className="workflow-actions"><button className="workflow-secondary" onClick={exportToExcel} disabled={busy}><FileSpreadsheet size={18}/>書類Excel</button><button className="workflow-secondary" onClick={exportToCSV} disabled={busy}><FileText size={18}/>書類CSV</button>{onPrintDay && <button className="workflow-secondary" onClick={handlePrintDay} disabled={busy}><Printer size={18}/>当日日誌を印刷</button>}</div></section>
          <section className="workflow-section"><h3>月間日誌を印刷・PDF保存</h3><label className="workflow-field">対象月<input type="month" value={targetMonth} disabled={busy} onChange={e => setTargetMonth(e.target.value)}/></label><div className="workflow-actions"><p className="workflow-help">ブラウザーの印刷画面でPDF保存を選べます。</p><button className="workflow-primary" onClick={handleMonthlyPDF} disabled={busy || !targetMonth}>{isPrinting ? <Loader2 size={18} className="animate-spin"/> : <Printer size={18}/>}印刷・PDF保存へ</button></div></section>
        </div><footer className="workflow-footer"><div className="workflow-actions"><button className="workflow-secondary" onClick={close} disabled={busy}>業務へ戻る</button></div></footer>
      </section>
    </div>;
}

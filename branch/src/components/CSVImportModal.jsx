import React, { useState, useRef } from 'react';
import { X, FileSpreadsheet, Upload, CheckCircle2, AlertTriangle, Check, Loader2 } from 'lucide-react';

export default function CSVImportModal({ show, onClose, masterChildren, offices, selectedOffice, selectedDate, cs, onRefresh, onImportSandbox }) {
    const [dragActive, setDragActive] = useState(false);
    const [parsedRows, setParsedRows] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const [fileName, setFileName] = useState('');
    const [sandboxOnly, setSandboxOnly] = useState(false);
    const fileInputRef = useRef(null);

    if (!show) return null;

    // Helper: Parse date into YYYY-MM-DD
    const parseCSVDate = (dateStr) => {
        if (!dateStr) return '';
        let clean = dateStr.trim().replace(/\//g, '-');
        if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
        const parts = clean.split('-');
        if (parts.length === 3) {
            let y = parts[0];
            let m = parts[1].padStart(2, '0');
            let d = parts[2].padStart(2, '0');
            if (y.length === 2) {
                y = '20' + y;
            }
            return `${y}-${m}-${d}`;
        }
        return '';
    };

    // Robust CSV parser handling quotes
    const parseCSVLine = (line) => {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim());
        return result;
    };

    const handleFile = (file) => {
        if (!file) return;
        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target.result;
            const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
            if (lines.length <= 1) {
                alert('CSVファイルが空か、ヘッダー行しかありません。');
                return;
            }

            const rows = [];
            // Parse lines (skip first header row)
            for (let i = 1; i < lines.length; i++) {
                const parts = parseCSVLine(lines[i]);
                if (parts.length < 2) continue; // skip invalid rows

                const [csvName, csvDate, csvOffice, csvStatus, csvPickupLocation, csvPickupTime, csvNotes] = parts;
                if (!csvName) continue;

                // Match Child from master list
                const cleanCsvName = csvName.replace(/\s+/g, '');
                const matchedChild = masterChildren.find(mc => {
                    const cleanDbName = (mc.name || '').replace(/\s+/g, '');
                    const cleanConcatName = `${mc.lastName || ''}${mc.firstName || ''}`.replace(/\s+/g, '');
                    return cleanDbName === cleanCsvName || cleanConcatName === cleanCsvName;
                });

                // Match Office
                let matchedOffice = null;
                if (csvOffice) {
                    const cleanCsvOffice = csvOffice.replace(/\s+/g, '');
                    matchedOffice = offices.find(o => {
                        const cleanOfficeName = (o.name || '').replace(/\s+/g, '');
                        return cleanOfficeName === cleanCsvOffice || cleanOfficeName.includes(cleanCsvOffice) || cleanCsvOffice.includes(cleanOfficeName);
                    });
                }
                // Fallback to currently selected office if no match found
                if (!matchedOffice) {
                    matchedOffice = selectedOffice;
                }

                // Match Date
                const targetDate = parseCSVDate(csvDate) || selectedDate;

                rows.push({
                    id: `${i}-${Date.now()}`,
                    originalName: csvName,
                    matchedChild,
                    date: targetDate,
                    office: matchedOffice,
                    status: csvStatus || '通常',
                    pickupLocation: csvPickupLocation || '',
                    pickupTime: csvPickupTime || '',
                    notes: csvNotes || '',
                    enabled: !!matchedChild // Check by default if matched
                });
            }
            setParsedRows(rows);
        };
        reader.readAsText(file, 'UTF-8');
    };

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    };

    const handleFileInputChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
        }
    };

    const toggleRowEnabled = (rowId) => {
        setParsedRows(prev => prev.map(row => row.id === rowId ? { ...row, enabled: !row.enabled } : row));
    };

    const toggleAllEnabled = () => {
        const anyDisabled = parsedRows.some(r => !r.enabled && r.matchedChild);
        setParsedRows(prev => prev.map(row => {
            if (!row.matchedChild) return row; // Keep unmatched rows disabled
            return { ...row, enabled: anyDisabled };
        }));
    };

    const handleSave = async () => {
        const activeRows = parsedRows.filter(r => r.enabled && r.matchedChild);
        if (activeRows.length === 0) {
            alert('インポート対象の有効な児童が選択されていません。');
            return;
        }

        setIsSaving(true);
        try {
            // Group active rows by Date and OfficeId
            const groups = {};
            activeRows.forEach(row => {
                const groupKey = `${row.date}_${row.office.id}`;
                if (!groups[groupKey]) {
                    groups[groupKey] = {
                        date: row.date,
                        officeId: row.office.id,
                        rows: []
                    };
                }
                groups[groupKey].rows.push(row);
            });

            // Process each group
            for (const key of Object.keys(groups)) {
                const { date, officeId, rows } = groups[key];

                // 1. Fetch current daily report
                const currentData = await cs({ action: 'getReport', date, officeId });
                const finalReport = currentData && typeof currentData === 'object' ? { ...currentData } : {};
                
                // Initialize sub structures
                const currentChildren = Array.isArray(finalReport.children) ? [...finalReport.children] : [];
                const currentTable = finalReport.dailyTable ? { ...finalReport.dailyTable } : {};
                const currentResults = finalReport.results ? { ...finalReport.results } : {};
                const currentMessages = finalReport.messages ? { ...finalReport.messages } : {};
                const currentGlobalLog = finalReport.globalLog || { admin: '', supervisor: '', notice: '', activities: '', programTitle: '', programSummary: '' };
                const currentChangeLogs = finalReport.changeLogs || [];

                rows.forEach(row => {
                    const child = row.matchedChild;
                    
                    // Map Status
                    const isWaitlist = row.status === 'キャンセル待ち';
                    const isAbsent = row.status === '欠席';

                    // Check if child is already in the report's children list
                    const existingChildIndex = currentChildren.findIndex(c => c.id === child.id);
                    const childData = {
                        ...child,
                        isWaitlist,
                        isAbsent,
                        timestamp: Date.now()
                    };

                    if (existingChildIndex > -1) {
                        currentChildren[existingChildIndex] = {
                            ...currentChildren[existingChildIndex],
                            ...childData
                        };
                    } else {
                        currentChildren.push(childData);
                    }

                    // Map fields into dailyTable
                    currentTable[child.id] = {
                        ...(currentTable[child.id] || {}),
                        pickupLocation: row.pickupLocation,
                        transportTime: row.pickupTime,
                        notes: row.notes
                    };
                });

                // Package and save daily bulk report
                const updatedReport = {
                    children: currentChildren,
                    messages: currentMessages,
                    results: currentResults,
                    summaryC: finalReport.summaryC || '',
                    dailyTable: currentTable,
                    globalLog: currentGlobalLog,
                    changeLogs: currentChangeLogs,
                    updatedAt: new Date().toISOString()
                };

                if (sandboxOnly) {
                    if (onImportSandbox) {
                        onImportSandbox(date, officeId, updatedReport);
                    }
                } else {
                    await cs({ action: 'saveReport', date, data: updatedReport, officeId });

                    // 2. Save individual child communications
                    for (const child of currentChildren) {
                        if (child.isPlaceholder) continue;
                        const childResult = currentResults[child.id] || {};
                        const childTable = currentTable[child.id] || {};

                        const individualData = {
                            name: child.name,
                            tree_comm_text: childResult.D || '',
                            future_plan: childResult.futurePlan || '',
                            pickupLocation: childTable.pickupLocation || '',
                            endTime: childTable.endTime || '',
                            transportTime: childTable.transportTime || '',
                            notes: childTable.notes || ''
                        };

                        await cs({
                            action: 'saveIndividualTreeComm',
                            childId: child.id,
                            date,
                            data: individualData
                        });
                    }
                }
            }

            alert(sandboxOnly ? 'CSVデータのデモ反映が完了しました（データベース保存無効中）' : 'CSVデータの取り込みが完了しました。');
            if (!sandboxOnly) {
                onRefresh(); // Refresh screen
            }
            onClose();
        } catch (error) {
            console.error(error);
            alert('インポート中にエラーが発生しました: ' + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const matchedCount = parsedRows.filter(r => r.matchedChild).length;
    const unmatchedCount = parsedRows.length - matchedCount;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 animate-in fade-in duration-300">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={onClose} />
            
            {/* Modal Box */}
            <div className="relative w-full max-w-4xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col border border-white animate-in zoom-in-95 duration-300 max-h-[85vh]">
                {/* Header */}
                <div className="p-6 bg-indigo-600 flex items-center justify-between shadow-lg flex-shrink-0 text-white">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                            <FileSpreadsheet className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-base font-black tracking-wider">CSV送迎記録インポート</h2>
                            <p className="text-[10px] text-white/70 font-semibold mt-0.5">送迎表・乗車記録などのCSVファイルを読み込み、一括でスケジュールや備考を各事業所・日付に反映させます。</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-all cursor-pointer">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-grow p-6 overflow-y-auto min-h-0 flex flex-col gap-4">
                    {/* Drag and Drop Zone */}
                    {parsedRows.length === 0 && (
                        <div
                            onDragEnter={handleDrag}
                            onDragOver={handleDrag}
                            onDragLeave={handleDrag}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className={`border-2 border-dashed rounded-3xl p-12 text-center transition-all duration-300 cursor-pointer flex flex-col items-center justify-center gap-3 ${
                                dragActive
                                    ? 'border-indigo-500 bg-indigo-50/50 scale-[0.99]'
                                    : 'border-slate-200 hover:border-indigo-400 hover:bg-slate-50/50'
                            }`}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".csv"
                                onChange={handleFileInputChange}
                                className="hidden"
                            />
                            <div className="p-4 bg-indigo-50 text-indigo-600 rounded-full animate-bounce">
                                <Upload className="w-8 h-8" />
                            </div>
                            <div>
                                <p className="text-xs font-black text-slate-700">CSVファイルをドラッグ＆ドロップ、またはクリックして選択</p>
                                <p className="text-[10px] text-slate-400 font-bold mt-1">
                                    列の順番: 児童名, 日付, 利用事業所, ステータス, 乗車場所, 乗車時間, 備考
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Preview Area */}
                    {parsedRows.length > 0 && (
                        <div className="flex flex-col min-h-0 flex-grow gap-3">
                            {/* Stats */}
                            <div className="flex justify-between items-center bg-slate-50 border border-slate-100 p-3 rounded-2xl flex-shrink-0 text-xs">
                                <div className="flex items-center gap-4">
                                    <span className="font-bold text-slate-500">ファイル: <span className="text-slate-800 font-black">{fileName}</span></span>
                                    <span className="flex items-center gap-1 font-bold text-emerald-600">
                                        <CheckCircle2 className="w-3.5 h-3.5" /> マッチ: {matchedCount}名
                                    </span>
                                    {unmatchedCount > 0 && (
                                        <span className="flex items-center gap-1 font-bold text-amber-500">
                                            <AlertTriangle className="w-3.5 h-3.5" /> 未登録: {unmatchedCount}名
                                        </span>
                                    )}
                                </div>
                                <button
                                    onClick={() => {
                                        setParsedRows([]);
                                        setFileName('');
                                    }}
                                    className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-500 font-bold rounded-lg border border-slate-200 transition-all cursor-pointer"
                                >
                                    ファイルを変更
                                </button>
                            </div>

                            {/* Table */}
                            <div className="flex-grow border border-slate-200 rounded-2xl overflow-hidden flex flex-col min-h-0">
                                <div className="overflow-auto flex-grow custom-scrollbar">
                                    <table className="w-full text-xs text-left border-collapse">
                                        <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 z-10 font-black text-slate-500">
                                            <tr>
                                                <th className="p-2.5 text-center w-12">
                                                    <input
                                                        type="checkbox"
                                                        checked={parsedRows.length > 0 && parsedRows.filter(r => r.matchedChild).every(r => r.enabled)}
                                                        onChange={toggleAllEnabled}
                                                        className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
                                                    />
                                                </th>
                                                <th className="p-2.5 w-32">児童名 (CSV / DB)</th>
                                                <th className="p-2.5 w-24">日付</th>
                                                <th className="p-2.5 w-28">利用事業所</th>
                                                <th className="p-2.5 w-20">ステータス</th>
                                                <th className="p-2.5 w-28">迎え場所 (乗車場所)</th>
                                                <th className="p-2.5 w-20">送迎時間</th>
                                                <th className="p-2.5">備考</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                                            {parsedRows.map((row) => (
                                                <tr
                                                    key={row.id}
                                                    className={`hover:bg-slate-50/50 ${
                                                        !row.matchedChild ? 'bg-amber-50/30' : 'bg-white'
                                                    }`}
                                                >
                                                    <td className="p-2 text-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={row.enabled}
                                                            disabled={!row.matchedChild}
                                                            onChange={() => toggleRowEnabled(row.id)}
                                                            className="w-4 h-4 rounded accent-indigo-600 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                                        />
                                                    </td>
                                                    <td className="p-2">
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-[11px] text-slate-500">{row.originalName}</span>
                                                            {row.matchedChild ? (
                                                                <span className="text-emerald-700 font-black text-xs">✓ {row.matchedChild.name}</span>
                                                            ) : (
                                                                <span className="text-amber-500 font-black text-[9px] flex items-center gap-0.5">
                                                                    <AlertTriangle className="w-3 h-3 flex-shrink-0" /> 未登録
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="p-2 text-slate-500 font-bold">{row.date}</td>
                                                    <td className="p-2">
                                                        <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-black text-[9px]">
                                                            {row.office?.name || '---'}
                                                        </span>
                                                    </td>
                                                    <td className="p-2">
                                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${
                                                            row.status === 'キャンセル待ち'
                                                                ? 'bg-amber-100 text-amber-800'
                                                                : row.status === '欠席'
                                                                ? 'bg-rose-100 text-rose-800'
                                                                : 'bg-slate-100 text-slate-800'
                                                        }`}>
                                                            {row.status}
                                                        </span>
                                                    </td>
                                                    <td className="p-2 text-slate-800 font-black">{row.pickupLocation || '---'}</td>
                                                    <td className="p-2 text-slate-600 font-bold">{row.pickupTime || '---'}</td>
                                                    <td className="p-2 text-slate-500 font-medium truncate max-w-xs" title={row.notes}>
                                                        {row.notes || '---'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 bg-white border-t border-slate-100 flex flex-col gap-4 flex-shrink-0">
                    <label className="flex items-center gap-2.5 p-3.5 bg-amber-50/50 hover:bg-amber-50/80 border border-amber-200/50 rounded-2xl cursor-pointer transition-colors select-none text-left">
                        <input 
                            type="checkbox"
                            checked={sandboxOnly}
                            onChange={(e) => setSandboxOnly(e.target.checked)}
                            className="w-4 h-4 rounded accent-amber-600 cursor-pointer"
                        />
                        <div className="flex flex-col">
                            <span className="text-xs font-black text-amber-800">データベースに保存せず、画面上でのみ動作検証する（デモモード）</span>
                            <span className="text-[10px] text-amber-700/80 font-bold">本番データベースに影響を与えずに、CSVインポートのマッチングや表示の動作確認が可能です。</span>
                        </div>
                    </label>
                    <div className="flex items-center justify-between w-full">
                        <button
                            onClick={onClose}
                            className="px-5 py-2.5 font-bold text-xs text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all cursor-pointer"
                        >
                            キャンセル
                        </button>
                        {parsedRows.length > 0 && (
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className={`px-6 py-3 rounded-xl font-black text-xs shadow-md transition-all active:scale-95 flex items-center gap-2 uppercase tracking-widest cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                                    sandboxOnly 
                                        ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-200/50' 
                                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100'
                                }`}
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>処理中...</span>
                                    </>
                                ) : (
                                    <>
                                        <Check className="w-4 h-4" />
                                        <span>{sandboxOnly ? 'デモ反映を実行' : '反映して保存'}</span>
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

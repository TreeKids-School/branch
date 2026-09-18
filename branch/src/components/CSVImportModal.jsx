import React, { useState, useRef } from 'react';
import { 
    X, FileSpreadsheet, Upload, CheckCircle2, AlertTriangle, Check, 
    Loader2, ShieldAlert, RefreshCw, Filter, Info, Lock, AlertCircle, Users
} from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';

const SLOT_LIMIT = 10; // 定員（10名）

export default function CSVImportModal({ 
    show, onClose, masterChildren, offices, selectedOffice, selectedDate, 
    cs, onRefresh, onImportSandbox, user, currentStaffName, firestore 
}) {
    const [dragActive, setDragActive] = useState(false);
    const [parsedRows, setParsedRows] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
    const [importMode, setImportMode] = useState('skip'); // 'skip' | 'overwrite'
    const [fileName, setFileName] = useState('');
    const [sandboxOnly, setSandboxOnly] = useState(false);
    const [overflowNotice, setOverflowNotice] = useState(null); // 定員超過通知モーダル/アラート
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

    // Check existing reports to identify duplicates, differences, and capacity overflow (11th+ child)
    const checkDuplicatesAndEnrich = async (rawRows) => {
        setIsCheckingDuplicates(true);
        try {
            // Collect unique date + office combinations
            const groupKeys = {};
            rawRows.forEach(r => {
                if (r.matchedChild && r.office?.id) {
                    const k = `${r.date}_${r.office.id}`;
                    groupKeys[k] = { date: r.date, officeId: r.office.id };
                }
            });

            // Fetch current reports in parallel
            const reportMap = {};
            await Promise.all(Object.values(groupKeys).map(async ({ date, officeId }) => {
                const rep = await cs({ action: 'getReport', date, officeId });
                reportMap[`${date}_${officeId}`] = rep;
            }));

            // Track regular counts per group to detect 11th+ children
            const groupCounters = {};
            Object.keys(reportMap).forEach(k => {
                const rep = reportMap[k];
                const existingChildren = rep?.children || [];
                const regularChildren = existingChildren.filter(c => !c.isPlaceholder && !c.isWaitlist && !c.isAbsent);
                groupCounters[k] = {
                    count: regularChildren.length,
                    existingRegularIds: new Set(regularChildren.map(c => c.id))
                };
            });

            // Enrich each row with duplicate and capacity analysis
            const enriched = rawRows.map(row => {
                if (!row.matchedChild || !row.office?.id) {
                    return { 
                        ...row, 
                        isExisting: false, 
                        conflictDetails: [], 
                        willBeWaitlistDueToCapacity: false 
                    };
                }
                const key = `${row.date}_${row.office.id}`;
                const rep = reportMap[key];
                const existingChildren = rep?.children || [];
                const existingChild = existingChildren.find(c => c.id === row.matchedChild.id);

                const isAbsentInCsv = row.status === '欠席';
                const isWaitlistInCsv = row.status === 'キャンセル待ち';

                // Check 11th+ child overflow logic
                let willBeWaitlistDueToCapacity = false;
                const gc = groupCounters[key];
                if (gc && !isAbsentInCsv && !isWaitlistInCsv) {
                    const isAlreadyRegular = gc.existingRegularIds.has(row.matchedChild.id);
                    if (!isAlreadyRegular) {
                        if (gc.count >= SLOT_LIMIT) {
                            willBeWaitlistDueToCapacity = true;
                        } else {
                            gc.count++;
                            gc.existingRegularIds.add(row.matchedChild.id);
                        }
                    }
                }

                if (!existingChild) {
                    const conflictDetails = [];
                    if (willBeWaitlistDueToCapacity) {
                        conflictDetails.push(`定員（${SLOT_LIMIT}名）超過のためキャンセル待ちに自動配置`);
                    }

                    return { 
                        ...row, 
                        isExisting: false, 
                        conflictDetails, 
                        enabled: true,
                        willBeWaitlistDueToCapacity
                    };
                }

                // Child already exists in DB for this date/office
                const existingTable = rep?.dailyTable?.[row.matchedChild.id] || {};
                const existingStatus = existingChild.isAbsent ? '欠席' : (existingChild.isWaitlist ? 'キャンセル待ち' : '通常');
                const existingLoc = existingTable.pickupLocation || '';
                const existingTime = existingTable.transportTime || '';
                const existingNotes = existingTable.notes || '';

                const diffs = [];
                if (existingStatus !== row.status) {
                    diffs.push(`ステータス: ${existingStatus} → ${row.status}`);
                }
                if (existingLoc !== (row.pickupLocation || '')) {
                    diffs.push(`迎場所: ${existingLoc || '未設定'} → ${row.pickupLocation || '未設定'}`);
                }
                if (existingTime !== (row.pickupTime || '')) {
                    diffs.push(`時間: ${existingTime || '未設定'} → ${row.pickupTime || '未設定'}`);
                }
                if (existingNotes !== (row.notes || '')) {
                    diffs.push(`備考差分あり`);
                }
                if (diffs.length === 0) {
                    diffs.push(`登録済（登録内容と同一）`);
                }
                if (willBeWaitlistDueToCapacity) {
                    diffs.push(`定員（${SLOT_LIMIT}名）超過のためキャンセル待ちに自動配置`);
                }

                return {
                    ...row,
                    isExisting: true,
                    existingInfo: {
                        status: existingStatus,
                        pickupLocation: existingLoc,
                        pickupTime: existingTime,
                        notes: existingNotes
                    },
                    conflictDetails: diffs,
                    willBeWaitlistDueToCapacity,
                    // Default enabled depends on current importMode
                    enabled: importMode === 'overwrite'
                };
            });

            setParsedRows(enriched);
        } catch (err) {
            console.error('Failed to check duplicates:', err);
            setParsedRows(rawRows);
        } finally {
            setIsCheckingDuplicates(false);
        }
    };

    const handleFile = (file) => {
        if (!file) return;
        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = async (e) => {
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
                    enabled: !!matchedChild, // Default: matched
                    isExisting: false,
                    conflictDetails: [],
                    willBeWaitlistDueToCapacity: false
                });
            }

            // Enrich with duplicate & capacity check
            await checkDuplicatesAndEnrich(rows);
        };
        reader.readAsText(file, 'UTF-8');
    };

    const handleModeChange = (newMode) => {
        setImportMode(newMode);
        setParsedRows(prev => prev.map(row => {
            if (!row.matchedChild) return row;
            if (row.isExisting) {
                return { ...row, enabled: newMode === 'overwrite' };
            }
            return row;
        }));
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
        let acquiredLock = false;
        const allOverflowChildren = [];

        try {
            // 1. 他端末操作防止のための排他ロック取得
            if (!sandboxOnly && firestore) {
                try {
                    const lockRef = doc(firestore, 'meta', 'importLock');
                    await setDoc(lockRef, {
                        isLocked: true,
                        lockedBy: user?.uid || 'import-operator',
                        userName: currentStaffName || user?.email || '管理者',
                        startedAt: new Date().toISOString(),
                        expiresAt: Date.now() + 5 * 60 * 1000 // 5分間有効のフェイルセーフ
                    });
                    acquiredLock = true;
                } catch (lockErr) {
                    console.warn('Could not acquire importLock:', lockErr);
                }
            }

            // Group active rows by Date and OfficeId
            const groups = {};
            activeRows.forEach(row => {
                const groupKey = `${row.date}_${row.office.id}`;
                if (!groups[groupKey]) {
                    groups[groupKey] = {
                        date: row.date,
                        officeId: row.office.id,
                        officeName: row.office.name,
                        rows: []
                    };
                }
                groups[groupKey].rows.push(row);
            });

            // Process each group
            for (const key of Object.keys(groups)) {
                const { date, officeId, officeName, rows } = groups[key];

                // Fetch current daily report
                const currentData = await cs({ action: 'getReport', date, officeId });
                const finalReport = currentData && typeof currentData === 'object' ? { ...currentData } : {};
                
                // Initialize sub structures
                const currentChildren = Array.isArray(finalReport.children) ? [...finalReport.children] : [];
                const currentTable = finalReport.dailyTable ? { ...finalReport.dailyTable } : {};
                const currentResults = finalReport.results ? { ...finalReport.results } : {};
                const currentMessages = finalReport.messages ? { ...finalReport.messages } : {};
                const currentGlobalLog = finalReport.globalLog || { admin: '', supervisor: '', notice: '', activities: '', programTitle: '', programSummary: '' };
                const currentChangeLogs = finalReport.changeLogs || [];

                // Track existing regular children for capacity limit (10)
                const existingRegularChildIds = new Set(
                    currentChildren
                        .filter(c => !c.isPlaceholder && !c.isWaitlist && !c.isAbsent)
                        .map(c => c.id)
                );
                let currentRegularCount = existingRegularChildIds.size;

                rows.forEach(row => {
                    const child = row.matchedChild;
                    const existingChildIndex = currentChildren.findIndex(c => c.id === child.id);

                    let isAbsent = row.status === '欠席';
                    let isWaitlist = row.status === 'キャンセル待ち';

                    // 11人目以降の定員超過自動振り分けロジック
                    if (!isAbsent && !isWaitlist) {
                        const isAlreadyRegular = existingRegularChildIds.has(child.id);

                        if (isAlreadyRegular) {
                            isWaitlist = false;
                        } else {
                            if (currentRegularCount >= SLOT_LIMIT) {
                                // 11人目以降：自動的にキャンセル待ちに配置
                                isWaitlist = true;
                                allOverflowChildren.push({
                                    childName: child.name,
                                    date,
                                    officeName: officeName || '事業所',
                                    orderNumber: currentRegularCount + 1
                                });
                            } else {
                                isWaitlist = false;
                                currentRegularCount++;
                                existingRegularChildIds.add(child.id);
                            }
                        }
                    }

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

                    // Save individual child communications
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

            // 11人目以降のキャンセル待ち振り分けがあった場合は通知
            if (allOverflowChildren.length > 0) {
                setOverflowNotice(allOverflowChildren);
            } else {
                alert(sandboxOnly ? 'CSVデータのデモ反映が完了しました（データベース保存無効中）' : 'CSVデータの取り込みが完了しました。');
                if (!sandboxOnly) {
                    onRefresh(); // Refresh screen
                }
                onClose();
            }
        } catch (error) {
            console.error(error);
            alert('インポート中にエラーが発生しました: ' + error.message);
        } finally {
            // 排他ロックを確実に解除
            if (acquiredLock && firestore) {
                try {
                    const lockRef = doc(firestore, 'meta', 'importLock');
                    await setDoc(lockRef, {
                        isLocked: false,
                        lockedBy: null,
                        userName: '',
                        expiresAt: 0
                    });
                } catch (unlockErr) {
                    console.error('Failed to release importLock:', unlockErr);
                }
            }
            setIsSaving(false);
        }
    };

    const matchedCount = parsedRows.filter(r => r.matchedChild).length;
    const existingCount = parsedRows.filter(r => r.matchedChild && r.isExisting).length;
    const newCount = parsedRows.filter(r => r.matchedChild && !r.isExisting).length;
    const unmatchedCount = parsedRows.filter(r => !r.matchedChild).length;
    const activeSelectedCount = parsedRows.filter(r => r.enabled && r.matchedChild).length;
    const capacityOverflowCount = parsedRows.filter(r => r.willBeWaitlistDueToCapacity).length;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 animate-in fade-in duration-300">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={onClose} />
            
            {/* Modal Box */}
            <div className="relative w-full max-w-5xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col border border-white animate-in zoom-in-95 duration-300 max-h-[90vh]">
                {/* Header */}
                <div className="p-5 md:p-6 bg-indigo-600 flex items-center justify-between shadow-lg flex-shrink-0 text-white">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-sm shadow-sm">
                            <FileSpreadsheet className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-base md:text-lg font-black tracking-wider">CSV送迎記録インポート</h2>
                            <p className="text-[10px] md:text-xs text-white/80 font-semibold mt-0.5">送迎表・乗車記録などのCSVファイルを読み込み、一括でスケジュールや備考を各事業所・日付に反映させます。</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/15 rounded-full transition-all cursor-pointer">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-grow p-4 md:p-6 overflow-y-auto min-h-0 flex flex-col gap-4 custom-scrollbar">
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
                                <p className="text-sm font-black text-slate-700">CSVファイルをドラッグ＆ドロップ、またはクリックして選択</p>
                                <p className="text-xs text-slate-400 font-bold mt-1.5">
                                    列の順番: 児童名, 日付, 利用事業所, ステータス, 乗車場所, 乗車時間, 備考
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Preview Area */}
                    {parsedRows.length > 0 && (
                        <div className="flex flex-col min-h-0 flex-grow gap-3">
                            {/* Capacity Overflow Alert Banner if 11th+ children detected */}
                            {capacityOverflowCount > 0 && (
                                <div className="p-3.5 bg-amber-500/10 border-2 border-amber-500/30 rounded-2xl flex items-start gap-3 text-amber-900 animate-in slide-in-from-top-2">
                                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                    <div className="flex-1 text-xs">
                                        <div className="font-black text-amber-800 text-[13px] flex items-center gap-1.5 mb-0.5">
                                            <span>定員（{SLOT_LIMIT}名枠）超過の児童が {capacityOverflowCount}名 検出されました</span>
                                        </div>
                                        <p className="text-amber-700 leading-relaxed font-bold">
                                            1つの日付・事業所において出席枠（通常児童）が10名を満たしているため、<span className="font-black underline underline-offset-2">11人目以降の児童は自動的に【キャンセル待ち】として登録</span>されます。インポート完了後にメイン画面の「キャンセル待ち」一覧よりご確認いただけます。
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Duplicate Policy & Stats Bar */}
                            <div className="flex flex-col gap-3 bg-slate-50 border border-slate-200/80 p-3.5 rounded-2xl flex-shrink-0">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    {/* Stats */}
                                    <div className="flex flex-wrap items-center gap-2 text-xs">
                                        <span className="font-bold text-slate-500 mr-1">ファイル: <span className="text-slate-800 font-black">{fileName}</span></span>
                                        <span className="flex items-center gap-1 font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> 新規追加: {newCount}名
                                        </span>
                                        {existingCount > 0 && (
                                            <span className="flex items-center gap-1 font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> 重複登録: {existingCount}名
                                            </span>
                                        )}
                                        {capacityOverflowCount > 0 && (
                                            <span className="flex items-center gap-1 font-black text-purple-700 bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-200">
                                                <Users className="w-3.5 h-3.5 text-purple-600" /> 定員超過待機: {capacityOverflowCount}名
                                            </span>
                                        )}
                                        {unmatchedCount > 0 && (
                                            <span className="flex items-center gap-1 font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200">
                                                <AlertTriangle className="w-3.5 h-3.5 text-rose-500" /> 未登録: {unmatchedCount}名
                                            </span>
                                        )}
                                        {isCheckingDuplicates && (
                                            <span className="flex items-center gap-1 text-slate-400 text-xs font-bold animate-pulse ml-2">
                                                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                                                既存重複・定員枠確認中...
                                            </span>
                                        )}
                                    </div>

                                    <button
                                        onClick={() => {
                                            setParsedRows([]);
                                            setFileName('');
                                        }}
                                        className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-600 font-bold rounded-xl border border-slate-200 transition-all cursor-pointer text-xs flex-shrink-0 shadow-sm"
                                    >
                                        ファイルを変更
                                    </button>
                                </div>

                                {/* Duplicate Policy Selection Buttons */}
                                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-black text-slate-700 flex items-center gap-1">
                                            <Filter className="w-3.5 h-3.5 text-indigo-600" />
                                            既存重複の処理方針:
                                        </span>
                                        <div className="inline-flex rounded-xl bg-slate-200/70 p-0.5 gap-0.5">
                                            <button
                                                type="button"
                                                onClick={() => handleModeChange('skip')}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                                                    importMode === 'skip'
                                                        ? 'bg-white text-indigo-700 shadow-sm'
                                                        : 'text-slate-600 hover:text-slate-800'
                                                }`}
                                            >
                                                <ShieldAlert className="w-3.5 h-3.5 text-emerald-600" />
                                                <span>かぶっている情報はスキップ</span>
                                                <span className="text-[10px] px-1.5 py-0.2 bg-emerald-100 text-emerald-700 rounded-full font-bold">推奨</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleModeChange('overwrite')}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                                                    importMode === 'overwrite'
                                                        ? 'bg-amber-600 text-white shadow-sm'
                                                        : 'text-slate-600 hover:text-slate-800'
                                                }`}
                                            >
                                                <RefreshCw className="w-3.5 h-3.5" />
                                                <span>すでにある情報は上書き</span>
                                            </button>
                                        </div>
                                    </div>

                                    <span className="text-[11px] font-bold text-slate-500">
                                        インポート対象: <span className="text-indigo-600 font-black text-xs">{activeSelectedCount}</span> / {parsedRows.length}名
                                    </span>
                                </div>
                            </div>

                            {/* Table */}
                            <div className="flex-grow border border-slate-200 rounded-2xl overflow-hidden flex flex-col min-h-0 bg-white">
                                <div className="overflow-auto flex-grow custom-scrollbar">
                                    <table className="w-full text-xs text-left border-collapse">
                                        <thead className="sticky top-0 bg-slate-100/90 backdrop-blur-sm border-b border-slate-200 z-10 font-black text-slate-600">
                                            <tr>
                                                <th className="p-2.5 text-center w-12">
                                                    <input
                                                        type="checkbox"
                                                        checked={parsedRows.length > 0 && parsedRows.filter(r => r.matchedChild).every(r => r.enabled)}
                                                        onChange={toggleAllEnabled}
                                                        className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
                                                    />
                                                </th>
                                                <th className="p-2.5 w-24">状態 / 重複</th>
                                                <th className="p-2.5 w-36">児童名 (CSV / DB)</th>
                                                <th className="p-2.5 w-24">日付</th>
                                                <th className="p-2.5 w-28">利用事業所</th>
                                                <th className="p-2.5 w-28">ステータス</th>
                                                <th className="p-2.5 w-28">迎え場所</th>
                                                <th className="p-2.5 w-20">時間</th>
                                                <th className="p-2.5">備考・重複/定員詳細</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                                            {parsedRows.map((row) => {
                                                const isSkipTarget = row.isExisting && importMode === 'skip';
                                                const isOverwriteTarget = row.isExisting && importMode === 'overwrite';

                                                return (
                                                    <tr
                                                        key={row.id}
                                                        className={`transition-colors ${
                                                            !row.matchedChild 
                                                                ? 'bg-rose-50/40 opacity-60' 
                                                                : isSkipTarget 
                                                                    ? 'bg-slate-50/80 text-slate-400' 
                                                                    : row.willBeWaitlistDueToCapacity
                                                                        ? 'bg-purple-50/40 hover:bg-purple-50/70'
                                                                        : isOverwriteTarget 
                                                                            ? 'bg-amber-50/40 hover:bg-amber-50/70' 
                                                                            : 'bg-white hover:bg-indigo-50/30'
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
                                                            {!row.matchedChild ? (
                                                                <span className="inline-flex items-center gap-1 text-[10px] font-black text-rose-600 bg-rose-100/70 px-2 py-0.5 rounded-full border border-rose-200">
                                                                    <AlertTriangle className="w-3 h-3" /> 未登録
                                                                </span>
                                                            ) : row.isExisting ? (
                                                                isSkipTarget ? (
                                                                    <span className="inline-flex items-center gap-1 text-[10px] font-black text-slate-500 bg-slate-200/80 px-2 py-0.5 rounded-full border border-slate-300" title="重複のためスキップされます">
                                                                        <ShieldAlert className="w-3 h-3 text-slate-500" /> 重複(スキップ)
                                                                    </span>
                                                                ) : (
                                                                    <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300" title="CSVデータで既存情報を上書きします">
                                                                        <RefreshCw className="w-3 h-3 text-amber-700" /> 重複(上書き)
                                                                    </span>
                                                                )
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-200">
                                                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> 新規
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="p-2">
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-[11px] text-slate-400">{row.originalName}</span>
                                                                {row.matchedChild ? (
                                                                    <span className={`font-black text-xs ${isSkipTarget ? 'text-slate-600' : 'text-slate-800'}`}>
                                                                        {row.matchedChild.name}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-rose-500 font-bold text-[10px]">
                                                                        マスター不一致
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="p-2 font-bold">{row.date}</td>
                                                        <td className="p-2">
                                                            <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-black text-[10px] border border-indigo-100">
                                                                {row.office?.name || '---'}
                                                            </span>
                                                        </td>
                                                        <td className="p-2">
                                                            {row.willBeWaitlistDueToCapacity ? (
                                                                <div className="flex flex-col gap-0.5">
                                                                    <span className="line-through text-slate-400 text-[10px]">通常</span>
                                                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-purple-100 text-purple-900 border border-purple-200 flex items-center gap-0.5">
                                                                        <Users className="w-3 h-3" /> キャンセル待ち
                                                                    </span>
                                                                </div>
                                                            ) : (
                                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                                                                    row.status === 'キャンセル待ち'
                                                                        ? 'bg-amber-100 text-amber-800'
                                                                        : row.status === '欠席'
                                                                        ? 'bg-rose-100 text-rose-800'
                                                                        : 'bg-slate-100 text-slate-800'
                                                                }`}>
                                                                    {row.status}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="p-2 font-bold">{row.pickupLocation || '---'}</td>
                                                        <td className="p-2 font-bold">{row.pickupTime || '---'}</td>
                                                        <td className="p-2">
                                                            <div className="flex flex-col gap-0.5 max-w-sm">
                                                                {row.notes && (
                                                                    <span className="text-slate-600 truncate font-medium" title={row.notes}>
                                                                        {row.notes}
                                                                    </span>
                                                                )}
                                                                {row.conflictDetails?.length > 0 && (
                                                                    <div className="flex flex-wrap gap-1 mt-0.5">
                                                                        {row.conflictDetails.map((detail, dIdx) => (
                                                                            <span 
                                                                                key={dIdx} 
                                                                                className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                                                                                    detail.includes('定員')
                                                                                        ? 'bg-purple-100 text-purple-800 border-purple-300 font-black'
                                                                                        : isSkipTarget
                                                                                            ? 'bg-slate-100 text-slate-500 border-slate-200'
                                                                                            : 'bg-amber-50 text-amber-800 border-amber-200'
                                                                                }`}
                                                                            >
                                                                                {detail}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 md:p-6 bg-white border-t border-slate-100 flex flex-col gap-3 flex-shrink-0">
                    <label className="flex items-center gap-2.5 p-3 bg-amber-50/60 hover:bg-amber-50/90 border border-amber-200/60 rounded-2xl cursor-pointer transition-colors select-none text-left">
                        <input 
                            type="checkbox"
                            checked={sandboxOnly}
                            onChange={(e) => setSandboxOnly(e.target.checked)}
                            className="w-4 h-4 rounded accent-amber-600 cursor-pointer flex-shrink-0"
                        />
                        <div className="flex flex-col">
                            <span className="text-xs font-black text-amber-800">データベースに保存せず、画面上でのみ動作検証する（デモモード）</span>
                            <span className="text-[10px] text-amber-700/80 font-bold">本番データベースに影響を与えずに、CSVインポートのマッチングや表示の動作確認が可能です（他端末ロックも実行されません）。</span>
                        </div>
                    </label>
                    <div className="flex items-center justify-between w-full">
                        <button
                            onClick={onClose}
                            disabled={isSaving}
                            className="px-5 py-2.5 font-bold text-xs text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                        >
                            キャンセル
                        </button>
                        {parsedRows.length > 0 && (
                            <button
                                onClick={handleSave}
                                disabled={isSaving || activeSelectedCount === 0}
                                className={`px-6 py-3 rounded-xl font-black text-xs shadow-md transition-all active:scale-95 flex items-center gap-2 tracking-wider cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                                    sandboxOnly 
                                        ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-200/50' 
                                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200/50'
                                }`}
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>取込処理中（他端末をロック中）...</span>
                                    </>
                                ) : (
                                    <>
                                        <Check className="w-4 h-4" />
                                        <span>
                                            {sandboxOnly 
                                                ? `デモ反映を実行 (${activeSelectedCount}名)` 
                                                : `${importMode === 'skip' ? '新規のみ反映して保存' : '既存上書き含めて反映して保存'} (${activeSelectedCount}名)`}
                                        </span>
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Capacity Overflow Notice Dialog */}
            {overflowNotice && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2rem] p-6 max-w-lg w-full shadow-2xl border border-slate-100 flex flex-col gap-4 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-purple-100 text-purple-700 rounded-2xl">
                                <Users className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-base font-black text-slate-800">定員超過（10名枠）による待機配置通知</h3>
                                <p className="text-xs text-slate-500 font-bold">CSVインポート処理は正常に完了しました</p>
                            </div>
                        </div>

                        <div className="bg-purple-50/70 border border-purple-200/70 rounded-2xl p-4 text-xs font-bold text-purple-900 leading-relaxed">
                            <p className="mb-2">
                                通常出席枠（10名）を満たしていたため、<span className="font-black text-purple-700 underline underline-offset-2">11人目以降となった以下の児童は自動的に【キャンセル待ち】として登録</span>されました：
                            </p>
                            <div className="max-h-40 overflow-y-auto space-y-1.5 custom-scrollbar bg-white/80 p-2.5 rounded-xl border border-purple-100">
                                {overflowNotice.map((c, i) => (
                                    <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-purple-50 last:border-none">
                                        <span className="font-black text-slate-800">{c.childName} 様</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-slate-500">{c.date} ({c.officeName})</span>
                                            <span className="text-[10px] font-black bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
                                                {c.orderNumber}人目・待機
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <p className="mt-3 text-[11px] text-purple-700 font-normal">
                                ※ メイン画面のテーブル下にある「キャンセル待ち」一覧から、必要に応じて状態の変更や確認を行えます。
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={() => {
                                setOverflowNotice(null);
                                if (!sandboxOnly) {
                                    onRefresh();
                                }
                                onClose();
                            }}
                            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs shadow-md transition-all active:scale-95 cursor-pointer"
                        >
                            確認しました（画面を更新）
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

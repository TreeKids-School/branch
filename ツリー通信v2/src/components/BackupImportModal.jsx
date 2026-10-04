import React, { useState, useRef, useEffect } from 'react';
import { X, FileSpreadsheet, Upload, CheckCircle2, AlertTriangle, Check, Loader2, CalendarDays, ShieldCheck } from 'lucide-react';
import { parseCSV, buildHeaderIndex, findChildByName } from '../utils/csv';
import { normalizeDate, mergeBackupRowsIntoReport } from '../utils/backup';
import './WorkflowModals.css';
import { columnText } from '../utils/communicationFlow';

/**
 * BackupImportModal
 * ─────────────────────────────────────────────────────────
 * 「バックアップCSV」を読み込み、1件ずつ確認してから取り込むモーダル。
 *
 * 重要な仕様:
 *   - CSVの「日付」列を尊重し、日付ごとに保存する（表示中の日だけに書かない）
 *   - CSVに含まれない児童のデータは一切変更しない（そのまま残す）
 *   - 「復元用データ」列があれば、メモ類も含めて完全に復元する
 */
export default function BackupImportModal({
    show,
    onClose,
    masterChildren = [],
    currentChildren = [],
    selectedDate,
    selectedOffice,
    cs,
    onRefresh, tagColumnMap, onDirtyChange,
}) {
    const [dragActive, setDragActive] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [registerUnknown, setRegisterUnknown] = useState(false);
    const [restoreDaily, setRestoreDaily] = useState(false);
    const [rows, setRows] = useState([]);
    const [fileName, setFileName] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [progress, setProgress] = useState('');
    const fileInputRef = useRef(null);

    useEffect(() => { onDirtyChange?.(isSaving); }, [isSaving, onDirtyChange]);
    useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
    if (!show) return null;

    const reset = () => { setRows([]); setFileName(''); setProgress(''); setErrorMessage(''); };

    const handleClose = () => { if (isSaving) return; reset(); onClose(); };

    // ── CSV 読み込み ──────────────────────────────────────
    const handleFile = (file) => {
        if (!file) return;
        if (isSaving) return;
        reset(); setFileName(file.name);
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const table = parseCSV(e.target.result);
                if (table.length <= 1) {
                    alert('CSVファイルが空か、ヘッダー行しかありません。');
                    return;
                }
                const H = buildHeaderIndex(table[0]);
                const col = (r, key) => (H[key] !== undefined ? (r[H[key]] || '') : '');

                const parsed = [];
                for (let i = 1; i < table.length; i++) {
                    const r = table[i];
                    const csvName = String(col(r, '児童名')).trim();
                    if (!csvName) continue;

                    const date = col(r, '日付') ? normalizeDate(col(r, '日付')) : selectedDate;
                    let invalid = !date ? '日付が不正です' : '';
                    const matchedChild = findChildByName(csvName, currentChildren, masterChildren);

                     // 復元用データ（あれば完全復元、無ければ主要4項目のみ）
                     let restore = null;
                     const raw = col(r, '復元用データ');
                     if (raw && String(raw).trim().startsWith('{')) {
                         try { restore = JSON.parse(raw); if (!restore || Array.isArray(restore)) invalid = '復元用データが不正です'; } catch { invalid = '復元用データを読み込めません'; }
                     }

                     if (raw && !restore) invalid = '復元用データが不正です';
                     if (restore && ((restore.m && !Array.isArray(restore.m)) || (restore.r && (typeof restore.r !== 'object' || Array.isArray(restore.r))) || (restore.t && (typeof restore.t !== 'object' || Array.isArray(restore.t))))) invalid = '復元用データの形式が不正です';
                     // 日次データ（あれば復元）
                     let dailyData = null;
                     const rawDaily = col(r, '日次データ');
                     if (rawDaily && String(rawDaily).trim().startsWith('{')) {
                         try { dailyData = JSON.parse(rawDaily); } catch { invalid = '日次データを読み込めません'; }
                     }

                     if (rawDaily && (!dailyData || typeof dailyData !== 'object' || Array.isArray(dailyData))) invalid = '日次データが不正です';
                     parsed.push({
                         id: `${i}-${date}-${csvName}`, invalid,
                         csvName,
                         date,
                         matchedChild,
                         restore,
                         dailyData,
                         presentFields: { study: H['学習'] !== undefined, program: H['プログラム'] !== undefined, treeComm: H['ツリー通信'] !== undefined, futurePlan: H['今後の予定'] !== undefined, notes: H['備考'] !== undefined, transportTime: H['送迎時間'] !== undefined, endTime: H['終了時間'] !== undefined, pickupLocation: H['迎え場所'] !== undefined },
                         futurePlan: col(r, '今後の予定'), notes: col(r, '備考'),
                         study: col(r, '学習'),
                         program: col(r, 'プログラム'),
                         treeComm: col(r, 'ツリー通信'),
                         transportTime: col(r, '送迎時間'),
                         endTime: col(r, '終了時間'),
                         pickupLocation: col(r, '迎え場所'),
                         enabled: !invalid,
                     });
                 }

                if (parsed.length === 0) {
                    alert('取り込める行が見つかりませんでした。ヘッダーに「児童名」列があるかご確認ください。');
                    return;
                }

                parsed.sort((a, b) => (a.date === b.date ? a.csvName.localeCompare(b.csvName, 'ja') : a.date.localeCompare(b.date)));
                setRows(parsed);
            } catch (err) {
                console.error('Backup CSV parse error:', err);
                alert('CSVの読み込みに失敗しました: ' + err.message);
            }
        };
        reader.onerror = () => setErrorMessage('ファイルを読み込めませんでした。');
        reader.readAsText(file, 'UTF-8');
    };

    const handleDrag = (e) => {
        e.preventDefault(); e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
        else if (e.type === 'dragleave') setDragActive(false);
    };
    const handleDrop = (e) => {
        e.preventDefault(); e.stopPropagation(); setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    };

    // ── 選択操作 ─────────────────────────────────────────
    const toggleRow = (id) => setRows(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
    const toggleAll = () => {
        const anyDisabled = rows.some(r => !r.enabled);
        setRows(prev => prev.map(r => ({ ...r, enabled: !r.invalid && anyDisabled })));
    };
    const toggleDate = (date) => {
        const targets = rows.filter(r => r.date === date);
        const anyDisabled = targets.some(r => !r.enabled);
        setRows(prev => prev.map(r => (r.date === date) ? { ...r, enabled: !r.invalid && anyDisabled } : r));
    };

    // ── 保存 ─────────────────────────────────────────────
    const handleSave = async () => {
        if (isSaving) return;
        const active = rows.filter(row => row.enabled && !row.invalid).map(row => ({ ...row }));
        const eligible = registerUnknown ? active : active.filter(row => row.matchedChild);
        if (!eligible.length) { setErrorMessage('復元対象がありません。児童の照合と選択を確認してください。'); return; }
        const officeId = selectedOffice?.id;
        if (!officeId) { setErrorMessage('事業所を選択してください。'); return; }
        const dates = [...new Set(eligible.map(row => row.date))].sort();
        const unknownNames = [...new Set(eligible.filter(row => !row.matchedChild).map(row => row.csvName))];
        // All destructive choices are confirmed before the first write, including child registration.
        if (!window.confirm(`${selectedOffice.name} / ${dates.length}日分・${eligible.length}件を復元します。\n対象日: ${dates.join('、')}\n選択児童の記録を上書きし、選択していない児童は保持します。\n${unknownNames.length ? `未登録${unknownNames.length}名を新規登録します。\n` : ''}${restoreDaily ? '日誌の全体記録も復元します。' : '日誌の全体記録は変更しません。'}`)) return;
        setIsSaving(true); setErrorMessage('');
        let saved = 0; const savedDates = [];
        try {
            for (const name of unknownNames) {
                setProgress(`${name} を児童マスターへ登録中…`);
                const newChild = { id: `child_${crypto.randomUUID()}`, name, lastName: name, firstName: '', createdAt: new Date().toISOString() };
                await cs({ action: 'saveMasterChildren', data: newChild });
                eligible.forEach(row => { if (row.csvName === name) row.matchedChild = newChild; });
                // Retain successful registrations if a later day fails; retries must not duplicate children.
                setRows(prev => prev.map(row => row.csvName === name ? { ...row, matchedChild: newChild } : row));
            }
            for (const date of dates) {
                setProgress(`${date} を保存中… (${savedDates.length + 1}/${dates.length})`);
                const dayRows = eligible.filter(row => row.date === date);
                await cs({ action: 'commitDailyMutation', date, officeId,
                    syncChildIds: dayRows.map(row => row.matchedChild.id),
                    deriveRemarks: (messages, id, report) => [columnText(messages, 'remarks', tagColumnMap), report.dailyTable?.[id]?.notes || ''].filter(Boolean).join(' / '),
                    mutate: current => {
                        const { data } = mergeBackupRowsIntoReport(current, dayRows, Date.now(), tagColumnMap);
                        const daily = restoreDaily && dayRows.find(row => row.dailyData)?.dailyData;
                        if (daily) {
                            if (Object.prototype.hasOwnProperty.call(daily, 'summaryC')) data.summaryC = daily.summaryC;
                            if (daily.globalLog) data.globalLog = { ...(data.globalLog || {}), ...daily.globalLog };
                        }
                        return data;
                    }
                });
                saved += dayRows.length; savedDates.push(date);
                setRows(prev => prev.map(row => dayRows.some(done => done.id === row.id) ? { ...row, enabled: false } : row));
            }
            await onRefresh?.();
            alert(`${savedDates.length}日分 / ${saved}件の復元を保存しました。${rows.length - eligible.length}件は変更していません。`);
            reset(); onClose();
        } catch (error) {
            setErrorMessage(`${savedDates.length}日分（${savedDates.join('、') || '保存済みの日付なし'}）の処理後に停止しました。保存済みの行は選択を外しています。${error.message || ''}`);
            await onRefresh?.();
        } finally { setIsSaving(false); setProgress(''); }
    };

    // ── 集計 ─────────────────────────────────────────────
    const matchedCount = rows.filter(r => r.matchedChild).length;
    const unmatchedCount = rows.length - matchedCount;
    const selectedCount = rows.filter(r => r.enabled).length;
    const dateCount = new Set(rows.filter(r => r.enabled).map(r => r.date)).size;
    const restoreCount = rows.filter(r => r.restore).length;

    return (
        <div className="io-modal fixed inset-0 z-[110] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={handleClose} />

            <div className="relative w-full max-w-5xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col border border-white animate-in zoom-in-95 duration-300 max-h-[88vh]">
                {/* Header */}
                <div className="p-6 bg-tree-600 flex items-center justify-between shadow-lg flex-shrink-0 text-white">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                            <FileSpreadsheet className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-base font-black tracking-wider">バックアップから復元</h2>
                            <p className="text-[10px] text-white/70 font-semibold mt-0.5">
                                CSVの日付ごとに復元します。CSVに含まれない児童のデータはそのまま残ります。
                            </p>
                        </div>
                    </div>
                    <button onClick={handleClose} disabled={isSaving} className="p-2 hover:bg-white/10 rounded-full transition-all cursor-pointer disabled:opacity-40">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-grow p-6 overflow-y-auto min-h-0 flex flex-col gap-4">
                    <div className="io-status">復元先: {selectedOffice?.name} / ファイルの日付ごとに保存します。</div>
                    {errorMessage && <div className="workflow-error" role="alert">{errorMessage}</div>}
                    {rows.length > 0 && <div className="io-selection-summary">
                        <p>選択 {selectedCount}件 · {dateCount}日分。選択児童の記録を上書きします。</p>
                        {unmatchedCount > 0 && <label className="flex items-center gap-3 py-3"><input type="checkbox" checked={registerUnknown} disabled={isSaving} onChange={e => setRegisterUnknown(e.target.checked)}/>未登録児童を新規登録して復元する（外すとスキップ）</label>}
                        {rows.some(row => row.dailyData) && <label className="flex items-center gap-3 py-3"><input type="checkbox" checked={restoreDaily} disabled={isSaving} onChange={e => setRestoreDaily(e.target.checked)}/>選択日の全体記録・特記・共有事項・プログラムも復元する</label>}
                        <p>CSVにない児童は保持します。日付ごとに保存するため、途中で停止すると一部の日付だけ復元される場合があります。</p>
                    </div>}
                    {rows.length === 0 ? (
                        <div
                            onDragEnter={handleDrag} onDragOver={handleDrag} onDragLeave={handleDrag} onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className={`border-2 border-dashed rounded-3xl p-12 text-center transition-all duration-300 cursor-pointer flex flex-col items-center justify-center gap-3 ${
                                dragActive ? 'border-tree-500 bg-tree-50/50 scale-[0.99]' : 'border-slate-200 hover:border-tree-400 hover:bg-slate-50/50'
                            }`}
                        >
                            <input ref={fileInputRef} type="file" accept=".csv" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} className="hidden" />
                            <div className="p-4 bg-tree-50 text-tree-600 rounded-full animate-bounce">
                                <Upload className="w-8 h-8" />
                            </div>
                            <div>
                                <p className="text-xs font-black text-slate-700">バックアップCSVをドラッグ＆ドロップ、またはクリックして選択</p>
                                <p className="text-[10px] text-slate-400 font-bold mt-1">
                                    「エクスポート → CSVでエクスポート」で書き出したファイルを選んでください
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col min-h-0 flex-grow gap-3">
                            {/* Stats */}
                            <div className="flex flex-wrap justify-between items-center gap-3 bg-slate-50 border border-slate-100 p-3 rounded-2xl flex-shrink-0 text-xs">
                                <div className="flex items-center gap-4 flex-wrap">
                                    <span className="font-bold text-slate-500">ファイル: <span className="text-slate-800 font-black">{fileName}</span></span>
                                    <span className="flex items-center gap-1 font-bold text-tree-600">
                                        <CalendarDays className="w-3.5 h-3.5" /> {dateCount}日分
                                    </span>
                                    <span className="flex items-center gap-1 font-bold text-emerald-600">
                                        <CheckCircle2 className="w-3.5 h-3.5" /> 選択: {selectedCount}件
                                    </span>
                                    {restoreCount > 0 && (
                                        <span className="flex items-center gap-1 font-bold text-indigo-600">
                                            <ShieldCheck className="w-3.5 h-3.5" /> 復元データあり: {restoreCount}件
                                        </span>
                                    )}
                                    {unmatchedCount > 0 && (
                                        <span className="flex items-center gap-1 font-bold text-amber-500">
                                            <AlertTriangle className="w-3.5 h-3.5" /> 未登録: {unmatchedCount}件
                                        </span>
                                    )}
                                </div>
                                <button onClick={reset} disabled={isSaving} className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-500 font-bold rounded-lg border border-slate-200 transition-all cursor-pointer disabled:opacity-40">
                                    ファイルを変更
                                </button>
                            </div>

                            {/* Table */}
                            <div className="flex-grow border border-slate-200 rounded-2xl overflow-hidden flex flex-col min-h-0">
                                <div className="overflow-auto flex-grow custom-scrollbar-thin">
                                    <table className="w-full text-xs text-left border-collapse">
                                        <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 z-10 font-black text-slate-500">
                                            <tr>
                                                <th className="p-2.5 text-center w-12">
                                                    <input
                                                        type="checkbox"
                                                        checked={rows.length > 0 && rows.every(r => r.enabled)}
                                                        onChange={toggleAll}
                                                        className="w-4 h-4 rounded accent-tree-600 cursor-pointer"
                                                    />
                                                </th>
                                                <th className="p-2.5 w-28">日付</th>
                                                <th className="p-2.5 w-36">児童名 (CSV / DB)</th>
                                                <th className="p-2.5 w-24">復元方法</th>
                                                <th className="p-2.5">ツリー通信（先頭）</th>
                                                <th className="p-2.5 w-40">学習 / プログラム</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                                            {rows.map((r, idx) => {
                                                const isNewDate = idx === 0 || rows[idx - 1].date !== r.date;
                                                return (
                                                    <tr key={r.id} className={`hover:bg-slate-50/50 ${!r.matchedChild ? 'bg-amber-50/30' : 'bg-white'}`}>
                                                        <td data-label="復元対象" className="p-2 text-center">
                                                            <input
                                                                type="checkbox"
                                                                aria-label={`${r.csvName} ${r.date}を復元対象にする`} checked={r.enabled}
                                                                disabled={isSaving || !!r.invalid}
                                                                onChange={() => toggleRow(r.id)}
                                                                className="w-4 h-4 rounded accent-tree-600 cursor-pointer disabled:opacity-30"
                                                            />
                                                        </td>
                                                        <td data-label="日付" className="p-2 text-slate-500 font-bold">
                                                            {isNewDate ? (
                                                                <button
                                                                    onClick={() => toggleDate(r.date)}
                                                                    disabled={isSaving}
                                                                    className="px-2 py-0.5 bg-tree-50 text-tree-700 rounded-full font-black text-[10px] hover:bg-tree-100 transition-all"
                                                                    title="この日をまとめて選択／解除"
                                                                >
                                                                    {r.date}
                                                                </button>
                                                            ) : (
                                                                <span className="text-slate-500 text-[10px] pl-2">{r.date}</span>
                                                            )}
                                                        </td>
                                                        <td data-label="児童" className="p-2">
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-[11px] text-slate-500">{r.csvName}</span>
                                                                {r.matchedChild ? (
                                                                    <span className="text-emerald-700 font-black text-xs">✓ {r.matchedChild.name}</span>
                                                                ) : (
                                                                    <span className="text-amber-500 font-black text-[9px] flex items-center gap-0.5" title="新規登録するか、スキップするかを上の欄で指定します">
                                                                        <AlertTriangle className="w-3 h-3 flex-shrink-0" /> 未登録（選択が必要）
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td data-label="復元方法" className="p-2">
                                                            {r.invalid ? <span className="text-red-600">{r.invalid}</span> : r.restore ? (
                                                                <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 text-[9px] font-black">復元データあり</span>
                                                            ) : (
                                                                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[9px] font-black" title="復元用データ列が無いCSVです">主要項目のみ</span>
                                                            )}
                                                        </td>
                                                        <td data-label="ツリー通信" className="p-2 text-slate-600 font-medium">
                                                            <div className="max-h-[42px] overflow-hidden text-[11px] leading-snug whitespace-pre-wrap break-all">
                                                                {r.treeComm || <span className="text-slate-300 italic">（なし）</span>}
                                                            </div>
                                                        </td>
                                                        <td data-label="学習・プログラム" className="p-2 text-slate-500 font-bold text-[10px] whitespace-pre-wrap break-all">
                                                            {[r.study, r.program].filter(Boolean).join(' / ') || '---'}
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
                <div className="p-6 bg-white border-t border-slate-100 flex items-center justify-between gap-4 flex-shrink-0">
                    <div className="text-[10px] font-bold text-slate-400 leading-relaxed">
                        {isSaving
                            ? <span className="text-tree-600 font-black">{progress}</span>
                            : 'CSVに含まれない児童のデータは変更されません。'}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={handleClose} disabled={isSaving} className="px-5 py-2.5 font-bold text-xs text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all cursor-pointer disabled:opacity-40">
                            キャンセル
                        </button>
                        {rows.length > 0 && (
                            <button
                                onClick={handleSave}
                                disabled={isSaving || selectedCount === 0}
                                className="px-6 py-3 rounded-xl font-black text-xs shadow-md transition-all active:scale-95 flex items-center gap-2 uppercase tracking-widest cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed bg-tree-600 hover:bg-tree-700 text-white shadow-tree-100"
                            >
                                {isSaving ? (<><Loader2 className="w-4 h-4 animate-spin" /><span>処理中...</span></>)
                                    : (<><Check className="w-4 h-4" /><span>{selectedCount}件を復元</span></>)}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

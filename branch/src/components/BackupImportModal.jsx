import React, { useState, useRef } from 'react';
import { X, FileSpreadsheet, Upload, CheckCircle2, AlertTriangle, Check, Loader2, CalendarDays, ShieldCheck } from 'lucide-react';
import { parseCSV, buildHeaderIndex, findChildByName } from '../utils/csv';
import { normalizeDate, mergeBackupRowsIntoReport } from '../utils/backup';

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
    onRefresh,
}) {
    const [dragActive, setDragActive] = useState(false);
    const [rows, setRows] = useState([]);
    const [fileName, setFileName] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [progress, setProgress] = useState('');
    const fileInputRef = useRef(null);

    if (!show) return null;

    const reset = () => { setRows([]); setFileName(''); setProgress(''); };

    const handleClose = () => { if (isSaving) return; reset(); onClose(); };

    // ── CSV 読み込み ──────────────────────────────────────
    const handleFile = (file) => {
        if (!file) return;
        setFileName(file.name);
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

                    const date = normalizeDate(col(r, '日付')) || selectedDate;
                    const matchedChild = findChildByName(csvName, currentChildren, masterChildren);

                     // 復元用データ（あれば完全復元、無ければ主要4項目のみ）
                     let restore = null;
                     const raw = col(r, '復元用データ');
                     if (raw && String(raw).trim().startsWith('{')) {
                         try { restore = JSON.parse(raw); } catch { restore = null; }
                     }

                     // 日次データ（あれば復元）
                     let dailyData = null;
                     const rawDaily = col(r, '日次データ');
                     if (rawDaily && String(rawDaily).trim().startsWith('{')) {
                         try { dailyData = JSON.parse(rawDaily); } catch { dailyData = null; }
                     }

                     parsed.push({
                         id: `${i}-${date}-${csvName}`,
                         csvName,
                         date,
                         matchedChild,
                         restore,
                         dailyData,
                         study: col(r, '学習'),
                         program: col(r, 'プログラム'),
                         treeComm: col(r, 'ツリー通信'),
                         transportTime: col(r, '送迎時間'),
                         endTime: col(r, '終了時間'),
                         pickupLocation: col(r, '迎え場所'),
                         enabled: true,
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
        setRows(prev => prev.map(r => ({ ...r, enabled: anyDisabled })));
    };
    const toggleDate = (date) => {
        const targets = rows.filter(r => r.date === date);
        const anyDisabled = targets.some(r => !r.enabled);
        setRows(prev => prev.map(r => (r.date === date) ? { ...r, enabled: anyDisabled } : r));
    };

    // ── 保存 ─────────────────────────────────────────────
    const handleSave = async () => {
        let active = rows.filter(r => r.enabled);
        if (active.length === 0) { alert('取り込む行が選択されていません。'); return; }

        const officeId = selectedOffice?.id;
        if (!officeId) { alert('事業所が選択されていません。'); return; }

        setIsSaving(true);

        // 未登録児童の自動登録プロセス
        const unregisteredNames = [...new Set(active.filter(r => !r.matchedChild).map(r => r.csvName))];
        if (unregisteredNames.length > 0) {
            const autoRegister = window.confirm(
                `移行先の児童マスターに登録されていない児童が ${unregisteredNames.length} 名検出されました：\n` +
                `${unregisteredNames.slice(0, 10).join(', ')}${unregisteredNames.length > 10 ? ' ほか' : ''}\n\n` +
                `これらの児童を児童マスターに自動で新規登録してインポートを進めますか？\n` +
                `（「キャンセル」を選択した場合、未登録の児童のデータはスキップされます）`
            );

            if (autoRegister) {
                setProgress('未登録児童を登録中...');
                try {
                    for (const name of unregisteredNames) {
                        const newChildId = 'child_' + Math.random().toString(36).substring(2, 15);
                        const newChild = {
                            id: newChildId,
                            name: name,
                            lastName: name.substring(0, 1) || '',
                            firstName: name.substring(1) || '',
                            createdAt: new Date().toISOString()
                        };
                        await cs({ action: 'saveMasterChildren', data: newChild });

                        // メモリ上の matchedChild を更新
                        active.forEach(r => {
                            if (r.csvName === name) {
                                r.matchedChild = newChild;
                            }
                        });
                    }
                } catch (err) {
                    console.error('Auto register child error:', err);
                    alert('児童の自動登録中にエラーが発生しました: ' + err.message);
                    setIsSaving(false);
                    setProgress('');
                    return;
                }
            }
        }

        // matchedChild がある有効な行に絞り込む
        const finalActive = active.filter(r => r.matchedChild);
        if (finalActive.length === 0) {
            alert('取り込む行がありません。');
            setIsSaving(false);
            setProgress('');
            return;
        }

        const dates = [...new Set(finalActive.map(r => r.date))].sort();
        const ok = window.confirm(
            `${dates.length}日分・${finalActive.length}件を取り込みます。\n\n` +
            `対象日: ${dates.slice(0, 5).join(' / ')}${dates.length > 5 ? ` ほか${dates.length - 5}日` : ''}\n\n` +
            `※ これらの日の「選択した児童」のデータは上書きされます。\n` +
            `※ CSVに含まれない児童のデータはそのまま残ります。\n` +
            `※ 取り消しはできません。`
        );
        if (!ok) {
            setIsSaving(false);
            setProgress('');
            return;
        }

        let saved = 0;
        try {
            for (let di = 0; di < dates.length; di++) {
                const date = dates[di];
                setProgress(`${date} を保存中... (${di + 1}/${dates.length})`);

                const current = await cs({ action: 'getReport', date, officeId });

                // CSVに含まれない児童のデータには一切触れずにマージする
                const { data, applied } = mergeBackupRowsIntoReport(
                    current,
                    finalActive.filter(r => r.date === date)
                );
                saved += applied;

                // 日次データ (summaryC / globalLog) の復元
                const rowWithDaily = finalActive.find(r => r.date === date && r.dailyData);
                if (rowWithDaily && rowWithDaily.dailyData) {
                    const dailyPatch = rowWithDaily.dailyData;
                    if (dailyPatch.summaryC) {
                        data.summaryC = dailyPatch.summaryC;
                    }
                    if (dailyPatch.globalLog) {
                        data.globalLog = {
                            ...(data.globalLog || {}),
                            ...dailyPatch.globalLog
                        };
                    }
                }

                await cs({ action: 'saveReport', date, officeId, data });
            }

            const skipped = rows.length - finalActive.length;
            alert(
                `取り込みが完了しました。\n\n` +
                `・${dates.length}日分 / ${saved}件を取り込みました\n` +
                `・${skipped}件はスキップしました（未選択または未登録の児童）`
            );
            reset();
            if (onRefresh) onRefresh();
            onClose();
        } catch (error) {
            console.error('Backup import error:', error);
            alert('取り込み中にエラーが発生しました: ' + error.message);
        } finally {
            setIsSaving(false);
            setProgress('');
        }
    };

    // ── 集計 ─────────────────────────────────────────────
    const matchedCount = rows.filter(r => r.matchedChild).length;
    const unmatchedCount = rows.length - matchedCount;
    const selectedCount = rows.filter(r => r.enabled).length;
    const dateCount = new Set(rows.filter(r => r.enabled).map(r => r.date)).size;
    const restoreCount = rows.filter(r => r.restore).length;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 animate-in fade-in duration-300">
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
                                            <ShieldCheck className="w-3.5 h-3.5" /> 完全復元可: {restoreCount}件
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
                                                        <td className="p-2 text-center">
                                                            <input
                                                                type="checkbox"
                                                                checked={r.enabled}
                                                                disabled={isSaving}
                                                                onChange={() => toggleRow(r.id)}
                                                                className="w-4 h-4 rounded accent-tree-600 cursor-pointer disabled:opacity-30"
                                                            />
                                                        </td>
                                                        <td className="p-2 text-slate-500 font-bold">
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
                                                                <span className="text-slate-300 text-[10px] pl-2">〃</span>
                                                            )}
                                                        </td>
                                                        <td className="p-2">
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-[11px] text-slate-500">{r.csvName}</span>
                                                                {r.matchedChild ? (
                                                                    <span className="text-emerald-700 font-black text-xs">✓ {r.matchedChild.name}</span>
                                                                ) : (
                                                                    <span className="text-amber-500 font-black text-[9px] flex items-center gap-0.5" title="インポート実行時に児童マスターへ自動登録されます">
                                                                        <AlertTriangle className="w-3 h-3 flex-shrink-0" /> 未登録（自動作成）
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="p-2">
                                                            {r.restore ? (
                                                                <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 text-[9px] font-black">完全復元</span>
                                                            ) : (
                                                                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[9px] font-black" title="復元用データ列が無いCSVです">主要項目のみ</span>
                                                            )}
                                                        </td>
                                                        <td className="p-2 text-slate-600 font-medium">
                                                            <div className="max-h-[42px] overflow-hidden text-[11px] leading-snug whitespace-pre-wrap break-all">
                                                                {r.treeComm || <span className="text-slate-300 italic">（なし）</span>}
                                                            </div>
                                                        </td>
                                                        <td className="p-2 text-slate-500 font-bold text-[10px] whitespace-pre-wrap break-all">
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

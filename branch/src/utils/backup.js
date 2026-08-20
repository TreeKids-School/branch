// ── バックアップ復元ロジック ──────────────────────────────────────────────────
// 画面（BackupImportModal）から切り出した純粋な処理。
// 「CSVに含まれない児童のデータは絶対に触らない」ことをここで保証する。

/**
 * 日付文字列を YYYY-MM-DD に正規化する。
 * Excel で開くと "2026/8/8" のように書き換わることがあるため必須。
 * 解釈できない場合は '' を返す。
 */
export function normalizeDate(input) {
    const s = String(input || '').trim();
    if (!s) return '';
    const clean = s.replace(/[年月./]/g, '-').replace(/日/g, '').replace(/-+$/, '');
    const parts = clean.split('-').filter(p => p !== '');
    if (parts.length !== 3) return '';
    let [y, m, d] = parts;
    if (!/^\d{1,4}$/.test(y) || !/^\d{1,2}$/.test(m) || !/^\d{1,2}$/.test(d)) return '';
    if (y.length <= 2) y = String(2000 + Number(y));
    if (y.length !== 4) return '';
    const mm = m.padStart(2, '0');
    const dd = d.padStart(2, '0');
    if (Number(mm) < 1 || Number(mm) > 12 || Number(dd) < 1 || Number(dd) > 31) return '';
    return `${y}-${mm}-${dd}`;
}

/**
 * 1日分のレポートに、その日のCSV行をマージした「保存用データ」を作る。
 *
 * 保証すること:
 *   - CSVに出てこない児童の results / messages / dailyTable は一切変更しない
 *   - 勤怠・特記事項・共有事項・変更履歴など、他の項目もそのまま維持する
 *   - CSVにあってその日のリストに居ない児童は、リストに追加する
 *
 * @param {object|null} report  その日の既存レポート（無ければ null）
 * @param {Array} rows          その日ぶんの取り込み対象行
 * @param {number} now          timestamp（テスト用に外から渡せるように）
 * @returns {{data: object, applied: number}}
 */
export function mergeBackupRowsIntoReport(report, rows, now = Date.now()) {
    const base = (report && typeof report === 'object') ? report : {};

    const children = Array.isArray(base.children) ? [...base.children] : [];
    const results = base.results ? { ...base.results } : {};
    const messages = base.messages ? { ...base.messages } : {};
    const dailyTable = base.dailyTable ? { ...base.dailyTable } : {};

    let applied = 0;

    rows.forEach(r => {
        const child = r.matchedChild;
        if (!child || !child.id) return;

        // その日のリストに居なければ追加（居る場合は既存のまま触らない）
        if (!children.some(c => c && c.id === child.id)) {
            children.push({ ...child, timestamp: now });
        }

        if (r.restore) {
            if (Array.isArray(r.restore.m)) messages[child.id] = r.restore.m;
            if (r.restore.r && typeof r.restore.r === 'object') {
                results[child.id] = { ...(results[child.id] || {}), ...r.restore.r };
            }
            if (r.restore.t && typeof r.restore.t === 'object') {
                dailyTable[child.id] = { ...(dailyTable[child.id] || {}), ...r.restore.t };
            }
        } else {
            // 復元用データ列が無い旧CSV: 主要項目のみ
            if (r.treeComm) {
                results[child.id] = { ...(results[child.id] || {}), D: r.treeComm };
            }
            const patch = {
                ...(r.transportTime ? { transportTime: r.transportTime } : {}),
                ...(r.endTime ? { endTime: r.endTime } : {}),
                ...(r.pickupLocation ? { pickupLocation: r.pickupLocation } : {}),
            };
            if (Object.keys(patch).length > 0) {
                dailyTable[child.id] = { ...(dailyTable[child.id] || {}), ...patch };
            }
        }
        applied++;
    });

    return {
        applied,
        data: {
            children,
            results,
            messages,
            dailyTable,
            // 以下は既存の値をそのまま引き継ぐ（消さないため必ず含める）
            summaryC: base.summaryC || '',
            globalLog: base.globalLog || { admin: '', supervisor: '', notice: '', activities: '', programTitle: '', programSummary: '' },
            changeLogs: base.changeLogs || [],
            updatedAt: new Date(now).toISOString(),
        },
    };
}

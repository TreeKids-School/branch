// ── CSV ユーティリティ ────────────────────────────────────────────────────────
// 引用符の中にある「改行」「カンマ」「""」を正しく扱う RFC4180 準拠のパーサ。
// 旧実装は行を先に改行で分割していたため、ツリー通信のような複数行テキストが
// 混ざると行が分裂して読み込めなかった。

/**
 * CSV文字列を 2次元配列にパースする。
 * - 引用符内の改行 / カンマ / エスケープされた二重引用符("") に対応
 * - CRLF / LF どちらの改行にも対応
 * - 全セルが空の行は除去
 */
export function parseCSV(text) {
    const src = String(text || '').replace(/^﻿/, '');
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;
    let i = 0;

    while (i < src.length) {
        const ch = src[i];

        if (inQuotes) {
            if (ch === '"') {
                if (src[i + 1] === '"') { field += '"'; i += 2; continue; }
                inQuotes = false; i++; continue;
            }
            // 引用符の中の改行は本文として保持する（CRLF は LF に正規化）
            if (ch === '\r') {
                field += '\n';
                i += (src[i + 1] === '\n') ? 2 : 1;
                continue;
            }
            field += ch; i++; continue;
        }

        if (ch === '"') { inQuotes = true; i++; continue; }
        if (ch === ',') { row.push(field); field = ''; i++; continue; }
        if (ch === '\r') { i++; continue; }
        if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }

        field += ch; i++;
    }

    row.push(field);
    rows.push(row);

    return rows.filter(r => r.some(c => String(c).trim() !== ''));
}

/** 2次元配列を CSV 文字列に変換する（全セルを引用符で囲む安全な形式） */
export function toCSV(rows) {
    return rows
        .map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
        .join('\r\n');
}

/** 照合用に名前を正規化（半角/全角スペースを除去） */
export function normalizeName(s) {
    return String(s || '').replace(/[\s　]/g, '');
}

/**
 * 名前から児童を探す。
 * - 空白を無視
 * - 「姓+名」の連結でも照合
 * 複数のリストを渡せる（先に渡したリストを優先）。
 */
export function findChildByName(name, ...lists) {
    const target = normalizeName(name);
    if (!target) return null;
    for (const list of lists) {
        if (!Array.isArray(list)) continue;
        const hit = list.find(c => {
            if (!c) return false;
            const full = normalizeName(c.name);
            const joined = normalizeName(`${c.lastName || ''}${c.firstName || ''}`);
            return full === target || (joined !== '' && joined === target);
        });
        if (hit) return hit;
    }
    return null;
}

/** ヘッダー行から「列名 → 位置」の対応表を作る（列の順番が違っても読めるように） */
export function buildHeaderIndex(headerRow) {
    const map = {};
    (headerRow || []).forEach((h, idx) => {
        const key = String(h || '').trim();
        if (key && !(key in map)) map[key] = idx;
    });
    return map;
}

// 強行シートのテキストをパース
export function parseForceSheet(text) {
    const result = { learning: '', play: '', program: '', snack: '' };
    if (!text || typeof text !== 'string') return result;
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    let currentSection = null;
    for (const line of lines) {
        if (line.startsWith('学習:') || line.startsWith('【学習】')) {
            currentSection = 'learning';
            result.learning += (result.learning ? '\n' : '') + line.replace(/^(学習:|【学習】)\s*/, '');
        } else if (line.startsWith('自由遊び:') || line.startsWith('【自由遊び】')) {
            currentSection = 'play';
            result.play += (result.play ? '\n' : '') + line.replace(/^(自由遊び:|【自由遊び】)\s*/, '');
        } else if (line.startsWith('プログラム:') || line.startsWith('【プログラム】')) {
            currentSection = 'program';
            result.program += (result.program ? '\n' : '') + line.replace(/^(プログラム:|【プログラム】)\s*/, '');
        } else if (line.startsWith('おやつ:') || line.startsWith('【おやつ】')) {
            currentSection = 'snack';
            result.snack += (result.snack ? '\n' : '') + line.replace(/^(おやつ:|【おやつ】)\s*/, '');
        } else if (currentSection) {
            result[currentSection] += '\n' + line;
        }
    }
    return result;
}

export function buildForceSheet(force) {
    if (!force) return "";

    const l = force.learning?.trim();
    const p = force.play?.trim();
    const pr = force.program?.trim();
    const s = force.snack?.trim();

    // 全てが空、もしくは「該当なし」のみの場合は空文字を返す
    if ((!l || l === '該当なし') &&
        (!p || p === '該当なし') &&
        (!pr || pr === '該当なし') &&
        (!s || s === '該当なし')) {
        return "";
    }

    return `学習: ${l || '該当なし'}\n自由遊び: ${p || '該当なし'}\nプログラム: ${pr || '該当なし'}\nおやつ: ${s || '該当なし'}`;
}

export function childDisplayName(child) {
    return child.lastName ? [child.lastName, child.firstName].filter(Boolean).join(' ') : child.name || '名前未登録';
}
export function normalizedChildSearch(value) {
    return String(value || '').normalize('NFKC').toLowerCase().replace(/\s/g, '').replace(/[\u30a1-\u30f6]/g, character => String.fromCharCode(character.charCodeAt(0) - 0x60));
}
export function availableChildren(masterChildren, currentChildren, search) {
    const present = new Set(currentChildren.map(child => child.id));
    const query = normalizedChildSearch(search);
    return masterChildren.filter(child => !present.has(child.id)).filter(child => [
        child.name, [child.lastName, child.firstName].join(''), [child.lastNameFurigana, child.firstNameFurigana].join(''), child.nameFurigana, child.yomi,
    ].some(value => normalizedChildSearch(value).includes(query))).sort((a, b) => (a.yomi || a.nameFurigana || childDisplayName(a)).localeCompare(b.yomi || b.nameFurigana || childDisplayName(b), 'ja'));
}

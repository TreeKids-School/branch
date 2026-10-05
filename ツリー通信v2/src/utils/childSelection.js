export function childDisplayName(child) {
    return child.lastName ? [child.lastName, child.firstName].filter(Boolean).join(' ') : child.name || '名前未登録';
}
export function needsChildIdentityReview(child) {
    return ['birth-conflict', 'unmatched-history'].includes(child?.identityReview);
}
export function normalizedChildSearch(value) {
    return String(value || '').normalize('NFKC').toLowerCase().replace(/\s/g, '').replace(/[\u30a1-\u30f6]/g, character => String.fromCharCode(character.charCodeAt(0) - 0x60));
}
export function childCandidateIds(child) {
    return [child?.id, child?.candidateChildId].filter(value => typeof value === 'string' && value);
}
export function hasChildCandidateOverlap(left, right) {
    const keys = new Set(childCandidateIds(left));
    return childCandidateIds(right).some(id => keys.has(id));
}
export function availableChildren(masterChildren, currentChildren, search) {
    const present = new Set(currentChildren.flatMap(child => childCandidateIds({ ...masterChildren.find(master => master.id === child.id), ...child })));
    const query = normalizedChildSearch(search);
    return masterChildren.filter(child => !childCandidateIds(child).some(id => present.has(id))).filter(child => [
        child.name, [child.lastName, child.firstName].join(''), [child.lastNameFurigana, child.firstNameFurigana].join(''), child.nameFurigana, child.yomi,
    ].some(value => normalizedChildSearch(value).includes(query))).sort((a, b) => (a.yomi || a.nameFurigana || childDisplayName(a)).localeCompare(b.yomi || b.nameFurigana || childDisplayName(b), 'ja'));
}

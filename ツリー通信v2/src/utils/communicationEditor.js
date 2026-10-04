// The editor only writes fields it owns. Other report fields remain in App's store.
export const EDITOR_FIELDS = ['D', 'futurePlan'];
export const editorValues = (result = {}) => ({ D: result.D || '', futurePlan: result.futurePlan || '' });
export const editorDraftKey = ({ scope, officeId, date, childId }) =>
    `tree_tsushin_v2_editor_v2:${[scope, officeId, date, childId].map(value => encodeURIComponent(value || 'local')).join(':')}`;

export function editorSavePayload(values, base, extra = {}, force = false) {
    const patch = { ...extra };
    const expected = {};
    for (const field of EDITOR_FIELDS) {
        if (force || values[field] !== base[field]) { patch[field] = values[field]; expected[field] = base[field]; }
    }
    return { patch, expected };
}

export function reconcileEditor(current, base, incoming) {
    const values = { ...current };
    const nextBase = { ...base };
    const conflicts = {};
    for (const field of EDITOR_FIELDS) {
        if (incoming[field] === base[field]) continue;
        if (current[field] === base[field] || current[field] === incoming[field]) {
            values[field] = incoming[field];
            nextBase[field] = incoming[field];
        } else {
            conflicts[field] = incoming[field];
        }
    }
    return { values, base: nextBase, conflicts };
}

export function restoreEditorDraft(result, draft) {
    const stored = editorValues(result);
    if (!draft || draft.version !== 2) return { values: stored, base: stored, conflicts: {} };
    const values = Object.fromEntries(EDITOR_FIELDS.map(field => [field, typeof draft.values?.[field] === 'string' ? draft.values[field] : stored[field]]));
    const base = Object.fromEntries(EDITOR_FIELDS.map(field => [field, typeof draft.base?.[field] === 'string' ? draft.base[field] : stored[field]]));
    return reconcileEditor(values, base, stored);
}

export function cleanMemoText(text, tags = []) {
    let cleaned = String(text || '').trim();
    for (const tag of tags) {
        if (cleaned.startsWith(tag)) { cleaned = cleaned.slice(tag.length).trim(); break; }
    }
    return cleaned.replace(/^(?:【[^】]+】|\[[^\]]+\])\s*/, '');
}

export const memoTags = tag => Array.isArray(tag) ? tag : String(tag || '').split(/\s+/).filter(Boolean);
export const appendEditorText = (current, text) => !String(text || '').trim() ? current : current.trim() ? `${current.trimEnd()}\n${text}` : text;

export function orderedMemoText(messages, selected, tags) {
    return selected.map(id => messages.find(message => (message.id || String(message.timestamp)) === id))
        .filter(Boolean).map(message => cleanMemoText(message.text, tags)).filter(Boolean).join('\n\n');
}

export function programTemplateText(tag, templates, programs, mode) {
    if (mode === 'none') return '';
    const template = templates[tag] ?? (tag.includes('プログラム') ? '{プログラム内容}' : tag.includes('ツリー式学習') ? 'ツリー式学習' : '');
    const text = mode === 'all'
        ? programs.map((program, index) => `【${program.title || `プログラム${index + 1}`}】${program.summary ? `\n${program.summary}` : ''}`).join('\n\n')
        : programs[mode]?.summary || programs[mode]?.title || '';
    return template.replace(/\{プログラム内容\}|\{program\}/g, text);
}

export function scanForNames(text, okWords = []) {
    const matches = String(text || '').match(/([^ 　\n\r\t、。！？()（）「」『』【】“”"'’‘:;,.\-\+=\/\\*&^%$#@!\[\]]+(?:さん|くん|ちゃん|君))/g) || [];
    const exclusions = ['お母さん', 'お父さん', 'お兄さん', 'お姉さん', '皆さん', 'みなさん', '看護師さん', 'お医者さん', '保育士さん', '運転手さん', '警察官さん', '屋さん', 'くんさん', 'おじさん', 'おばさん', 'おじいさん', 'おばあさん'];
    return [...new Set(matches)].filter(match => !exclusions.some(word => match.includes(word)) && !okWords.includes(match));
}

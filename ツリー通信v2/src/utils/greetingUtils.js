// ── Greeting Template & Auto-insertion Utilities ──────────────────────────────

/**
 * Finds the greeting template for a given staff member from greetingTemplates.
 * Checks staff name, loginId, full name, id, and nickname.
 */
export function findGreetingTemplateForStaff(staffOrName, greetingTemplates = {}, staffList = []) {
    if (!staffOrName || !greetingTemplates || typeof greetingTemplates !== 'object') return '';

    const staffObj = typeof staffOrName === 'object'
        ? staffOrName
        : (staffList.find(s => s.name === staffOrName || s.id === staffOrName || s.loginId === staffOrName) || { name: String(staffOrName) });

    const candidates = [
        staffObj.name,
        staffObj.loginId,
        staffObj.id,
        `${staffObj.lastName || ''} ${staffObj.firstName || ''}`.trim(),
        `${staffObj.lastName || ''}${staffObj.firstName || ''}`.trim()
    ].filter(Boolean);

    // 1. Direct match with candidates
    for (const c of candidates) {
        if (greetingTemplates[c]) return greetingTemplates[c];
    }

    // 2. Loose match (ignoring whitespace)
    const cleanCand = candidates.map(c => c.replace(/\s+/g, ''));
    for (const [key, val] of Object.entries(greetingTemplates)) {
        const cleanKey = key.replace(/\s+/g, '');
        if (cleanCand.some(c => c === cleanKey)) {
            return val;
        }
    }

    // 3. Partial match (key contains candidate or candidate contains key)
    for (const [key, val] of Object.entries(greetingTemplates)) {
        const cleanKey = key.replace(/\s+/g, '');
        if (cleanCand.some(c => c && (cleanKey.includes(c) || c.includes(cleanKey)))) {
            return val;
        }
    }

    // 4. Check if template content mentions staff's name or nickname/loginId
    for (const c of cleanCand) {
        if (!c || c.length < 2) continue;
        for (const [key, val] of Object.entries(greetingTemplates)) {
            if (typeof val === 'string' && val.includes(c)) {
                return val;
            }
        }
    }

    return '';
}

/**
 * Checks whether the tree communication text already contains a greeting.
 * Returns true if any template in greetingTemplates or standard greeting phrase is detected.
 */
export function checkHasGreeting(text, greetingTemplates = {}) {
    if (!text || typeof text !== 'string' || !text.trim()) return false;
    const trimmed = text.trim();

    // 1. Check against all registered templates in greetingTemplates
    if (greetingTemplates && typeof greetingTemplates === 'object') {
        for (const t of Object.values(greetingTemplates)) {
            if (typeof t === 'string' && t.trim()) {
                const cleanT = t.trim();
                if (trimmed.includes(cleanT)) return true;

                // Also check if the first line of the template exists
                const firstLine = cleanT.split('\n')[0].trim();
                if (firstLine.length >= 4 && trimmed.includes(firstLine)) return true;
            }
        }
    }

    // 2. Check top section (first 200 chars) for typical greeting patterns
    const headerSection = trimmed.slice(0, 200);
    const greetingRegex = /(こんにちは|こんばんは|おはようございます|おはよう|ツリー通信)/i;
    if (greetingRegex.test(headerSection)) {
        return true;
    }

    return false;
}

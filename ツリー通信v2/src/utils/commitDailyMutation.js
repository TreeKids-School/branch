// One logical edit owns one transaction: the report, child document, calendar
// index and change history either all persist or none do. Callbacks are pure
// and synchronous because Firestore may retry them with a newer report.
export async function commitDailyMutation(storage, payload) {
    const { firestore, doc, runTransaction, arrayUnion } = storage;
    const { date, officeId, mutate, buildLogs, logs = [], syncChildIds = [], deriveRemarks } = payload;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) throw new Error('保存する日付を選択してください。');
    if (officeId != null && (typeof officeId !== 'string' || !officeId || officeId.includes('/'))) throw new Error('保存する事業所が正しくありません。');
    if (typeof mutate !== 'function') throw new Error('保存する変更がありません。');
    const reportId = officeId ? `${officeId}_${date}` : date;
    const reportRef = doc(firestore, 'reports', reportId);
    const historyRef = doc(firestore, 'changeLogs', reportId);
    const indexRef = doc(firestore, 'meta', officeId ? `reports_index_${officeId}` : 'reports_index');
    return runTransaction(firestore, async transaction => {
        const snapshot = await transaction.get(reportRef);
        const previous = snapshot.exists() ? snapshot.data() : {
            children: [], messages: {}, results: {}, summaryC: '', dailyTable: {},
            globalLog: { admin: '', supervisor: '', notice: '', activities: '', programTitle: '', programSummary: '' }, changeLogs: [],
        };
        const changed = mutate(previous);
        if (!changed || typeof changed !== 'object' || Array.isArray(changed) || typeof changed.then === 'function') throw new Error('保存する変更が正しくありません。');
        // Unrecognised legacy fields and edit locks are retained even when a
        // caller deliberately returns just the top-level fields it changed.
        const next = { ...previous, ...changed, updatedAt: new Date().toISOString() };
        const additions = buildLogs ? buildLogs(previous, next) : logs;
        if (!Array.isArray(additions)) throw new Error('変更履歴の内容が正しくありません。');
        const childIds = typeof syncChildIds === 'function' ? syncChildIds(previous, next) : syncChildIds;
        if (!Array.isArray(childIds)) throw new Error('反映する児童の指定が正しくありません。');
        transaction.set(reportRef, next);
        transaction.set(indexRef, { dates: arrayUnion(date) }, { merge: true });
        if (additions.length) transaction.set(historyRef, {
            logs: arrayUnion(...additions), date, officeId: officeId || null, updatedAt: next.updatedAt,
        }, { merge: true });
        for (const childId of new Set(childIds)) {
            const child = (next.children || []).find(item => item.id === childId);
            if (!child || child.isPlaceholder) continue;
            const result = next.results?.[childId] || {};
            const table = next.dailyTable?.[childId] || {};
            const individual = {
                name: child.name || [child.lastName, child.firstName].filter(Boolean).join(' '),
                tree_comm_text: result.D || '', future_plan: result.futurePlan || '',
                pickupLocation: table.pickupLocation || '', endTime: table.endTime || '',
                transportTime: table.transportTime || '', officeId: officeId || null,
                updatedAt: next.updatedAt,
            };
            if (deriveRemarks) individual.notes = deriveRemarks(next.messages?.[childId] || [], childId, next);
            // The same child may attend two offices on one date. Never write
            // back into the legacy date-only document from an office workspace.
            // This is not a reservation publication or a LINE delivery.
            transaction.set(doc(firestore, 'children', childId, 'app_categories', '書類管理', 'tree_communications', reportId), individual, { merge: true });
        }
        return { status: 'OK', report: next, logs: additions };
    });
}

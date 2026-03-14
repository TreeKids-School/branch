import { db } from '../firebase';
import { ref, get, set } from 'firebase/database';

const isLocal = () =>
    window.location.protocol === 'file:' ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';

const localGet = (k) => {
    try { return JSON.parse(localStorage.getItem('care_pro_local_' + k) || 'null'); }
    catch { return null; }
};
const localSet = (k, v) => localStorage.setItem('care_pro_local_' + k, JSON.stringify(v));

const performLocalAction = (payload) => {
    const { action, data, childId, date } = payload;
    switch (action) {
        case 'getChildren': return localGet('children') || [];
        case 'setChildren': localSet('children', data); return { status: 'OK' };
        case 'getReport': return localGet(`report_${date}`) || null;
        case 'saveReport': {
            localSet(`report_${date}`, data);
            let index = localGet('reports_index') || [];
            if (!Array.isArray(index)) index = [];
            if (!index.includes(date)) { index.push(date); localSet('reports_index', index); }
            return { status: 'OK' };
        }
        case 'getReportIndex': return localGet('reports_index') || [];
        case 'rebuildIndex': {
            const keys = Object.keys(localStorage).filter(k => k.startsWith('care_pro_local_report_'));
            const dates = keys.map(k => k.replace('care_pro_local_report_', '')).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
            localSet('reports_index', dates);
            return dates;
        }
        default: return null;
    }
};

export const callStorage = async (payload, setConnectionStatus, setLastError) => {
    const { action, data, childId, date } = payload;

    if (isLocal()) {
        setConnectionStatus?.('local');
        return performLocalAction(payload);
    }

    try {
        switch (action) {
            case 'getChildren': {
                const snap = await get(ref(db, 'children'));
                setConnectionStatus?.('online'); setLastError?.(null);
                return snap.val() || [];
            }
            case 'setChildren': {
                await set(ref(db, 'children'), data);
                setConnectionStatus?.('online'); setLastError?.(null);
                return { status: 'OK' };
            }
            case 'getReport': {
                const snap = await get(ref(db, `reports/${date}`));
                setConnectionStatus?.('online'); setLastError?.(null);
                return snap.val() || null;
            }
            case 'saveReport': {
                await set(ref(db, `reports/${date}`), data);
                const idxSnap = await get(ref(db, 'reports_index'));
                let index = idxSnap.val() || [];
                if (!Array.isArray(index)) index = Object.values(index);
                if (!index.includes(date)) { index.push(date); await set(ref(db, 'reports_index'), index); }
                setConnectionStatus?.('online'); setLastError?.(null);
                return { status: 'OK' };
            }
            case 'getReportIndex': {
                const snap = await get(ref(db, 'reports_index'));
                setConnectionStatus?.('online'); setLastError?.(null);
                const val = snap.val();
                if (val && !Array.isArray(val)) return Object.values(val);
                return val || [];
            }
            case 'rebuildIndex': {
                const snap = await get(ref(db, 'reports'));
                const val = snap.val();
                if (!val) {
                    await set(ref(db, 'reports_index'), []);
                    return [];
                }
                const newIndex = Object.keys(val).sort();
                await set(ref(db, 'reports_index'), newIndex);
                setConnectionStatus?.('online'); setLastError?.(null);
                return newIndex;
            }
            default: return null;
        }
    } catch (e) {
        console.warn('Firebase error, falling back to localStorage:', e);
        setConnectionStatus?.('offline');
        setLastError?.(e.message || 'Network Error');
        return performLocalAction(payload);
    }
};

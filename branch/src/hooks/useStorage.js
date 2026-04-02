import { firestore } from '../firebase';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';

const isLocal = () => false; // Force Firestore for testing/deployment

const localGet = (k) => {
    try { return JSON.parse(localStorage.getItem('care_pro_local_' + k) || 'null'); }
    catch { return null; }
};
const localSet = (k, v) => localStorage.setItem('care_pro_local_' + k, JSON.stringify(v));

const performLocalAction = (payload) => {
    const { action, data, childId, date } = payload;
    switch (action) {
        case 'getMasterChildren': return localGet('master_children') || [];
        case 'saveMasterChildren': localSet('master_children', data); return { status: 'OK' };
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
            case 'getMasterChildren': {
                const docRef = doc(firestore, 'meta', 'children');
                const snap = await getDoc(docRef);
                setConnectionStatus?.('online'); setLastError?.(null);
                return snap.exists() ? (snap.data().list || []) : [];
            }
            case 'saveMasterChildren': {
                const docRef = doc(firestore, 'meta', 'children');
                await setDoc(docRef, { list: data });
                setConnectionStatus?.('online'); setLastError?.(null);
                return { status: 'OK' };
            }
            case 'getChildren': {
                const docRef = doc(firestore, 'meta', 'children');
                const snap = await getDoc(docRef);
                setConnectionStatus?.('online'); setLastError?.(null);
                return snap.exists() ? (snap.data().list || []) : [];
            }
            case 'setChildren': {
                const docRef = doc(firestore, 'meta', 'children');
                await setDoc(docRef, { list: data });
                setConnectionStatus?.('online'); setLastError?.(null);
                return { status: 'OK' };
            }
            case 'getReport': {
                const docRef = doc(firestore, 'reports', date);
                const snap = await getDoc(docRef);
                setConnectionStatus?.('online'); setLastError?.(null);
                return snap.exists() ? snap.data() : null;
            }
            case 'saveReport': {
                const docRef = doc(firestore, 'reports', date);
                await setDoc(docRef, data);
                
                // Update index
                const idxRef = doc(firestore, 'meta', 'reports_index');
                const idxSnap = await getDoc(idxRef);
                let index = idxSnap.exists() ? (idxSnap.data().dates || []) : [];
                if (!index.includes(date)) { 
                    index.push(date); 
                    await setDoc(idxRef, { dates: index }); 
                }
                
                setConnectionStatus?.('online'); setLastError?.(null);
                return { status: 'OK' };
            }
            case 'getReportIndex': {
                const idxRef = doc(firestore, 'meta', 'reports_index');
                const snap = await getDoc(idxRef);
                setConnectionStatus?.('online'); setLastError?.(null);
                return snap.exists() ? (snap.data().dates || []) : [];
            }
            case 'rebuildIndex': {
                const querySnap = await getDocs(collection(firestore, 'reports'));
                const newIndex = querySnap.docs.map(d => d.id).sort();
                const idxRef = doc(firestore, 'meta', 'reports_index');
                await setDoc(idxRef, { dates: newIndex });
                setConnectionStatus?.('online'); setLastError?.(null);
                return newIndex;
            }
            default: return null;
        }
    } catch (e) {
        console.warn('Firestore error, falling back to localStorage:', e);
        setConnectionStatus?.('offline');
        setLastError?.(e.message || 'Network Error');
        return performLocalAction(payload);
    }
};

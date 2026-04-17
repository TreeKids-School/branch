import { firestore } from '../firebase';
import { 
    doc, getDoc, setDoc, collection, getDocs, deleteDoc, 
    addDoc, serverTimestamp 
} from 'firebase/firestore';

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
                const colRef = collection(firestore, 'children');
                const snap = await getDocs(colRef);
                setConnectionStatus?.('online'); setLastError?.(null);
                return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            }
            case 'saveMasterChildren': {
                const child = Array.isArray(data) ? null : data;
                const { userId } = payload;
                if (child && child.id) {
                    const docRef = doc(firestore, 'children', child.id);
                    await setDoc(docRef, { 
                        ...child, 
                        createdBy: userId || null,
                        updatedAt: new Date().toISOString() 
                    }, { merge: true });
                }
                setConnectionStatus?.('online'); setLastError?.(null);
                return { status: 'OK' };
            }
            case 'deleteMasterChild': {
                const { id } = payload;
                if (!id) throw new Error('id is required for deletion');
                const docRef = doc(firestore, 'children', id);
                await deleteDoc(docRef);
                setConnectionStatus?.('online'); setLastError?.(null);
                return { status: 'OK' };
            }
            case 'getChildren': {
                // In the new project, we might still want a per-day children list 
                // but the master list is now in artifacts/.../children.
                // For now, let's keep reports and daily children list in their old paths 
                // (reports/{date}) but they will be on the new project.
                const docRef = doc(firestore, 'reports', date);
                const snap = await getDoc(docRef);
                setConnectionStatus?.('online'); setLastError?.(null);
                return snap.exists() ? (snap.data().children || []) : [];
            }
            case 'setChildren': {
                // This is typically called when saving the daily report.
                // Handled in saveReport.
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
            case 'saveIndividualTreeComm': {
                const { childId, date, data } = payload;
                if (!childId || !date) throw new Error('childId and date are required for individual save');
                // Path: children/{childId}/app_categories/書類管理/tree_communications/{date}
                const docRef = doc(firestore, 'children', childId, 'app_categories', '書類管理', 'tree_communications', date);
                await setDoc(docRef, {
                    ...data,
                    updatedAt: new Date().toISOString()
                }, { merge: true });
                setConnectionStatus?.('online'); setLastError?.(null);
                return { status: 'OK' };
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

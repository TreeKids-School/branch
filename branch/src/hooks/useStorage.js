import { firestore, auth } from '../firebase';
import { 
    doc, getDoc, setDoc, collection, getDocs, deleteDoc, 
    addDoc, serverTimestamp, query, where, orderBy, Timestamp 
} from 'firebase/firestore';

const isLocal = () => false; // Force Firestore for testing/deployment

const localGet = (k) => {
    try { return JSON.parse(localStorage.getItem('care_pro_local_' + k) || 'null'); }
    catch { return null; }
};
const localSet = (k, v) => localStorage.setItem('care_pro_local_' + k, JSON.stringify(v));

const performLocalAction = (payload) => {
    const { action, data, childId, date, officeId } = payload;
    switch (action) {
        case 'getMasterChildren': return localGet('master_children') || [];
        case 'saveMasterChildren': localSet('master_children', data); return { status: 'OK' };
        case 'getChildren': return localGet('children') || [];
        case 'setChildren': localSet('children', data); return { status: 'OK' };
        case 'getReport': {
            const reportKey = officeId ? `report_${officeId}_${date}` : `report_${date}`;
            return localGet(reportKey) || null;
        }
        case 'saveReport': {
            const reportKey = officeId ? `report_${officeId}_${date}` : `report_${date}`;
            localSet(reportKey, data);
            const indexKey = officeId ? `reports_index_${officeId}` : 'reports_index';
            let index = localGet(indexKey) || [];
            if (!Array.isArray(index)) index = [];
            if (!index.includes(date)) { index.push(date); localSet(indexKey, index); }
            return { status: 'OK' };
        }
        case 'getReportIndex': {
            const indexKey = officeId ? `reports_index_${officeId}` : 'reports_index';
            return localGet(indexKey) || [];
        }
        case 'rebuildIndex': {
            const indexKey = officeId ? `reports_index_${officeId}` : 'reports_index';
            const prefix = officeId ? `report_${officeId}_` : 'report_';
            const fullPrefix = 'care_pro_local_' + prefix;
            const keys = Object.keys(localStorage).filter(k => k.startsWith(fullPrefix));
            const dates = keys.map(k => k.replace(fullPrefix, '')).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
            localSet(indexKey, dates);
            return dates;
        }
        case 'getAttendance': {
            const attendanceKey = officeId ? `attendance_${officeId}_${date}` : `attendance_${date}`;
            return localGet(attendanceKey) || {};
        }
        case 'saveAttendance': {
            const attendanceKey = officeId ? `attendance_${officeId}_${date}` : `attendance_${date}`;
            localSet(attendanceKey, data);
            return { status: 'OK' };
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
                const projectId = firestore.app.options.projectId;
                console.log(`[Firestore Debug] Fetching children from project: ${projectId}`);
                const colRef = collection(firestore, 'children');
                const snap = await getDocs(colRef);
                console.log(`[Firestore Debug] Successfully fetched ${snap.docs.length} children.`);
                setConnectionStatus?.('online'); setLastError?.(null);
                return snap.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }))
                    .filter(child => child.name || child.lastName); // name または lastName があるドキュメントを表示
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
            case 'getOffices': {
                const colRef = collection(firestore, 'offices');
                const snap = await getDocs(colRef);
                setConnectionStatus?.('online'); setLastError?.(null);
                return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            }
            case 'getReport': {
                const reportId = payload.officeId ? `${payload.officeId}_${date}` : date;
                const docRef = doc(firestore, 'reports', reportId);
                const snap = await getDoc(docRef);
                setConnectionStatus?.('online'); setLastError?.(null);
                return snap.exists() ? snap.data() : null;
            }
            case 'saveReport': {
                const reportId = payload.officeId ? `${payload.officeId}_${date}` : date;
                const docRef = doc(firestore, 'reports', reportId);
                const fieldsToOverwrite = ['children', 'messages', 'results', 'summaryC', 'dailyTable', 'globalLog', 'updatedAt'];
                await setDoc(docRef, data, { mergeFields: fieldsToOverwrite });
                
                // Update index
                const indexDocId = payload.officeId ? `reports_index_${payload.officeId}` : 'reports_index';
                const idxRef = doc(firestore, 'meta', indexDocId);
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
                const indexDocId = payload.officeId ? `reports_index_${payload.officeId}` : 'reports_index';
                const idxRef = doc(firestore, 'meta', indexDocId);
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
            case 'getDailyReports': {
                const { childId } = payload;
                if (!childId) throw new Error('childId is required');
                const colRef = collection(firestore, 'daily_reports');
                const q = query(colRef, where('childId', '==', childId), orderBy('date', 'desc'));
                const snap = await getDocs(q);
                return snap.docs.map(d => {
                    const data = d.data();
                    return {
                        id: d.id,
                        ...data,
                        date: data.date?.toDate?.() ? data.date.toDate().toISOString().split('T')[0] : data.date // Convert to YYYY-MM-DD
                    };
                });
            }
            case 'saveDailyReport': {
                const { childId, date, externalInfo, staffName, id } = payload.data;
                const dailyRef = collection(firestore, 'daily_reports');
                
                const dateObj = new Date(date);
                const timestamp = Timestamp.fromDate(dateObj);
                
                const docData = {
                    childId,
                    date: timestamp,
                    externalInfo,
                    staffName,
                    updatedAt: serverTimestamp()
                };

                if (id) {
                    await setDoc(doc(firestore, 'daily_reports', id), docData, { merge: true });
                } else {
                    await addDoc(dailyRef, docData);
                }
                return { status: 'OK' };
            }
            case 'deleteDailyReport': {
                const { id } = payload;
                if (!id) throw new Error('id is required');
                await deleteDoc(doc(firestore, 'daily_reports', id));
                return { status: 'OK' };
            }
            case 'getStaffNames': {
                const projectId = firestore.app.options.projectId;
                const currentUser = auth.currentUser;
                console.log(`[Firestore Debug] User: ${currentUser ? currentUser.email : 'NOT LOGGED IN'} (${currentUser ? currentUser.uid : 'N/A'})`);
                console.log(`[Firestore Debug] Fetching staff from project: ${projectId}`);
                
                let snap;
                try {
                    const colRef = collection(firestore, 'staff');
                    snap = await getDocs(colRef);
                } catch (e) {
                    console.warn('[Firestore Debug] Failed to fetch from "staff" collection, trying "staffs"...', e.message);
                    const colRef = collection(firestore, 'staffs');
                    snap = await getDocs(colRef);
                }

                console.log(`[Firestore Debug] Successfully fetched ${snap.docs.length} staff members.`);
                const results = snap.docs.map(doc => {
                    const data = doc.data();
                    console.log(`[Firestore Debug] Staff Doc ID: ${doc.id}, Data:`, data);
                    return { id: doc.id, ...data, name: data.name || doc.id };
                });
                setConnectionStatus?.('online'); setLastError?.(null);
                return results;
            }
            case 'getStaffList': {
                let snap;
                try {
                    const colRef = collection(firestore, 'staff');
                    snap = await getDocs(colRef);
                } catch (e) {
                    console.warn('[Firestore Debug] getStaffList failed on "staff", trying "staffs"...', e.message);
                    const colRef = collection(firestore, 'staffs');
                    snap = await getDocs(colRef);
                }
                setConnectionStatus?.('online'); setLastError?.(null);
                return snap.docs.map(doc => {
                    const data = doc.data();
                    return { id: doc.id, name: data.name || doc.id };
                });
            }
            case 'getAttendance': {
                if (!date) throw new Error('date is required for getAttendance');
                const attendanceId = payload.officeId ? `${payload.officeId}_${date}` : date;
                const docRef = doc(firestore, 'attendance', attendanceId);
                const snap = await getDoc(docRef);
                setConnectionStatus?.('online'); setLastError?.(null);
                return snap.exists() ? snap.data() : {};
            }
            case 'saveAttendance': {
                if (!date) throw new Error('date is required for saveAttendance');
                const attendanceId = payload.officeId ? `${payload.officeId}_${date}` : date;
                const docRef = doc(firestore, 'attendance', attendanceId);
                await setDoc(docRef, data, { merge: true });
                setConnectionStatus?.('online'); setLastError?.(null);
                return { status: 'OK' };
            }
            default: return null;
        }
    } catch (e) {
        const projectId = firestore.app.options.projectId;
        console.error(`[Firestore Error] Failed during action: ${action} on project: ${projectId}`, e);
        setConnectionStatus?.('offline');
        setLastError?.(e.message || 'Network Error');
        return performLocalAction(payload);
    }
};

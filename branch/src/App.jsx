import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    PlusCircle, MessageSquare, Send, FileSpreadsheet, Printer,
    Trash2, Clock, CheckCircle2, AlertCircle, Loader2,
    ChevronDown, ChevronUp, ChevronLeft, ChevronRight, FileText, LayoutPanelLeft, UserCheck,
    FileEdit, X, Calendar as CalendarIcon, Settings, LogOut, HelpCircle, Menu,
    Copy, Check, ClipboardList
} from 'lucide-react';
import MemoPanel from './components/MemoPanel';
import DocViewer from './components/DocViewer';
import HelpGuide from './components/HelpGuide';
import Login from './components/Login';
import { auth, firestore } from './firebase';
import { onAuthStateChanged, signOut, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, onSnapshot, setDoc, updateDoc, deleteField, runTransaction } from 'firebase/firestore';
import { callStorage } from './hooks/useStorage';
import { APP_VERSION, STAFF_OPTIONS, parseForceSheet, buildForceSheet, getStaffInstruction, getRoleFromPost } from './app_constants';
import { defaultPrompts } from './constants/defaultPrompts';
import { CopyButton, ErrorBoundary } from './components/Shared';
import CalendarModal from './components/CalendarModal';
import SettingsModal from './components/SettingsModal';
import ExportModal from './components/ExportModal';
import AddChildModal from './components/AddChildModal';
import AttendanceModal from './components/AttendanceModal';
import ActivitiesModal from './components/ActivitiesModal';
import NoticeModal from './components/NoticeModal';

import { printAllDocuments, GROUP1_ITEMS, GROUP2_ITEMS } from './utils/print';



const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

const getOffsetDateString = (baseDateStr, offset) => {
    if (!baseDateStr) return '';
    const d = new Date(baseDateStr);
    d.setDate(d.getDate() + offset);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const date = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${date}`;
};

const getFormattedDateWithDay = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const m = d.getMonth() + 1;
    const date = d.getDate();
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    const day = dayNames[d.getDay()];
    return `${m}/${date} (${day})`;
};

const roundTo5Minutes = (timeStr) => {
    if (!timeStr) return '';
    const parts = timeStr.split(':');
    if (parts.length < 2) return timeStr;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return timeStr;
    
    const roundedMin = Math.round(m / 5) * 5;
    if (roundedMin === 60) {
        const nextHour = String((h + 1) % 24).padStart(2, '0');
        return `${nextHour}:00`;
    }
    return `${String(h).padStart(2, '0')}:${String(roundedMin).padStart(2, '0')}`;
};

// ── ユーティリティ ──────────────────────────────────────────────────
const cn = (...classes) => classes.filter(Boolean).join(' ');

// ── メインアプリケーション ──────────────────────────────────────────────────
export default function App() {
    // 1. All States (Restored and gathered at the very top)
    const [user, setUser] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [children, setChildren] = useState([]);
    const [toast, setToast] = useState(null);
    const [results, setResults] = useState({});
    const [summaryC, setSummaryC] = useState('');
    const [dailyMessages, setDailyMessages] = useState({});
    const [dailyTable, setDailyTable] = useState({});
    const [globalLog, setGlobalLog] = useState({ admin: '', supervisor: '', notice: '', activities: '', programTitle: '', programSummary: '' });
    const [showProgramModal, setShowProgramModal] = useState(false);
    const [selectedChildId, setSelectedChildId] = useState(null);
    const [selectedTreeChildId, setSelectedTreeChildId] = useState(null);
    const [selectedDocChildId, setSelectedDocChildId] = useState(null);
    const [showTransportListModal, setShowTransportListModal] = useState(false);
    const [memoActiveTab, setMemoActiveTab] = useState('tree');
    const [isWaitlistExpanded, setIsWaitlistExpanded] = useState(false);
    const [isAbsentExpanded, setIsAbsentExpanded] = useState(false);
    const [pressingChildId, setPressingChildId] = useState(null);
    const [statusMenuChild, setStatusMenuChild] = useState(null);

    const longPressTimers = useRef({});
    const isPressing = useRef({});
    const hasTriggeredLongPress = useRef({});
    const touchStartPos = useRef({});
    const [isKintaiExpanded, setIsKintaiExpanded] = useState(() => window.innerWidth >= 1024);
    const [showNoticeModal, setShowNoticeModal] = useState(false);
    const [showActivitiesModal, setShowActivitiesModal] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [showCalendarModal, setShowCalendarModal] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [showAddChildModal, setShowAddChildModal] = useState(false);
    const [showAttendanceModal, setShowAttendanceModal] = useState(false);
    const [isDashboardMode, setIsDashboardMode] = useState(true);
    const [attendance, setAttendance] = useState({});
    const [sortConfig, setSortConfig] = useState({ key: 'default', direction: 'asc' });
    const [copiedChildId, setCopiedChildId] = useState(null);
    const [masterChildren, setMasterChildren] = useState([]);
    const [existingReportDates, setExistingReportDates] = useState([]);
    const [showHelpGuide, setShowHelpGuide] = useState(false);
    const [helpGuideStartStepId, setHelpGuideStartStepId] = useState(null);
    const [staffList, setStaffList] = useState([]);
    const [offices, setOffices] = useState([]);
    const [selectedOffice, setSelectedOffice] = useState(() => {
        try {
            const saved = localStorage.getItem('care_pro_selected_office');
            return saved ? JSON.parse(saved) : null;
        } catch {
            return null;
        }
    });
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Filter staff list by selected office
    const filteredStaffList = staffList.filter(staff => {
        if (!selectedOffice) return true;
        if (staff.officeId === selectedOffice.id) return true;
        if (Array.isArray(staff.office) && staff.office.includes(selectedOffice.name)) return true;
        if (staff.office === selectedOffice.name) return true;
        return false;
    });

    const [isPanelClosing, setIsPanelClosing] = useState(false);
    const [lastPanelData, setLastPanelData] = useState(null);
    const [slideDirection, setSlideDirection] = useState(null);
    const [animationKey, setAnimationKey] = useState(0);
    const [dateAnimKey, setDateAnimKey] = useState(0);
    const [activeTableTab, setActiveTableTab] = useState('learning'); // 'learning' or 'transport'
    const [activeLocks, setActiveLocks] = useState({});
    const [lockingChildId, setLockingChildId] = useState(null);
    const prevSelectedChildIdRef = useRef(null);
    const lockedReportIdRef = useRef(null);
    const justAcquiredLockRef = useRef(null);
    const activeSavePromiseRef = useRef(Promise.resolve());

    const getReportId = useCallback(() => {
        if (!selectedOffice) return selectedDate;
        return selectedOffice.id ? `${selectedOffice.id}_${selectedDate}` : selectedDate;
    }, [selectedOffice, selectedDate]);

    const getCurrentStaffName = useCallback(() => {
        if (!user) return 'Staff';
        const staff = staffList.find(s => s.email === user.email || s.id === user.uid);
        if (staff) return staff.name;
        return user.email ? user.email.split('@')[0] : 'Staff';
    }, [user, staffList]);

    const getChildLockOwner = useCallback((childId) => {
        const lock = activeLocks[childId];
        if (!lock) return null;
        const now = Date.now();
        if (lock.expiresAt && lock.expiresAt > now) {
            if (lock.userId !== user?.uid) {
                return lock;
            }
        }
        return null;
    }, [activeLocks, user]);

    const isChildLocked = useCallback((childId) => {
        return !!getChildLockOwner(childId);
    }, [getChildLockOwner]);

    // Acquire lock using a Firestore Transaction to prevent race conditions on multi-terminal access
    const acquireLock = useCallback(async (childId) => {
        if (!user || !selectedOffice) return false;
        const reportId = getReportId();
        const docRef = doc(firestore, 'reports', reportId);
        
        try {
            const success = await runTransaction(firestore, async (transaction) => {
                const docSnap = await transaction.get(docRef);
                const data = docSnap.exists() ? docSnap.data() : {};
                const currentLocks = data.activeLocks || {};
                const lock = currentLocks[childId];
                const now = Date.now();
                
                if (lock && lock.expiresAt > now && lock.userId !== user.uid) {
                    // Locked by someone else
                    return false;
                }
                
                const staffName = getCurrentStaffName();
                const expiresAt = Date.now() + 5 * 60 * 1000; // 5 min expiry
                
                const newLock = {
                    userId: user.uid,
                    userEmail: user.email || '',
                    userName: staffName,
                    expiresAt: expiresAt
                };
                
                transaction.set(docRef, {
                    activeLocks: {
                        [childId]: newLock
                    }
                }, { merge: true });
                return true;
            });
            
            if (success) {
                lockedReportIdRef.current = reportId;
            }
            return success;
        } catch (e) {
            console.error('Failed to acquire lock:', e);
            return false;
        }
    }, [user, selectedOffice, getReportId, getCurrentStaffName]);

    // Release lock
    const releaseLock = useCallback(async (childId) => {
        if (!user) return;
        const reportId = lockedReportIdRef.current || getReportId();
        const docRef = doc(firestore, 'reports', reportId);
        
        try {
            // Wait for any active save operations to complete first
            console.log('[Lock Release] Waiting for pending saves to complete before releasing lock for child:', childId);
            await activeSavePromiseRef.current;
            console.log('[Lock Release] Pending saves completed. Releasing lock now.');
            
            await updateDoc(docRef, {
                [`activeLocks.${childId}`]: deleteField()
            });
            if (lockedReportIdRef.current === reportId) {
                lockedReportIdRef.current = null;
            }
        } catch (e) {
            console.log('Failed to release lock:', e.message);
        }
    }, [user, getReportId]);

    // Handle opening a child's memo panel with pre-acquisition lock sync check
    const handleOpenChildPanel = async (childId, tab) => {
        if (lockingChildId) return;
        
        // Quick local check first to avoid redundant transaction calls
        const lockOwner = getChildLockOwner(childId);
        if (lockOwner) {
            showToast(`${lockOwner.userName || lockOwner.userEmail || '他ユーザー'}が入力中のため編集できません。`);
            return;
        }
        
        setLockingChildId(childId);
        try {
            const success = await acquireLock(childId);
            if (success) {
                justAcquiredLockRef.current = childId;
                setSelectedChildId(childId);
                setMemoActiveTab(tab);
                setSelectedTreeChildId(null);
                setSelectedDocChildId(null);
            } else {
                showToast('この児童は現在、他ユーザーが入力中のため編集できません。');
            }
        } catch (e) {
            console.error('Lock acquisition failed:', e);
            showToast('接続エラーによりロックの取得に失敗しました。');
        } finally {
            setLockingChildId(null);
        }
    };
    const [tableTouchStart, setTableTouchStart] = useState(null);
    const [tableTouchEnd, setTableTouchEnd] = useState(null);
    const [tableTouchStartY, setTableTouchStartY] = useState(null);
    const [tableTouchEndY, setTableTouchEndY] = useState(null);

    const handleTableTouchStart = (e) => {
        if (window.innerWidth >= 1024) return;
        setTableTouchEnd(null);
        setTableTouchEndY(null);
        setTableTouchStart(e.targetTouches[0].clientX);
        setTableTouchStartY(e.targetTouches[0].clientY);
    };

    const handleTableTouchMove = (e) => {
        if (window.innerWidth >= 1024) return;
        setTableTouchEnd(e.targetTouches[0].clientX);
        setTableTouchEndY(e.targetTouches[0].clientY);
    };

    const handleTableTouchEnd = () => {
        if (window.innerWidth >= 1024) return;
        if (tableTouchStart === null || tableTouchEnd === null || tableTouchStartY === null || tableTouchEndY === null) return;

        const diffX = tableTouchEnd - tableTouchStart;
        const diffY = tableTouchEndY - tableTouchStartY;

        // 横方向のスワイプ判定（縦方向の移動より横方向が大きく、かつしきい値が60px以上）
        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 60) {
            const tabs = ['learning', 'transport', 'copy'];
            const currentIndex = tabs.indexOf(activeTableTab);

            if (diffX < 0) {
                // 左フリック（右から左へスワイプ） ➔ 次のタブへ
                if (currentIndex < tabs.length - 1) {
                    setActiveTableTab(tabs[currentIndex + 1]);
                }
            } else {
                // 右フリック（左から右へスワイプ） ➔ 前のタブへ
                if (currentIndex > 0) {
                    setActiveTableTab(tabs[currentIndex - 1]);
                }
            }
        }
    };

    const handleDateChange = (newDateStr) => {
        if (newDateStr === selectedDate) return;
        const current = new Date(selectedDate);
        const next = new Date(newDateStr);
        setSlideDirection(next > current ? 'right' : 'left');
        setAnimationKey(prev => prev + 1);
        setDateAnimKey(prev => prev + 1);
        setSelectedDate(newDateStr);
    };

    // Version update check (Auto-detect deploy updates to avoid cache issues)
    useEffect(() => {
        const checkVersion = async () => {
            try {
                const res = await fetch(`/version.json?t=${Date.now()}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.version && data.version !== APP_VERSION) {
                        console.log(`[Version Check] New version available: ${data.version} (Current: ${APP_VERSION})`);
                        if (window.confirm(`新しいシステムアップデート（v${data.version}）が利用可能です。\n最新版を読み込むためにアプリを再起動しますか？`)) {
                            window.location.reload(true);
                        }
                    }
                }
            } catch (e) {
                console.warn('[Version Check] Failed to check for updates:', e);
            }
        };

        const timer = setTimeout(checkVersion, 3000);
        const interval = setInterval(checkVersion, 300000);

        return () => {
            clearTimeout(timer);
            clearInterval(interval);
        };
    }, []);

    // Track the last active panel to keep content stable during exit animation
    useEffect(() => {
        if (selectedChildId || selectedTreeChildId || selectedDocChildId) {
            setLastPanelData({
                memo: selectedChildId,
                tree: selectedTreeChildId,
                doc: selectedDocChildId
            });
        }
    }, [selectedChildId, selectedTreeChildId, selectedDocChildId]);

    const handlePanelClose = () => {
        setIsPanelClosing(true);
        setTimeout(() => {
            setSelectedChildId(null);
            setSelectedTreeChildId(null);
            setSelectedDocChildId(null);
            setIsPanelClosing(false);
        }, 500);
    };

    // Prevent background scrolling when panel is open
    useEffect(() => {
        const isAnyPanelOpen = !!(selectedChildId || selectedTreeChildId || selectedDocChildId || isPanelClosing);
        if (isAnyPanelOpen) {
            document.body.style.overflow = 'hidden';
            document.body.style.touchAction = 'none'; // Further restrict gestures on body
        } else {
            document.body.style.overflow = '';
            document.body.style.touchAction = '';
        }
        return () => {
            document.body.style.overflow = '';
            document.body.style.touchAction = '';
        };
    }, [selectedChildId, selectedTreeChildId, selectedDocChildId, isPanelClosing]);


    const [tags, setTags] = useState(() => {
        const defaultTags = ['【ツリー式学習】', '【宿題】', '【プリント】', '【プログラム】', '【おやつ】', '【自由時間】'];
        try {
            const saved = localStorage.getItem('care_pro_tags');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (!parsed.includes('【自由時間】')) {
                    const newTags = [...parsed, '【自由時間】'];
                    localStorage.setItem('care_pro_tags', JSON.stringify(newTags));
                    return newTags;
                }
                return parsed;
            }
        } catch (e) { console.error('Tags load error', e); }
        return defaultTags;
    });

    // --- Hooks (MUST be called before any early returns) ---

    // Storage helper
    const cs = useCallback((p) => callStorage(p, () => { }, () => { }), []);

    // 1. Data Fetching Callback
    const fetchDailyData = useCallback(async (dateString, officeId) => {
        const data = await cs({ action: 'getReport', date: dateString, officeId });
        if (data && typeof data === 'object') {
            setResults(data.results || {});
            setSummaryC(data.summaryC || '');
            setDailyMessages(data.messages || {});
            setChildren(Array.isArray(data.children) ? data.children : []);
            setDailyTable(data.dailyTable || {});
            setGlobalLog(data.globalLog || { admin: '', supervisor: '', notice: '', activities: '', programTitle: '', programSummary: '' });
        } else {
            setResults({}); setSummaryC(''); setDailyMessages({}); setChildren([]);
            setDailyTable({}); setGlobalLog({ admin: '', supervisor: '', notice: '', activities: '', programTitle: '', programSummary: '' });
        }

        const att = await cs({ action: 'getAttendance', date: dateString, officeId });
        const formattedAtt = {};
        if (att && typeof att === 'object') {
            Object.keys(att).forEach(staffId => {
                formattedAtt[staffId] = {
                    ...att[staffId],
                    startTime: roundTo5Minutes(att[staffId].startTime || '09:30'),
                    endTime: roundTo5Minutes(att[staffId].endTime || '18:30')
                };
            });
        }
        setAttendance(formattedAtt);
    }, [cs]);

    // 1.2 Staff Attendance Change and Auto-save Handler
    const handleStaffAttendanceChange = useCallback(async (staffId, field, value) => {
        const staffObj = staffList.find(s => s.id === staffId);
        const staffName = staffObj ? staffObj.name : '';
        const staffRole = staffObj ? (staffObj.role || '') : '';
        setAttendance(prev => {
            const currentRecord = prev[staffId] || { type: 'work', startTime: '09:30', endTime: '18:30', name: staffName, role: staffRole };
            const updatedRecord = { ...currentRecord, [field]: value, name: staffName, role: staffRole };
            const updatedAttendance = { ...prev, [staffId]: updatedRecord };
            
            // Background auto-save to Firestore
            cs({
                action: 'saveAttendance',
                date: selectedDate,
                officeId: selectedOffice?.id,
                data: updatedAttendance
            }).catch(err => {
                console.error('Failed to auto-save attendance data:', err);
            });

            return updatedAttendance;
        });
    }, [cs, selectedDate, selectedOffice, staffList]);

    // 1.5 Fetch Master Children
    const fetchMasterChildren = useCallback(async () => {
        const list = await cs({ action: 'getMasterChildren' });
        setMasterChildren(list || []);
    }, [cs]);

    // 1.6 Fetch Staff Names
    const fetchStaffNames = useCallback(async () => {
        try {
            console.log('[Staff Debug] Fetching staff names...');
            const list = await cs({ action: 'getStaffNames' });
            console.log('[Staff Debug] Received list:', list);
            console.log('[Staff Debug] Staff roles:', list?.map(s => `${s.name}: role="${s.role || '(なし)'}"`));
            if (!list || list.length === 0) {
                console.warn('[Staff Debug] Firestore staff list is empty, using fallback.');
                setStaffList(STAFF_OPTIONS.map(name => ({ id: name, name: name })));
            } else {
                setStaffList(list);
            }
        } catch (e) {
            console.error('[Staff Debug] Fetch failed:', e);
            setStaffList(STAFF_OPTIONS.map(name => ({ id: name, name: name })));
        }
    }, [cs]);

    // 1.7 Fetch Offices
    const fetchOffices = useCallback(async () => {
        try {
            console.log('[Office Debug] Fetching offices...');
            const list = await cs({ action: 'getOffices' });
            console.log('[Office Debug] Received offices:', list);
            setOffices(list || []);
            
            if (list && list.length > 0) {
                setSelectedOffice(prev => {
                    if (prev && list.some(o => o.id === prev.id)) {
                        return prev;
                    }
                    const defaultOffice = list[0];
                    localStorage.setItem('care_pro_selected_office', JSON.stringify(defaultOffice));
                    return defaultOffice;
                });
            }
        } catch (e) {
            console.error('[Office Debug] Fetch failed:', e);
        }
    }, [cs]);

    useEffect(() => {
        console.log('[Staff Debug] staffList state updated:', staffList);
    }, [staffList]);

    // 2. Auth Listener
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (u) => {
            console.log('[Auth Debug] Auth state changed. User:', u ? u.email : 'null');
            setUser(u);
            setAuthLoading(false);
            if (u) {
                console.log('[Auth Debug] User detected, triggering initial fetches...');
                fetchMasterChildren();
                fetchStaffNames();
                fetchOffices();
            }
        });
        return () => unsubscribe();
    }, [fetchMasterChildren, fetchStaffNames, fetchOffices]);

    // 2.5 Authentication Bridge (Portal integration)
    useEffect(() => {
        const handleAuthMessage = async (event) => {
            const msg = event.data;
            if (msg && msg.type === 'PORTAL_AUTH_DATA') {
                const { employeeEmail, employeePassword } = msg.payload || {};
                if (employeeEmail && employeePassword) {
                    try {
                        await signInWithEmailAndPassword(auth, employeeEmail, employeePassword);
                        console.log('Auth Bridge: Success');
                    } catch (err) {
                        console.error('Auth Bridge: Error', err);
                    }
                }
            }
        };
        window.addEventListener('message', handleAuthMessage);
        return () => window.removeEventListener('message', handleAuthMessage);
    }, []);

    useEffect(() => {
        if (!user || !selectedOffice) return;

        setIsSyncing(true);
        const reportId = selectedOffice.id ? `${selectedOffice.id}_${selectedDate}` : selectedDate;

        // 1. Reports コレクションのリアルタイム同期リスナー登録
        const reportDocRef = doc(firestore, 'reports', reportId);
        const unsubscribeReport = onSnapshot(reportDocRef, (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                setActiveLocks(data.activeLocks || {});
                // 楽観的ローカル更新（hasPendingWrites）の場合は、入力フォーカス外れを防ぐため状態更新をスキップ
                if (!snap.metadata.hasPendingWrites) {
                    setResults(data.results || {});
                    setSummaryC(data.summaryC || '');
                    setDailyMessages(data.messages || {});
                    setChildren(Array.isArray(data.children) ? data.children : []);
                    setDailyTable(data.dailyTable || {});
                    setGlobalLog(data.globalLog || { admin: '', supervisor: '', notice: '', activities: '', programTitle: '', programSummary: '' });
                }
            } else {
                setActiveLocks({});
                if (!snap.metadata.hasPendingWrites) {
                    setResults({});
                    setSummaryC('');
                    setDailyMessages({});
                    setChildren([]);
                    setDailyTable({});
                    setGlobalLog({ admin: '', supervisor: '', notice: '', activities: '', programTitle: '', programSummary: '' });
                }
            }
            setIsSyncing(false);
        }, (error) => {
            console.error("Error listening to report:", error);
            setIsSyncing(false);
        });

        // 2. Attendance コレクションのリアルタイム同期リスナー登録
        const attendanceId = selectedOffice.id ? `${selectedOffice.id}_${selectedDate}` : selectedDate;
        const attendanceDocRef = doc(firestore, 'attendance', attendanceId);
        const unsubscribeAttendance = onSnapshot(attendanceDocRef, (snap) => {
            if (snap.exists()) {
                const att = snap.data();
                if (!snap.metadata.hasPendingWrites) {
                    const formattedAtt = {};
                    Object.keys(att).forEach(staffId => {
                        formattedAtt[staffId] = {
                            ...att[staffId],
                            startTime: roundTo5Minutes(att[staffId].startTime || '09:30'),
                            endTime: roundTo5Minutes(att[staffId].endTime || '18:30')
                        };
                    });
                    setAttendance(formattedAtt);
                }
            } else {
                if (!snap.metadata.hasPendingWrites) {
                    setAttendance({});
                }
            }
        }, (error) => {
            console.error("Error listening to attendance:", error);
        });

        return () => {
            unsubscribeReport();
            unsubscribeAttendance();
        };
    }, [selectedDate, selectedOffice, user]);

    // Heartbeat for keeping lock active (every 2 minutes)
    useEffect(() => {
        let intervalId = null;
        const currentId = selectedChildId;
        
        if (currentId) {
            intervalId = setInterval(() => {
                console.log('[Lock Heartbeat] Renewing lock for child:', currentId);
                acquireLock(currentId);
            }, 2 * 60 * 1000); // 2 minutes
        }
        
        return () => {
            if (intervalId) {
                clearInterval(intervalId);
            }
        };
    }, [selectedChildId, acquireLock]);

    // Handle switching selected child
    useEffect(() => {
        const prevId = prevSelectedChildIdRef.current;
        prevSelectedChildIdRef.current = selectedChildId;
        
        const updateLocks = async () => {
            if (prevId && prevId !== selectedChildId) {
                console.log('[Lock Switch] Releasing lock for prev child:', prevId);
                await releaseLock(prevId);
            }
            if (selectedChildId) {
                if (justAcquiredLockRef.current === selectedChildId) {
                    // Already acquired via click handler transaction, skip duplicate write
                    justAcquiredLockRef.current = null;
                    return;
                }
                console.log('[Lock Switch] Acquiring lock for current child:', selectedChildId);
                const success = await acquireLock(selectedChildId);
                if (!success) {
                    showToast('この児童は現在、他ユーザーが入力中のため編集できません。');
                    setSelectedChildId(null);
                }
            }
        };
        
        updateLocks();
    }, [selectedChildId, acquireLock, releaseLock]);

    // Close panel and release lock when selected date or office changes
    useEffect(() => {
        setSelectedChildId(null);
        setSelectedTreeChildId(null);
        setSelectedDocChildId(null);
    }, [selectedDate, selectedOffice]);

    // Release lock on unmount or tab/window close
    useEffect(() => {
        const handleBeforeUnload = () => {
            if (prevSelectedChildIdRef.current) {
                releaseLock(prevSelectedChildIdRef.current);
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            if (prevSelectedChildIdRef.current) {
                releaseLock(prevSelectedChildIdRef.current);
            }
        };
    }, [releaseLock]);

    // 5. Normal Functions & Handlers
    const handleUpdateTags = (newTags) => {
        setTags(newTags);
        localStorage.setItem('care_pro_tags', JSON.stringify(newTags));
    };

    const handleLogout = async () => {
        if (!confirm('ログアウトしますか？')) return;
        if (selectedChildId) {
            await releaseLock(selectedChildId);
        }
        await signOut(auth);
    };

    const SLOT_LIMIT = 10;
    const sortedChildren = [...children].sort((a, b) => {
        if (sortConfig.key === 'transportTime') {
            const timeA = dailyTable[a.id]?.transportTime || '';
            const timeB = dailyTable[b.id]?.transportTime || '';
            if (!timeA && timeB) return 1;
            if (timeA && !timeB) return -1;
            if (timeA === timeB) return (a.timestamp || 0) - (b.timestamp || 0);
            return sortConfig.direction === 'asc' ? timeA.localeCompare(timeB) : timeB.localeCompare(timeA);
        } else if (sortConfig.key === 'endTime') {
            const timeA = dailyTable[a.id]?.endTime || '';
            const timeB = dailyTable[b.id]?.endTime || '';
            if (!timeA && timeB) return 1;
            if (timeA && !timeB) return -1;
            if (timeA === timeB) return (a.timestamp || 0) - (b.timestamp || 0);
            return sortConfig.direction === 'asc' ? timeA.localeCompare(timeB) : timeB.localeCompare(timeA);
        }
        return (a.timestamp || 0) - (b.timestamp || 0);
    });
    // Filter active and absent children
    const absentChildren = sortedChildren.filter(c => c.isAbsent === true);
    const activeChildren = sortedChildren.filter(c => c.isAbsent !== true);
    
    // Partition active children into regular and waitlisted
    const regularChildren = [];
    const waitlistChildren = [];
    
    activeChildren.forEach((child, index) => {
        if (child.isWaitlist === true) {
            waitlistChildren.push(child);
        } else if (child.isWaitlist === false) {
            regularChildren.push(child);
        } else {
            // Backward-compatible fallback for older records without explicit fields
            if (index < SLOT_LIMIT) {
                regularChildren.push(child);
            } else {
                waitlistChildren.push(child);
            }
        }
    });

    const displayRegular = [...regularChildren];
    while (displayRegular.length < SLOT_LIMIT) {
        displayRegular.push({ id: `empty-${displayRegular.length}`, name: '未設定', isPlaceholder: true });
    }

    const saveDailyData = async (date, ch, msgs, res, sum, table, global) => {
        setIsSyncing(true);
        const dailyData = { children: ch, messages: msgs, results: res, summaryC: sum, dailyTable: table || dailyTable, globalLog: global || globalLog, updatedAt: new Date().toISOString() };

        const savePromise = (async () => {
            // 1. Save traditional daily bulk report
            await cs({ action: 'saveReport', date, data: dailyData, officeId: selectedOffice?.id });

            // 2. Save individual child communications for cross-app synchronization
            for (const child of ch) {
                if (child.isPlaceholder) continue;

                const childResult = res[child.id] || {};
                const childTable = (table || dailyTable)[child.id] || {};

                const individualData = {
                    name: child.name,
                    tree_comm_text: childResult.D || '',
                    pickupLocation: childTable.pickupLocation || '',
                    endTime: childTable.endTime || '',
                    transportTime: childTable.transportTime || '',
                    notes: childTable.notes || ''
                };

                await cs({
                    action: 'saveIndividualTreeComm',
                    childId: child.id,
                    date: date,
                    data: individualData
                });
            }
        })();

        activeSavePromiseRef.current = savePromise;

        try {
            await savePromise;
        } finally {
            setIsSyncing(false);
        }
    };

    const updateGlobalLog = async (field, value) => {
        const newLog = { ...globalLog, [field]: value };
        setGlobalLog(newLog);
        await saveDailyData(selectedDate, children, dailyMessages, results, summaryC, dailyTable, newLog);
    };

    const handleAddMultipleFromMaster = async (selectedChildren, isWaitlist = false) => {
        if (selectedChildren.length === 0) return;
        const newChildrenToAdd = selectedChildren.filter(sc => !children.some(c => c.id === sc.id));
        if (newChildrenToAdd.length === 0) {
            showToast(`選択された児童はすべて既に追加されています。`);
            return;
        }
        
        const newList = [...children];
        const newTable = { ...dailyTable };
        
        newChildrenToAdd.forEach(sc => {
            const newChild = { ...sc, isWaitlist, isAbsent: false, timestamp: Date.now() };
            newList.push(newChild);
            newTable[newChild.id] = {
                ...(dailyTable[newChild.id] || {}),
                pickupLocation: sc.defaultPickupLocation || ''
            };
        });
        
        setChildren(newList);
        setDailyTable(newTable);
        
        if (isWaitlist) {
            setIsWaitlistExpanded(true);
        }
        
        await saveDailyData(selectedDate, newList, dailyMessages, results, summaryC, newTable, globalLog);
        showToast(`${newChildrenToAdd.length}名の児童を${isWaitlist ? 'キャンセル待ち' : '通常児童'}として追加しました。`);
    };

    const updateChildStatus = async (childId, targetStatus) => {
        const targetChild = children.find(c => c.id === childId);
        if (!targetChild) return;
        
        const newList = children.map(c => {
            if (c.id === childId) {
                if (targetStatus === 'regular') {
                    return { ...c, isWaitlist: false, isAbsent: false, timestamp: Date.now() };
                } else if (targetStatus === 'waitlist') {
                    return { ...c, isWaitlist: true, isAbsent: false };
                } else if (targetStatus === 'absent') {
                    return { ...c, isWaitlist: false, isAbsent: true };
                }
            }
            return c;
        });
        
        setChildren(newList);
        
        if (targetStatus === 'waitlist') {
            setIsWaitlistExpanded(true);
        } else if (targetStatus === 'absent') {
            setIsAbsentExpanded(true);
        }
        
        await saveDailyData(selectedDate, newList, dailyMessages, results, summaryC, dailyTable, globalLog);
        
        const statusNames = { regular: '通常（出席）', waitlist: 'キャンセル待ち', absent: '欠席' };
        showToast(`${targetChild.lastName ? `${targetChild.lastName} ${targetChild.firstName}` : targetChild.name}を${statusNames[targetStatus]}に移動しました。`);
    };

    const startLongPress = (e, childId, type) => {
        e.persist();
        
        const targetChild = children.find(c => c.id === childId);
        if (!targetChild) return;
        
        if (longPressTimers.current[childId]) {
            clearTimeout(longPressTimers.current[childId]);
        }
        
        isPressing.current[childId] = true;
        hasTriggeredLongPress.current[childId] = false;
        
        const triggerTime = 600;
        
        setPressingChildId({ id: childId, type });
        
        longPressTimers.current[childId] = setTimeout(() => {
            if (isPressing.current[childId]) {
                hasTriggeredLongPress.current[childId] = true;
                isPressing.current[childId] = false;
                setPressingChildId(null);
                
                setStatusMenuChild({ child: targetChild, currentStatus: type });
            }
        }, triggerTime);
    };

    const cancelLongPress = (e, childId) => {
        if (longPressTimers.current[childId]) {
            clearTimeout(longPressTimers.current[childId]);
            delete longPressTimers.current[childId];
        }
        isPressing.current[childId] = false;
        setPressingChildId(null);
    };

    const handleTouchStart = (e, childId, type) => {
        const touch = e.touches[0];
        touchStartPos.current[childId] = { x: touch.clientX, y: touch.clientY };
        startLongPress(e, childId, type);
    };

    const handleTouchMove = (e, childId) => {
        if (!isPressing.current[childId]) return;
        const touch = e.touches[0];
        const start = touchStartPos.current[childId];
        if (start) {
            const dx = touch.clientX - start.x;
            const dy = touch.clientY - start.y;
            if (Math.sqrt(dx * dx + dy * dy) > 10) {
                cancelLongPress(e, childId);
            }
        }
    };

    const updateDailyTable = async (childId, data) => {
        const newTable = { ...dailyTable, [childId]: { ...(dailyTable[childId] || {}), ...data } };
        setDailyTable(newTable);
        await saveDailyData(selectedDate, children, dailyMessages, results, summaryC, newTable, globalLog);
    };

    const removeChild = async (id) => {
        if (!confirm('削除しますか？')) return;
        const newList = children.filter(c => c.id !== id);
        setChildren(newList);
        await saveDailyData(selectedDate, newList, dailyMessages, results, summaryC, dailyTable, globalLog);
    };

    const handleSort = (key) => {
        setSortConfig(prev => {
            if (prev.key === key) {
                if (prev.direction === 'asc') return { key, direction: 'desc' };
                return { key: 'default', direction: 'asc' }; // Reset to manual order
            }
            return { key, direction: 'asc' };
        });
    };

    const sendMessage = async (childId, text, tag) => {
        const staffName = getCurrentStaffName();
        const newMsg = { 
            id: crypto.randomUUID(), 
            text, 
            timestamp: new Date().toISOString(), 
            included: true,
            staffName: staffName,
            tag: tag || null
        };
        const newMessages = { ...dailyMessages, [childId]: [...(dailyMessages[childId] || []), newMsg] };
        setDailyMessages(newMessages);
        await saveDailyData(selectedDate, children, newMessages, results, summaryC, dailyTable, globalLog);
    };

    const deleteMessage = async (childId, msgId) => {
        if (!confirm('メッセージを削除しますか？')) return;
        const newMsgs = (dailyMessages[childId] || []).filter(m => m.id !== msgId);
        const newMessages = { ...dailyMessages, [childId]: newMsgs };
        setDailyMessages(newMessages);
        await saveDailyData(selectedDate, children, newMessages, results, summaryC, dailyTable, globalLog);
    };

    const updateMessage = async (childId, msgId, newText) => {
        const newMsgs = (dailyMessages[childId] || []).map(m => m.id === msgId ? { ...m, text: newText } : m);
        const newMessages = { ...dailyMessages, [childId]: newMsgs };
        setDailyMessages(newMessages);
        await saveDailyData(selectedDate, children, newMessages, results, summaryC, dailyTable, globalLog);
    };

    const saveResults = async (res, sum) => {
        setResults(res); setSummaryC(sum);
        await saveDailyData(selectedDate, children, dailyMessages, res, sum, dailyTable, globalLog);
    };

    const copyAllTreeCommunications = () => {
        const activeChildren = children.filter(c => !c.isPlaceholder);
        if (activeChildren.length === 0) {
            alert('児童データがありません。');
            return;
        }
        
        let text = `=== ${selectedDate} ツリー通信一括コピー ===\n\n`;
        let count = 0;
        
        activeChildren.forEach(child => {
            const result = results[child.id] || {};
            const content = result.D || '';
            if (content.trim()) {
                const staff = result.staffName ? ` (担当: ${result.staffName})` : '';
                text += `【${child.lastName ? `${child.lastName} ${child.firstName}` : child.name} 様】${staff}\n${content.trim()}\n\n`;
                text += `--------------------------------\n\n`;
                count++;
            }
        });
        
        if (count === 0) {
            alert('本日のツリー通信が入力されている児童はいません。');
            return;
        }
        
        navigator.clipboard.writeText(text)
            .then(() => {
                alert(`入力済みのツリー通信（${count}名分）をクリップボードに一括コピーしました！`);
            })
            .catch(err => {
                console.error('Failed to copy text: ', err);
                alert('コピーに失敗しました。');
            });
    };

    const handleCopySingle = (childId, childName, text) => {
        if (!text || !text.trim()) {
            alert('この児童のツリー通信はまだ入力されていません。');
            return;
        }
        const textToCopy = `${childName}さん\n${text}`;
        navigator.clipboard.writeText(textToCopy)
            .then(() => {
                setCopiedChildId(childId);
                setTimeout(() => {
                    setCopiedChildId(null);
                }, 2000);
            })
            .catch(err => {
                console.error('Failed to copy: ', err);
                alert('コピーに失敗しました。');
            });
    };

    const showToast = (message) => {
        setToast(message);
        setTimeout(() => setToast(null), 5000);
    };


    // タグ抽出
    const getStudyText = (childId) => {
        const msgs = dailyMessages[childId] || [];
        return msgs.filter(m => {
            const hasStudyTag = m.tag && (m.tag === '【ツリー式学習】' || m.tag === '【学習】' || m.tag === '【宿題】' || m.tag === '【プリント】');
            const hasTextPrefix = m.text.includes('【ツリー式学習】') || m.text.includes('【学習】') || m.text.includes('【宿題】') || m.text.includes('【プリント】');
            return hasStudyTag || hasTextPrefix;
        })
        .map(m => {
            let t = m.text.trim();
            if (m.tag && !t.includes(m.tag)) {
                t = `${m.tag}${t}`;
            }
            return t;
        }).filter(t => t).join('\n');
    };
    const getProgramText = (childId) => {
        const msgs = dailyMessages[childId] || [];
        return msgs.filter(m => {
            const hasProgTag = m.tag && m.tag === '【プログラム】';
            const hasTextPrefix = m.text.includes('【プログラム】');
            return hasProgTag || hasTextPrefix;
        })
        .map(m => {
            let t = m.text.trim();
            if (m.tag && !t.includes(m.tag)) {
                t = `${m.tag}${t}`;
            }
            return t;
        }).filter(t => t).join(' / ');
    };

    // 業務・活動内容ラベル（ダッシュボードモード用インライン表示）
    const dashboardActivityLabels = (() => {
        const activities = globalLog.activities || '';
        let parsed = { group1: [], group2: [] };
        if (activities) {
            if (typeof activities === 'object') { parsed = activities; }
            else { try { parsed = JSON.parse(activities); } catch { /* ignore */ } }
        }
        const labels = [];
        GROUP1_ITEMS.forEach(item => { if ((parsed.group1 || []).includes(item.id)) labels.push(item.label); });
        GROUP2_ITEMS.forEach(item => { if ((parsed.group2 || []).includes(item.id)) labels.push(item.label); });
        return labels;
    })();

    // 6. JSX Return (Conditional inside to keep hook order)
    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-10 h-10 text-tree-500 animate-spin" />
                    <p className="font-black text-slate-400 uppercase tracking-widest text-xs">Authenticating...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return <Login onLoginSuccess={() => { }} />;
    }

    return (
        <div className="min-h-screen p-3 md:p-6 pb-24 space-y-4 md:space-y-6 max-w-[1800px] mx-auto overflow-x-hidden">
            {/* Ultra Compact Responsive Header */}
            <header className="sticky top-0 z-[50] bg-white/70 backdrop-blur-xl rounded-2xl md:rounded-[2.5rem] flex flex-col gap-3 px-4 py-3 md:px-6 md:py-4 mb-6 border border-white/40 shadow-premium no-print">
                {/* 1段目: タイトルと右側アクションボタン */}
                <div className="flex items-center justify-between w-full">
                    {/* Title */}
                    <div className="flex items-center gap-3">
                        <div className="p-1.5 md:p-2 bg-tree-600 rounded-xl shadow-lg flex-shrink-0">
                            <FileText className="w-4 h-4 md:w-5 md:h-5 text-white" />
                        </div>
                        <h1 className="text-base md:text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                            <span>業務管理日誌</span>
                            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full select-none">
                                v{APP_VERSION}
                            </span>
                        </h1>
                    </div>

                    {/* Right Side: Action Buttons & Office selector (Hidden on screens below lg) */}
                    <div className="hidden lg:flex items-center gap-2 md:gap-4">
                        {/* Office Selector Dropdown */}
                        {offices.length > 0 && (
                            <div className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-50/80 hover:bg-tree-50 rounded-full border border-slate-100 transition-all group relative min-w-0">
                                <LayoutPanelLeft className="w-3.5 h-3.5 text-tree-600 flex-shrink-0" />
                                <select
                                    value={selectedOffice?.id || ''}
                                    onChange={(e) => {
                                        const office = offices.find(o => o.id === e.target.value);
                                        if (office) {
                                            setSelectedOffice(office);
                                            localStorage.setItem('care_pro_selected_office', JSON.stringify(office));
                                        }
                                    }}
                                    className="bg-transparent font-black text-slate-700 text-[10px] md:text-xs tracking-tight border-none outline-none cursor-pointer pr-4 appearance-none text-center truncate"
                                >
                                    {offices.map(o => (
                                        <option key={o.id} value={o.id}>{o.name}</option>
                                    ))}
                                </select>
                                <ChevronDown className="w-3 h-3 text-slate-300 absolute right-3 pointer-events-none flex-shrink-0" />
                            </div>
                        )}

                        <div className="flex items-center gap-2 mr-2">
                            <button
                                id="guide-add-child"
                                onClick={() => setShowAddChildModal(true)}
                                className="px-3 py-2 md:px-5 md:py-2.5 bg-tree-600 hover:bg-tree-700 text-white rounded-full font-black text-[10px] md:text-sm shadow-md transition-all active:scale-95 flex items-center gap-2"
                            >
                                <PlusCircle className="w-4 h-4" />
                                <span className="hidden sm:inline">児童追加</span>
                            </button>

                            <button
                                id="guide-print"
                                onClick={() => printAllDocuments(children, results, summaryC, selectedDate, dailyTable, dailyMessages, globalLog, attendance, filteredStaffList)}
                                className="px-3 py-2 md:px-5 md:py-2.5 bg-wood-600 hover:bg-wood-700 text-white rounded-full font-black text-[10px] md:text-sm shadow-md transition-all active:scale-95 flex items-center gap-2"
                            >
                                <Printer className="w-4 h-4" />
                                <span className="hidden sm:inline">印刷</span>
                            </button>

                            <button
                                onClick={() => setShowActivitiesModal(true)}
                                className="px-2.5 py-1.5 text-slate-500 hover:text-wood-700 hover:bg-wood-50/50 rounded-full border border-slate-200/60 hover:border-wood-200 shadow-sm transition-all active:scale-95 flex items-center gap-1.5"
                                title="業務活動内容登録"
                            >
                                <ClipboardList className="w-3.5 h-3.5 text-wood-500" />
                                <span className="text-[10px] font-black">業務活動内容</span>
                            </button>

                            <button
                                onClick={() => setShowNoticeModal(true)}
                                className="px-2.5 py-1.5 text-slate-500 hover:text-apple-700 hover:bg-apple-50/50 rounded-full border border-slate-200/60 hover:border-apple-200 shadow-sm transition-all active:scale-95 flex items-center gap-1.5"
                                title="全体的な様子登録"
                            >
                                <FileText className="w-3.5 h-3.5 text-apple-500" />
                                <span className="text-[10px] font-black">全体的な様子</span>
                            </button>
                            
                            <button
                                id="guide-export"
                                onClick={() => setShowExportModal(true)}
                                className="px-2.5 py-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-full border border-slate-200/60 hover:border-slate-300 shadow-sm transition-all active:scale-95 flex items-center gap-1.5"
                                title="データ出力"
                            >
                                <FileSpreadsheet className="w-3.5 h-3.5 text-slate-400" />
                                <span className="text-[10px] font-black">データ出力</span>
                            </button>

                            <button
                                id="guide-attendance"
                                onClick={() => setShowAttendanceModal(true)}
                                className="px-2.5 py-1.5 text-slate-500 hover:text-tree-700 hover:bg-tree-50/50 rounded-full border border-slate-200/60 hover:border-tree-200 shadow-sm transition-all active:scale-95 flex items-center gap-1.5"
                                title="勤怠管理"
                            >
                                <UserCheck className="w-3.5 h-3.5 text-tree-500" />
                                <span className="text-[10px] font-black">勤怠管理</span>
                            </button>
                        </div>

                        <div className="w-px h-6 bg-slate-200 hidden md:block" />

                        <div className="flex flex-col items-end gap-0.5">
                            <div className="flex items-center gap-1">
                                <button id="guide-help" onClick={() => setShowHelpGuide(true)} className="p-2 hover:bg-tree-50 rounded-xl transition-all active:scale-95 group">
                                    <HelpCircle className="w-4.5 h-4.5 text-tree-600 group-hover:scale-110 transition-transform" />
                                </button>
                                <button onClick={() => setShowSettingsModal(true)} className="p-2 hover:bg-tree-50 rounded-xl transition-all active:scale-95 group">
                                    <Settings id="guide-settings" className="w-4.5 h-4.5 text-slate-400 group-hover:rotate-45 transition-transform" />
                                </button>
                                <button onClick={handleLogout} className="p-2 hover:bg-apple-50 rounded-xl transition-all active:scale-95 group" title="ログアウト">
                                    <LogOut className="w-4.5 h-4.5 text-slate-400 group-hover:text-apple-500" />
                                </button>
                            </div>
                            <span className="text-[10px] font-black text-slate-500 pr-2">
                                ログイン中: {getCurrentStaffName()}
                            </span>
                        </div>
                    </div>
                </div>

                {/* 2段目: 昨日 ← 今日 → 明日 (日付切り替え) */}
                <div className="flex items-center justify-center w-full">
                    <div className="flex items-center bg-slate-100/50 p-1 rounded-full border border-slate-200/30 max-w-[340px] md:max-w-md w-full justify-between shadow-inner">
                        {/* 昨日 */}
                        <button
                            onClick={() => handleDateChange(getOffsetDateString(selectedDate, -1))}
                            className="flex-1 py-1.5 hover:bg-white hover:shadow-sm rounded-full font-bold text-[9px] md:text-xs text-slate-500 hover:text-tree-600 transition-all text-center truncate"
                        >
                            {getFormattedDateWithDay(getOffsetDateString(selectedDate, -1))}
                        </button>
                        
                        <span className="text-slate-300 font-light text-[10px] px-1">←</span>

                        {/* 今日 (クリックでカレンダー) */}
                        <button
                            id="guide-date-picker"
                            onClick={() => setShowCalendarModal(true)}
                            className="flex-1 py-2 px-3 md:px-5 bg-tree-600 text-white rounded-full font-black text-[10px] md:text-xs shadow-md hover:bg-tree-700 transition-all text-center flex items-center justify-center gap-1 md:gap-1.5 overflow-hidden"
                        >
                            <CalendarIcon className="w-3 h-3 md:w-3.5 md:h-3.5 flex-shrink-0" />
                            <span
                                key={dateAnimKey}
                                className={cn(
                                    "truncate inline-block",
                                    slideDirection === 'left' ? "date-slide-left" :
                                    slideDirection === 'right' ? "date-slide-right" : ""
                                )}
                            >{getFormattedDateWithDay(selectedDate)}</span>
                        </button>

                        <span className="text-slate-300 font-light text-[10px] px-1">→</span>

                        {/* 明日 */}
                        <button
                            onClick={() => handleDateChange(getOffsetDateString(selectedDate, 1))}
                            className="flex-1 py-1.5 hover:bg-white hover:shadow-sm rounded-full font-bold text-[9px] md:text-xs text-slate-500 hover:text-tree-600 transition-all text-center truncate"
                        >
                            {getFormattedDateWithDay(getOffsetDateString(selectedDate, 1))}
                        </button>
                    </div>
                </div>
            </header>

            {/* 本日のプログラム登録ボタン (コンパクト設計) */}
            <div className="flex justify-center w-full mt-2 mb-1 no-print">
                <button
                    onClick={() => setShowProgramModal(true)}
                    className="px-3.5 py-1.5 bg-wood-50 hover:bg-wood-100 text-wood-700 rounded-full font-bold text-[10px] md:text-xs border border-wood-200/40 transition-all text-center flex items-center justify-center gap-1 active:scale-95 shadow-sm"
                >
                    <ClipboardList className="w-3.5 h-3.5 text-wood-600" />
                    <span>本日のプログラム登録</span>
                    {globalLog.programTitle && (
                        <span className="w-1.5 h-1.5 bg-wood-500 rounded-full ml-1" title={`登録済: ${globalLog.programTitle}`} />
                    )}
                </button>
            </div>

            <div 
                key={animationKey}
                className={cn(
                    "w-full transition-all",
                    slideDirection === 'left' ? "animate-in slide-in-from-right-8" :
                    slideDirection === 'right' ? "animate-in slide-in-from-left-8" : "animate-in fade-in duration-300"
                )}
            >
            {/* ダッシュボードモード: 上段情報バー（職員・全体・業務） */}
            {isDashboardMode && (
                <div className="hidden lg:grid grid-cols-[minmax(280px,310px)_1fr_minmax(160px,190px)] gap-3 mb-3">

                    {/* 左: 職員配置（役職・名前直接編集可、スクロールなし） */}
                    <div id="guide-staff-section" className="bg-white/95 backdrop-blur-xl rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                        <div className="flex items-center gap-2 px-3 py-2 bg-tree-50/80 border-b border-tree-100 flex-shrink-0">
                            <UserCheck className="w-3.5 h-3.5 text-tree-600" />
                            <span className="text-[10px] font-black text-tree-700 uppercase tracking-widest">職員配置</span>
                        </div>
                        <div className="flex flex-col">
                            {filteredStaffList.length === 0 ? (
                                <div className="py-6 text-center text-slate-300 text-[10px] font-bold">スタッフ未登録</div>
                            ) : (() => {
                                // 役職順にグループ分け（印刷レイアウトと同じ順番）
                                const roleOrder = ['管理者', '児発管', '児童指導員・保育士', '指導員'];
                                const flatStaffWithRoles = [];

                                filteredStaffList.forEach(staff => {
                                    const post = staff.post || staff.role || '';
                                    const posts = Array.isArray(post) ? post : [post];
                                    const resolved = posts.map(p => getRoleFromPost(p)).filter(Boolean);
                                    let uniqueRoles = resolved.length > 0 ? [...new Set(resolved)] : ['児童指導員・保育士'];
                                    uniqueRoles = uniqueRoles.map(r => roleOrder.includes(r) ? r : '児童指導員・保育士');
                                    const cleanRoles = [...new Set(uniqueRoles)];
                                    cleanRoles.forEach(role => {
                                        flatStaffWithRoles.push({ staff, role });
                                    });
                                });

                                // 役職順にソート
                                flatStaffWithRoles.sort((a, b) => {
                                    return roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role);
                                });

                                return flatStaffWithRoles.map(({ staff, role }) => {
                                    const record = attendance[staff.id] || { type: 'work', startTime: '09:30', endTime: '18:30' };
                                    const isWork = record.type === 'work';
                                    const [startHour, startMin] = (record.startTime || '09:30').split(':');
                                    const [endHour, endMin] = (record.endTime || '18:30').split(':');
                                    
                                    const handleTimeUpdate = (field, part, val) => {
                                        const currentVal = record[field] || (field === 'startTime' ? '09:30' : '18:30');
                                        const [h, m] = currentVal.split(':');
                                        const newTime = part === 'hour' ? `${val}:${m || '00'}` : `${h || '00'}:${val}`;
                                        handleStaffAttendanceChange(staff.id, field, newTime);
                                    };

                                    return (
                                        <div key={`${staff.id}-${role}`} className="grid grid-cols-[85px_1fr] border-b border-slate-100 last:border-0 hover:bg-slate-50/40 transition-all duration-200">
                                            {/* 左: 役職 */}
                                            <div className="bg-slate-50/70 border-r border-slate-100 flex items-center justify-center p-1.5 min-h-[34px]">
                                                <span className="text-[9px] font-black text-slate-500 text-center leading-normal select-none tracking-wider">
                                                    {role === '児童指導員・保育士' ? (
                                                        <>
                                                            児童指導員<br />保育士
                                                        </>
                                                    ) : role}
                                                </span>
                                            </div>
                                            {/* 右: 名前・状態 */}
                                            <div className="flex items-center justify-between gap-1.5 py-1 px-2.5">
                                                {/* 名前ボタン */}
                                                <button
                                                    onClick={() => handleStaffAttendanceChange(staff.id, 'type', record.type === 'work' ? 'public_holiday' : record.type === 'public_holiday' ? 'paid_leave' : 'work')}
                                                    className={`px-2 py-0.5 rounded text-[11.5px] font-black border transition-all text-left truncate flex-grow cursor-pointer ${
                                                        record.type === 'work'
                                                            ? 'bg-tree-50 text-tree-800 border-tree-200/60 hover:bg-tree-100/70'
                                                            : record.type === 'public_holiday'
                                                            ? 'bg-wood-50 text-wood-800 border-wood-200/60 hover:bg-wood-100/70'
                                                            : 'bg-apple-50 text-apple-800 border-apple-200/60 hover:bg-apple-100/70'
                                                    }`}
                                                    title="クリックで 出勤・公休・有給 を切り替え"
                                                >
                                                    {staff.name}
                                                </button>

                                                {/* 時間編集・または公休/有給テキスト */}
                                                {isWork ? (
                                                    <div className="flex items-center gap-[1px] text-[9px] flex-shrink-0 select-none">
                                                        <select value={startHour || '09'} onChange={e => handleTimeUpdate('startTime', 'hour', e.target.value)}
                                                            className="bg-white border border-slate-200 rounded text-[10px] font-bold text-slate-700 outline-none px-0.5 py-0 cursor-pointer appearance-none text-center w-[25px]">
                                                            {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                                                        </select>
                                                        <span className="text-slate-300 text-[8px] font-bold">:</span>
                                                        <select value={startMin || '30'} onChange={e => handleTimeUpdate('startTime', 'minute', e.target.value)}
                                                            className="bg-white border border-slate-200 rounded text-[10px] font-bold text-slate-700 outline-none px-0.5 py-0 cursor-pointer appearance-none text-center w-[25px]">
                                                            {MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
                                                        </select>
                                                        <span className="text-slate-300 text-[8px] font-bold px-0.5">〜</span>
                                                        <select value={endHour || '18'} onChange={e => handleTimeUpdate('endTime', 'hour', e.target.value)}
                                                            className="bg-white border border-slate-200 rounded text-[10px] font-bold text-slate-700 outline-none px-0.5 py-0 cursor-pointer appearance-none text-center w-[25px]">
                                                            {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                                                        </select>
                                                        <span className="text-slate-300 text-[8px] font-bold">:</span>
                                                        <select value={endMin || '30'} onChange={e => handleTimeUpdate('endTime', 'minute', e.target.value)}
                                                            className="bg-white border border-slate-200 rounded text-[10px] font-bold text-slate-700 outline-none px-0.5 py-0 cursor-pointer appearance-none text-center w-[25px]">
                                                            {MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
                                                        </select>
                                                    </div>
                                                ) : (
                                                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full select-none ${
                                                        record.type === 'public_holiday' 
                                                            ? 'bg-wood-100/50 text-wood-700' 
                                                            : 'bg-apple-100/50 text-apple-700'
                                                    }`}>
                                                        {record.type === 'public_holiday' ? '公休' : '有給'}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                });
                            })()}
                        </div>
                    </div>

                    {/* 中: 全体的な様子（クリックでモーダル編集） */}
                    <div
                        id="guide-notice-section"
                        className="bg-white/95 backdrop-blur-xl rounded-2xl border border-slate-100 shadow-sm overflow-hidden cursor-pointer hover:shadow-md hover:border-apple-200 transition-all group"
                        onClick={() => setShowNoticeModal(true)}
                    >
                        <div className="flex items-center justify-between px-3 py-2 bg-apple-50/80 border-b border-apple-100">
                            <span className="text-[10px] font-black text-apple-600 uppercase tracking-widest">全体的な様子・特記事項</span>
                            <span className="text-[9px] font-bold text-slate-300 group-hover:text-apple-500 transition-colors">タップして編集 →</span>
                        </div>
                        <div className="p-3 text-[11px] text-slate-700 leading-relaxed font-medium whitespace-pre-wrap break-words min-h-[80px] max-h-[200px] overflow-y-auto">
                            {globalLog.notice || summaryC || (
                                <span className="text-slate-300 italic text-[10px]">（タップして入力）</span>
                            )}
                        </div>
                    </div>

                    {/* 右: 業務・活動内容（クリックでモーダル編集） */}
                    <div
                        id="guide-activities-section"
                        className="bg-white/95 backdrop-blur-xl rounded-2xl border border-slate-100 shadow-sm overflow-hidden cursor-pointer hover:shadow-md hover:border-wood-200 transition-all group"
                        onClick={() => setShowActivitiesModal(true)}
                    >
                        <div className="flex items-center justify-between px-3 py-2 bg-wood-50/80 border-b border-wood-100">
                            <span className="text-[10px] font-black text-wood-600 uppercase tracking-widest">業務・活動内容</span>
                            <span className="text-[9px] font-bold text-slate-300 group-hover:text-wood-500 transition-colors">タップして編集 →</span>
                        </div>
                        <div className="p-3 text-[11px] text-slate-700 leading-relaxed space-y-1 min-h-[80px] max-h-[200px] overflow-y-auto">
                            {dashboardActivityLabels.length > 0 ? dashboardActivityLabels.map((label, i) => (
                                <div key={i} className="font-bold">{label}</div>
                            )) : (
                                <span className="text-slate-300 italic text-[10px]">（タップして登録）</span>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* 推移: 通常時の勤怠セクション（ダッシュボード時は非表示） */}
            {!isDashboardMode && (
            <div className="hidden md:flex bg-white/95 backdrop-blur-3xl rounded-[1.5rem] md:rounded-[2rem] shadow-premium border border-slate-100 p-3 md:p-4 mb-4 flex-col gap-2.5 no-print transition-all duration-300">
                <button
                    onClick={() => setIsKintaiExpanded(!isKintaiExpanded)}
                    className="flex items-center justify-between w-full text-left focus:outline-none"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-1.5 h-6 bg-tree-600 rounded-full" />
                        <h3 className="text-xs md:text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                            <UserCheck className="w-4.5 h-4.5 text-tree-600" />
                            <span>【本日のスタッフ勤怠状況】</span>
                        </h3>
                        <span className="hidden sm:inline-block text-[9px] font-black text-tree-600 uppercase tracking-widest bg-tree-50 px-3 py-1 rounded-full border border-tree-100 shadow-sm animate-pulse">
                            自動保存
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-400">
                            {isKintaiExpanded ? '閉じる' : '展開する'}
                        </span>
                        {isKintaiExpanded ? (
                            <ChevronUp className="w-4 h-4 text-slate-400" />
                        ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                    </div>
                </button>

                {isKintaiExpanded && (
                    <div className="animate-in fade-in duration-300">
                        {filteredStaffList.length === 0 ? (
                            <div className="text-center py-6 text-slate-400 font-bold text-xs bg-slate-50/50 rounded-2xl border border-slate-100">
                                この事業所にはスタッフが登録されていません。
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 pt-2 border-t border-slate-50">
                                {filteredStaffList.map(staff => {
                                    const record = attendance[staff.id] || { type: 'work', startTime: '09:30', endTime: '18:30' };
                                    const isWork = record.type === 'work';
                                    const [startHour, startMin] = (record.startTime || '09:30').split(':');
                                    const [endHour, endMin] = (record.endTime || '18:30').split(':');

                                    const handleTimeUpdate = (field, part, val) => {
                                        const currentVal = record[field] || (field === 'startTime' ? '09:30' : '18:30');
                                        const [h, m] = currentVal.split(':');
                                        let newTime = '';
                                        if (part === 'hour') {
                                            newTime = `${val}:${m || '00'}`;
                                        } else {
                                            newTime = `${h || '00'}:${val}`;
                                        }
                                        handleStaffAttendanceChange(staff.id, field, newTime);
                                    };

                                    return (
                                        <div key={staff.id} className="bg-slate-50/50 py-1.5 px-3 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between gap-3 hover:bg-white hover:shadow-premium transition-all duration-300 min-w-0">
                                            <div className="w-20 sm:w-24 flex-shrink-0 flex items-center gap-1.5 min-w-0">
                                                <div className="w-5.5 h-5.5 rounded-full bg-tree-100 flex items-center justify-center text-tree-600 font-black text-[9px] flex-shrink-0">
                                                    {staff.name.substring(0, 1)}
                                                </div>
                                                <span className="font-black text-slate-700 text-xs truncate" title={staff.name}>{staff.name}</span>
                                            </div>

                                            <div className="w-28 flex-shrink-0 flex bg-slate-200/50 p-0.5 rounded-full border border-slate-200/10 shadow-inner justify-between">
                                                <button
                                                    onClick={() => handleStaffAttendanceChange(staff.id, 'type', 'work')}
                                                    className={`flex-1 py-0.5 rounded-full text-[8.5px] font-black transition-all text-center ${isWork ? 'bg-white text-tree-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                                >
                                                    出勤
                                                </button>
                                                <button
                                                    onClick={() => handleStaffAttendanceChange(staff.id, 'type', 'public_holiday')}
                                                    className={`flex-1 py-0.5 rounded-full text-[8.5px] font-black transition-all text-center ${record.type === 'public_holiday' ? 'bg-white text-wood-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                                >
                                                    公休
                                                </button>
                                                <button
                                                    onClick={() => handleStaffAttendanceChange(staff.id, 'type', 'paid_leave')}
                                                    className={`flex-1 py-0.5 rounded-full text-[8.5px] font-black transition-all text-center ${record.type === 'paid_leave' ? 'bg-white text-apple-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                                >
                                                    有給
                                                </button>
                                            </div>

                                            <div className={`flex items-center gap-1 transition-opacity flex-shrink-0 ${isWork ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
                                                <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shadow-sm">
                                                    <select
                                                        disabled={!isWork}
                                                        value={startHour || '09'}
                                                        onChange={e => handleTimeUpdate('startTime', 'hour', e.target.value)}
                                                        className="bg-transparent text-[10px] font-bold text-slate-700 outline-none px-1 py-0.5 cursor-pointer appearance-none text-center min-w-[20px]"
                                                    >
                                                        {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                                                    </select>
                                                    <span className="text-slate-400 font-bold text-[8px] px-0.5">:</span>
                                                    <select
                                                        disabled={!isWork}
                                                        value={startMin || '30'}
                                                        onChange={e => handleTimeUpdate('startTime', 'minute', e.target.value)}
                                                        className="bg-transparent text-[10px] font-bold text-slate-700 outline-none px-1 py-0.5 cursor-pointer appearance-none text-center min-w-[20px]"
                                                    >
                                                        {MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
                                                    </select>
                                                </div>

                                                <span className="text-slate-400 font-bold text-[9px] px-0.5">〜</span>

                                                <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shadow-sm">
                                                    <select
                                                        disabled={!isWork}
                                                        value={endHour || '18'}
                                                        onChange={e => handleTimeUpdate('endTime', 'hour', e.target.value)}
                                                        className="bg-transparent text-[10px] font-bold text-slate-700 outline-none px-1 py-0.5 cursor-pointer appearance-none text-center min-w-[20px]"
                                                    >
                                                        {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                                                    </select>
                                                    <select
                                                        disabled={!isWork}
                                                        value={endMin || '30'}
                                                        onChange={e => handleTimeUpdate('endTime', 'minute', e.target.value)}
                                                        className="bg-transparent text-[10px] font-bold text-slate-700 outline-none px-1 py-0.5 cursor-pointer appearance-none text-center min-w-[20px]"
                                                    >
                                                        {MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>
            )}

            <div className="flex flex-col lg:flex-row gap-6 animate-in fade-in duration-1000">
                <div className="flex-1 min-w-0">
                    <div id="guide-table-section" className="bg-white/90 backdrop-blur-3xl rounded-[2.5rem] md:rounded-[3.5rem] shadow-premium border border-white/60 overflow-hidden hover:shadow-2xl transition-all duration-700 flex flex-col">
                        
                        {/* Table Header Controls */}
                        <div className="flex items-center justify-between px-4 py-2 bg-tree-100 border-b border-tree-200">
                            <h3 className="font-black text-tree-800 text-xs tracking-widest hidden sm:block">本日の業務</h3>
                            <div className="flex bg-white rounded-full p-0.5 border border-slate-200/60 shadow-sm mx-auto sm:mx-0 lg:hidden">
                                <button
                                    onClick={() => setActiveTableTab('learning')}
                                    className={`px-3 py-1.5 rounded-full text-[10px] font-black transition-all ${activeTableTab === 'learning' ? 'bg-tree-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                                >
                                    学習・プログラム
                                </button>
                                <button
                                    onClick={() => setActiveTableTab('transport')}
                                    className={`px-3 py-1.5 rounded-full text-[10px] font-black transition-all ${activeTableTab === 'transport' ? 'bg-wood-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                                >
                                    送迎・終了
                                </button>
                                <button
                                    onClick={() => setActiveTableTab('copy')}
                                    className={`px-3 py-1.5 rounded-full text-[10px] font-black transition-all ${activeTableTab === 'copy' ? 'bg-apple-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                                >
                                    通信コピー
                                </button>
                            </div>
                        </div>

                        <div 
                            onTouchStart={handleTableTouchStart}
                            onTouchMove={handleTableTouchMove}
                            onTouchEnd={handleTableTouchEnd}
                            className="overflow-x-auto lg:overflow-x-hidden custom-scrollbar-hidden md:custom-scrollbar"
                        >
                            <table className="w-full border-collapse table-fixed">
                                <thead>
                                    <tr className="bg-slate-50/50 border-b border-slate-100">
                                        <th className="sticky left-0 z-30 bg-slate-50 border-r border-slate-100 w-[30%] lg:w-[15%] min-w-[110px] p-2 md:p-4 text-[10px] md:text-[12px] font-black text-slate-400 uppercase tracking-[0.2em] text-left relative animate-all">
                                            <span>児童氏名</span>
                                        </th>

                                        <th className={`p-2 text-[10px] font-black text-slate-400 w-[35%] lg:w-[20%] min-w-[120px] border-r border-slate-100 bg-slate-50/10 text-center ${activeTableTab === 'learning' ? 'table-cell' : 'hidden'} lg:table-cell`}>学習</th>
                                        <th className={`p-2 text-[10px] font-black text-slate-400 w-[35%] lg:w-[20%] min-w-[120px] border-r border-slate-100 bg-slate-50/10 text-center ${activeTableTab === 'learning' ? 'table-cell' : 'hidden'} lg:table-cell`}>プログラム</th>
                                        <th className={`p-2 text-[10px] font-black text-slate-400 w-[23%] lg:w-[10%] min-w-[60px] border-r border-slate-100 bg-slate-50/10 text-center ${activeTableTab === 'transport' ? 'table-cell' : 'hidden'} lg:table-cell`}>送迎</th>
                                        <th className={`p-2 text-[10px] font-black text-slate-400 w-[23%] lg:w-[10%] min-w-[60px] border-r border-slate-100 bg-slate-50/10 text-center ${activeTableTab === 'transport' ? 'table-cell' : 'hidden'} lg:table-cell`}>終了</th>
                                        <th className={`p-2 text-[10px] font-black text-slate-400 w-[24%] lg:w-[12%] min-w-[75px] border-r border-slate-100 bg-slate-50/10 text-center ${activeTableTab === 'transport' ? 'table-cell' : 'hidden'} lg:table-cell`}>迎え場所</th>
                                        <th className={`p-2 text-[10px] font-black text-slate-400 w-[70%] lg:w-[22%] min-w-[200px] border-r border-slate-100 bg-slate-50/10 text-center ${activeTableTab === 'copy' ? 'table-cell' : 'hidden'} lg:table-cell`}>ツリー通信コピー</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {displayRegular.map((child, index) => {
                                        const row = dailyTable[child.id] || {};
                                        const isPlaceholder = !!child.isPlaceholder;
                                        const lockOwner = getChildLockOwner(child.id);
                                        const isLocked = !isPlaceholder && !!lockOwner;
                                        return (
                                            <tr key={child.id} className={`border-b border-slate-100 group transition-all ${isPlaceholder ? 'row-placeholder bg-slate-50/10 no-print' : selectedChildId === child.id ? 'bg-tree-50/30' : 'hover:bg-slate-50/20'}`}>
                                                <td className={`sticky left-0 z-10 p-3 md:p-4 font-black border-r border-slate-100 relative ${isLocked ? 'bg-[#e2e8f0] text-slate-400 cursor-not-allowed' : selectedChildId === child.id ? 'bg-[#e3f4e9]' : 'bg-white group-hover:bg-slate-50'} ${isPlaceholder ? 'text-[10px] py-2' : 'text-[12px] md:text-sm'}`}>
                                                    {pressingChildId && pressingChildId.id === child.id && (
                                                        <div className="absolute inset-0 bg-slate-200/50 pointer-events-none overflow-hidden z-20">
                                                            <div className="h-full bg-tree-500/20 animate-long-press" />
                                                        </div>
                                                    )}
                                                    <div className="flex flex-col gap-2 w-full">
                                                        <div className="flex items-center justify-between w-full">
                                                            <button
                                                                id={index === 0 ? "guide-child-name" : undefined}
                                                                onClick={(e) => {
                                                                    if (hasTriggeredLongPress.current[child.id]) {
                                                                        hasTriggeredLongPress.current[child.id] = false;
                                                                        return;
                                                                    }
                                                                    if (isLocked) {
                                                                        showToast(`${lockOwner.userName || lockOwner.userEmail || '他ユーザー'}が入力中のため編集できません。`);
                                                                        return;
                                                                    }
                                                                    if (lockingChildId) return;
                                                                    if (!isPlaceholder) { handleOpenChildPanel(child.id, 'tree'); }
                                                                }}
                                                                onMouseDown={(e) => {
                                                                    if (!isPlaceholder && !isLocked && !lockingChildId) startLongPress(e, child.id, 'regular');
                                                                }}
                                                                onMouseUp={(e) => {
                                                                    if (!isPlaceholder) cancelLongPress(e, child.id);
                                                                }}
                                                                onMouseLeave={(e) => {
                                                                    if (!isPlaceholder) cancelLongPress(e, child.id);
                                                                }}
                                                                onTouchStart={(e) => {
                                                                    if (!isPlaceholder && !isLocked && !lockingChildId) handleTouchStart(e, child.id, 'regular');
                                                                }}
                                                                onTouchEnd={(e) => {
                                                                    if (!isPlaceholder) cancelLongPress(e, child.id);
                                                                }}
                                                                onTouchMove={(e) => {
                                                                    if (!isPlaceholder) handleTouchMove(e, child.id);
                                                                }}
                                                                onContextMenu={(e) => {
                                                                    if (!isPlaceholder) e.preventDefault();
                                                                }}
                                                                disabled={isLocked || !!lockingChildId}
                                                                className={`flex-1 text-left transition-colors flex flex-col min-w-0 longpress-safe select-none ${isLocked ? 'text-slate-400 cursor-not-allowed' : isPlaceholder ? 'text-slate-300 cursor-default' : 'hover:text-tree-600'}`}>
                                                                <span className="whitespace-nowrap font-black block text-sm md:text-base flex items-center gap-1.5">
                                                                    {lockingChildId === child.id && <Loader2 className="w-3.5 h-3.5 animate-spin text-tree-600" />}
                                                                    {child.lastName ? `${child.lastName} ${child.firstName}` : (child.name || '名称未設定')}
                                                                </span>
                                                                {!isPlaceholder && (child.lastNameFurigana || child.nameFurigana) && (
                                                                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider opacity-60 whitespace-nowrap block">
                                                                        {child.lastNameFurigana ? `${child.lastNameFurigana} ${child.firstNameFurigana}` : child.nameFurigana}
                                                                    </span>
                                                                )}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className={`p-3 md:p-5 text-[10px] md:text-[12px] border-r border-slate-100 leading-relaxed font-bold align-top transition-colors ${isLocked ? 'bg-slate-100/60 text-slate-400 cursor-not-allowed' : lockingChildId === child.id ? 'cursor-wait text-slate-600' : 'cursor-pointer hover:bg-slate-50 text-slate-600'} ${selectedChildId === child.id ? 'bg-tree-50/20' : ''} ${activeTableTab === 'learning' ? 'table-cell' : 'hidden'} lg:table-cell`} onClick={() => {
                                                    if (isLocked) {
                                                        showToast(`${lockOwner.userName || lockOwner.userEmail || '他ユーザー'}が入力中のため編集できません。`);
                                                        return;
                                                    }
                                                    if (lockingChildId) return;
                                                    if (!isPlaceholder) { handleOpenChildPanel(child.id, 'chat'); }
                                                }}>
                                                    {!isPlaceholder && (
                                                        <div className={`tracking-tight whitespace-pre-wrap break-all ${isLocked ? 'text-slate-400' : 'text-tree-600'}`}>{getStudyText(child.id)}</div>
                                                    )}
                                                </td>
                                                <td className={`p-3 md:p-5 text-[10px] md:text-[12px] border-r border-slate-100 leading-relaxed font-bold align-top transition-colors ${isLocked ? 'bg-slate-100/60 text-slate-400 cursor-not-allowed' : lockingChildId === child.id ? 'cursor-wait text-slate-600' : 'cursor-pointer hover:bg-slate-50 text-slate-600'} ${selectedChildId === child.id ? 'bg-tree-50/20' : ''} ${activeTableTab === 'learning' ? 'table-cell' : 'hidden'} lg:table-cell`} onClick={() => {
                                                    if (isLocked) {
                                                        showToast(`${lockOwner.userName || lockOwner.userEmail || '他ユーザー'}が入力中のため編集できません。`);
                                                        return;
                                                    }
                                                    if (lockingChildId) return;
                                                    if (!isPlaceholder) { handleOpenChildPanel(child.id, 'chat'); }
                                                }}>
                                                    {!isPlaceholder && (
                                                        <div className={`tracking-tight whitespace-pre-wrap break-all ${isLocked ? 'text-slate-400' : 'text-wood-600'}`}>{getProgramText(child.id)}</div>
                                                    )}
                                                </td>
                                                <td className={`p-1 border-r border-slate-100 align-middle ${isLocked ? 'bg-slate-100/40' : ''} ${activeTableTab === 'transport' ? 'table-cell' : 'hidden'} lg:table-cell`}>
                                                    {!isPlaceholder && (
                                                        <input 
                                                            type="time" 
                                                            step="300"
                                                            value={row.transportTime || ''} 
                                                            onChange={e => updateDailyTable(child.id, { transportTime: e.target.value })} 
                                                            disabled={isLocked}
                                                            className={`w-full px-1 py-1.5 bg-transparent text-[11px] font-bold outline-none transition-all text-center ${isLocked ? 'text-slate-400 cursor-not-allowed' : 'text-slate-700'}`} 
                                                        />
                                                    )}
                                                </td>
                                                <td className={`p-1 border-r border-slate-100 align-middle ${isLocked ? 'bg-slate-100/40' : ''} ${activeTableTab === 'transport' ? 'table-cell' : 'hidden'} lg:table-cell`}>
                                                    {!isPlaceholder && (
                                                        <input 
                                                            type="time" 
                                                            step="300"
                                                            value={row.endTime || ''} 
                                                            onChange={e => updateDailyTable(child.id, { endTime: e.target.value })} 
                                                            disabled={isLocked}
                                                            className={`w-full px-1 py-1.5 bg-transparent text-[11px] font-bold outline-none transition-all text-center ${isLocked ? 'text-slate-400 cursor-not-allowed' : 'text-slate-700'}`} 
                                                        />
                                                    )}
                                                </td>
                                                <td className={`p-1 border-r border-slate-100 align-middle ${isLocked ? 'bg-slate-100/40' : ''} ${activeTableTab === 'transport' ? 'table-cell' : 'hidden'} lg:table-cell`}>
                                                    {!isPlaceholder && (
                                                <input 
                                                            value={row.pickupLocation || ''} 
                                                            onChange={e => updateDailyTable(child.id, { pickupLocation: e.target.value })} 
                                                            placeholder="場所" 
                                                            disabled={isLocked}
                                                            className={`w-full px-1 py-1.5 bg-transparent text-[11px] font-bold outline-none transition-all ${isLocked ? 'text-slate-400 cursor-not-allowed' : 'text-slate-700'}`} 
                                                        />
                                                    )}
                                                </td>
                                                <td className={`p-3 border-r border-slate-100/50 text-center ${isLocked ? 'bg-slate-100/40' : ''} ${activeTableTab === 'copy' ? 'table-cell' : 'hidden'} lg:table-cell`}>
                                                    {!isPlaceholder && (
                                                        <div className="flex flex-row items-center justify-center gap-4">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const text = results[child.id]?.D || '';
                                                                    const name = child.lastName ? `${child.lastName} ${child.firstName}` : child.name;
                                                                    handleCopySingle(child.id, name, text);
                                                                }}
                                                                disabled={isLocked}
                                                                className={`px-2 py-1.5 rounded-xl border transition-all active:scale-95 flex items-center justify-center gap-1 ${isLocked ? 'bg-slate-100 border-slate-200 text-slate-300 cursor-not-allowed' : copiedChildId === child.id ? 'bg-green-100 border-green-300 text-green-700' : results[child.id]?.D?.trim() ? 'bg-white border-tree-200 text-tree-600 hover:bg-tree-50 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100'}`}
                                                                title={isLocked ? '他ユーザーが編集中のためコピーできません' : copiedChildId === child.id ? 'コピー完了' : results[child.id]?.D?.trim() ? '今日のツリー通信をコピー' : 'ツリー通信未入力'}
                                                            >
                                                                {copiedChildId === child.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                                                <span className="text-[10px] font-black tracking-wider">{copiedChildId === child.id ? 'コピー完了' : 'コピー'}</span>
                                                            </button>
                                                            <div onClick={(e) => e.stopPropagation()}>
                                                                <select
                                                                    value={row.assignedStaff || ''}
                                                                    onChange={(e) => {
                                                                        updateDailyTable(child.id, { assignedStaff: e.target.value });
                                                                    }}
                                                                    disabled={isLocked}
                                                                    className="text-[10px] font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded px-1.5 py-1 outline-none focus:border-tree-400 focus:ring-1 focus:ring-tree-200"
                                                                >
                                                                    <option value="">担当</option>
                                                                    {filteredStaffList.map(staff => (
                                                                        <option key={staff.id} value={staff.name}>{staff.name}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                            <label 
                                                                className={`flex items-center gap-1 select-none ${isLocked ? 'cursor-not-allowed text-slate-300' : 'cursor-pointer text-slate-500'}`}
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={!!row.sentChecked}
                                                                    onChange={(e) => {
                                                                        updateDailyTable(child.id, { sentChecked: e.target.checked });
                                                                    }}
                                                                    disabled={isLocked}
                                                                    className={`w-3.5 h-3.5 rounded text-tree-600 border-slate-300 focus:ring-tree-500 ${isLocked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                                                                />
                                                                <span className="text-[10px] font-bold">送信</span>
                                                            </label>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Waitlist children list */}
                    <div className="bg-white/90 backdrop-blur-3xl rounded-[2.5rem] md:rounded-[3.5rem] shadow-premium border border-apple-200/60 overflow-hidden hover:shadow-2xl transition-all duration-700 flex flex-col mt-6 p-4 bg-apple-50/5">
                        <button onClick={() => setIsWaitlistExpanded(!isWaitlistExpanded)} className="w-full py-4 text-[12px] font-black text-apple-700 hover:bg-white hover:text-apple-800 transition-all rounded-[2rem] border-2 border-dashed border-apple-200 uppercase tracking-widest bg-apple-100/70 shadow-sm">
                            {isWaitlistExpanded ? 'キャンセル待ちリストを非表示' : `キャンセル待ち児童を表示 (${waitlistChildren.length} 名)`}
                        </button>
                        {isWaitlistExpanded && waitlistChildren.map(child => {
                            const name = child.lastName ? `${child.lastName} ${child.firstName}` : child.name;
                            return (
                                <div 
                                    key={child.id} 
                                    className="relative mt-3 p-5 rounded-[2rem] flex items-center justify-between bg-white border border-apple-200/40 shadow-sm shadow-apple-50/50 animate-in slide-in-from-top-4 overflow-hidden"
                                >
                                    {pressingChildId && pressingChildId.id === child.id && (
                                        <div className="absolute inset-0 bg-slate-200/50 pointer-events-none z-20">
                                            <div className="h-full bg-apple-500/20 animate-long-press" />
                                        </div>
                                    )}
                                    <span 
                                        className="text-xs font-black text-slate-600 cursor-pointer select-none longpress-safe flex-1 py-1"
                                        onMouseDown={(e) => startLongPress(e, child.id, 'waitlist')}
                                        onMouseUp={(e) => cancelLongPress(e, child.id)}
                                        onMouseLeave={(e) => cancelLongPress(e, child.id)}
                                        onTouchStart={(e) => handleTouchStart(e, child.id, 'waitlist')}
                                        onTouchEnd={(e) => cancelLongPress(e, child.id)}
                                        onTouchMove={(e) => handleTouchMove(e, child.id)}
                                        onContextMenu={(e) => e.preventDefault()}
                                    >
                                        {name}
                                        <span className="text-[10px] text-apple-400 font-bold ml-2">キャンセル待ち (長押しで状態変更)</span>
                                    </span>
                                    <button 
                                        onClick={() => removeChild(child.id)} 
                                        className="p-3 text-slate-200 hover:text-apple-500 transition-colors z-10"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    {/* Absent children list */}
                    <div className="bg-white/90 backdrop-blur-3xl rounded-[2.5rem] md:rounded-[3.5rem] shadow-premium border border-wood-200/60 overflow-hidden hover:shadow-2xl transition-all duration-700 flex flex-col mt-6 p-4 bg-wood-50/5">
                        <button 
                            onClick={() => setIsAbsentExpanded(!isAbsentExpanded)} 
                            className="w-full py-4 text-[12px] font-black text-wood-700 hover:bg-white hover:text-wood-800 transition-all rounded-[2rem] border-2 border-dashed border-wood-200 uppercase tracking-widest bg-wood-100/70 shadow-sm"
                        >
                            {isAbsentExpanded ? '欠席リストを非表示' : `欠席児童を表示 (${absentChildren.length} 名)`}
                        </button>
                        {isAbsentExpanded && absentChildren.map(child => {
                            const name = child.lastName ? `${child.lastName} ${child.firstName}` : child.name;
                            return (
                                <div 
                                    key={child.id} 
                                    className="relative mt-3 p-5 rounded-[2rem] flex items-center justify-between bg-white border border-wood-200/40 shadow-sm shadow-wood-50/50 animate-in slide-in-from-top-4 overflow-hidden"
                                >
                                    {pressingChildId && pressingChildId.id === child.id && (
                                        <div className="absolute inset-0 bg-slate-200/50 pointer-events-none z-20">
                                            <div className="h-full bg-wood-500/20 animate-long-press" />
                                        </div>
                                    )}
                                    <span 
                                        className="text-xs font-black text-slate-600 cursor-pointer select-none longpress-safe flex-1 py-1"
                                        onMouseDown={(e) => startLongPress(e, child.id, 'absent')}
                                        onMouseUp={(e) => cancelLongPress(e, child.id)}
                                        onMouseLeave={(e) => cancelLongPress(e, child.id)}
                                        onTouchStart={(e) => handleTouchStart(e, child.id, 'absent')}
                                        onTouchEnd={(e) => cancelLongPress(e, child.id)}
                                        onTouchMove={(e) => handleTouchMove(e, child.id)}
                                        onContextMenu={(e) => e.preventDefault()}
                                    >
                                        {name}
                                        <span className="text-[10px] text-wood-400 font-bold ml-2">欠席 (長押しで状態変更)</span>
                                    </span>
                                    <button 
                                        onClick={() => removeChild(child.id)} 
                                        className="p-3 text-slate-200 hover:text-apple-500 transition-colors z-10"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Floating Action Panels - Use Portal to ensure they are on top of everything */}
            {(selectedChildId || selectedTreeChildId || selectedDocChildId || isPanelClosing) && createPortal(
                <div className="fixed inset-y-0 right-0 z-[9999] w-full md:w-[540px] p-4 flex pointer-events-none">
                    <div className={cn(
                        "glass-card w-full h-full rounded-[2rem] shadow-2xl overflow-hidden flex flex-col border-white shadow-tree-100 pointer-events-auto",
                        isPanelClosing ? 'animate-out-right' : 'animate-in slide-in-from-right'
                    )} style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)' }}>
                        {(selectedChildId || (isPanelClosing && lastPanelData?.memo)) && !selectedDocChildId && (
                            <MemoPanel
                                child={children.find(c => c.id === (selectedChildId || lastPanelData?.memo))}
                                messages={dailyMessages[selectedChildId || lastPanelData?.memo] || []}
                                tags={tags}
                                onSave={sendMessage}
                                onDelete={deleteMessage}
                                onUpdate={updateMessage}
                                result={results[selectedChildId || lastPanelData?.memo] || {}}
                                selectedDate={selectedDate}
                                staffList={filteredStaffList}
                                onSaveTree={(id, res) => saveResults({ ...results, [id]: { ...res, staffName: getCurrentStaffName() } }, summaryC)}
                                onClose={handlePanelClose}
                                activeTab={memoActiveTab}
                                setActiveTab={setMemoActiveTab}
                                onShowHelpGuide={(stepId) => {
                                    setHelpGuideStartStepId(stepId);
                                    setShowHelpGuide(true);
                                }}
                                currentStaffName={getCurrentStaffName()}
                                programTitle={globalLog.programTitle}
                                programSummary={globalLog.programSummary}
                            />
                        )}
                        {(selectedDocChildId || (isPanelClosing && lastPanelData?.doc)) && (
                            <DocViewer
                                child={children.find(c => c.id === (selectedDocChildId || lastPanelData?.doc))}
                                result={results[selectedDocChildId || lastPanelData?.doc]}
                                selectedDate={selectedDate}
                                onSaveResult={(id, res) => saveResults({ ...results, [id]: { ...res, staffName: getCurrentStaffName() } }, summaryC)}
                                onClose={handlePanelClose}
                            />
                        )}
                    </div>
                </div>,
                document.body
            )}
            </div>

            {/* Modals */}
            {statusMenuChild && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setStatusMenuChild(null)} />
                    <div className="relative w-full max-w-sm bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col border border-white animate-in zoom-in-95 duration-300">
                        {/* Header */}
                        <div className="p-6 bg-tree-600 flex items-center justify-between shadow-lg flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                                    <Clock className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-black text-lg text-white tracking-tight">状態変更</h3>
                                    <p className="text-[9px] font-bold text-tree-100 uppercase tracking-widest opacity-80">Change child status</p>
                                </div>
                            </div>
                            <button onClick={() => setStatusMenuChild(null)} className="p-2 hover:bg-white/10 rounded-xl transition-all text-white/80 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        {/* Body */}
                        <div className="p-6 bg-slate-50/50 flex flex-col gap-4 text-center">
                            <p className="text-sm font-black text-slate-700">
                                <span className="text-base text-tree-700 bg-tree-50 border border-tree-100 px-3 py-1 rounded-full shadow-sm">
                                    {statusMenuChild.child.lastName ? `${statusMenuChild.child.lastName} ${statusMenuChild.child.firstName}` : statusMenuChild.child.name}
                                </span>
                            </p>
                            <p className="text-xs text-slate-400 font-bold">
                                移動先の状態を選択してください。
                            </p>
                            
                            <div className="flex flex-col gap-3 mt-2">
                                {/* Regular / 出席 button */}
                                {statusMenuChild.currentStatus !== 'absent' && statusMenuChild.currentStatus !== 'regular' && (
                                    <button
                                        onClick={() => {
                                            updateChildStatus(statusMenuChild.child.id, 'regular');
                                            setStatusMenuChild(null);
                                        }}
                                        className="w-full py-4 bg-tree-600 hover:bg-tree-700 text-white rounded-2xl font-black text-xs shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 uppercase tracking-widest"
                                    >
                                        <CheckCircle2 className="w-4 h-4" />
                                        <span>通常（出席）に移動</span>
                                    </button>
                                )}
                                {statusMenuChild.currentStatus === 'absent' && (
                                    <button
                                        onClick={() => {
                                            updateChildStatus(statusMenuChild.child.id, 'regular');
                                            setStatusMenuChild(null);
                                        }}
                                        className="w-full py-4 bg-tree-600 hover:bg-tree-700 text-white rounded-2xl font-black text-xs shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 uppercase tracking-widest"
                                    >
                                        <CheckCircle2 className="w-4 h-4" />
                                        <span>出席に移動</span>
                                    </button>
                                )}

                                {/* Waitlist / キャンセル待ち button */}
                                {statusMenuChild.currentStatus !== 'waitlist' && (
                                    <button
                                        onClick={() => {
                                            updateChildStatus(statusMenuChild.child.id, 'waitlist');
                                            setStatusMenuChild(null);
                                        }}
                                        className="w-full py-4 bg-apple-500 hover:bg-apple-600 text-white rounded-2xl font-black text-xs shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 uppercase tracking-widest"
                                    >
                                        <Clock className="w-4 h-4" />
                                        <span>キャンセル待ちに移動</span>
                                    </button>
                                )}

                                {/* Absent / 欠席 button */}
                                {statusMenuChild.currentStatus !== 'absent' && (
                                    <button
                                        onClick={() => {
                                            updateChildStatus(statusMenuChild.child.id, 'absent');
                                            setStatusMenuChild(null);
                                        }}
                                        className="w-full py-4 bg-wood-500 hover:bg-wood-600 text-white rounded-2xl font-black text-xs shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 uppercase tracking-widest"
                                    >
                                        <AlertCircle className="w-4 h-4" />
                                        <span>欠席に移動</span>
                                    </button>
                                )}
                            </div>
                        </div>
                        {/* Footer */}
                        <div className="p-4 bg-white border-t border-slate-100 flex items-center justify-center flex-shrink-0">
                            <button
                                onClick={() => setStatusMenuChild(null)}
                                className="px-6 py-2 font-black text-xs text-slate-400 hover:text-slate-600 uppercase tracking-widest transition-all"
                            >
                                キャンセル
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <CalendarModal show={showCalendarModal} onClose={() => setShowCalendarModal(false)} setSelectedDate={handleDateChange} selectedDate={selectedDate} existingReportDates={existingReportDates} />
            <AddChildModal show={showAddChildModal} onClose={() => setShowAddChildModal(false)} masterChildren={masterChildren} currentChildren={children} onAddChildren={handleAddMultipleFromMaster} />
            <NoticeModal
                show={showNoticeModal}
                onClose={() => setShowNoticeModal(false)}
                notice={globalLog.notice}
                onSave={(val) => updateGlobalLog('notice', val)}
            />

            {showProgramModal && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setShowProgramModal(false)} />
                    <div className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col border border-white animate-in zoom-in-95 duration-300">
                        {/* Header */}
                        <div className="p-6 bg-wood-600 flex items-center justify-between shadow-lg flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                                    <ClipboardList className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-black text-lg text-white tracking-tight">本日のプログラム登録</h3>
                                    <p className="text-[9px] font-bold text-wood-100 uppercase tracking-widest opacity-80">Register Today's Program</p>
                                </div>
                            </div>
                            <button onClick={() => setShowProgramModal(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all text-white/80 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        {/* Body */}
                        <div className="p-6 bg-slate-50/50 flex flex-col gap-4 overflow-y-auto max-h-[70vh]">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                                    プログラムのタイトル
                                </label>
                                <input
                                    type="text"
                                    placeholder="例：ちぎり絵制作、プラ板キーホルダー作りなど..."
                                    value={globalLog.programTitle || ''}
                                    onChange={(e) => updateGlobalLog('programTitle', e.target.value)}
                                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:border-wood-400 focus:ring-4 focus:ring-wood-50 transition-all shadow-sm"
                                />
                            </div>
                            
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                                    プログラムの概要
                                </label>
                                <textarea
                                    rows="6"
                                    placeholder="プログラムの具体的な手順や概要を入力してください。ここで登録した内容は、ツリー通信の入力画面でワンクリックで引用（コピー・反映）できます。"
                                    value={globalLog.programSummary || ''}
                                    onChange={(e) => updateGlobalLog('programSummary', e.target.value)}
                                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:border-wood-400 focus:ring-4 focus:ring-wood-50 transition-all leading-relaxed shadow-sm resize-none"
                                />
                            </div>
                        </div>
                        
                        {/* Footer */}
                        <div className="p-6 bg-white border-t border-slate-100 flex items-center justify-between flex-shrink-0">
                            <button
                                onClick={() => {
                                    if (confirm('登録内容をクリアしますか？')) {
                                        updateGlobalLog('programTitle', '');
                                        updateGlobalLog('programSummary', '');
                                    }
                                }}
                                className="px-5 py-2.5 font-bold text-xs text-apple-500 hover:bg-apple-50 rounded-xl transition-all"
                            >
                                クリア
                            </button>
                            <button
                                onClick={() => setShowProgramModal(false)}
                                className="px-6 py-3 bg-wood-600 hover:bg-wood-700 text-white rounded-xl font-black text-xs shadow-md transition-all active:scale-95 flex items-center gap-2 uppercase tracking-widest"
                            >
                                <Check className="w-4 h-4" />
                                <span>閉じる</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {showSettingsModal && (
                <SettingsModal
                    onClose={() => setShowSettingsModal(false)}
                    tags={tags}
                    onSaveTags={handleUpdateTags}
                />
            )}
            <ExportModal show={showExportModal} onClose={() => setShowExportModal(false)} selectedDate={selectedDate} children={children} results={results} summaryC={summaryC} selectedOffice={selectedOffice} staffList={filteredStaffList} />
            {showAttendanceModal && (
                <AttendanceModal
                    onClose={() => { setShowAttendanceModal(false); fetchDailyData(selectedDate, selectedOffice?.id); }}
                    selectedDate={selectedDate}
                    officeId={selectedOffice?.id}
                    staffList={filteredStaffList}
                />
            )}

            <ActivitiesModal
                show={showActivitiesModal}
                onClose={() => setShowActivitiesModal(false)}
                activities={globalLog.activities}
                onSave={(val) => updateGlobalLog('activities', val)}
            />



            {/* Mobile Floating Action Menu (FAB) */}
            <div className="lg:hidden fixed bottom-6 right-6 z-[90] no-print">
                {/* Expandable Menu Panel */}
                {isMobileMenuOpen && (
                    <div className="absolute bottom-16 right-0 mb-2 w-56 glass-card bg-white/95 backdrop-blur-xl rounded-[2rem] shadow-2xl border border-slate-100 p-4 space-y-2.5 animate-in slide-in-from-bottom-5 duration-300">
                        <button
                                id="guide-add-child-mobile-btn"
                                onClick={() => { setShowAddChildModal(true); setIsMobileMenuOpen(false); }}
                                className="w-full px-4 py-3 bg-tree-50 text-tree-700 hover:bg-tree-100 rounded-2xl font-black text-xs transition-all active:scale-95 flex items-center gap-3"
                            >
                                <PlusCircle className="w-4 h-4 text-tree-600" />
                                <span>児童追加</span>
                            </button>

                            <button
                                id="guide-print-mobile-btn"
                                onClick={() => { printAllDocuments(children, results, summaryC, selectedDate, dailyTable, dailyMessages, globalLog, attendance, filteredStaffList); setIsMobileMenuOpen(false); }}
                                className="w-full px-4 py-3 bg-wood-50 text-wood-700 hover:bg-wood-100 rounded-2xl font-black text-xs transition-all active:scale-95 flex items-center gap-3"
                            >
                            <Printer className="w-4 h-4 text-wood-600" />
                            <span>印刷</span>
                        </button>



                        <div className="h-px bg-slate-100 my-1" />

                        <button
                            id="guide-export-mobile-btn"
                            onClick={() => { setShowExportModal(true); setIsMobileMenuOpen(false); }}
                            className="w-full px-4 py-2.5 hover:bg-slate-50 text-slate-600 hover:text-slate-800 rounded-xl font-bold text-xs transition-all flex items-center gap-3"
                        >
                            <FileSpreadsheet className="w-4 h-4 text-slate-400" />
                            <span>データ出力</span>
                        </button>

                        <button
                            id="guide-attendance-mobile-btn"
                            onClick={() => { setShowAttendanceModal(true); setIsMobileMenuOpen(false); }}
                            className="w-full px-4 py-2.5 hover:bg-slate-50 text-slate-600 hover:text-slate-800 rounded-xl font-bold text-xs transition-all flex items-center gap-3"
                        >
                            <UserCheck className="w-4 h-4 text-slate-400" />
                            <span>勤怠管理</span>
                        </button>

                        <button
                            id="guide-activities-mobile-btn"
                            onClick={() => { setShowActivitiesModal(true); setIsMobileMenuOpen(false); }}
                            className="w-full px-4 py-2.5 hover:bg-slate-50 text-slate-600 hover:text-slate-800 rounded-xl font-bold text-xs transition-all flex items-center gap-3"
                        >
                            <ClipboardList className="w-4 h-4 text-slate-400" />
                            <span>業務活動内容登録</span>
                        </button>

                        <button
                            id="guide-notice-mobile-btn"
                            onClick={() => { setShowNoticeModal(true); setIsMobileMenuOpen(false); }}
                            className="w-full px-4 py-2.5 hover:bg-slate-50 text-slate-600 hover:text-slate-800 rounded-xl font-bold text-xs transition-all flex items-center gap-3"
                        >
                            <FileText className="w-4 h-4 text-slate-400" />
                            <span>全体的な様子登録</span>
                        </button>

                        <button
                            onClick={() => { setShowHelpGuide(true); setIsMobileMenuOpen(false); }}
                            className="w-full px-4 py-2.5 hover:bg-slate-50 text-slate-600 hover:text-slate-800 rounded-xl font-bold text-xs transition-all flex items-center gap-3"
                        >
                            <HelpCircle className="w-4 h-4 text-slate-400" />
                            <span>ヘルプガイド</span>
                        </button>

                        <button
                            onClick={() => { setShowSettingsModal(true); setIsMobileMenuOpen(false); }}
                            className="w-full px-4 py-2.5 hover:bg-slate-50 text-slate-600 hover:text-slate-800 rounded-xl font-bold text-xs transition-all flex items-center gap-3"
                        >
                            <Settings className="w-4 h-4 text-slate-400" />
                            <span>設定</span>
                        </button>

                        <div className="h-px bg-slate-100 my-1" />

                        {/* 表示事業所選択 (モバイルメニュー) */}
                        {offices.length > 0 && (
                            <div className="px-4 py-2 flex flex-col gap-1.5">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">表示事業所</span>
                                <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl relative">
                                    <LayoutPanelLeft className="w-4 h-4 text-tree-600 flex-shrink-0" />
                                    <select
                                        value={selectedOffice?.id || ''}
                                        onChange={(e) => {
                                            const office = offices.find(o => o.id === e.target.value);
                                            if (office) {
                                                setSelectedOffice(office);
                                                localStorage.setItem('care_pro_selected_office', JSON.stringify(office));
                                            }
                                        }}
                                        className="w-full bg-transparent font-black text-slate-700 text-xs tracking-tight border-none outline-none cursor-pointer pr-4 appearance-none"
                                    >
                                        {offices.map(o => (
                                            <option key={o.id} value={o.id}>{o.name}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="w-3 h-3 text-slate-300 absolute right-3 pointer-events-none" />
                                </div>
                            </div>
                        )}

                        <div className="h-px bg-slate-100 my-1" />

                        <div className="px-4 py-1.5 flex flex-col gap-0.5">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">ログイン中</span>
                            <span className="text-xs font-black text-slate-700">{getCurrentStaffName()}</span>
                        </div>

                        <button
                            onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }}
                            className="w-full px-4 py-2.5 bg-apple-50 hover:bg-apple-100 text-apple-600 hover:text-apple-700 rounded-xl font-black text-xs transition-all flex items-center gap-3"
                        >
                            <LogOut className="w-4 h-4" />
                            <span>ログアウト</span>
                        </button>
                    </div>
                )}

                {/* FAB Trigger Button */}
                <button
                    id="guide-mobile-menu-btn"
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className={cn(
                        "p-4 bg-tree-600 hover:bg-tree-700 text-white rounded-full shadow-2xl transition-all duration-300 active:scale-90 flex items-center justify-center border-4 border-white/60",
                        isMobileMenuOpen ? "rotate-90" : "rotate-0"
                    )}
                >
                    {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </button>
            </div>

            {showHelpGuide && (
                <HelpGuide 
                    onClose={() => {
                        setShowHelpGuide(false);
                        setIsMobileMenuOpen(false);
                        setSelectedChildId(null);
                        setHelpGuideStartStepId(null);
                    }} 
                    setIsMobileMenuOpen={setIsMobileMenuOpen}
                    selectedChildId={selectedChildId}
                    setSelectedChildId={setSelectedChildId}
                    memoActiveTab={memoActiveTab}
                    setMemoActiveTab={setMemoActiveTab}
                    firstChildId={selectedChildId || children[0]?.id || null}
                    startStepId={helpGuideStartStepId}
                />
            )}



            {/* Custom Toast Notification */}
            {toast && (
                <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[110] bg-slate-900/95 backdrop-blur-md text-white px-4 md:px-6 py-3 md:py-4 rounded-2xl shadow-2xl flex items-center gap-2.5 md:gap-3.5 animate-in slide-in-from-top-4 fade-in duration-300 max-w-[90%] md:max-w-xl border-l-4 md:border-l-6 border-apple-500">
                    <AlertCircle className="w-5 h-5 md:w-6 md:h-6 text-apple-400 flex-shrink-0" />
                    <p className="font-bold text-[11px] md:text-sm leading-relaxed tracking-wide drop-shadow-sm flex-1">{toast}</p>
                    <button onClick={() => setToast(null)} className="p-1.5 ml-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors flex-shrink-0">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}
        </div>
    );
}

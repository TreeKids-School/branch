import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    PlusCircle, MessageSquare, Send, FileSpreadsheet, Printer,
    Trash2, Clock, CheckCircle2, AlertCircle, Loader2,
    ChevronDown, ChevronUp, ChevronLeft, ChevronRight, FileText, LayoutPanelLeft, UserCheck,
    FileEdit, X, Calendar as CalendarIcon, Settings, LogOut, HelpCircle, Menu,
    Copy, Check, ClipboardList, ClipboardCheck, History, Plus
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
import LogModal from './components/LogModal';
import CSVImportModal from './components/CSVImportModal';
import BackupImportModal from './components/BackupImportModal';

import { printAllDocuments, GROUP1_ITEMS, GROUP2_ITEMS } from './utils/print';
import { toCSV } from './utils/csv';



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
    const [changeLogs, setChangeLogs] = useState([]);
    const [greetingTemplates, setGreetingTemplates] = useState({});
    const [okWords, setOkWords] = useState([]);
    const [showLogModal, setShowLogModal] = useState(false);
    const [summaryC, setSummaryC] = useState('');
    const [dailyMessages, setDailyMessages] = useState({});
    const [dailyTable, setDailyTable] = useState({});
    const [globalLog, setGlobalLog] = useState({ admin: '', supervisor: '', notice: '', activities: '', programTitle: '', programSummary: '' });
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
    const [localNotice, setLocalNotice] = useState('');
    const [localProgramSummary, setLocalProgramSummary] = useState('');
    const [localActivities, setLocalActivities] = useState('');
    const [isSyncing, setIsSyncing] = useState(false);
    const [showCalendarModal, setShowCalendarModal] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [showAddChildModal, setShowAddChildModal] = useState(false);
    const [showAttendanceModal, setShowAttendanceModal] = useState(false);
    const [showCSVImportModal, setShowCSVImportModal] = useState(false);
    const [showBackupImportModal, setShowBackupImportModal] = useState(false);
    const [mobileExportOpen, setMobileExportOpen] = useState(false);
    const [mobileImportOpen, setMobileImportOpen] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [showImportMenu, setShowImportMenu] = useState(false);
    const [isStaffCollapsed, setIsStaffCollapsed] = useState(false);
    const [isNoticeCollapsed, setIsNoticeCollapsed] = useState(false);
    const [isProgramCollapsed, setIsProgramCollapsed] = useState(false);
    const [isActivitiesCollapsed, setIsActivitiesCollapsed] = useState(false);
    const [activeProgramTab, setActiveProgramTab] = useState(0);
    const [isDashboardMode, setIsDashboardMode] = useState(true);
    const [attendance, setAttendance] = useState({});
    const [sortConfig, setSortConfig] = useState({ key: 'default', direction: 'asc' });
    const [copiedChildId, setCopiedChildId] = useState(null);
    const [masterChildren, setMasterChildren] = useState([]);
    const [existingReportDates, setExistingReportDates] = useState([]);
    const [isSandboxMode, setIsSandboxMode] = useState(false);
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
    const [selectedChildIdsForCopy, setSelectedChildIdsForCopy] = useState([]);
    const [isCopySelectionMode, setIsCopySelectionMode] = useState(false);
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
            const tabs = ['learning', 'program', 'transport', 'copy', 'futurePlan', 'remarks'];
            const currentIndex = tabs.indexOf(activeTableTab);

            if (diffX < 0) {
                // 左フリック（右から左へスワイプ） ➔ 次のタブへ（ループ）
                const nextIndex = (currentIndex + 1) % tabs.length;
                setActiveTableTab(tabs[nextIndex]);
            } else {
                // 右フリック（左から右へスワイプ） ➔ 前のタブへ（ループ）
                const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
                setActiveTableTab(tabs[prevIndex]);
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

    // Auto-scroll active tab button into view on mobile
    useEffect(() => {
        if (window.innerWidth < 1024) {
            const activeBtn = document.querySelector(`[data-tab-btn="${activeTableTab}"]`);
            if (activeBtn) {
                activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
        }
    }, [activeTableTab]);


    const [tags, setTags] = useState(() => {
        const defaultTags = ['【ツリー式学習】', '【宿題】', '【プリント】', '【プログラム】', '【おやつ】', '【自由時間】', '【備考】'];
        try {
            const saved = localStorage.getItem('care_pro_tags');
            if (saved) {
                const parsed = JSON.parse(saved);
                let updated = false;
                let newTags = [...parsed];
                if (!newTags.includes('【自由時間】')) {
                    newTags.push('【自由時間】');
                    updated = true;
                }
                if (!newTags.includes('【備考】')) {
                    newTags.push('【備考】');
                    updated = true;
                }
                if (updated) {
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
            setChangeLogs(data.changeLogs || []);
        } else {
            setResults({}); setSummaryC(''); setDailyMessages({}); setChildren([]);
            setDailyTable({}); setGlobalLog({ admin: '', supervisor: '', notice: '', activities: '', programTitle: '', programSummary: '' });
            setChangeLogs([]);
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
        setIsSandboxMode(false);
    }, [selectedDate, selectedOffice?.id]);

    useEffect(() => {
        if (!user || !selectedOffice) return;

        setIsSyncing(true);
        const reportId = selectedOffice.id ? `${selectedOffice.id}_${selectedDate}` : selectedDate;

        // 1. Reports コレクションのリアルタイム同期リスナー登録
        const reportDocRef = doc(firestore, 'reports', reportId);
        const unsubscribeReport = onSnapshot(reportDocRef, (snap) => {
            if (isSandboxMode) {
                console.log('[Sandbox] onSnapshot update ignored');
                return;
            }
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
                    setChangeLogs(data.changeLogs || []);
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
                    setChangeLogs([]);
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
            if (isSandboxMode) {
                console.log('[Sandbox] onSnapshot attendance ignored');
                return;
            }
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
    }, [selectedDate, selectedOffice, user, isSandboxMode]);

    // 挨拶テンプレのリアルタイム同期
    useEffect(() => {
        if (!user) return;
        const ref = doc(firestore, 'meta', 'greeting_templates');
        const unsubscribeTemplates = onSnapshot(ref, (snap) => {
            if (snap.exists()) {
                setGreetingTemplates(snap.data() || {});
            } else {
                setGreetingTemplates({});
            }
        }, (error) => {
            console.error("Error listening to greeting templates:", error);
        });
        return () => unsubscribeTemplates();
    }, [user]);

    // OKワードのリアルタイム同期
    useEffect(() => {
        if (!user) return;
        const ref = doc(firestore, 'meta', 'ok_words');
        const unsubscribeOkWords = onSnapshot(ref, (snap) => {
            if (snap.exists()) {
                setOkWords(snap.data().words || []);
            } else {
                setOkWords([]);
            }
        }, (error) => {
            console.error("Error listening to ok_words:", error);
        });
        return () => unsubscribeOkWords();
    }, [user]);

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

    // Sync globalLog with local state
    useEffect(() => {
        setLocalNotice(globalLog.notice || '');
        setLocalProgramSummary(globalLog.programSummary || '');
        
        let activitiesText = '';
        const acts = globalLog.activities || '';
        if (acts) {
            if (typeof acts === 'object') {
                const group1 = acts.group1 || [];
                const group2 = acts.group2 || [];
                const labels = [];
                GROUP1_ITEMS.forEach(item => { if (group1.includes(item.id)) labels.push(item.label); });
                GROUP2_ITEMS.forEach(item => { if (group2.includes(item.id)) labels.push(item.label); });
                activitiesText = labels.join('\n');
            } else if (acts.trim().startsWith('{')) {
                try {
                    const parsed = JSON.parse(acts);
                    const group1 = parsed.group1 || [];
                    const group2 = parsed.group2 || [];
                    const labels = [];
                    GROUP1_ITEMS.forEach(item => { if (group1.includes(item.id)) labels.push(item.label); });
                    GROUP2_ITEMS.forEach(item => { if (group2.includes(item.id)) labels.push(item.label); });
                    activitiesText = labels.join('\n');
                } catch {
                    activitiesText = acts;
                }
            } else {
                activitiesText = acts;
            }
        }
        setLocalActivities(activitiesText);
    }, [globalLog]);

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
        if (isSandboxMode) {
            console.log('[Sandbox] saveDailyData bypassed');
            return;
        }
        setIsSyncing(true);
        const dailyData = { children: ch, messages: msgs, results: res, summaryC: sum, dailyTable: table || dailyTable, globalLog: global || globalLog, changeLogs: changeLogs, updatedAt: new Date().toISOString() };

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
                    future_plan: childResult.futurePlan || '',
                    pickupLocation: childTable.pickupLocation || '',
                    endTime: childTable.endTime || '',
                    transportTime: childTable.transportTime || '',
                    notes: getRemarksText(child.id)
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

    const saveDailyDataGranular = async ({ childId, result, tableRow, messagesList }) => {
        setIsSyncing(true);
        
        // ── 変更ログの作成 ──
        const childObj = children.find(c => c.id === childId);
        const childName = childObj ? (childObj.lastName ? `${childObj.lastName} ${childObj.firstName}` : childObj.name) : '児童';
        const staffName = getCurrentStaffName();
        const newLogs = [];

        if (result !== undefined) {
            const prevResult = results[childId] || {};
            const fields = [
                { key: 'D', label: '連絡帳', prev: prevResult.D, curr: result.D },
                { key: 'B_result', label: '支援結果', prev: prevResult.B_result, curr: result.B_result },
                { key: 'B_plan', label: '支援計画', prev: prevResult.B_plan, curr: result.B_plan },
                { key: 'B_item', label: '支援内容', prev: prevResult.B_item, curr: result.B_item },
                { key: 'K_sheet', label: 'Forceシート', prev: prevResult.K_sheet, curr: result.K_sheet }
            ];
            for (const f of fields) {
                if ((f.prev || '') !== (f.curr || '')) {
                    newLogs.push({
                        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
                        timestamp: new Date().toISOString(),
                        staffName,
                        childId,
                        childName,
                        type: 'result',
                        field: f.key,
                        description: f.label,
                        prevDisplay: f.prev || '（未入力）',
                        newDisplay: f.curr || '（未入力）',
                        restoreValue: f.prev || ''
                    });
                }
            }
        }

        if (tableRow !== undefined) {
            const prevTable = dailyTable[childId] || {};
            const fields = [
                { key: 'transportTime', label: '送迎時間', prev: prevTable.transportTime, curr: tableRow.transportTime },
                { key: 'endTime', label: '退室時間', prev: prevTable.endTime, curr: tableRow.endTime },
                { key: 'pickupLocation', label: '送迎場所', prev: prevTable.pickupLocation, curr: tableRow.pickupLocation },
                { key: 'assignedStaff', label: '担当職員', prev: prevTable.assignedStaff, curr: tableRow.assignedStaff },
                { key: 'sentChecked', label: '送信チェック', prev: prevTable.sentChecked, curr: tableRow.sentChecked }
            ];
            for (const f of fields) {
                const pVal = f.key === 'sentChecked' ? !!f.prev : (f.prev || '');
                const cVal = f.key === 'sentChecked' ? !!f.curr : (f.curr || '');
                if (pVal !== cVal) {
                    let pDisp = pVal;
                    let cDisp = cVal;
                    if (f.key === 'sentChecked') {
                        pDisp = pVal ? '送信済' : '未送信';
                        cDisp = cVal ? '送信済' : '未送信';
                    } else {
                        if (!pDisp) pDisp = '（未入力）';
                        if (!cDisp) cDisp = '（未入力）';
                    }
                    newLogs.push({
                        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
                        timestamp: new Date().toISOString(),
                        staffName,
                        childId,
                        childName,
                        type: 'tableRow',
                        field: f.key,
                        description: f.label,
                        prevDisplay: String(pDisp),
                        newDisplay: String(cDisp),
                        restoreValue: f.prev === undefined ? '' : f.prev
                    });
                }
            }
        }

        if (messagesList !== undefined) {
            const prevMsgs = dailyMessages[childId] || [];
            const currMsgs = messagesList || [];
            
            const deleted = prevMsgs.filter(pm => !currMsgs.some(cm => cm.id === pm.id));
            const added = currMsgs.filter(cm => !prevMsgs.some(pm => pm.id === cm.id));
            const updated = currMsgs.filter(cm => {
                const pm = prevMsgs.find(p => p.id === cm.id);
                return pm && pm.text !== cm.text;
            });

            if (deleted.length > 0) {
                for (const dm of deleted) {
                    newLogs.push({
                        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
                        timestamp: new Date().toISOString(),
                        staffName,
                        childId,
                        childName,
                        type: 'messagesList',
                        field: 'messagesList',
                        description: 'チャットメモ削除',
                        prevDisplay: dm.text || '',
                        newDisplay: '（削除されました）',
                        restoreValue: prevMsgs
                    });
                }
            } else if (added.length > 0) {
                for (const am of added) {
                    newLogs.push({
                        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
                        timestamp: new Date().toISOString(),
                        staffName,
                        childId,
                        childName,
                        type: 'messagesList',
                        field: 'messagesList',
                        description: 'チャットメモ追加',
                        prevDisplay: '（なし）',
                        newDisplay: am.text || '',
                        restoreValue: prevMsgs
                    });
                }
            } else if (updated.length > 0) {
                for (const um of updated) {
                    const pm = prevMsgs.find(p => p.id === um.id);
                    newLogs.push({
                        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
                        timestamp: new Date().toISOString(),
                        staffName,
                        childId,
                        childName,
                        type: 'messagesList',
                        field: 'messagesList',
                        description: 'チャットメモ編集',
                        prevDisplay: pm ? (pm.text || '') : '',
                        newDisplay: um.text || '',
                        restoreValue: prevMsgs
                    });
                }
            }
        }

        let updatedLogs = [...changeLogs];
        if (newLogs.length > 0) {
            updatedLogs = [...newLogs, ...updatedLogs].slice(0, 10);
            setChangeLogs(updatedLogs);
        }

        const savePromise = (async () => {
            if (isSandboxMode) {
                console.log('[Sandbox] saveDailyDataGranular bypassed');
                return;
            }
            await cs({
                action: 'updateDailyReportChildData',
                date: selectedDate,
                officeId: selectedOffice?.id,
                childId,
                result,
                tableRow,
                messagesList,
                childrenList: children,
                changeLogs: updatedLogs
            });

            const childObj = children.find(c => c.id === childId);
            if (childObj && !childObj.isPlaceholder) {
                const childResult = result !== undefined ? result : (results[childId] || {});
                const childTable = tableRow !== undefined ? tableRow : (dailyTable[childId] || {});

                const individualData = {
                    name: childObj.name,
                    tree_comm_text: childResult.D || '',
                    future_plan: childResult.futurePlan || '',
                    pickupLocation: childTable.pickupLocation || '',
                    endTime: childTable.endTime || '',
                    transportTime: childTable.transportTime || '',
                    notes: getRemarksText(childId)
                };

                await cs({
                    action: 'saveIndividualTreeComm',
                    childId,
                    date: selectedDate,
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

    const handleRestoreLog = async (log) => {
        if (!confirm(`${log.childName}の「${log.description}」を復元しますか？\n（復元前の値に書き戻されます）`)) return;
        
        setIsSyncing(true);
        try {
            const childId = log.childId;
            const staffName = getCurrentStaffName();
            const childObj = children.find(c => c.id === childId);
            const childName = childObj ? (childObj.lastName ? `${childObj.lastName} ${childObj.firstName}` : childObj.name) : '児童';
            
            let currVal = '';
            let prevVal = log.restoreValue;
            
            let updatePayload = {
                action: 'updateDailyReportChildData',
                date: selectedDate,
                officeId: selectedOffice?.id,
                childId,
                childrenList: children
            };
            
            if (log.type === 'result') {
                const currentResult = results[childId] || {};
                currVal = currentResult[log.field] || '';
                const restoredResult = { ...currentResult, [log.field]: prevVal };
                restoredResult.staffName = staffName;
                
                setResults(prev => ({ ...prev, [childId]: restoredResult }));
                updatePayload.result = restoredResult;
            } else if (log.type === 'tableRow') {
                const currentTableRow = dailyTable[childId] || {};
                currVal = currentTableRow[log.field] || '';
                const restoredTableRow = { ...currentTableRow, [log.field]: prevVal };
                
                setDailyTable(prev => ({ ...prev, [childId]: restoredTableRow }));
                updatePayload.tableRow = restoredTableRow;
            } else if (log.type === 'messagesList') {
                const currentMessages = dailyMessages[childId] || [];
                currVal = `（メッセージ数: ${currentMessages.length}件）`;
                
                setDailyMessages(prev => ({ ...prev, [childId]: prevVal }));
                updatePayload.messagesList = prevVal;
            }
            
            let prevDisp = prevVal;
            let currDisp = currVal;
            if (log.field === 'sentChecked') {
                prevDisp = prevVal ? '送信済' : '未送信';
                currDisp = currVal ? '送信済' : '未送信';
            } else if (log.type === 'messagesList') {
                prevDisp = `（メッセージ数: ${prevVal.length}件）`;
            } else {
                if (!prevDisp) prevDisp = '（未入力）';
                if (!currDisp) currDisp = '（未入力）';
            }
            
            const restoreLog = {
                id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
                timestamp: new Date().toISOString(),
                staffName,
                childId,
                childName,
                type: log.type,
                field: log.field,
                description: `${log.description}復元`,
                prevDisplay: String(currDisp),
                newDisplay: String(prevDisp),
                restoreValue: currVal
            };
            
            const updatedLogs = [restoreLog, ...changeLogs].slice(0, 10);
            setChangeLogs(updatedLogs);
            updatePayload.changeLogs = updatedLogs;
            
            await cs(updatePayload);
            
            if (childObj && !childObj.isPlaceholder) {
                const childResult = log.type === 'result' ? updatePayload.result : (results[childId] || {});
                const childTable = log.type === 'tableRow' ? updatePayload.tableRow : (dailyTable[childId] || {});
                
                const individualData = {
                    name: childObj.name,
                    tree_comm_text: childResult.D || '',
                    future_plan: childResult.futurePlan || '',
                    pickupLocation: childTable.pickupLocation || '',
                    endTime: childTable.endTime || '',
                    transportTime: childTable.transportTime || '',
                    notes: getRemarksText(childId)
                };
                
                await cs({
                    action: 'saveIndividualTreeComm',
                    childId,
                    date: selectedDate,
                    data: individualData
                });
            }
            
            showToast('データを復元しました。');
        } catch (error) {
            console.error("Failed to restore log:", error);
            showToast('復元に失敗しました。');
        } finally {
            setIsSyncing(false);
        }
    };

    const handleSaveGreetingTemplate = async (staffName, templateText) => {
        try {
            const ref = doc(firestore, 'meta', 'greeting_templates');
            await setDoc(ref, { [staffName]: templateText }, { merge: true });
            showToast('挨拶テンプレを保存しました。');
        } catch (error) {
            console.error("Failed to save template:", error);
            showToast('テンプレの保存に失敗しました。');
        }
    };

    const handleSaveOkWords = async (newOkWords) => {
        try {
            const ref = doc(firestore, 'meta', 'ok_words');
            await setDoc(ref, { words: newOkWords });
            showToast('OKワードを保存しました。');
        } catch (error) {
            console.error("Failed to save ok words:", error);
            showToast('OKワードの保存に失敗しました。');
        }
    };

    const handleAddOkWord = async (word) => {
        if (!word || okWords.includes(word)) return;
        const updated = [...okWords, word];
        setOkWords(updated);
        try {
            const ref = doc(firestore, 'meta', 'ok_words');
            await setDoc(ref, { words: updated });
            showToast(`「${word}」をOKワードに追加しました。`);
        } catch (error) {
            console.error("Failed to add ok word:", error);
            showToast('OKワードの追加に失敗しました。');
        }
    };

    const updateGlobalLog = async (field, value) => {
        const newLog = { ...globalLog, [field]: value };
        setGlobalLog(newLog);
        await saveDailyData(selectedDate, children, dailyMessages, results, summaryC, dailyTable, newLog);
    };

    const updateGlobalPrograms = async (updatedPrograms) => {
        const firstProg = updatedPrograms[0] || { title: '', summary: '' };
        const newLog = { 
            ...globalLog, 
            programs: updatedPrograms,
            programTitle: firstProg.title || '',
            programSummary: firstProg.summary || ''
        };
        setGlobalLog(newLog);
        await saveDailyData(selectedDate, children, dailyMessages, results, summaryC, dailyTable, newLog);
    };

    const updateGlobalProgramSummary = async (newSummary) => {
        const firstProg = { title: globalLog.programTitle || 'プログラム', summary: newSummary };
        const updatedPrograms = [firstProg];
        const newLog = {
            ...globalLog,
            programs: updatedPrograms,
            programTitle: firstProg.title,
            programSummary: newSummary
        };
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
        const childRow = { ...(dailyTable[childId] || {}), ...data };
        const newTable = { ...dailyTable, [childId]: childRow };
        setDailyTable(newTable);
        await saveDailyDataGranular({ childId, tableRow: childRow });
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
        const childMsgs = [...(dailyMessages[childId] || []), newMsg];
        const newMessages = { ...dailyMessages, [childId]: childMsgs };
        setDailyMessages(newMessages);
        await saveDailyDataGranular({ childId, messagesList: childMsgs });
    };

    const deleteMessage = async (childId, msgId) => {
        if (!confirm('メッセージを削除しますか？')) return;
        const childMsgs = (dailyMessages[childId] || []).filter(m => m.id !== msgId);
        const newMessages = { ...dailyMessages, [childId]: childMsgs };
        setDailyMessages(newMessages);
        await saveDailyDataGranular({ childId, messagesList: childMsgs });
    };

    const updateMessage = async (childId, msgId, newText) => {
        const childMsgs = (dailyMessages[childId] || []).map(m => m.id === msgId ? { ...m, text: newText } : m);
        const newMessages = { ...dailyMessages, [childId]: childMsgs };
        setDailyMessages(newMessages);
        await saveDailyDataGranular({ childId, messagesList: childMsgs });
    };

    const saveResults = async (res, sum, changedChildId) => {
        setResults(res); setSummaryC(sum);
        if (changedChildId) {
            const childResult = res[changedChildId] || {};
            await saveDailyDataGranular({ childId: changedChildId, result: childResult });
        } else {
            await saveDailyData(selectedDate, children, dailyMessages, res, sum, dailyTable, globalLog);
        }
    };

    const toggleCopySelectionMode = () => {
        setIsCopySelectionMode(prev => {
            const newVal = !prev;
            if (!newVal) {
                setSelectedChildIdsForCopy([]);
            }
            return newVal;
        });
    };

    const toggleCopySelection = (childId) => {
        setSelectedChildIdsForCopy(prev => {
            if (prev.includes(childId)) {
                return prev.filter(id => id !== childId);
            } else {
                return [...prev, childId];
            }
        });
    };

    const getCombinedChildrenNames = (selectedChildren) => {
        if (selectedChildren.length === 0) return '';
        
        const lastNameGroups = {};
        const orderOfLastNames = [];
        
        selectedChildren.forEach(child => {
            const ln = child.lastName || '';
            if (ln) {
                if (!lastNameGroups[ln]) {
                    lastNameGroups[ln] = [];
                    orderOfLastNames.push(ln);
                }
                lastNameGroups[ln].push(child);
            } else {
                const key = `_empty_${child.id}`;
                lastNameGroups[key] = [child];
                orderOfLastNames.push(key);
            }
        });
        
        const formattedGroups = orderOfLastNames.map(key => {
            const group = lastNameGroups[key];
            if (key.startsWith('_empty_')) {
                return `${group[0].name || '名称未設定'}さん`;
            }
            
            if (group.length > 1) {
                return key + group.map(c => `${c.firstName}さん`).join('、');
            } else {
                return `${key}${group[0].firstName}さん`;
            }
        });
        
        return formattedGroups.join('、');
    };

    const handleCopySelectedCommunications = () => {
        if (selectedChildIdsForCopy.length === 0) {
            alert('選択されている児童がいません。');
            return;
        }

        const activeSelectedChildren = selectedChildIdsForCopy
            .map(id => children.find(c => c.id === id))
            .filter(Boolean);

        // 兄弟グループ化（同じ姓でグループ）
        const lastNameGroups = {};
        const orderOfLastNames = [];

        activeSelectedChildren.forEach(child => {
            const ln = child.lastName || '';
            if (ln) {
                if (!lastNameGroups[ln]) {
                    lastNameGroups[ln] = [];
                    orderOfLastNames.push(ln);
                }
                lastNameGroups[ln].push(child);
            } else {
                const key = `_empty_${child.id}`;
                lastNameGroups[key] = [child];
                orderOfLastNames.push(key);
            }
        });

        let text = '';
        let count = 0;

        orderOfLastNames.forEach(key => {
            const group = lastNameGroups[key];

            // 名前を結合（山田太郎さん次郎さん）
            let nameStr;
            if (key.startsWith('_empty_')) {
                nameStr = `${group[0].name || '名称未設定'}さん`;
            } else if (group.length > 1) {
                // 兄弟をまとめた時だけ【】で囲む
                nameStr = `【${key}${group.map(c => `${c.firstName}さん`).join('')}】`;
            } else {
                nameStr = `${key}${group[0].firstName}さん`;
            }

            // コンテンツを収集（重複除去）
            const contents = [];
            group.forEach(child => {
                const content = (results[child.id]?.D || '').trim();
                if (content && !contents.includes(content)) {
                    contents.push(content);
                }
            });

            if (contents.length > 0) {
                text += `${nameStr}\n${contents.join('\n')}\n\n`;
                count += group.length;
            }
        });

        if (count === 0) {
            alert('選択された児童のツリー通信が入力されていません。');
            return;
        }

        text = text.trim();

        navigator.clipboard.writeText(text)
            .then(() => {
                alert(`${count}名分のツリー通信を兄弟結合してコピーしました！`);
                setSelectedChildIdsForCopy([]);
                setIsCopySelectionMode(false);
            })
            .catch(err => {
                console.error('Failed to copy text: ', err);
                alert('コピーに失敗しました。');
            });
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
                text += `【${child.lastName ? `${child.lastName} ${child.firstName}` : child.name}さん】${staff}\n${content.trim()}\n\n`;
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

    const exportBackupCSV = async (range = 'day') => {
        const officeId = selectedOffice?.id;
        if (!officeId) { showToast('事業所が選択されていません'); return; }

        // 対象日付リストを生成
        const today = new Date(selectedDate);
        const dates = [];
        if (range === 'day') {
            dates.push(selectedDate);
        } else {
            let startDate = new Date(today);
            if (range === 'week') startDate.setDate(today.getDate() - 6);
            else if (range === 'month') startDate.setMonth(today.getMonth() - 1);
            else if (range === 'year') startDate.setFullYear(today.getFullYear() - 1);
            else if (range === 'all') startDate = new Date('2024-01-01');
            for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
                dates.push(d.toISOString().split('T')[0]);
            }
        }

        showToast(`${dates.length}日分のデータを取得中...`);

        // 末尾の「復元用データ」は取り込み時の完全復元用（人が読む必要はない）
        const headers = ["児童名", "日付", "学習", "プログラム", "送迎時間", "終了時間", "迎え場所", "ツリー通信", "チャットメモ", "今後の予定", "備考", "復元用データ"];
        const allRows = [];

        for (const dateStr of dates) {
            let dayChildren, dayResults, dayMessages, dayTable;
            if (dateStr === selectedDate) {
                // 現在表示中の日はローカルデータを使用
                dayChildren = children;
                dayResults = results;
                dayMessages = dailyMessages;
                dayTable = dailyTable;
            } else {
                // 他の日はFirestoreから取得
                try {
                    const data = await cs({ action: 'getReport', date: dateStr, officeId });
                    if (!data || typeof data !== 'object') continue;
                    dayChildren = Array.isArray(data.children) ? data.children : [];
                    dayResults = data.results || {};
                    dayMessages = data.messages || {};
                    dayTable = data.dailyTable || {};
                } catch { continue; }
            }

            dayChildren.filter(c => !c.isPlaceholder).forEach(child => {
                const row = dayTable[child.id] || {};
                const result = dayResults[child.id] || {};
                const msgs = dayMessages[child.id] || [];
                const chatText = msgs.map(m => `${m.tag || ''}${m.text || ''}`).join(' | ');
                const studyMsgs = msgs.filter(m => {
                    const hasTag = m.tag && (m.tag === '【ツリー式学習】' || m.tag === '【学習】' || m.tag === '【宿題】' || m.tag === '【プリント】');
                    const hasPrefix = m.text && (m.text.includes('【ツリー式学習】') || m.text.includes('【学習】') || m.text.includes('【宿題】') || m.text.includes('【プリント】'));
                    return hasTag || hasPrefix;
                }).map(m => { let t = m.text.trim(); if (m.tag && !t.includes(m.tag)) t = `${m.tag}${t}`; return t; }).filter(t => t).join('\n');
                const progMsgs = msgs.filter(m => {
                    const hasTag = m.tag && m.tag === '【プログラム】';
                    const hasPrefix = m.text && m.text.includes('【プログラム】');
                    return hasTag || hasPrefix;
                }).map(m => { let t = m.text.trim(); if (m.tag && !t.includes(m.tag)) t = `${m.tag}${t}`; return t; }).filter(t => t).join(' / ');
                const futureText = msgs.filter(m => m.tag === '【今後の予定】' || (m.text && m.text.includes('【今後の予定】'))).map(m => m.text).join(' | ');
                const remarksText = msgs.filter(m => m.tag === '【備考】' || (m.text && m.text.startsWith('【備考】'))).map(m => m.text).join(' | ');
                // 復元用データ: メモ配列・書類・表の行を、そのままの形で保持する
                let restoreJSON = '';
                try {
                    restoreJSON = JSON.stringify({ v: 1, m: msgs, r: result, t: row });
                } catch { restoreJSON = ''; }

                allRows.push([
                    child.name, dateStr, studyMsgs, progMsgs,
                    row.transportTime || '', row.endTime || '', row.pickupLocation || '',
                    result.D || '', chatText, futureText, remarksText,
                    restoreJSON
                ]);
            });
        }

        if (allRows.length === 0) { showToast('エクスポートするデータがありません'); return; }

        const rangeLabels = { day: selectedDate, week: '1週間', month: '1ヶ月', year: '1年', all: '全期間' };
        const csvContent = '\uFEFF' + toCSV([headers, ...allRows]);
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `バックアップ_${rangeLabels[range] || selectedDate}_${selectedDate}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast(`${allRows.length}件のデータをエクスポートしました`);
    };



    const getRemarksText = (childId) => {
        const msgs = dailyMessages[childId] || [];
        return msgs.filter(m => {
            const hasRemarksTag = m.tag && m.tag === '【備考】';
            const hasTextPrefix = m.text.startsWith('【備考】');
            return hasRemarksTag || hasTextPrefix;
        })
        .map(m => {
            let t = m.text.trim();
            t = t.replace(/^【備考】\s*/, '').trim();
            return t;
        }).filter(t => t).join('\n');
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
        <div 
            onClick={() => { if (showExportMenu) setShowExportMenu(false); if (showImportMenu) setShowImportMenu(false); }}
            className="min-h-screen p-3 md:p-6 pb-24 space-y-4 md:space-y-6 max-w-[1800px] mx-auto overflow-x-hidden"
        >
            {isSandboxMode && (
                <div className="bg-amber-500 text-white px-5 py-3 rounded-2xl flex items-center justify-between shadow-lg font-black text-xs md:text-sm animate-in slide-in-from-top-4 duration-300 no-print">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 flex-shrink-0 animate-bounce" />
                        <span>【デモ（検証用）モード作動中】データベースには保存されません。画面上で表示や印刷などを自由に検証できます。</span>
                    </div>
                    <button 
                        onClick={() => {
                            setIsSandboxMode(false);
                            fetchDailyData(selectedDate, selectedOffice?.id);
                        }}
                        className="px-3 py-1.5 bg-white text-amber-600 rounded-xl hover:bg-slate-100 transition-all active:scale-95 text-xs font-bold"
                    >
                        デモモード解除（再読込）
                    </button>
                </div>
            )}
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
                            {offices.length > 0 ? (
                                <div className="relative inline-flex items-center">
                                    <select
                                        value={selectedOffice?.id || ''}
                                        onChange={(e) => {
                                            const office = offices.find(o => o.id === e.target.value);
                                            if (office) {
                                                setSelectedOffice(office);
                                                localStorage.setItem('care_pro_selected_office', JSON.stringify(office));
                                            }
                                        }}
                                        className="text-[10px] font-bold text-tree-700 bg-tree-50 border border-tree-200 pl-2 pr-5 py-0.5 rounded-full select-none cursor-pointer appearance-none outline-none hover:bg-tree-100 transition-all"
                                    >
                                        {offices.map(o => (
                                            <option key={o.id} value={o.id}>{o.name}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="w-3 h-3 text-tree-500 absolute right-1.5 pointer-events-none" />
                                </div>
                            ) : (
                                <span className="text-[10px] font-bold text-slate-400 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full select-none">未選択</span>
                            )}
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
                            
                            <div className="relative">
                                <button
                                    id="guide-export"
                                    onClick={() => { setShowExportMenu(!showExportMenu); setShowImportMenu(false); }}
                                    className="px-2.5 py-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-full border border-slate-200/60 hover:border-slate-300 shadow-sm transition-all active:scale-95 flex items-center gap-1.5"
                                    title="エクスポート"
                                >
                                    <FileSpreadsheet className="w-3.5 h-3.5 text-slate-400" />
                                    <span className="text-[10px] font-black">エクスポート</span>
                                    <ChevronDown className="w-3 h-3 text-slate-300" />
                                </button>
                                {showExportMenu && (
                                    <div className="absolute top-full left-0 mt-1 w-56 bg-white/95 backdrop-blur-xl rounded-xl shadow-xl border border-slate-200 p-1.5 z-[100] animate-in fade-in duration-200">
                                        <button onClick={() => { setShowExportModal(true); setShowExportMenu(false); }} className="w-full px-3 py-2 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 rounded-lg transition-all flex items-center gap-2">
                                            <FileText className="w-3.5 h-3.5 text-wood-500" />
                                            業務管理日誌に上書き
                                        </button>
                                        <div className="h-px bg-slate-100 my-1" />
                                        <div className="px-3 py-1">
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">CSVでエクスポート</span>
                                        </div>
                                        <button onClick={() => { exportBackupCSV('day'); setShowExportMenu(false); }} className="w-full px-3 py-1.5 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 rounded-lg transition-all flex items-center gap-2">
                                            <FileSpreadsheet className="w-3.5 h-3.5 text-tree-500" />
                                            本日のデータ
                                        </button>
                                        <button onClick={() => { exportBackupCSV('week'); setShowExportMenu(false); }} className="w-full px-3 py-1.5 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 rounded-lg transition-all flex items-center gap-2">
                                            <FileSpreadsheet className="w-3.5 h-3.5 text-tree-500" />
                                            1週間分
                                        </button>
                                        <button onClick={() => { exportBackupCSV('month'); setShowExportMenu(false); }} className="w-full px-3 py-1.5 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 rounded-lg transition-all flex items-center gap-2">
                                            <FileSpreadsheet className="w-3.5 h-3.5 text-tree-500" />
                                            1ヶ月分
                                        </button>
                                        <button onClick={() => { exportBackupCSV('year'); setShowExportMenu(false); }} className="w-full px-3 py-1.5 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 rounded-lg transition-all flex items-center gap-2">
                                            <FileSpreadsheet className="w-3.5 h-3.5 text-tree-500" />
                                            1年分
                                        </button>
                                        <button onClick={() => { exportBackupCSV('all'); setShowExportMenu(false); }} className="w-full px-3 py-1.5 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 rounded-lg transition-all flex items-center gap-2">
                                            <FileSpreadsheet className="w-3.5 h-3.5 text-tree-500" />
                                            全データ
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="relative">
                                <button
                                    onClick={() => { setShowImportMenu(!showImportMenu); setShowExportMenu(false); }}
                                    className="px-2.5 py-1.5 text-slate-500 hover:text-indigo-700 hover:bg-indigo-50/50 rounded-full border border-slate-200/60 hover:border-indigo-200 shadow-sm transition-all active:scale-95 flex items-center gap-1.5"
                                    title="インポート"
                                >
                                    <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-500" />
                                    <span className="text-[10px] font-black">インポート</span>
                                    <ChevronDown className="w-3 h-3 text-slate-300" />
                                </button>
                                {showImportMenu && (
                                    <div className="absolute top-full left-0 mt-1 w-56 bg-white/95 backdrop-blur-xl rounded-xl shadow-xl border border-slate-200 p-1.5 z-[100] animate-in fade-in duration-200">
                                        <button onClick={() => { setShowCSVImportModal(true); setShowImportMenu(false); }} className="w-full px-3 py-2 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 rounded-lg transition-all flex items-center gap-2">
                                            <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-500" />
                                            送迎管理アプリからインポート
                                        </button>
                                        <button onClick={() => { setShowBackupImportModal(true); setShowImportMenu(false); }} className="w-full px-3 py-2 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 rounded-lg transition-all flex items-center gap-2">
                                            <FileSpreadsheet className="w-3.5 h-3.5 text-tree-500" />
                                            バックアップから復元
                                        </button>
                                    </div>
                                )}
                            </div>

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
                                <button onClick={() => setShowLogModal(true)} className="p-2 hover:bg-tree-50 rounded-xl transition-all active:scale-95 group" title="変更履歴">
                                    <History className="w-4.5 h-4.5 text-slate-400 group-hover:scale-110 transition-transform" />
                                </button>
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



            <div 
                key={animationKey}
                className={cn(
                    "w-full transition-all",
                    slideDirection === 'left' ? "animate-in slide-in-from-right-8" :
                    slideDirection === 'right' ? "animate-in slide-in-from-left-8" : "animate-in fade-in duration-300"
                )}
            >
            {/* 新設: 勤怠管理 ＆ 本日の特記事項 ＆ 本日のプログラム ＆ 共有事項 の入力欄 (PC・スマホ両対応、直接入力可能) */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-4 no-print animate-in fade-in duration-500 items-stretch">
                
                {/* 1. 勤怠管理 */}
                <div className="bg-white/95 backdrop-blur-xl rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col transition-all duration-300 w-full animate-in fade-in h-full">
                    <div
                        className="flex items-center justify-between gap-4 px-3 py-2 bg-tree-50/80 border-b border-tree-100 flex-shrink-0 cursor-pointer hover:bg-tree-100/60 transition-all select-none"
                        onClick={() => setIsStaffCollapsed(!isStaffCollapsed)}
                    >
                        <div className="flex items-center gap-2">
                            <UserCheck className="w-3.5 h-3.5 text-tree-600" />
                            <span className="text-xs font-black text-tree-700 uppercase tracking-widest whitespace-nowrap">勤怠管理</span>
                            {isStaffCollapsed && Object.keys(attendance).length > 0 && (
                                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" title="入力済み" />
                            )}
                        </div>
                        <button
                            className="p-1 hover:bg-tree-100/50 rounded-full transition-all flex-shrink-0"
                            title={isStaffCollapsed ? "展開する" : "最小化する"}
                            onClick={(e) => { e.stopPropagation(); setIsStaffCollapsed(!isStaffCollapsed); }}
                        >
                            {isStaffCollapsed ? (
                                <ChevronDown className="w-4 h-4 text-tree-500" />
                            ) : (
                                <ChevronUp className="w-4 h-4 text-tree-500" />
                            )}
                        </button>
                    </div>
                    <div className={`transition-all duration-500 ease-in-out overflow-hidden ${isStaffCollapsed ? 'max-h-0 opacity-0' : 'max-h-[2000px] opacity-100'}`}>
                        <div className="flex flex-col">
                            {filteredStaffList.length === 0 ? (
                                <div className="py-6 text-center text-slate-300 text-[10px] font-bold">スタッフ未登録</div>
                            ) : (() => {
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

                                flatStaffWithRoles.sort((a, b) => roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role));

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
                                        <div key={`${staff.id}-${role}`} className="grid grid-cols-[75px_1fr] border-b border-slate-100 last:border-0 hover:bg-slate-50/40 transition-all duration-200">
                                            <div className="bg-slate-50/70 border-r border-slate-100 flex items-center justify-center p-1 min-h-[30px]">
                                                <span className="text-[8px] font-black text-slate-500 text-center leading-tight tracking-tighter">
                                                    {role === '児童指導員・保育士' ? "指導員/保育士" : role}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between gap-1 py-0.5 px-2">
                                                <button
                                                    onClick={() => handleStaffAttendanceChange(staff.id, 'type', record.type === 'work' ? 'public_holiday' : record.type === 'public_holiday' ? 'paid_leave' : 'work')}
                                                    className={`px-1.5 py-0.5 rounded text-[10px] font-black border transition-all text-left truncate flex-grow cursor-pointer ${
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
                                                {isWork ? (
                                                    <div className="flex items-center gap-[1px] text-[8px] flex-shrink-0 select-none scale-[0.9] origin-right">
                                                        <select value={startHour || '09'} onChange={e => handleTimeUpdate('startTime', 'hour', e.target.value)}
                                                            className="bg-white border border-slate-200 rounded text-[9px] font-bold text-slate-700 outline-none px-0.5 py-0 cursor-pointer appearance-none text-center w-[22px]">
                                                            {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                                                        </select>
                                                        <span className="text-slate-355">:</span>
                                                        <select value={startMin || '30'} onChange={e => handleTimeUpdate('startTime', 'minute', e.target.value)}
                                                            className="bg-white border border-slate-200 rounded text-[9px] font-bold text-slate-700 outline-none px-0.5 py-0 cursor-pointer appearance-none text-center w-[22px]">
                                                            {MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
                                                        </select>
                                                        <span className="text-slate-355 px-0.5">〜</span>
                                                        <select value={endHour || '18'} onChange={e => handleTimeUpdate('endTime', 'hour', e.target.value)}
                                                            className="bg-white border border-slate-200 rounded text-[9px] font-bold text-slate-700 outline-none px-0.5 py-0 cursor-pointer appearance-none text-center w-[22px]">
                                                            {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                                                        </select>
                                                        <span className="text-slate-355">:</span>
                                                        <select value={endMin || '30'} onChange={e => handleTimeUpdate('endTime', 'minute', e.target.value)}
                                                            className="bg-white border border-slate-200 rounded text-[9px] font-bold text-slate-700 outline-none px-0.5 py-0 cursor-pointer appearance-none text-center w-[22px]">
                                                            {MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
                                                        </select>
                                                    </div>
                                                ) : (
                                                    <span className={`text-[9px] font-black px-1.5 py-0.2 rounded-full select-none ${
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
                </div>

                {/* 2. 本日の特記事項 (旧 全体的な様子) */}
                <div className="bg-white/95 backdrop-blur-xl rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col transition-all duration-300 w-full animate-in fade-in h-full">
                    <div
                        className="flex items-center justify-between gap-4 px-3 py-2 bg-apple-50/80 border-b border-apple-100 flex-shrink-0 cursor-pointer hover:bg-apple-100/60 transition-all select-none"
                        onClick={() => setIsNoticeCollapsed(!isNoticeCollapsed)}
                    >
                        <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-apple-600" />
                            <span className="text-xs font-black text-apple-700 uppercase tracking-widest whitespace-nowrap">本日の特記事項</span>
                            {isNoticeCollapsed && localNotice && localNotice.trim() !== '' && (
                                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" title="入力済み" />
                            )}
                        </div>
                        <button
                            className="p-1 hover:bg-apple-100/50 rounded-full transition-all flex-shrink-0"
                            title={isNoticeCollapsed ? "展開する" : "最小化する"}
                            onClick={(e) => { e.stopPropagation(); setIsNoticeCollapsed(!isNoticeCollapsed); }}
                        >
                            {isNoticeCollapsed ? (
                                <ChevronDown className="w-4 h-4 text-apple-500" />
                            ) : (
                                <ChevronUp className="w-4 h-4 text-apple-500" />
                            )}
                        </button>
                    </div>
                    <div className={`transition-all duration-500 ease-in-out overflow-hidden ${isNoticeCollapsed ? 'max-h-0 opacity-0' : 'flex-1 flex flex-col min-h-0 max-h-[2000px] opacity-100'}`}>
                        <div className="p-3 flex-1 flex flex-col">
                            <textarea
                                value={localNotice}
                                onChange={(e) => setLocalNotice(e.target.value)}
                                onBlur={(e) => updateGlobalLog('notice', e.target.value)}
                                placeholder="本日の様子や業務上の特記事項を入力してください（自動保存）..."
                                style={{ fontSize: '14px' }}
                                className="w-full flex-1 min-h-0 text-xs md:text-sm font-medium leading-relaxed bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl p-3 outline-none focus:border-apple-400 focus:ring-4 focus:ring-apple-50 transition-all resize-none text-slate-700 shadow-inner"
                            />
                        </div>
                    </div>
                </div>

                {/* 3. 本日のプログラム */}
                <div className="bg-white/95 backdrop-blur-xl rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col transition-all duration-300 w-full animate-in fade-in h-full">
                    <div className="flex items-center justify-between gap-4 px-3 py-2 bg-purple-50/80 border-b border-purple-100 flex-shrink-0 cursor-pointer hover:bg-purple-100/60 transition-all select-none" onClick={() => setIsProgramCollapsed(!isProgramCollapsed)}>
                        <div className="flex items-center gap-2">
                            <ClipboardCheck className="w-4 h-4 text-purple-600" />
                            <span className="text-xs font-black text-purple-750 uppercase tracking-widest whitespace-nowrap">本日のプログラム</span>
                            {isProgramCollapsed && globalLog.programs && globalLog.programs.some(p => p.title || p.summary) && (
                                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" title="入力済み" />
                            )}
                        </div>
                        <button
                            onClick={(e) => { e.stopPropagation(); setIsProgramCollapsed(!isProgramCollapsed); }}
                            className="p-1 hover:bg-purple-100/50 rounded-full transition-all cursor-pointer flex-shrink-0"
                            title={isProgramCollapsed ? "展開する" : "最小化する"}
                        >
                            {isProgramCollapsed ? (
                                <ChevronDown className="w-4 h-4 text-purple-500" />
                            ) : (
                                <ChevronUp className="w-4 h-4 text-purple-500" />
                            )}
                        </button>
                    </div>
                    <div className={`transition-all duration-500 ease-in-out overflow-hidden ${isProgramCollapsed ? 'max-h-0 opacity-0' : 'max-h-[2000px] opacity-100'}`}>
                        <div className="p-3 flex-1 flex flex-col gap-3 min-h-0">
                            {(() => {
                                const currentPrograms = globalLog.programs || (globalLog.programTitle || globalLog.programSummary 
                                    ? [{ title: globalLog.programTitle || '', summary: globalLog.programSummary || '' }]
                                    : [{ title: '', summary: '' }]);
                                
                                // Ensure active tab index is in bounds
                                const activeIdx = Math.max(0, Math.min(activeProgramTab, currentPrograms.length - 1));
                                const activeProg = currentPrograms[activeIdx] || { title: '', summary: '' };

                                return (
                                    <>
                                        {/* Tabs Bar */}
                                        <div className="flex items-center gap-1 overflow-x-auto pb-1.5 border-b border-slate-100 flex-shrink-0 custom-scrollbar">
                                            {currentPrograms.map((prog, idx) => {
                                                const isActive = idx === activeIdx;
                                                return (
                                                    <div key={idx} className="flex items-center flex-shrink-0 relative group mr-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => setActiveProgramTab(idx)}
                                                            className={`px-2.5 py-1 text-[11px] font-black rounded-lg transition-all flex items-center gap-1 cursor-pointer border ${
                                                                isActive 
                                                                    ? 'bg-purple-600 text-white border-purple-600 shadow-sm font-bold' 
                                                                    : 'bg-white text-purple-700 border-purple-200 hover:bg-purple-50/50'
                                                            }`}
                                                        >
                                                            <span>{prog.title ? (prog.title.length > 5 ? prog.title.substring(0, 5) + '..' : prog.title) : `${idx + 1}`}</span>
                                                        </button>
                                                        {currentPrograms.length > 1 && (
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const updated = currentPrograms.filter((_, i) => i !== idx);
                                                                    updateGlobalPrograms(updated);
                                                                    // Shift tab index if needed
                                                                    if (activeIdx >= updated.length) {
                                                                        setActiveProgramTab(Math.max(0, updated.length - 1));
                                                                    }
                                                                }}
                                                                className={`absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full flex items-center justify-center border text-[8px] font-black shadow-sm transition-all scale-0 group-hover:scale-100 hover:scale-115 active:scale-90 cursor-pointer ${
                                                                    isActive
                                                                        ? 'bg-rose-500 text-white border-rose-600'
                                                                        : 'bg-white text-rose-500 border-rose-200'
                                                                }`}
                                                                title="このプログラムを削除"
                                                            >
                                                                ✕
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                            
                                            {/* Add Tab Button */}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const updated = [...currentPrograms, { title: '', summary: '' }];
                                                    updateGlobalPrograms(updated);
                                                    setActiveProgramTab(updated.length - 1);
                                                }}
                                                className="px-2 py-1 border border-dashed border-purple-300 hover:border-purple-500 text-purple-500 hover:bg-purple-50/10 rounded-lg text-[10px] font-bold transition-all flex items-center gap-0.5 cursor-pointer flex-shrink-0"
                                                title="プログラムを追加"
                                            >
                                                <Plus className="w-3 h-3" />
                                                <span>追加</span>
                                            </button>
                                        </div>

                                        {/* Active Tab Panel */}
                                        <div className="flex-1 flex flex-col gap-2 bg-slate-50/30 p-2 rounded-xl border border-slate-100/50 mt-1 animate-in fade-in duration-200">
                                            {/* Title */}
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                                                    プログラム名
                                                </label>
                                                <input
                                                    type="text"
                                                    placeholder="例: ダンス、工作、レクリエーション"
                                                    value={activeProg.title || ''}
                                                    onChange={(e) => {
                                                        const updated = [...currentPrograms];
                                                        updated[activeIdx] = { ...updated[activeIdx], title: e.target.value };
                                                        updateGlobalPrograms(updated);
                                                    }}
                                                    className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-750 focus:outline-none focus:border-purple-400 transition-all shadow-sm"
                                                />
                                            </div>
                                            
                                            {/* Description / Summary */}
                                            <div className="flex-grow flex flex-col space-y-1">
                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                                                    詳細・手順
                                                </label>
                                                <textarea
                                                    placeholder="具体的な手順やねらいを入力してください（自動保存）..."
                                                    value={activeProg.summary || ''}
                                                    onChange={(e) => {
                                                        const updated = [...currentPrograms];
                                                        updated[activeIdx] = { ...updated[activeIdx], summary: e.target.value };
                                                        updateGlobalPrograms(updated);
                                                    }}
                                                    className="w-full flex-grow min-h-[50px] px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:border-purple-400 transition-all leading-relaxed shadow-sm resize-none"
                                                />
                                            </div>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                </div>

                {/* 4. 共有事項 (旧 業務・活動内容) */}
                <div className="bg-white/95 backdrop-blur-xl rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col transition-all duration-300 w-full animate-in fade-in h-full">
                    <div
                        className="flex items-center justify-between gap-4 px-3 py-2 bg-wood-50/80 border-b border-wood-100 flex-shrink-0 cursor-pointer hover:bg-wood-100/60 transition-all select-none"
                        onClick={() => setIsActivitiesCollapsed(!isActivitiesCollapsed)}
                    >
                        <div className="flex items-center gap-2">
                            <ClipboardList className="w-4 h-4 text-wood-600" />
                            <span className="text-xs font-black text-wood-700 uppercase tracking-widest whitespace-nowrap">共有事項</span>
                            {isActivitiesCollapsed && localActivities && localActivities.trim() !== '' && (
                                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" title="入力済み" />
                            )}
                        </div>
                        <button
                            className="p-1 hover:bg-wood-100/50 rounded-full transition-all flex-shrink-0"
                            title={isActivitiesCollapsed ? "展開する" : "最小化する"}
                            onClick={(e) => { e.stopPropagation(); setIsActivitiesCollapsed(!isActivitiesCollapsed); }}
                        >
                            {isActivitiesCollapsed ? (
                                <ChevronDown className="w-4 h-4 text-wood-500" />
                            ) : (
                                <ChevronUp className="w-4 h-4 text-wood-500" />
                            )}
                        </button>
                    </div>
                    <div className={`transition-all duration-500 ease-in-out overflow-hidden ${isActivitiesCollapsed ? 'max-h-0 opacity-0' : 'flex-1 flex flex-col min-h-0 max-h-[2000px] opacity-100'}`}>
                        <div className="p-3 flex-1 flex flex-col">
                            <textarea
                                value={localActivities}
                                onChange={(e) => setLocalActivities(e.target.value)}
                                onBlur={(e) => updateGlobalLog('activities', e.target.value)}
                                placeholder="共有事項・連絡事項を入力してください（自動保存）..."
                                style={{ fontSize: '14px' }}
                                className="w-full flex-1 min-h-0 text-xs md:text-sm font-medium leading-relaxed bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl p-3 outline-none focus:border-wood-400 focus:ring-4 focus:ring-wood-50 transition-all resize-none text-slate-700 shadow-inner"
                            />
                        </div>
                    </div>
                </div>
            </div>

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
                            <div className="flex bg-white rounded-full p-0.5 border border-slate-200/60 shadow-sm mx-auto sm:mx-0 lg:hidden overflow-x-auto custom-scrollbar-hidden whitespace-nowrap max-w-full gap-0.5">
                                <button
                                    data-tab-btn="learning"
                                    onClick={() => setActiveTableTab('learning')}
                                    className={`px-2.5 py-1.5 rounded-full text-[10px] font-black transition-all flex-shrink-0 whitespace-nowrap ${activeTableTab === 'learning' ? 'bg-tree-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                                >
                                    学習
                                </button>
                                <button
                                    data-tab-btn="program"
                                    onClick={() => setActiveTableTab('program')}
                                    className={`px-2.5 py-1.5 rounded-full text-[10px] font-black transition-all flex-shrink-0 whitespace-nowrap ${activeTableTab === 'program' ? 'bg-purple-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                                >
                                    プログラム
                                </button>
                                <button
                                    data-tab-btn="transport"
                                    onClick={() => setActiveTableTab('transport')}
                                    className={`px-2.5 py-1.5 rounded-full text-[10px] font-black transition-all flex-shrink-0 whitespace-nowrap ${activeTableTab === 'transport' ? 'bg-wood-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                                >
                                    時間
                                </button>
                                <button
                                    data-tab-btn="copy"
                                    onClick={() => setActiveTableTab('copy')}
                                    className={`px-2.5 py-1.5 rounded-full text-[10px] font-black transition-all flex-shrink-0 whitespace-nowrap ${activeTableTab === 'copy' ? 'bg-apple-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                                >
                                    ツリー通信
                                </button>
                                <button
                                    data-tab-btn="futurePlan"
                                    onClick={() => setActiveTableTab('futurePlan')}
                                    className={`px-2.5 py-1.5 rounded-full text-[10px] font-black transition-all flex-shrink-0 whitespace-nowrap ${activeTableTab === 'futurePlan' ? 'bg-tree-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                                >
                                    今後の予定
                                </button>
                                <button
                                    data-tab-btn="remarks"
                                    onClick={() => setActiveTableTab('remarks')}
                                    className={`px-2.5 py-1.5 rounded-full text-[10px] font-black transition-all flex-shrink-0 whitespace-nowrap ${activeTableTab === 'remarks' ? 'bg-wood-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                                >
                                    備考
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
                                        <th className="sticky left-0 z-30 bg-slate-50 border-r border-slate-100 w-[30%] lg:w-[10%] min-w-[110px] p-2 md:p-4 text-[10px] md:text-[12px] font-black text-slate-400 uppercase tracking-[0.2em] text-left relative animate-all">
                                            <span>児童氏名</span>
                                        </th>

                                        <th className={`p-2 text-[10px] font-black text-slate-400 w-[70%] lg:w-[14%] min-w-[120px] border-r border-slate-100 bg-slate-50/10 text-center ${activeTableTab === 'learning' ? 'table-cell' : 'hidden'} lg:table-cell`}>学習</th>
                                        <th className={`p-2 text-[10px] font-black text-slate-400 w-[70%] lg:w-[14%] min-w-[120px] border-r border-slate-100 bg-slate-50/10 text-center ${activeTableTab === 'program' ? 'table-cell' : 'hidden'} lg:table-cell`}>プログラム</th>
                                        <th className={`p-2 text-[10px] font-black text-slate-400 w-[23%] lg:w-[6%] min-w-[60px] border-r border-slate-100 bg-slate-50/10 text-center ${activeTableTab === 'transport' ? 'table-cell' : 'hidden'} lg:table-cell`}>送迎</th>
                                        <th className={`p-2 text-[10px] font-black text-slate-400 w-[23%] lg:w-[6%] min-w-[60px] border-r border-slate-100 bg-slate-50/10 text-center ${activeTableTab === 'transport' ? 'table-cell' : 'hidden'} lg:table-cell`}>終了</th>
                                        <th className={`p-2 text-[10px] font-black text-slate-400 w-[24%] lg:w-[8%] min-w-[75px] border-r border-slate-100 bg-slate-50/10 text-center ${activeTableTab === 'transport' ? 'table-cell' : 'hidden'} lg:table-cell`}>迎え場所</th>
                                        <th className={`p-2 text-[10px] font-black text-slate-400 w-[70%] lg:w-[14%] min-w-[200px] border-r border-slate-100 bg-slate-50/10 text-center ${activeTableTab === 'copy' ? 'table-cell' : 'hidden'} lg:table-cell`}>
                                            <div className="flex flex-col items-center gap-1.5 py-1">
                                                <span>ツリー通信コピー</span>
                                                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                                    <button
                                                        onClick={toggleCopySelectionMode}
                                                        className={`px-2 py-0.5 rounded-full text-[9px] font-black border transition-all active:scale-95 ${isCopySelectionMode ? 'bg-green-600 border-green-700 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                                                    >
                                                        {isCopySelectionMode ? '選択解除' : '兄弟コピー'}
                                                    </button>
                                                    {isCopySelectionMode && (
                                                        <button
                                                            onClick={handleCopySelectedCommunications}
                                                            disabled={selectedChildIdsForCopy.length === 0}
                                                            className={`px-2 py-0.5 rounded-full text-[9px] font-black border transition-all ${selectedChildIdsForCopy.length > 0 ? 'bg-apple-600 border-apple-700 text-white shadow-sm active:scale-95' : 'bg-slate-100 border-slate-200 text-slate-300 cursor-not-allowed'}`}
                                                        >
                                                            コピー ({selectedChildIdsForCopy.length})
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </th>
                                        <th className={`p-2 text-[10px] font-black text-slate-400 w-[70%] lg:w-[14%] min-w-[200px] border-r border-slate-100 bg-slate-50/10 text-center ${activeTableTab === 'futurePlan' ? 'table-cell' : 'hidden'} lg:table-cell`}>今後の予定</th>
                                        <th className={`p-2 text-[10px] font-black text-slate-400 w-[70%] lg:w-[14%] min-w-[200px] border-r border-slate-100 bg-slate-50/10 text-center ${activeTableTab === 'remarks' ? 'table-cell' : 'hidden'} lg:table-cell`}>備考</th>
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
                                                                    if (!isPlaceholder) {
                                                                        handleOpenChildPanel(child.id, 'tree');
                                                                    } else {
                                                                        setShowAddChildModal(true);
                                                                    }
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
                                                                disabled={!isPlaceholder && (isLocked || !!lockingChildId)}
                                                                className={`flex-1 text-left transition-colors flex flex-col min-w-0 longpress-safe select-none ${isLocked ? 'text-slate-400 cursor-not-allowed' : isPlaceholder ? 'text-slate-300 cursor-pointer hover:text-tree-600 hover:bg-slate-50/50' : 'hover:text-tree-600'}`}>
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
                                                <td className={`p-3 md:p-5 text-[10px] md:text-[12px] border-r border-slate-100 leading-relaxed font-bold align-top transition-colors ${isLocked ? 'bg-slate-100/60 text-slate-400 cursor-not-allowed' : lockingChildId === child.id ? 'cursor-wait text-slate-600' : 'cursor-pointer hover:bg-slate-50 text-slate-600'} ${selectedChildId === child.id ? 'bg-tree-50/20' : ''} ${activeTableTab === 'program' ? 'table-cell' : 'hidden'} lg:table-cell`} onClick={() => {
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
                                                <td className={`p-2 border-r border-slate-100/50 align-top ${isLocked ? 'bg-slate-100/40' : ''} ${activeTableTab === 'copy' ? 'table-cell' : 'hidden'} lg:table-cell`}>
                                                    {!isPlaceholder && (
                                                        <div className="flex flex-col gap-2">
                                                            {/* ツリー通信テキスト表示（約5行で頭打ち・枠内スクロール） */}
                                                            <div
                                                                className={`custom-scrollbar-thin text-[10px] md:text-[12px] leading-relaxed whitespace-pre-wrap break-all cursor-pointer hover:bg-slate-50/50 rounded-lg p-1 transition-all min-h-[20px] max-h-[85px] md:max-h-[100px] overflow-y-auto ${results[child.id]?.D?.trim() ? 'text-slate-600 font-medium' : 'text-slate-300 italic'}`}
                                                                onPointerDown={(e) => {
                                                                    e.currentTarget.dataset.tapX = e.clientX;
                                                                    e.currentTarget.dataset.tapY = e.clientY;
                                                                }}
                                                                onPointerUp={(e) => {
                                                                    // スクロール操作（指やマウスを動かした場合）は編集パネルを開かない
                                                                    const startX = e.currentTarget.dataset.tapX;
                                                                    const startY = e.currentTarget.dataset.tapY;
                                                                    delete e.currentTarget.dataset.tapX;
                                                                    delete e.currentTarget.dataset.tapY;
                                                                    if (startX === undefined || startY === undefined) return;
                                                                    if (Math.abs(e.clientX - Number(startX)) > 8 || Math.abs(e.clientY - Number(startY)) > 8) return;

                                                                    if (isLocked) {
                                                                        showToast(`${lockOwner.userName || lockOwner.userEmail || '他ユーザー'}が入力中のため編集できません。`);
                                                                        return;
                                                                    }
                                                                    if (lockingChildId) return;
                                                                    handleOpenChildPanel(child.id, 'tree');
                                                                }}
                                                            >
                                                                {results[child.id]?.D?.trim() || '未入力'}
                                                            </div>
                                                            {/* ボタン群 */}
                                                            <div className="flex flex-row items-center justify-center gap-4">
                                                            {isCopySelectionMode ? (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        toggleCopySelection(child.id);
                                                                    }}
                                                                    disabled={isLocked || !results[child.id]?.D?.trim()}
                                                                    className={`px-3 py-1.5 rounded-xl border transition-all active:scale-95 flex items-center justify-center gap-1.5 min-w-[75px] ${
                                                                        !results[child.id]?.D?.trim()
                                                                            ? 'bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed'
                                                                            : selectedChildIdsForCopy.includes(child.id)
                                                                                ? 'bg-green-600 border-green-700 text-white shadow-sm font-black'
                                                                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 shadow-sm'
                                                                    }`}
                                                                    title={isLocked ? '編集中のため選択できません' : !results[child.id]?.D?.trim() ? 'ツリー通信未入力' : '一括コピーの対象に選択'}
                                                                >
                                                                    {selectedChildIdsForCopy.includes(child.id) ? (
                                                                        <>
                                                                            <span className="w-4 h-4 bg-white text-green-700 rounded-full flex items-center justify-center text-[10px] font-black leading-none shadow-sm">
                                                                                {selectedChildIdsForCopy.indexOf(child.id) + 1}
                                                                            </span>
                                                                            <span className="text-[10px] font-black tracking-wider">選択中</span>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <Copy className="w-3.5 h-3.5 opacity-60" />
                                                                            <span className="text-[10px] font-bold tracking-wider">選択する</span>
                                                                        </>
                                                                    )}
                                                                </button>
                                                            ) : (
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
                                                            )}
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
                                                        </div>
                                                    )}
                                                </td>
                                                <td className={`p-3 md:p-5 text-[10px] md:text-[12px] border-r border-slate-100 leading-relaxed font-bold align-top transition-colors ${isLocked ? 'bg-slate-100/60 text-slate-400 cursor-not-allowed' : lockingChildId === child.id ? 'cursor-wait text-slate-600' : 'cursor-pointer hover:bg-slate-50 text-slate-600'} ${selectedChildId === child.id ? 'bg-tree-50/20' : ''} ${activeTableTab === 'futurePlan' ? 'table-cell' : 'hidden'} lg:table-cell`} onClick={() => {
                                                    if (isLocked) {
                                                        showToast(`${lockOwner.userName || lockOwner.userEmail || '他ユーザー'}が入力中のため編集できません。`);
                                                        return;
                                                    }
                                                    if (lockingChildId) return;
                                                    if (!isPlaceholder) { handleOpenChildPanel(child.id, 'futurePlan'); }
                                                }}>
                                                    {!isPlaceholder && (
                                                        <div className="tracking-tight whitespace-pre-wrap break-all text-slate-600">
                                                            {results[child.id]?.futurePlan || ''}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className={`p-3 md:p-5 text-[10px] md:text-[12px] border-r border-slate-100 leading-relaxed font-bold align-top transition-colors ${isLocked ? 'bg-slate-100/60 text-slate-400 cursor-not-allowed' : lockingChildId === child.id ? 'cursor-wait text-slate-600' : 'cursor-pointer hover:bg-slate-50 text-slate-600'} ${selectedChildId === child.id ? 'bg-tree-50/20' : ''} ${activeTableTab === 'remarks' ? 'table-cell' : 'hidden'} lg:table-cell`} onClick={() => {
                                                    if (isLocked) {
                                                        showToast(`${lockOwner.userName || lockOwner.userEmail || '他ユーザー'}が入力中のため編集できません。`);
                                                        return;
                                                    }
                                                    if (lockingChildId) return;
                                                    if (!isPlaceholder) { handleOpenChildPanel(child.id, 'chat'); }
                                                }}>
                                                    {!isPlaceholder && (
                                                        <div className="tracking-tight whitespace-pre-wrap break-all text-slate-600">
                                                            {getRemarksText(child.id)}
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
                                onSaveTree={(id, res) => saveResults({ ...results, [id]: { ...res, staffName: getCurrentStaffName() } }, summaryC, id)}
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
                                programs={globalLog.programs || []}
                                greetingTemplates={greetingTemplates}
                                onSaveTemplate={handleSaveGreetingTemplate}
                                okWords={okWords}
                                onAddOkWord={handleAddOkWord}
                            />
                        )}
                        {(selectedDocChildId || (isPanelClosing && lastPanelData?.doc)) && (
                            <DocViewer
                                child={children.find(c => c.id === (selectedDocChildId || lastPanelData?.doc))}
                                result={results[selectedDocChildId || lastPanelData?.doc]}
                                selectedDate={selectedDate}
                                onSaveResult={(id, res) => saveResults({ ...results, [id]: { ...res, staffName: getCurrentStaffName() } }, summaryC, id)}
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


            {showSettingsModal && (
                <SettingsModal
                    onClose={() => setShowSettingsModal(false)}
                    tags={tags}
                    onSaveTags={handleUpdateTags}
                    okWords={okWords}
                    onSaveOkWords={handleSaveOkWords}
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

            <CSVImportModal
                show={showCSVImportModal}
                onClose={() => setShowCSVImportModal(false)}
                masterChildren={masterChildren}
                offices={offices}
                selectedOffice={selectedOffice}
                selectedDate={selectedDate}
                cs={cs}
                onRefresh={() => fetchDailyData(selectedDate, selectedOffice?.id)}
                onImportSandbox={(date, officeId, sandboxReport) => {
                    if (date === selectedDate && officeId === selectedOffice?.id) {
                        setChildren(sandboxReport.children || []);
                        setDailyTable(sandboxReport.dailyTable || {});
                        setResults(sandboxReport.results || {});
                        setSummaryC(sandboxReport.summaryC || '');
                    }
                    setIsSandboxMode(true);
                }}
            />

            <BackupImportModal
                show={showBackupImportModal}
                onClose={() => setShowBackupImportModal(false)}
                masterChildren={masterChildren}
                currentChildren={children}
                selectedDate={selectedDate}
                selectedOffice={selectedOffice}
                cs={cs}
                onRefresh={() => fetchDailyData(selectedDate, selectedOffice?.id)}
            />

            <LogModal
                show={showLogModal}
                onClose={() => setShowLogModal(false)}
                logs={changeLogs}
                onRestore={handleRestoreLog}
            />



            {/* Mobile Floating Action Menu (FAB) */}
            <div className="lg:hidden fixed bottom-6 right-6 z-[90] no-print">
                {/* Expandable Menu Panel */}
                {isMobileMenuOpen && (
                    <div className="absolute bottom-16 right-0 mb-2 w-56 glass-card bg-white/95 backdrop-blur-xl rounded-[2rem] shadow-2xl border border-slate-100 p-4 space-y-2.5 animate-in slide-in-from-bottom-5 duration-300 max-h-[70vh] overflow-y-auto custom-scrollbar">

                            <button
                                id="guide-print-mobile-btn"
                                onClick={() => { printAllDocuments(children, results, summaryC, selectedDate, dailyTable, dailyMessages, globalLog, attendance, filteredStaffList); setIsMobileMenuOpen(false); }}
                                className="w-full px-4 py-3 bg-wood-50 text-wood-700 hover:bg-wood-100 rounded-2xl font-black text-xs transition-all active:scale-95 flex items-center gap-3"
                            >
                            <Printer className="w-4 h-4 text-wood-600" />
                            <span>印刷</span>
                        </button>



                        <div className="h-px bg-slate-100 my-1" />

                        {/* エクスポート（タップで開く小メニュー） */}
                        <button
                            onClick={() => { setMobileExportOpen(!mobileExportOpen); setMobileImportOpen(false); }}
                            className="w-full px-4 py-2.5 hover:bg-slate-50 text-slate-600 hover:text-slate-800 rounded-xl font-bold text-xs transition-all flex items-center gap-3"
                        >
                            <FileSpreadsheet className="w-4 h-4 text-slate-400" />
                            <span className="flex-1 text-left">エクスポート</span>
                            {mobileExportOpen ? <ChevronUp className="w-3.5 h-3.5 text-slate-300" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-300" />}
                        </button>
                        {mobileExportOpen && (
                            <div className="pl-3 ml-2 border-l-2 border-slate-100 space-y-1 animate-in fade-in slide-in-from-top-2 duration-200">
                                <button onClick={() => { setShowExportModal(true); setIsMobileMenuOpen(false); }} className="w-full px-3 py-2 hover:bg-slate-50 text-slate-600 hover:text-slate-800 rounded-xl font-bold text-xs transition-all flex items-center gap-3">
                                    <FileText className="w-4 h-4 text-wood-500" />
                                    <span>業務管理日誌に上書き</span>
                                </button>
                                <div className="px-3 pt-1">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">CSVエクスポート</span>
                                </div>
                                <button onClick={() => { exportBackupCSV('day'); setIsMobileMenuOpen(false); }} className="w-full px-3 py-2 hover:bg-slate-50 text-slate-600 hover:text-slate-800 rounded-xl font-bold text-xs transition-all flex items-center gap-3">
                                    <FileSpreadsheet className="w-4 h-4 text-tree-500" />
                                    <span>本日のデータ</span>
                                </button>
                                <button onClick={() => { exportBackupCSV('week'); setIsMobileMenuOpen(false); }} className="w-full px-3 py-2 hover:bg-slate-50 text-slate-600 hover:text-slate-800 rounded-xl font-bold text-xs transition-all flex items-center gap-3">
                                    <FileSpreadsheet className="w-4 h-4 text-tree-500" />
                                    <span>1週間分</span>
                                </button>
                                <button onClick={() => { exportBackupCSV('month'); setIsMobileMenuOpen(false); }} className="w-full px-3 py-2 hover:bg-slate-50 text-slate-600 hover:text-slate-800 rounded-xl font-bold text-xs transition-all flex items-center gap-3">
                                    <FileSpreadsheet className="w-4 h-4 text-tree-500" />
                                    <span>1ヶ月分</span>
                                </button>
                                <button onClick={() => { exportBackupCSV('year'); setIsMobileMenuOpen(false); }} className="w-full px-3 py-2 hover:bg-slate-50 text-slate-600 hover:text-slate-800 rounded-xl font-bold text-xs transition-all flex items-center gap-3">
                                    <FileSpreadsheet className="w-4 h-4 text-tree-500" />
                                    <span>1年分</span>
                                </button>
                                <button onClick={() => { exportBackupCSV('all'); setIsMobileMenuOpen(false); }} className="w-full px-3 py-2 hover:bg-slate-50 text-slate-600 hover:text-slate-800 rounded-xl font-bold text-xs transition-all flex items-center gap-3">
                                    <FileSpreadsheet className="w-4 h-4 text-tree-500" />
                                    <span>全データ</span>
                                </button>
                            </div>
                        )}

                        {/* インポート（タップで開く小メニュー） */}
                        <button
                            onClick={() => { setMobileImportOpen(!mobileImportOpen); setMobileExportOpen(false); }}
                            className="w-full px-4 py-2.5 hover:bg-slate-50 text-slate-600 hover:text-slate-800 rounded-xl font-bold text-xs transition-all flex items-center gap-3"
                        >
                            <FileSpreadsheet className="w-4 h-4 text-indigo-500" />
                            <span className="flex-1 text-left">インポート</span>
                            {mobileImportOpen ? <ChevronUp className="w-3.5 h-3.5 text-slate-300" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-300" />}
                        </button>
                        {mobileImportOpen && (
                            <div className="pl-3 ml-2 border-l-2 border-slate-100 space-y-1 animate-in fade-in slide-in-from-top-2 duration-200">
                                <button onClick={() => { setShowCSVImportModal(true); setIsMobileMenuOpen(false); }} className="w-full px-3 py-2 hover:bg-slate-50 text-slate-600 hover:text-slate-800 rounded-xl font-bold text-xs transition-all flex items-center gap-3">
                                    <FileSpreadsheet className="w-4 h-4 text-indigo-500" />
                                    <span>送迎アプリからインポート</span>
                                </button>
                                <button onClick={() => { setShowBackupImportModal(true); setIsMobileMenuOpen(false); }} className="w-full px-3 py-2 hover:bg-slate-50 text-slate-600 hover:text-slate-800 rounded-xl font-bold text-xs transition-all flex items-center gap-3">
                                    <FileSpreadsheet className="w-4 h-4 text-tree-500" />
                                    <span>バックアップから復元</span>
                                </button>
                            </div>
                        )}





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

                        <button
                            onClick={() => { setShowLogModal(true); setIsMobileMenuOpen(false); }}
                            className="w-full px-4 py-2.5 hover:bg-slate-50 text-slate-600 hover:text-slate-800 rounded-xl font-bold text-xs transition-all flex items-center gap-3"
                        >
                            <History className="w-4 h-4 text-slate-400" />
                            <span>変更履歴</span>
                        </button>



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
                    onClick={() => { const next = !isMobileMenuOpen; setIsMobileMenuOpen(next); if (!next) { setMobileExportOpen(false); setMobileImportOpen(false); } }}
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

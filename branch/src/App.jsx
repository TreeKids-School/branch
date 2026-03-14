import { useState, useEffect, useCallback, useRef } from 'react';
import {
    Users, FileText, MessageSquare, Send, Loader2, Copy, Check,
    PlusCircle, Trash2, ClipboardCheck, BookOpen, Cloud, ClipboardList,
    Printer, FileSpreadsheet, Calendar, X,
    Settings, Edit2
} from 'lucide-react';
import { callStorage } from './hooks/useStorage';
import { STAFF_OPTIONS, APP_VERSION, DAILY_LIMIT, parseForceSheet, buildForceSheet, getStaffInstruction } from './constants';
import { defaultPrompts } from './constants/defaultPrompts';
import { CopyButton, ErrorBoundary } from './components/Shared';
import CalendarModal from './components/CalendarModal';
import SettingsModal from './components/SettingsModal';
import ExportModal from './components/ExportModal';
import { printAllDocuments } from './utils/print';

// ── Tour (Driver.js) ────────────────────────────────────────────────────────
const startTour = () => {
    const driver = window.driver?.js?.driver || window.driver;
    if (!driver) { alert('ガイドを読み込み中です。しばらくしてから再度お試しください。'); return; }
    const driverObj = driver({
        showProgress: true,
        allowClose: false,
        steps: [
            { element: '#tutorial-calendar', popover: { title: '① 日付を選択', description: 'まずは作成したい日報の日付を確認・変更します。<br>過去の日報を見たり、未来の予定を立てることもできます。', side: 'bottom', align: 'start' } },
            { element: '#tutorial-add-btn', popover: { title: '② 児童を追加', description: 'このボタンを押して、担当する児童をリストに追加します。', side: 'left', align: 'start' } },
            { element: '.tutorial-memo-btn', popover: { title: '③ メモを入力', description: 'この吹き出しアイコンを押して、児童の様子をメモします。<br>AIはこのメモを元に書類を作成します。', side: 'left', align: 'start' } },
            { element: '.tutorial-staff-select', popover: { title: '④ 担当者を選択', description: '誰が書いたかわかるように、担当スタッフを選択しておきます。<br>（文章の書き方の癖などをAIが調整します）', side: 'left', align: 'start' } },
            { element: '.tutorial-check-btn', popover: { title: '⑤ 生成対象をチェック', description: '書類を作りたい児童にチェックが入っていることを確認します。<br>チェックボックスを押すとオン/オフできます。', side: 'right', align: 'start' } },
            { element: '#tutorial-generate-btn', popover: { title: '⑥ 書類を生成', description: '準備ができたら、このボタンを押してAIに書類を一括生成させます。', side: 'top', align: 'start' } },
            { element: '.tutorial-action-buttons', popover: { title: '⑦ 生成完了', description: '生成が完了すると、この場所に📄（書類マーク）が表示されます。<br>それを押すと書類の中身を確認・編集できます。', side: 'left', align: 'start' } }
        ],
        nextBtnText: '次へ', prevBtnText: '戻る', doneBtnText: '完了',
    });
    driverObj.drive();
};

// ── AI ──────────────────────────────────────────────────────────────────────
const fetchAI = async (prompt, isJson) => {
    const callGeminiDirectly = async (apiKey, prompt, isJson) => {
        const MODEL = 'gemini-2.0-flash';
        const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;
        const response = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7 } })
        });
        const data = await response.json();
        if (!response.ok || data.error) throw new Error(data.error?.message || 'Gemini API Error');
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (isJson && text) {
            try { const m = text.match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : JSON.parse(text); } catch { return null; }
        }
        return isJson ? null : text;
    };

    try {
        const apiKey = localStorage.getItem('care_pro_gemini_key');
        if (apiKey) {
            try { return await callGeminiDirectly(apiKey, prompt, isJson); }
            catch (e) {
                if (e.message?.includes('429') || e.message?.toLowerCase().includes('quota')) {
                    alert('AIサービスの利用制限に達しました。しばらく時間を空けてから再度お試しください。');
                    throw new Error('QUOTA_EXCEEDED_STOP');
                }
                alert('AI生成エラー: ' + e.message);
                throw e;
            }
        }
        const isLocal = window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        if (isLocal) throw new Error('No API Key provided for local mode');
        const response = await fetch('/api/gemini', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, isJson }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'AI呼び出しに失敗しました');
        return isJson ? (data.parsed || null) : data.text;
    } catch (e) {
        if (e.message === 'QUOTA_EXCEEDED_STOP') throw e;
        await new Promise(r => setTimeout(r, 1000));
        if (isJson) return {
            B_result: '【デモ生成】学習では宿題に取り組む姿が見られ、途中で集中が途切れる場面もあったが、環境を整えることで再度取り組めた。',
            B_plan: '宿題では集中が続くよう環境調整を行い、プログラムは事前の見通し提示を増やして参加しやすくしていく。',
            B_item: '①健康・生活, ⑤人間関係・社会性',
            D: '【デモ生成】学習では宿題に取り組む姿が見られました。プログラムでは説明を受けて参加でき、自由時間は落ち着いて過ごす様子が見られました。',
            K_sheet: '【学習】漢字ドリルに集中して取り組んだ。\n【自由遊び】友だちと協力して遊んだ。\n【プログラム】ルールを理解して参加した。\n【おやつ】該当なし'
        };
        return '【デモ生成】学習では宿題に自発的に取り組む姿が見られ、途中で注意が逸れる場面もあったが環境調整で継続できた。';
    }
};

// ── MemoInput Component ──────────────────────────────────────────────────────
function MemoInput({ childId, drafts, setDrafts, onSend }) {
    const textareaRef = useRef(null);
    const savedSelRef = useRef({ start: 0, end: 0 });
    const TAGS = ['ツリー式学習', '宿題', 'プリント', 'プログラム', '自由時間'];

    const autoResize = () => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = el.scrollHeight + 'px';
    };

    const saveSelection = () => {
        const el = textareaRef.current;
        if (el) savedSelRef.current = { start: el.selectionStart, end: el.selectionEnd };
    };

    const insertTag = (tag) => {
        const el = textareaRef.current;
        const { start, end } = savedSelRef.current;
        const cur = drafts[childId] || '';
        const tagText = `【${tag}】`;
        const newVal = cur.slice(0, start) + tagText + cur.slice(end);
        const newPos = start + tagText.length;
        setDrafts(prev => ({ ...prev, [childId]: newVal }));
        requestAnimationFrame(() => {
            if (!el) return;
            el.focus();
            el.setSelectionRange(newPos, newPos);
            autoResize();
        });
    };

    const handleSend = () => {
        const text = (drafts[childId] || '').trim();
        if (!text) return;
        onSend(childId, text);
        setDrafts(prev => ({ ...prev, [childId]: '' }));
        requestAnimationFrame(() => {
            const el = textareaRef.current;
            if (el) { el.style.height = 'auto'; el.focus(); }
        });
    };

    return (
        <div className="space-y-2">
            <div className="flex gap-2 overflow-x-auto pb-1">
                {TAGS.map(tag => (
                    <button
                        key={tag}
                        type="button"
                        onMouseDown={saveSelection}
                        onClick={() => insertTag(tag)}
                        className="whitespace-nowrap px-4 py-1.5 bg-tree-50 text-tree-700 text-[10px] font-bold rounded-full border border-tree-100 hover:bg-tree-100 transition-colors">
                        {tag}
                    </button>
                ))}
            </div>
            <div className="flex gap-2 items-end">
                <textarea
                    ref={textareaRef}
                    value={drafts[childId] || ''}
                    onChange={e => {
                        setDrafts(prev => ({ ...prev, [childId]: e.target.value }));
                        autoResize();
                    }}
                    onSelect={saveSelection}
                    onKeyUp={saveSelection}
                    rows={2}
                    className="flex-1 bg-slate-50 border border-transparent focus:bg-white focus:border-tree-200 rounded-xl px-4 py-3 text-sm outline-none transition-all resize-none overflow-hidden"
                    style={{ minHeight: '72px' }}
                    placeholder="メモを入力（送信は▶ボタンのみ・Enterで改行）" />
                <button
                    type="button"
                    onClick={handleSend}
                    disabled={!(drafts[childId] || '').trim()}
                    className="bg-slate-900 text-white w-12 h-12 rounded-xl flex items-center justify-center shadow-lg active:scale-95 transition-all disabled:opacity-40 flex-shrink-0">
                    <Send className="w-5 h-5 rotate-[-15deg] translate-x-0.5" />
                </button>
            </div>
        </div>
    );
}

// ── MemoMessage (inline editable) ────────────────────────────────────────────
function MemoMessage({ msg, onToggle, onEdit }) {
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(msg.text);
    const textareaRef = useRef(null);

    const handleDoubleClick = () => {
        setEditText(msg.text);
        setIsEditing(true);
        setTimeout(() => textareaRef.current?.focus(), 50);
    };

    const handleSave = () => {
        if (editText.trim() && editText.trim() !== msg.text) {
            onEdit(editText.trim());
        }
        setIsEditing(false);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') { setIsEditing(false); }
    };

    return (
        <div className={`self-start p-3 rounded-2xl rounded-tl-none shadow-sm border relative ${msg.included !== false ? 'bg-white' : 'bg-slate-50 opacity-60 grayscale'}`}>
            <button onClick={onToggle}
                className={`absolute -top-2 -right-2 px-2 py-0.5 rounded-full text-[8px] font-bold ${msg.included !== false ? 'bg-emerald-500 text-white' : 'bg-slate-300 text-slate-600'}`}>
                {msg.included !== false ? 'AI利用' : '除外'}
            </button>
            {isEditing ? (
                <div className="space-y-1">
                    <textarea
                        ref={textareaRef}
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="w-full text-sm border border-tree-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-tree-300 resize-none"
                        rows={3}
                    />
                    <div className="flex gap-1">
                        <button onClick={handleSave} className="px-2 py-1 bg-emerald-600 text-white rounded text-xs font-bold flex items-center gap-1">
                            <Check className="w-3 h-3" />保存
                        </button>
                        <button onClick={() => setIsEditing(false)} className="px-2 py-1 bg-slate-200 text-slate-600 rounded text-xs font-bold flex items-center gap-1">
                            <X className="w-3 h-3" />キャンセル
                        </button>
                    </div>
                </div>
            ) : (
                <p
                    className="text-sm whitespace-pre-wrap cursor-pointer"
                    onDoubleClick={handleDoubleClick}
                    title="ダブルタップで編集"
                >
                    {msg.text}
                </p>
            )}
            {!isEditing && (
                <button onClick={handleDoubleClick} className="mt-1 text-[9px] text-slate-400 hover:text-tree-600 flex items-center gap-1">
                    <Edit2 className="w-2.5 h-2.5" />編集
                </button>
            )}
        </div>
    );
}

// ── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
    const [user] = useState({ uid: 'care-record-pro' });
    const [children, setChildren] = useState([]);
    const [results, setResults] = useState({});
    const [summaryC, setSummaryC] = useState('');
    const [dailyMessages, setDailyMessages] = useState({});
    const [selectedChildId, setSelectedChildId] = useState(null);
    const [dailyTable, setDailyTable] = useState({});
    const [globalLog, setGlobalLog] = useState({ admin: '', supervisor: '', notice: '', activities: '' });
    const [selectedDocChildId, setSelectedDocChildId] = useState(null);
    const [selectedGenerateIds, setSelectedGenerateIds] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [progress, setProgress] = useState(0);
    const [smoothProgress, setSmoothProgress] = useState(0);
    const [drafts, setDrafts] = useState({});
    const [dailyUsed, setDailyUsed] = useState(0);
    const [dailyResetAt, setDailyResetAt] = useState(null);
    const [existingReportDates, setExistingReportDates] = useState([]);
    const [showExportModal, setShowExportModal] = useState(false);
    const [showCalendarModal, setShowCalendarModal] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState('online');
    const [lastError, setLastError] = useState(null);
    const [isDemoMode, setIsDemoMode] = useState(false);
    const [docEditId, setDocEditId] = useState(null);
    const [docDraft, setDocDraft] = useState({});
    const [selectedChildMessages, setSelectedChildMessages] = useState([]);
    const backupState = useRef(null);

    const cs = (p) => callStorage(p, setConnectionStatus, setLastError);

    const saveDailyData = async (date, ch, msgs, res, sum, table, global) => {
        setIsSyncing(true);
        const packet = {
            children: ch,
            messages: msgs,
            results: res,
            summaryC: sum,
            dailyTable: table || dailyTable,
            globalLog: global || globalLog,
            updatedAt: new Date().toISOString()
        };
        await cs({ action: 'saveReport', date, data: packet });
        await cs({ action: 'setChildren', data: ch });
        setIsSyncing(false);
    };

    const fetchDailyData = useCallback(async (dateString) => {
        if (isDemoMode) return;
        setIsSyncing(true);
        const data = await cs({ action: 'getReport', date: dateString });
        if (data && typeof data === 'object') {
            setResults(data.results || {});
            setSummaryC(data.summaryC || '');
            setDailyMessages(data.messages || {});
            setChildren(Array.isArray(data.children) ? data.children : []);
            setDailyTable(data.dailyTable || {});
            setGlobalLog(data.globalLog || { admin: '', supervisor: '', notice: '', activities: '' });
        } else {
            setResults({}); setSummaryC(''); setDailyMessages({}); setChildren([]);
            setDailyTable({}); setGlobalLog({ admin: '', supervisor: '', notice: '', activities: '' });
        }
        setIsSyncing(false);
    }, [isDemoMode]);

    const fetchReportIndex = useCallback(async () => {
        const data = await cs({ action: 'getReportIndex' });
        if (data) setExistingReportDates(data);
    }, []);

    const persistQuota = (used, resetAt) => {
        setDailyUsed(used); setDailyResetAt(resetAt);
        localStorage.setItem('care_pro_quota', JSON.stringify({ used, resetAt }));
    };

    const ensureQuotaReset = () => {
        const now = new Date();
        const next9 = () => { const d = new Date(); d.setHours(9, 0, 0, 0); if (d <= now) d.setDate(d.getDate() + 1); return d; };
        const reset = dailyResetAt ? new Date(dailyResetAt) : null;
        if (!reset || now >= reset) persistQuota(0, next9().toISOString());
    };

    useEffect(() => {
        const raw = localStorage.getItem('care_pro_quota');
        if (raw) { try { const p = JSON.parse(raw); setDailyUsed(p.used || 0); setDailyResetAt(p.resetAt || null); } catch { } }
        ensureQuotaReset();
    }, []);

    useEffect(() => {
        if (isDemoMode) return;
        fetchReportIndex();
        fetchDailyData(selectedDate);
    }, [selectedDate, isDemoMode]);

    useEffect(() => {
        if (!isDemoMode) {
            const timer = setInterval(() => { fetchReportIndex(); fetchDailyData(selectedDate); }, 5000);
            return () => clearInterval(timer);
        }
    }, [selectedDate, isDemoMode]);

    useEffect(() => {
        setSelectedChildMessages(selectedChildId ? (dailyMessages[selectedChildId] || []) : []);
    }, [selectedChildId, dailyMessages]);

    useEffect(() => {
        let t;
        if (loading) {
            t = setInterval(() => setSmoothProgress(p => { const n = p + 0.5; return n >= 95 ? 95 : parseFloat(n.toFixed(1)); }), 200);
        } else { setSmoothProgress(0); }
        return () => t && clearInterval(t);
    }, [loading]);

    useEffect(() => {
        if (!selectedDocChildId) return;
        if (docEditId === selectedDocChildId) return;
        const result = results[selectedDocChildId] || {};
        const force = parseForceSheet(result.K_sheet || '');
        setDocDraft({ D: result.D || '', B_result: result.B_result || '', B_plan: result.B_plan || '', B_item: result.B_item || '', force });
    }, [selectedDocChildId, results, docEditId]);

    const addChild = async () => {
        const newId = crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 11);
        const newChild = { id: newId, name: '新規児童', timestamp: Date.now(), forceSheet: false };
        const newList = [...children, newChild];
        setChildren(newList);
        setSelectedGenerateIds(prev => Array.from(new Set([...prev, newId])));
        await saveDailyData(selectedDate, newList, dailyMessages, results, summaryC, dailyTable, globalLog);
    };

    const sendMessage = async (childId, text) => {
        if (!text.trim() || !childId) return;
        const newMsg = { id: Date.now().toString(), text, timestamp: Date.now(), userId: user.uid, included: true };
        const newMsgList = [...(dailyMessages[childId] || []), newMsg];
        const newDM = { ...dailyMessages, [childId]: newMsgList };
        setDailyMessages(newDM);

        let newTable = { ...dailyTable };
        const tagMap = { '宿題': 'homework', 'プリント': 'print', 'ツリー式学習': 'tree' };
        Object.entries(tagMap).forEach(([tag, key]) => {
            if (text.includes(`【${tag}】`)) {
                const content = text.replace(`【${tag}】`, '').trim();
                newTable[childId] = { ...(newTable[childId] || {}), [key]: content };
            }
        });
        if (JSON.stringify(newTable) !== JSON.stringify(dailyTable)) {
            setDailyTable(newTable);
        }

        if (selectedChildId === childId) setSelectedChildMessages(newMsgList);
        await saveDailyData(selectedDate, children, newDM, results, summaryC, newTable, globalLog);
    };

    const toggleMessage = async (childId, messageId) => {
        const newMsgList = (dailyMessages[childId] || []).map(m => m.id === messageId ? { ...m, included: !m.included } : m);
        const newDM = { ...dailyMessages, [childId]: newMsgList };
        setDailyMessages(newDM);
        if (selectedChildId === childId) setSelectedChildMessages(newMsgList);
        await saveDailyData(selectedDate, children, newDM, results, summaryC, dailyTable, globalLog);
    };

    const updateMessageText = async (childId, messageId, newText) => {
        const newMsgList = (dailyMessages[childId] || []).map(m => m.id === messageId ? { ...m, text: newText } : m);
        const newDM = { ...dailyMessages, [childId]: newMsgList };
        setDailyMessages(newDM);
        if (selectedChildId === childId) setSelectedChildMessages(newMsgList);
        await saveDailyData(selectedDate, children, newDM, results, summaryC, dailyTable, globalLog);
    };

    const updateChild = async (id, data) => {
        const newList = children.map(c => c.id === id ? { ...c, ...data } : c);
        setChildren(newList);
        await saveDailyData(selectedDate, newList, dailyMessages, results, summaryC, dailyTable, globalLog);
    };

    const removeChild = async (id) => {
        if (!window.confirm('本当にこの児童を削除してもよろしいですか？')) return;
        const newList = children.filter(c => c.id !== id);
        const newResults = { ...results }; delete newResults[id];
        const newDM = { ...dailyMessages }; delete newDM[id];
        const newTable = { ...dailyTable }; delete newTable[id];
        setChildren(newList); setResults(newResults); setDailyMessages(newDM); setDailyTable(newTable);
        await saveDailyData(selectedDate, newList, newDM, newResults, summaryC, newTable, globalLog);
        setSelectedGenerateIds(prev => prev.filter(cid => cid !== id));
        if (selectedChildId === id) setSelectedChildId(null);
        if (selectedDocChildId === id) setSelectedDocChildId(null);
    };

    const toggleChildGenerate = (id) => setSelectedGenerateIds(prev => prev.includes(id) ? prev.filter(cid => cid !== id) : [...prev, id]);

    const saveResults = async (newResults, newSummary) => {
        await saveDailyData(selectedDate, children, dailyMessages, newResults, newSummary, dailyTable, globalLog);
        setResults(newResults); setSummaryC(newSummary);
        fetchReportIndex();
    };

    const handleRebuildIndex = async () => {
        if (!confirm('カレンダー情報を再構築しますか？')) return;
        try {
            const newIndex = await cs({ action: 'rebuildIndex' });
            setExistingReportDates(newIndex || []);
            alert('再構築しました。');
        } catch (e) { alert('失敗: ' + e.message); }
    };

    const generateDocuments = async () => {
        if (isDemoMode) return;
        ensureQuotaReset();
        const toGenerate = children.filter(c => selectedGenerateIds.includes(c.id));
        const remaining = DAILY_LIMIT - dailyUsed;
        if (remaining <= 0) { alert('本日の残り生成回数がありません'); return; }
        if (toGenerate.length > remaining) { alert(`残り${remaining}回です。`); return; }
        setLoading(true);
        try {
            const processedResults = { ...results };
            const totalOps = toGenerate.length + 1;
            let completedOps = 0;
            setProgress(0); setSmoothProgress(0);

            const savedPromptsRaw = localStorage.getItem('care_pro_prompts');
            const customPrompts = savedPromptsRaw ? { ...defaultPrompts, ...JSON.parse(savedPromptsRaw) } : defaultPrompts;

            for (const child of toGenerate) {
                const msgs = (dailyMessages[child.id] || []).filter(m => m.included !== false).map(m => m.text).join('\n');
                const needsForce = !!child.forceSheet;
                const forceInstr = needsForce ? `\n【3. 強行シート】 (Key: K_sheet)\n${customPrompts.promptK}` : '';
                const jsonTemplate = needsForce ? '{"B_result": "...", "B_plan": "...", "B_item": "...", "D": "...", "K_sheet": "..."}' : '{"B_result": "...", "B_plan": "...", "B_item": "...", "D": "..."}';
                const customD = customPrompts.promptD.replace('{{STAFF_NAME}}', child.staff || '〇〇').replace('{{STAFF_INSTRUCTION}}', getStaffInstruction(child.staff) || '');

                const prompt = `児童メモを元に書類をJSONで作成してください。
メモ: ${msgs}
【ルール】
- 呼称は一切使用しない
【1. 実施計画】(Keys: B_result, B_plan, B_item)
${customPrompts.promptB}
【2. ツリー通信】(Key: D)
${customD}${forceInstr}
JSON: ${jsonTemplate}`;

                const response = await fetchAI(prompt, true);
                if (response) { processedResults[child.id] = response; }
                completedOps++;
                const actual = Math.round((completedOps / totalOps) * 100);
                setProgress(actual); setSmoothProgress(p => Math.max(p, actual));
            }

            let newSummary = summaryC;
            if (toGenerate.length > 0) {
                const summaryText = toGenerate.map(c => {
                    const res = processedResults[c.id] || {};
                    return `結果: ${res.B_result || ''}\n通信: ${res.D || ''}`;
                }).join('\n\n');
                const summaryPrompt = `${customPrompts.promptSummary}\n\n${summaryText}`;
                newSummary = await fetchAI(summaryPrompt, false);
                completedOps++;
                setProgress(100); setSmoothProgress(100);
            }

            await saveResults(processedResults, newSummary);
            persistQuota(dailyUsed + toGenerate.length + 1, dailyResetAt);
        } catch (error) { if (error.message !== 'QUOTA_EXCEEDED_STOP') alert('エラー: ' + error.message); }
        finally { setProgress(100); setSmoothProgress(100); setTimeout(() => setLoading(false), 200); }
    };

    const enterDemoMode = () => {
        backupState.current = { children: [...children], results: { ...results }, summaryC, dailyMessages: { ...dailyMessages }, selectedDate, selectedGenerateIds: [...selectedGenerateIds] };
        setIsDemoMode(true);
        // ... (demo data omitted for brevity)
    };

    const exitDemoMode = () => {
        if (backupState.current) {
            setChildren(backupState.current.children);
            setResults(backupState.current.results);
            setSummaryC(backupState.current.summaryC);
            setDailyMessages(backupState.current.dailyMessages);
            setSelectedDate(backupState.current.selectedDate);
            setSelectedGenerateIds(backupState.current.selectedGenerateIds);
            backupState.current = null;
        }
        setIsDemoMode(false);
    };

    return (
        <div className="min-h-screen bg-[#F1F5F9] text-[#1E293B] p-2 md:p-6 pb-24 lg:pb-6 font-sans overflow-x-hidden">
            <div className="max-w-[1600px] mx-auto">
                <header className="flex flex-col gap-2 mb-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <img src="/logo.png" alt="Logo" className="h-10 md:h-12 object-contain" onError={e => { e.target.style.display = 'none'; }} />
                            <h1 className="text-xl md:text-2xl font-black text-slate-800">業務管理日誌</h1>
                        </div>
                        <div onClick={() => setShowCalendarModal(true)} className="bg-white border-2 border-tree-200 rounded-lg px-4 py-2 text-md font-black text-tree-900 cursor-pointer flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-tree-500" />
                            <span>{new Date(selectedDate).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                        </div>
                    </div>
                </header>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 border-b">
                        <div className="border-r p-2 bg-slate-50 flex flex-col">
                            <span className="text-[10px] font-black text-slate-400">管理者</span>
                            <input value={globalLog.admin || ''} onChange={e => setGlobalLog(p => ({ ...p, admin: e.target.value }))} className="w-full text-xs font-bold outline-none" />
                        </div>
                        <div className="p-2 bg-slate-50 flex flex-col">
                            <span className="text-[10px] font-black text-slate-400">児発管</span>
                            <input value={globalLog.supervisor || ''} onChange={e => setGlobalLog(p => ({ ...p, supervisor: e.target.value }))} className="w-full text-xs font-bold outline-none" />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2">
                        <div className="border-r p-3 flex flex-col gap-1 min-h-[80px]">
                            <span className="text-[10px] font-black text-tree-600">特記事項</span>
                            <textarea value={globalLog.notice || ''} onChange={e => setGlobalLog(p => ({ ...p, notice: e.target.value }))} className="flex-1 w-full text-xs outline-none bg-transparent resize-none" />
                        </div>
                        <div className="p-3 flex flex-col gap-1 min-h-[80px]">
                            <span className="text-[10px] font-black text-tree-600">業務・活動内容</span>
                            <textarea value={globalLog.activities || ''} onChange={e => setGlobalLog(p => ({ ...p, activities: e.target.value }))} className="flex-1 w-full text-xs outline-none bg-transparent resize-none" />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden flex flex-col">
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full border-collapse text-left min-w-[1200px]">
                            <thead>
                                <tr className="bg-slate-100 border-b border-slate-300">
                                    <th className="sticky left-0 z-20 bg-slate-100 border-r w-32 p-2 text-[10px] font-black text-slate-500 uppercase">氏名</th>
                                    <th className="border-r w-24 p-2 text-[10px] font-black text-slate-500 text-center">開始</th>
                                    <th className="border-r w-24 p-2 text-[10px] font-black text-slate-500 text-center">終了</th>
                                    <th className="border-r w-48 p-2 text-[10px] font-black text-slate-500">宿題</th>
                                    <th className="border-r w-48 p-2 text-[10px] font-black text-slate-500">プリント</th>
                                    <th className="border-r w-48 p-2 text-[10px] font-black text-slate-500">ツリー式</th>
                                    <th className="border-r w-24 p-2 text-[10px] font-black text-slate-500 text-center">LINE</th>
                                    <th className="p-2 text-[10px] font-black text-slate-500">備考</th>
                                </tr>
                            </thead>
                            <tbody>
                                {children.sort((a,b)=>a.timestamp-b.timestamp).map((child, idx) => {
                                    const row = dailyTable[child.id] || {};
                                    return (
                                        <tr key={child.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors group">
                                            <td className="sticky left-0 bg-white group-hover:bg-slate-50 border-r p-2">
                                                <button onClick={() => setSelectedChildId(child.id)} className="w-full text-left font-black text-sm text-tree-700 hover:underline truncate">{child.name}</button>
                                            </td>
                                            <td className="border-r p-0 text-center">
                                                <input type="time" value={row.startTime || '09:30'} onChange={e => setDailyTable(p => ({ ...p, [child.id]: { ...(p[child.id]||{}), startTime: e.target.value } }))} className="w-full h-full p-2 text-xs border-none bg-transparent text-center outline-none" />
                                            </td>
                                            <td className="border-r p-0 text-center">
                                                <input type="time" value={row.endTime || '18:30'} onChange={e => setDailyTable(p => ({ ...p, [child.id]: { ...(p[child.id]||{}), endTime: e.target.value } }))} className="w-full h-full p-2 text-xs border-none bg-transparent text-center outline-none" />
                                            </td>
                                            <td className="border-r p-0">
                                                <input value={row.homework || ''} onChange={e => setDailyTable(p => ({ ...p, [child.id]: { ...(p[child.id]||{}), homework: e.target.value } }))} className="w-full h-full p-2 text-[10px] border-none bg-transparent outline-none" />
                                            </td>
                                            <td className="border-r p-0">
                                                <input value={row.print || ''} onChange={e => setDailyTable(p => ({ ...p, [child.id]: { ...(p[child.id]||{}), print: e.target.value } }))} className="w-full h-full p-2 text-[10px] border-none bg-transparent outline-none" />
                                            </td>
                                            <td className="border-r p-0">
                                                <input value={row.tree || ''} onChange={e => setDailyTable(p => ({ ...p, [child.id]: { ...(p[child.id]||{}), tree: e.target.value } }))} className="w-full h-full p-2 text-[10px] border-none bg-transparent outline-none" />
                                            </td>
                                            <td className="border-r p-0 text-center">
                                                <input type="checkbox" checked={!!row.line} onChange={e => setDailyTable(p => ({ ...p, [child.id]: { ...(p[child.id]||{}), line: e.target.checked } }))} className="w-4 h-4 accent-tree-500" />
                                            </td>
                                            <td className="p-0">
                                                <input value={row.notes || ''} onChange={e => setDailyTable(p => ({ ...p, [child.id]: { ...(p[child.id]||{}), notes: e.target.value } }))} className="w-full h-full p-2 text-[10px] border-none bg-transparent outline-none" />
                                            </td>
                                        </tr>
                                    );
                                })}
                                <tr>
                                    <td colSpan="9" className="p-2 bg-slate-50">
                                        <button onClick={addChild} className="w-full py-2 border-2 border-dashed border-slate-300 rounded-lg text-slate-400 font-bold text-xs flex items-center justify-center gap-2">
                                            <PlusCircle className="w-4 h-4" /> 児童を追加
                                        </button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="mt-6 flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-xl shadow-lg border border-slate-200">
                    <div className="flex gap-2 w-full md:w-auto">
                        <button onClick={() => printAllDocuments(children, results, summaryC, selectedDate)} className="px-6 py-3 bg-wood-500 text-white rounded-xl font-bold flex items-center justify-center gap-2">
                            <Printer className="w-5 h-5" /> 一括印刷
                        </button>
                        <button onClick={() => setShowExportModal(true)} className="px-6 py-3 bg-apple-500 text-white rounded-xl font-bold flex items-center justify-center gap-2">
                            <FileSpreadsheet className="w-5 h-5" /> 一括出力
                        </button>
                    </div>
                    <button onClick={generateDocuments} disabled={loading || children.length === 0} className={`w-full md:w-auto px-10 py-4 rounded-xl font-black flex items-center justify-center gap-3 transition-all ${loading ? 'bg-slate-300 text-slate-500' : 'bg-tree-500 hover:bg-tree-600 text-white'}`}>
                        {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Send className="w-6 h-6" />}
                        AI書類一括生成 ({children.length}名)
                    </button>
                </div>
            </div>

            <div className={`fixed inset-0 z-[100] transition-all duration-300 ${(selectedChildId || selectedDocChildId) ? 'bg-slate-900/40 backdrop-blur-sm pointer-events-auto' : 'bg-transparent pointer-events-none opacity-0'}`} onClick={() => { setSelectedChildId(null); setSelectedDocChildId(null); }}>
                <div className={`absolute right-0 bottom-0 top-0 w-full max-w-xl bg-white shadow-2xl transition-transform duration-300 ease-out flex flex-col ${(selectedChildId || selectedDocChildId) ? 'translate-x-0' : 'translate-x-full'}`} onClick={e => e.stopPropagation()}>
                    {selectedChildId && (
                        (() => {
                            const child = children.find(c => c.id === selectedChildId);
                            if (!child) return null;
                            return (
                                <div className="flex flex-col h-full bg-white relative">
                                    <div className="p-4 border-b flex items-center justify-between bg-slate-50">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 bg-tree-600 rounded-full flex items-center justify-center text-white font-black text-xs">{child.name[0]}</div>
                                            <input type="text" value={child.name} onChange={e => updateChild(child.id, { name: e.target.value })} className="font-black text-lg outline-none bg-transparent" />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => { setSelectedDocChildId(child.id); setSelectedChildId(null); }} className="p-2 text-emerald-600 rounded-lg"><FileText className="w-5 h-5" /></button>
                                            <button onClick={() => removeChild(child.id)} className="p-2 text-slate-300 hover:text-red-500 rounded-lg"><Trash2 className="w-5 h-5" /></button>
                                            <button onClick={() => setSelectedChildId(null)} className="p-2 bg-slate-200 rounded-lg"><X className="w-5 h-5" /></button>
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                                        {selectedChildMessages.map(msg => <MemoMessage key={msg.id} msg={msg} onToggle={() => toggleMessage(child.id, msg.id)} onEdit={(newText) => updateMessageText(child.id, msg.id, newText)} />)}
                                    </div>
                                    <div className="p-4 border-t bg-white">
                                        <MemoInput childId={child.id} drafts={drafts} setDrafts={setDrafts} onSend={sendMessage} />
                                    </div>
                                </div>
                            );
                        })()
                    )}

                    {selectedDocChildId && (
                        (() => {
                            const child = children.find(c => c.id === selectedDocChildId);
                            const result = results[selectedDocChildId] || {};
                            if (!child) return null;
                            return (
                                <div className="flex flex-col h-full bg-slate-50">
                                    <div className="p-4 border-b bg-white flex items-center justify-between">
                                        <div>
                                            <h2 className="text-lg font-black text-tree-900">{child.name}</h2>
                                            <p className="text-[10px] text-slate-500 font-bold">書類確認</p>
                                        </div>
                                        <button onClick={() => setSelectedDocChildId(null)} className="p-2 bg-slate-200 rounded-lg"><X className="w-5 h-5" /></button>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                        <div className="bg-emerald-100 p-4 rounded-xl border border-emerald-200">
                                            <h3 className="text-xs font-black text-emerald-700 mb-2 uppercase">ツリー通信</h3>
                                            <p className="text-sm bg-white p-3 rounded-lg border whitespace-pre-wrap">{result.D || '未生成'}</p>
                                        </div>
                                        <div className="bg-tree-50 p-4 rounded-xl border border-tree-100">
                                            <h3 className="text-xs font-black text-tree-700 mb-2 uppercase">専門的支援</h3>
                                            <p className="text-sm bg-white p-2 rounded border mb-2">{result.B_result}</p>
                                            <p className="text-sm bg-white p-2 rounded border">{result.B_plan}</p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()
                    )}
                </div>
            </div>

            <CalendarModal show={showCalendarModal} onClose={() => setShowCalendarModal(false)} selectedDate={selectedDate} setSelectedDate={setSelectedDate} existingReportDates={existingReportDates} onRebuild={handleRebuildIndex} />
            <SettingsModal show={showSettingsModal} onClose={() => setShowSettingsModal(false)} />
            <ExportModal show={showExportModal} onClose={() => setShowExportModal(false)} children={children} results={results} selectedDate={selectedDate} summaryC={summaryC} />

            {loading && (
                <div className="fixed inset-0 z-[200] bg-slate-900/30 backdrop-blur-[2px] flex flex-col items-center justify-center">
                    <div className="bg-white rounded-2xl shadow-2xl p-8 flex flex-col items-center max-w-sm w-full">
                        <Loader2 className="w-12 h-12 text-tree-600 animate-spin mb-4" />
                        <h3 className="text-lg font-black text-slate-800 mb-2">書類を作成中...</h3>
                        <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden mt-4 relative">
                            <div className="h-full bg-gradient-to-r from-tree-500 to-tree-300 transition-all duration-300" style={{ width: `${smoothProgress}%` }} />
                        </div>
                        <div className="text-center w-full mt-2">
                             <span className="text-xs font-black text-tree-600 font-mono">{smoothProgress}%</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

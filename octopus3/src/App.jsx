import { useState, useEffect, useCallback, useRef } from 'react';
import {
    Users, FileText, MessageSquare, Send, Loader2, Copy, Check,
    PlusCircle, Trash2, ClipboardCheck, RefreshCw, BookOpen, Cloud, Clipboard,
    Printer, FileSpreadsheet, Sparkles, Calendar, X, ChevronLeft, ChevronRight,
    Settings, LogOut, Edit2
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
        const MODEL = 'gemini-2.5-flash';
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

    // テキストエリアの高さを内容に合わせて自動調整
    const autoResize = () => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = el.scrollHeight + 'px';
    };

    // カーソル位置を保存（フォーカスが外れる前に呼ぶ）
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
        // フォーカスをtextareaに戻してカーソル位置を復元（スマホはキーボードが再表示される）
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
                        className="whitespace-nowrap px-4 py-1.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded-full border border-indigo-100 hover:bg-indigo-100 transition-colors">
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
                    className="flex-1 bg-slate-50 border border-transparent focus:bg-white focus:border-indigo-200 rounded-xl px-4 py-3 text-sm outline-none transition-all resize-none overflow-hidden"
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
                        className="w-full text-sm border border-indigo-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
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
                <button onClick={handleDoubleClick} className="mt-1 text-[9px] text-slate-400 hover:text-indigo-500 flex items-center gap-1">
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
    const [selectedDocChildId, setSelectedDocChildId] = useState(null);
    const [selectedGenerateIds, setSelectedGenerateIds] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [progress, setProgress] = useState(0);
    const [smoothProgress, setSmoothProgress] = useState(0);
    const [drafts, setDrafts] = useState({});
    const [childGeneratingId, setChildGeneratingId] = useState(null);
    const [dailyUsed, setDailyUsed] = useState(0);
    const [dailyResetAt, setDailyResetAt] = useState(null);
    const [existingReportDates, setExistingReportDates] = useState([]);
    const [showExportModal, setShowExportModal] = useState(false);
    const [showCalendarModal, setShowCalendarModal] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState('online');
    const [lastError, setLastError] = useState(null);
    const [isDemoMode, setIsDemoMode] = useState(false);
    const [showSummary, setShowSummary] = useState(false);
    const [docEditId, setDocEditId] = useState(null);
    const [docDraft, setDocDraft] = useState({});
    const [touchStartPos, setTouchStartPos] = useState(null);
    const [selectedChildMessages, setSelectedChildMessages] = useState([]);
    const backupState = useRef(null);

    const cs = (p) => callStorage(p, setConnectionStatus, setLastError);

    const saveDailyData = async (date, ch, msgs, res, sum) => {
        setIsSyncing(true);
        const packet = { children: ch, messages: msgs, results: res, summaryC: sum, updatedAt: new Date().toISOString() };
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
        } else {
            setResults({}); setSummaryC(''); setDailyMessages({}); setChildren([]);
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
        // 編集モード中はドラフトを上書きしない
        if (docEditId === selectedDocChildId) return;

        const result = results[selectedDocChildId] || {};
        const force = parseForceSheet(result.K_sheet || '');
        setDocDraft({ D: result.D || '', B_result: result.B_result || '', B_plan: result.B_plan || '', B_item: result.B_item || '', force });
    }, [selectedDocChildId, results, docEditId]);

    // ── Actions ──────────────────────────────────────────────────────────────
    const addChild = async () => {
        const newId = crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 11);
        const newChild = { id: newId, name: '新規児童', timestamp: Date.now(), forceSheet: false };
        const newList = [...children, newChild];
        setChildren(newList);
        setSelectedGenerateIds(prev => Array.from(new Set([...prev, newId])));
        await saveDailyData(selectedDate, newList, dailyMessages, results, summaryC);
    };

    const sendMessage = async (childId, text) => {
        if (!text.trim() || !childId) return;
        const newMsg = { id: Date.now().toString(), text, timestamp: Date.now(), userId: user.uid, included: true };
        const newMsgList = [...(dailyMessages[childId] || []), newMsg];
        const newDM = { ...dailyMessages, [childId]: newMsgList };
        setDailyMessages(newDM);
        if (selectedChildId === childId) setSelectedChildMessages(newMsgList);
        await saveDailyData(selectedDate, children, newDM, results, summaryC);
    };

    const toggleMessage = async (childId, messageId) => {
        const newMsgList = (dailyMessages[childId] || []).map(m => m.id === messageId ? { ...m, included: !m.included } : m);
        const newDM = { ...dailyMessages, [childId]: newMsgList };
        setDailyMessages(newDM);
        if (selectedChildId === childId) setSelectedChildMessages(newMsgList);
        await saveDailyData(selectedDate, children, newDM, results, summaryC);
    };

    const updateMessageText = async (childId, messageId, newText) => {
        const newMsgList = (dailyMessages[childId] || []).map(m => m.id === messageId ? { ...m, text: newText } : m);
        const newDM = { ...dailyMessages, [childId]: newMsgList };
        setDailyMessages(newDM);
        if (selectedChildId === childId) setSelectedChildMessages(newMsgList);
        await saveDailyData(selectedDate, children, newDM, results, summaryC);
    };

    const updateChild = async (id, data) => {
        const newList = children.map(c => c.id === id ? { ...c, ...data } : c);
        setChildren(newList);
        await saveDailyData(selectedDate, newList, dailyMessages, results, summaryC);
    };

    const removeChild = async (id) => {
        if (!window.confirm('本当にこの児童を削除してもよろしいですか？\nこの操作は取り消せません。')) return;
        const newList = children.filter(c => c.id !== id);
        const newResults = { ...results }; delete newResults[id];
        const newDM = { ...dailyMessages }; delete newDM[id];
        setChildren(newList); setResults(newResults); setDailyMessages(newDM);
        await saveDailyData(selectedDate, newList, newDM, newResults, summaryC);
        setSelectedGenerateIds(prev => prev.filter(cid => cid !== id));
        if (selectedChildId === id) setSelectedChildId(null);
        if (selectedDocChildId === id) setSelectedDocChildId(null);
    };

    const toggleChildGenerate = (id) => setSelectedGenerateIds(prev => prev.includes(id) ? prev.filter(cid => cid !== id) : [...prev, id]);
    const toggleForceSheet = async (id) => { const child = children.find(c => c.id === id); if (child) await updateChild(id, { forceSheet: !child.forceSheet }); };

    const saveResults = async (newResults, newSummary) => {
        await saveDailyData(selectedDate, children, dailyMessages, newResults, newSummary);
        setResults(newResults); setSummaryC(newSummary);
        fetchReportIndex();
    };

    const handleRebuildIndex = async () => {
        if (!confirm('カレンダーの表示が正しくない場合、データを再スキャンして修復します。\n実行しますか？')) return;
        try {
            const newIndex = await callStorage({ action: 'rebuildIndex' }, setConnectionStatus, setLastError);
            setExistingReportDates(newIndex || []);
            alert('カレンダー情報を再構築しました。');
        } catch (e) {
            console.error(e);
            alert('再構築に失敗しました: ' + e.message);
        }
    };

    const generateDocuments = async () => {
        if (isDemoMode) return;
        ensureQuotaReset();
        const toGenerate = children.filter(c => selectedGenerateIds.includes(c.id));
        const remaining = DAILY_LIMIT - dailyUsed;
        if (remaining <= 0) { alert('本日の残り生成回数がありません（リセットは9:00）'); return; }
        if (toGenerate.length > remaining) { alert(`本日の残り生成回数は${remaining}回です。対象を減らしてください。`); return; }
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

                const jsonTemplate = needsForce
                    ? '{"B_result": "...", "B_plan": "...", "B_item": "...", "D": "...", "K_sheet": "..."}'
                    : '{"B_result": "...", "B_plan": "...", "B_item": "...", "D": "..."}';

                const customD = customPrompts.promptD
                    .replace('{{STAFF_NAME}}', child.staff || '〇〇')
                    .replace('{{STAFF_INSTRUCTION}}', getStaffInstruction(child.staff) || '');

                const prompt = `あなたは療育施設の事務担当です。以下の児童メモを元に、書類を作成しJSONで返してください。

メモ内容: ${msgs}

【共通ルール】
- セキュリティ保護のため、児童名・実名や「〇〇君」「〇〇さん」などの呼称は一切使用しないでください。
- 個人が特定できる記述はしないでください。
- 保護者宛の文章として、主語を省き、自然な言い回しで記述してください（例：「〇〇君は楽しみました」→「楽しんでいました」）。

【1. 専門的支援実施計画】 (Keys: B_result, B_plan, B_item)
${customPrompts.promptB}

【2. ツリー通信】 (Key: D)
${customD}${forceInstr}

JSON形式で出力:
${jsonTemplate}`;

                const response = await fetchAI(prompt, true);
                if (response) {
                    if (!child.forceSheet) delete response.K_sheet;
                    processedResults[child.id] = response;
                }
                completedOps++;
                const actual = Math.round((completedOps / totalOps) * 100);
                setProgress(actual); setSmoothProgress(p => Math.max(p, actual));
            }

            let newSummary = summaryC;
            if (toGenerate.length > 0) {
                const summaryText = toGenerate.map(c => {
                    const res = processedResults[c.id] || {};
                    return `結果: ${res.B_result || ''}\n通信: ${res.D || ''}${res.K_sheet ? `\n強行: ${res.K_sheet}` : ''}`;
                }).join('\n\n');

                const summaryPrompt = `${customPrompts.promptSummary}\n\n${summaryText}`;
                newSummary = await fetchAI(summaryPrompt, false);
                completedOps++;
                setProgress(100); setSmoothProgress(100);
            }

            await saveResults(processedResults, newSummary);
            persistQuota(dailyUsed + toGenerate.length + 1, dailyResetAt);
        } catch (error) {
            if (error.message !== 'QUOTA_EXCEEDED_STOP') alert('エラーが発生しました: ' + error.message);
        } finally {
            setProgress(100); setSmoothProgress(100);
            setTimeout(() => setLoading(false), 200);
        }
    };

    const enterDemoMode = () => {
        if (!window.confirm('【DEMOモードを開始します】\n\n・現在のデータは一時的に隠され、架空のデータが表示されます。\n・DEMOモード中の変更は保存されません。\n・「DEMO終了」ボタンで元のデータに戻ります。\n\n開始してよろしいですか？')) return;
        backupState.current = { children: [...children], results: { ...results }, summaryC, dailyMessages: { ...dailyMessages }, selectedDate, selectedGenerateIds: [...selectedGenerateIds] };
        const demoKids = [
            { id: 'demo-child-1', name: '田中 蓮', timestamp: Date.now(), forceSheet: true },
            { id: 'demo-child-2', name: '佐藤 陽葵', timestamp: Date.now(), forceSheet: false },
        ];
        setIsDemoMode(true);
        setChildren(demoKids);
        setSelectedGenerateIds(demoKids.map(c => c.id));
        setSelectedChildId(null);
        const mockResults = {
            'demo-child-1': {
                B_result: '学習では、音読や漢字、計算などに取り組み、自信をもって進める姿が見られた。量の多さや難しさに戸惑う場面もあったが、確認しながら最後までやり切ろうとする姿勢があった。',
                B_plan: '学習面では自信を育む声掛けを継続し、失敗時の切り替え支援を行う。',
                B_item: '①健康・生活, ⑤人間関係・社会性',
                D: 'こんにちは、ブラックです！今日のツリー通信です！\n\n今日は宿題からスタート。音読はとても滑らかに読めるようになり、自信たっぷりの様子でした。',
                K_sheet: '【学習】音読や計算に自信を持って取り組んだ。\n【自由遊び】カード作りで失敗して悔しがる場面があった。\n【プログラム】切り絵で失敗してもやり直し、最後まで丁寧に作り上げた。\n【おやつ】該当なし'
            },
            'demo-child-2': {
                B_result: '学習では、国語や算数の課題に集中して取り組み、分からない箇所は質問しながら進めることができた。',
                B_plan: '学習への意欲を維持できるよう、できたことを具体的に褒めていく。',
                B_item: '①健康・生活, ⑤人間関係・社会性',
                D: 'こんにちは、ブラウンです！今日のツリー通信です！\n\n国語の漢字と算数の文章題に取り組みました。わからない問題はスタッフに聞きながら、最後まで頑張っていました！',
            }
        };
        const mockMessages = {
            'demo-child-1': [
                { id: 'dm1-1', text: '【学習】音読は滑らか。「俺できるよ！」と発言あり。', timestamp: Date.now(), included: true },
                { id: 'dm1-2', text: '【プログラム】クリスマス切り絵。失敗してもやり直して完成。', timestamp: Date.now() - 1000, included: true }
            ],
            'demo-child-2': [
                { id: 'dm2-1', text: '【学習】漢字と算数文章題。分からないところは質問して完遂。', timestamp: Date.now(), included: true }
            ]
        };
        setResults(mockResults);
        setDailyMessages(mockMessages);
        setSummaryC('学習では各自が課題に取り組み、意欲的な姿が見られた。プログラムでは説明を聞いて参加でき、自由時間は落ち着いて過ごす様子が多かった。（DEMOデータ）');
        setSelectedDate(new Date().toISOString().split('T')[0]);
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
        alert('DEMOモードを終了しました。元のデータに戻りました。');
    };

    const selectedChild = children.find(c => c.id === selectedChildId);

    return (
        <div className="min-h-screen bg-[#F1F5F9] text-[#1E293B] p-3 md:p-6 pb-24 lg:pb-6 font-sans">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <header className="flex flex-col gap-2 mb-4 md:mb-6">
                    <div className="flex flex-col items-center justify-center py-2">
                        <img src="/logo.png" alt="branch Logo" className="h-16 md:h-20 object-contain mb-1" onError={e => { e.target.style.display = 'none'; }} />
                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-none">branch</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 md:gap-4">
                            <div className="flex items-center gap-2" title={connectionStatus === 'online' ? 'クラウド同期中' : 'オフライン'}>
                                <Cloud className={`w-3 h-3 md:w-4 md:h-4 ${isSyncing ? 'text-green-500 animate-pulse' : connectionStatus === 'online' ? 'text-emerald-500' : 'text-slate-400'}`} />
                                <span className="text-[8px] md:text-[9px] text-slate-400 font-bold">
                                    v{APP_VERSION} {connectionStatus !== 'online' && '(オフライン)'}
                                    {lastError && <span className="text-red-500 ml-1">({lastError})</span>}
                                </span>
                            </div>
                            <p className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Sync: {user.uid.substring(0, 8)}...</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={startTour} className="px-3 py-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold" title="使い方の説明を見る">
                                <BookOpen className="w-5 h-5" />
                                <span className="hidden sm:inline">使い方ガイド</span>
                            </button>
                            <button onClick={() => setShowSettingsModal(true)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-full transition-colors" title="設定">
                                <Settings className="w-5 h-5 md:w-6 md:h-6" />
                            </button>
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full">
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <button
                                onClick={isDemoMode ? exitDemoMode : enterDemoMode}
                                className={`w-full sm:w-auto px-4 py-2.5 sm:py-2 rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 ${isDemoMode ? 'bg-slate-600 text-white hover:bg-slate-700' : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'}`}
                            >
                                {isDemoMode ? <><LogOut className="w-4 h-4" /> DEMO終了</> : <><Sparkles className="w-4 h-4" /> DEMOモード</>}
                            </button>
                        </div>
                        <div className="text-[10px] font-black text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded-lg shadow-inner flex items-center gap-2 self-start md:self-end">
                            <ClipboardCheck className="w-3 h-3" />
                            残り生成 {Math.max(0, DAILY_LIMIT - dailyUsed)} / {DAILY_LIMIT} （9:00リセット）
                        </div>
                    </div>
                </header>

                {isDemoMode && (
                    <div className="bg-amber-100 border-l-4 border-amber-500 text-amber-700 p-2 mb-4 text-xs font-bold flex items-center justify-center animate-pulse">
                        🚧 現在DEMOモード中です。データは保存されません。
                    </div>
                )
                }

                <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 h-auto lg:h-[calc(100vh-140px)] lg:min-h-[600px]">
                    {/* Sidebar */}
                    <div className="w-full lg:w-[450px] flex flex-col gap-4 flex-shrink-0">
                        {/* Date Selector */}
                        <div className="bg-white rounded-xl shadow-lg border-2 border-indigo-200 p-4">
                            <div className="flex flex-col items-center justify-center gap-3">
                                <div className="flex flex-col items-center w-full">
                                    <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wider mb-2">選択中の日付</span>
                                    <div
                                        id="tutorial-calendar"
                                        onClick={() => setShowCalendarModal(true)}
                                        className="w-full bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-indigo-300 rounded-lg px-4 py-3 text-lg font-black text-indigo-900 cursor-pointer hover:shadow-md text-center flex items-center justify-center gap-2 group transition-all active:scale-95"
                                    >
                                        <Calendar className="w-5 h-5 text-indigo-500 group-hover:scale-110 transition-transform" />
                                        <span>{new Date(selectedDate).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })}</span>
                                    </div>
                                </div>
                                <div className="flex gap-2 w-full">
                                    <button onClick={() => { const ids = children.filter(c => results[c.id]); if (!ids.length) return alert('生成済みの書類がありません'); printAllDocuments(children, results, summaryC, selectedDate); }}
                                        className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors">
                                        <Printer className="w-3 h-3" /> 一括印刷
                                    </button>
                                    <button onClick={() => { const ids = children.filter(c => results[c.id]).map(c => c.id); if (!ids.length) return alert('生成済みの書類がありません'); setShowExportModal(true); }}
                                        className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors">
                                        <FileSpreadsheet className="w-3 h-3" /> 一括出力
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Daily Summary */}
                        <div className="bg-white p-3 rounded-2xl shadow-sm border mb-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${summaryC ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                                    <span className="text-xs font-black uppercase tracking-widest text-slate-400">全体の様子</span>
                                </div>
                                <button onClick={() => setShowSummary(v => !v)} className="text-xs font-bold text-indigo-600 hover:text-indigo-700">
                                    {showSummary ? '閉じる' : '開く'}
                                </button>
                            </div>
                            {showSummary && (
                                <div className="mt-3 space-y-2">
                                    <div className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 border rounded-lg p-3 max-h-32 overflow-y-auto custom-scrollbar">
                                        {summaryC || 'まだ生成されていません。'}
                                    </div>
                                    {summaryC && <div className="flex items-center gap-2"><CopyButton text={summaryC} label="COPY" /></div>}
                                </div>
                            )}
                        </div>

                        {/* Child List */}
                        <div className="bg-white p-4 rounded-2xl shadow-sm border overflow-hidden flex-1 flex flex-col min-h-[400px] lg:min-h-[250px]">
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                    <Users className="w-4 h-4" /> 児童リスト
                                </span>
                                <button id="tutorial-add-btn" onClick={addChild} className="text-green-600 hover:scale-110 transition-transform">
                                    <PlusCircle className="w-6 h-6" />
                                </button>
                            </div>
                            <div className="space-y-2 overflow-y-auto flex-1 pr-1 custom-scrollbar">
                                {children.sort((a, b) => b.timestamp - a.timestamp).map(child => (
                                    <div key={child.id}
                                        className={`group p-3 rounded-xl border-2 transition-all flex items-center justify-between ${(selectedChildId === child.id || selectedDocChildId === child.id) ? 'border-green-500 bg-green-50 shadow-sm' : 'border-transparent bg-slate-50 hover:bg-slate-100'}`}>
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <button onClick={() => toggleChildGenerate(child.id)}
                                                className={`tutorial-check-btn w-4 h-4 shrink-0 rounded-[4px] border transition-colors flex items-center justify-center ${selectedGenerateIds.includes(child.id) ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'} ${results[child.id] ? 'ring-2 ring-emerald-400/60' : ''}`}
                                                title="書類生成の対象にする">
                                                {selectedGenerateIds.includes(child.id) && <Check className="w-3 h-3 text-white" />}
                                            </button>
                                            <span className="font-bold text-sm truncate">{child.name}</span>
                                            {results[child.id]?.K_sheet && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold">強行</span>}
                                            <div className="flex items-center gap-1 tutorial-action-buttons">
                                                <select value={child.staff || ''} onChange={e => updateChild(child.id, { staff: e.target.value })}
                                                    className="tutorial-staff-select text-[10px] py-1 px-1 rounded border border-slate-200 bg-white text-slate-600 focus:border-indigo-500 outline-none"
                                                    onClick={e => e.stopPropagation()}>
                                                    <option value="">担当なし</option>
                                                    {STAFF_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                                </select>
                                                <button onClick={() => { setSelectedChildId(child.id); setSelectedDocChildId(null); }}
                                                    className={`tutorial-memo-btn p-1.5 rounded-lg transition-colors ${selectedChildId === child.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                                                    title="メモ入力">
                                                    <MessageSquare className="w-4 h-4" />
                                                </button>
                                                {results[child.id] && (
                                                    <button onClick={() => { setSelectedDocChildId(child.id); setSelectedChildId(null); }}
                                                        className={`p-1.5 rounded-lg transition-colors ${selectedDocChildId === child.id ? 'bg-emerald-600 text-white' : 'text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50'}`}
                                                        title="書類を見る">
                                                        <FileText className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <label className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                                                <input type="checkbox" checked={!!child.forceSheet} onChange={() => toggleForceSheet(child.id)} className="h-3 w-3 accent-amber-500" />
                                                強行
                                            </label>
                                            <button onClick={() => removeChild(child.id)} className="opacity-60 sm:opacity-0 sm:group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {children.length === 0 && <p className="text-xs text-center text-slate-400 py-8 italic">児童を追加してください</p>}
                            </div>
                        </div>

                        {/* Generate Button */}
                        <div className="pt-2">
                            <button
                                id="tutorial-generate-btn"
                                onClick={generateDocuments}
                                disabled={loading || children.length === 0 || selectedGenerateIds.length === 0 || isDemoMode}
                                className={`w-full py-4 rounded-2xl shadow-xl font-black flex items-center justify-center gap-3 transition-all active:scale-95 group ${loading || children.length === 0 || selectedGenerateIds.length === 0 || isDemoMode ? 'bg-slate-300 cursor-not-allowed text-slate-500' : 'bg-green-600 hover:bg-green-700 text-white'}`}
                            >
                                {isDemoMode ? <span className="text-xs">DEMO中は押せません</span> : <><Send className="w-5 h-5 group-hover:translate-x-1 transition-transform" />書類を生成（{selectedGenerateIds.length}名）</>}
                            </button>
                        </div>
                    </div>

                    {/* Detail Area */}
                    <div className={`fixed lg:relative inset-0 lg:inset-auto lg:flex-1 h-full flex flex-col z-[100] lg:z-auto transition-all duration-300 ${(selectedChildId || selectedDocChildId) ? 'bg-slate-900/50 lg:bg-transparent pointer-events-auto' : 'bg-transparent pointer-events-none lg:pointer-events-auto'}`}>
                        <div className={`bg-white lg:rounded-2xl shadow-xl lg:shadow-sm border flex-1 flex flex-col overflow-hidden ml-auto w-full lg:w-auto transition-transform duration-300 ease-out ${(selectedChildId || selectedDocChildId) ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`}>

                            {/* Document View */}
                            {selectedDocChildId ? (() => {
                                const child = children.find(c => c.id === selectedDocChildId);
                                const result = results[selectedDocChildId] || {};
                                if (!child) return null;
                                const force = docEditId === child.id ? (docDraft.force || {}) : parseForceSheet(result.K_sheet || '');
                                return (
                                    <div className="flex flex-col h-full"
                                        onTouchStart={e => setTouchStartPos(e.touches[0].clientX)}
                                        onTouchEnd={e => { if (touchStartPos === null) return; if (e.changedTouches[0].clientX - touchStartPos > 100) setSelectedDocChildId(null); setTouchStartPos(null); }}>
                                        <div className="p-4 border-b bg-gradient-to-r from-indigo-50 to-purple-50 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <button onClick={() => { const list = children.filter(c => results[c.id]).sort((a, b) => b.timestamp - a.timestamp); const idx = list.findIndex(c => c.id === selectedDocChildId); if (idx < list.length - 1) setSelectedDocChildId(list[idx + 1].id); }} disabled={children.filter(c => results[c.id]).findIndex(c => c.id === selectedDocChildId) >= children.filter(c => results[c.id]).length - 1} className="p-1 disabled:opacity-30 lg:hidden text-indigo-400"><ChevronLeft className="w-6 h-6" /></button>
                                                <div>
                                                    <h2 className="text-lg font-black text-indigo-900">{child.name}</h2>
                                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">書類閲覧モード</p>
                                                </div>
                                                <button onClick={() => { const list = children.filter(c => results[c.id]).sort((a, b) => b.timestamp - a.timestamp); const idx = list.findIndex(c => c.id === selectedDocChildId); if (idx > 0) setSelectedDocChildId(list[idx - 1].id); }} disabled={children.filter(c => results[c.id]).findIndex(c => c.id === selectedDocChildId) <= 0} className="p-1 disabled:opacity-30 lg:hidden text-indigo-400"><ChevronRight className="w-6 h-6" /></button>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button onClick={async () => { setChildGeneratingId(child.id); await generateDocuments(); setChildGeneratingId(null); }} className="p-2 bg-green-600 text-white rounded-lg text-xs font-bold flex items-center gap-1">
                                                    <RefreshCw className={`w-3 h-3 ${childGeneratingId === child.id ? 'animate-spin' : ''}`} /> 再生成
                                                </button>
                                                <button onClick={async () => {
                                                    if (docEditId === child.id) {
                                                        const next = { ...result, D: docDraft.D || '', B_result: docDraft.B_result || '', B_plan: docDraft.B_plan || '', B_item: docDraft.B_item || '' };
                                                        const forceText = buildForceSheet(docDraft.force || {});
                                                        if (child.forceSheet || result.K_sheet || forceText) next.K_sheet = forceText;
                                                        await saveResults({ ...results, [child.id]: next }, summaryC);
                                                        setDocEditId(null);
                                                    } else {
                                                        setDocEditId(child.id);
                                                    }
                                                }} className={`p-2 rounded-lg text-xs font-bold ${docEditId === child.id ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'}`}>
                                                    {docEditId === child.id ? '保存して終了' : '編集'}
                                                </button>
                                                <button onClick={() => setSelectedDocChildId(null)} className="lg:hidden p-2 bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
                                            </div>
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-4 space-y-6">
                                            {/* ツリー通信 */}
                                            <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
                                                <div className="flex items-center justify-between mb-2">
                                                    <h3 className="text-xs font-black text-emerald-600 uppercase">ツリー通信</h3>
                                                    <CopyButton text={result.D || ''} label="COPY" />
                                                </div>
                                                <div className="bg-[#7494c0] p-4 rounded-xl rounded-tl-none text-white text-sm whitespace-pre-wrap leading-relaxed font-mono relative ml-2 shadow-sm w-fit max-w-[90%] break-words">
                                                    <div className="absolute -top-[0px] -left-[8px] w-0 h-0 border-t-[0px] border-r-[15px] border-b-[15px] border-l-[0px] border-transparent border-r-[#7494c0]" />
                                                    {docEditId === child.id ? (
                                                        <textarea
                                                            className="w-full bg-white/90 text-slate-900 rounded-lg p-2 text-sm leading-relaxed"
                                                            style={{ height: `${Math.max(140, ((docDraft.D || '').split('\n').length * 22) + 24)}px` }}
                                                            value={docDraft.D || ''}
                                                            onChange={e => setDocDraft(prev => ({ ...prev, D: e.target.value }))}
                                                        />
                                                    ) : (result.D || '未生成')}
                                                </div>
                                            </div>
                                            {/* 専門的支援実施計画 */}
                                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                                                <div className="flex items-center justify-between mb-2">
                                                    <h3 className="text-xs font-black text-indigo-600 uppercase">専門的支援実施計画</h3>
                                                </div>
                                                <div className="space-y-4">
                                                    <div>
                                                        <div className="flex items-center justify-between mb-1">
                                                            <p className="text-[10px] font-bold text-slate-400">実績</p>
                                                            <CopyButton text={result.B_result || ''} label="COPY" />
                                                        </div>
                                                        {docEditId === child.id ? (
                                                            <textarea
                                                                className="w-full bg-white rounded border p-2 text-sm leading-relaxed"
                                                                style={{ height: `${Math.max(100, ((docDraft.B_result || '').split('\n').length * 22) + 24)}px` }}
                                                                value={docDraft.B_result || ''}
                                                                onChange={e => setDocDraft(prev => ({ ...prev, B_result: e.target.value }))}
                                                            />
                                                        ) : <p className="bg-white p-3 rounded border text-sm whitespace-pre-wrap leading-relaxed">{result.B_result}</p>}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center justify-between mb-1">
                                                            <p className="text-[10px] font-bold text-slate-400">予定</p>
                                                            <CopyButton text={result.B_plan || ''} label="COPY" />
                                                        </div>
                                                        {docEditId === child.id ? (
                                                            <textarea
                                                                className="w-full bg-white rounded border p-2 text-sm leading-relaxed"
                                                                style={{ height: `${Math.max(80, ((docDraft.B_plan || '').split('\n').length * 22) + 24)}px` }}
                                                                value={docDraft.B_plan || ''}
                                                                onChange={e => setDocDraft(prev => ({ ...prev, B_plan: e.target.value }))}
                                                            />
                                                        ) : <p className="bg-white p-3 rounded border text-sm whitespace-pre-wrap leading-relaxed">{result.B_plan}</p>}
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-bold text-slate-400">該当項目</p>
                                                        {docEditId === child.id ? <input className="w-full bg-white rounded border p-2 text-sm" value={docDraft.B_item || ''} onChange={e => setDocDraft(prev => ({ ...prev, B_item: e.target.value }))} /> : <p className="bg-white p-3 rounded border text-sm">{result.B_item}</p>}
                                                    </div>
                                                </div>
                                            </div>
                                            {/* 強行シート */}
                                            {(result.K_sheet || child.forceSheet) && (
                                                <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                                                    <div className="flex items-center justify-between mb-3">
                                                        <h3 className="text-xs font-black text-amber-700 uppercase">強行シート</h3>
                                                        <CopyButton text={result.K_sheet} label="COPY" />
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                        {[['学習', 'learning'], ['自由遊び', 'play'], ['プログラム', 'program'], ['おやつ', 'snack']].map(([label, key]) => (
                                                            <div key={key} className="bg-white p-3 rounded border">
                                                                <div className="flex items-center justify-between mb-1">
                                                                    <p className="text-[10px] font-bold text-slate-400">{label}</p>
                                                                    <CopyButton text={force[key] || '該当なし'} label="COPY" />
                                                                </div>
                                                                {docEditId === child.id ? (
                                                                    <textarea
                                                                        className="w-full text-sm leading-relaxed border rounded"
                                                                        style={{ height: `${Math.max(70, (((force[key] || '').split('\n').length) * 20) + 16)}px` }}
                                                                        value={force[key] || ''}
                                                                        onChange={e => setDocDraft(prev => ({ ...prev, force: { ...(prev.force || {}), [key]: e.target.value } }))}
                                                                    />
                                                                ) : <p className="text-sm whitespace-pre-wrap leading-relaxed">{force[key] || '該当なし'}</p>}
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {docEditId === child.id && (
                                                        <div className="mt-3 flex justify-end">
                                                            <button onClick={async () => {
                                                                const next = { ...result, D: docDraft.D || '', B_result: docDraft.B_result || '', B_plan: docDraft.B_plan || '', B_item: docDraft.B_item || '' };
                                                                const forceText = buildForceSheet(docDraft.force || {});
                                                                if (child.forceSheet || result.K_sheet || forceText) next.K_sheet = forceText;
                                                                await saveResults({ ...results, [child.id]: next }, summaryC);
                                                                setDocEditId(null);
                                                            }} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold">変更を保存</button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            {docEditId === child.id && !child.forceSheet && !result.K_sheet && (
                                                <div className="flex justify-end">
                                                    <button onClick={async () => {
                                                        const next = { ...result, D: docDraft.D || '', B_result: docDraft.B_result || '', B_plan: docDraft.B_plan || '', B_item: docDraft.B_item || '' };
                                                        await saveResults({ ...results, [child.id]: next }, summaryC);
                                                        setDocEditId(null);
                                                    }} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold">変更を保存</button>
                                                </div>
                                            )}
                                        </div>
                                        <button onClick={() => setSelectedDocChildId(null)} className="lg:hidden fixed bottom-6 right-6 w-14 h-14 bg-slate-900 text-white rounded-full shadow-2xl flex items-center justify-center z-[110]"><X className="w-6 h-6" /></button>
                                    </div>
                                );
                            })() : selectedChildId ? (() => {
                                const child = children.find(c => c.id === selectedChildId);
                                if (!child) return null;
                                return (
                                    <div className="flex flex-col h-full bg-white relative"
                                        onTouchStart={e => setTouchStartPos(e.touches[0].clientX)}
                                        onTouchEnd={e => { if (touchStartPos === null) return; if (e.changedTouches[0].clientX - touchStartPos > 100) setSelectedChildId(null); setTouchStartPos(null); }}>
                                        <div className="flex-1 bg-slate-50/50 p-4 overflow-y-auto flex flex-col gap-3 relative">
                                            {selectedChildMessages.length === 0 ? (
                                                <div className="flex flex-col items-center justify-center py-6 px-4 select-none">
                                                    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-100 rounded-2xl p-5 max-w-sm w-full shadow-sm">
                                                        <p className="text-center text-sm font-black text-indigo-600 mb-4 flex items-center justify-center gap-2">
                                                            <BookOpen className="w-4 h-4" />メモの使い方
                                                        </p>
                                                        <div className="space-y-3 text-[11px] text-slate-600">
                                                            <div className="flex gap-2.5 items-start">
                                                                <span className="flex-shrink-0 w-5 h-5 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[10px] font-black">1</span>
                                                                <p><span className="font-bold text-slate-800">名前を登録</span>して、下のテキスト欄から<span className="font-bold text-slate-800">メモを送信</span>します。</p>
                                                            </div>
                                                            <div className="flex gap-2.5 items-start">
                                                                <span className="flex-shrink-0 w-5 h-5 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[10px] font-black">2</span>
                                                                <p>テキスト欄の上の<span className="font-bold text-indigo-600">タグボタン</span>で「学習」「プログラム」など<span className="font-bold text-slate-800">活動タグ</span>をつけられます。</p>
                                                            </div>
                                                            <div className="flex gap-2.5 items-start">
                                                                <span className="flex-shrink-0 w-5 h-5 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[10px] font-black">3</span>
                                                                <p>AIに使わせたくないメモは、メモ右上の<span className="font-bold text-emerald-600">「AI利用」ボタン</span>を押して<span className="font-bold text-slate-800">非採用</span>にできます。</p>
                                                            </div>
                                                            <div className="flex gap-2.5 items-start">
                                                                <span className="flex-shrink-0 w-5 h-5 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[10px] font-black">4</span>
                                                                <p>グループチャットのように、<span className="font-bold text-slate-800">他のスタッフのメモもリアルタイムに反映</span>されます。</p>
                                                            </div>
                                                            <div className="flex gap-2.5 items-start">
                                                                <span className="flex-shrink-0 w-5 h-5 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[10px] font-black">5</span>
                                                                <p>閉じるには<span className="font-bold text-slate-800">✕ボタン</span>を押すか、<span className="font-bold text-slate-800">左→右にスワイプ</span>します。</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : selectedChildMessages.map(msg => (
                                                <MemoMessage
                                                    key={msg.id}
                                                    msg={msg}
                                                    onToggle={() => toggleMessage(child.id, msg.id)}
                                                    onEdit={(newText) => updateMessageText(child.id, msg.id, newText)}
                                                />
                                            ))}
                                        </div>
                                        <div className="bg-white border-t p-4 space-y-3">
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1 relative">
                                                    <input type="text" value={child.name} onChange={e => updateChild(child.id, { name: e.target.value })}
                                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-indigo-700 outline-none focus:border-indigo-300 transition-colors"
                                                        placeholder="児童名" />
                                                </div>
                                                <button onClick={() => setSelectedChildId(null)} className="w-10 h-10 bg-slate-900 text-white rounded-full flex items-center justify-center shadow-md active:scale-90 transition-transform">
                                                    <X className="w-5 h-5" />
                                                </button>
                                            </div>
                                            <MemoInput
                                                childId={child.id}
                                                drafts={drafts}
                                                setDrafts={setDrafts}
                                                onSend={(id, text) => { sendMessage(id, text); }}
                                            />
                                        </div>
                                    </div>
                                );
                            })() : (
                                <div className="flex-1 flex flex-col items-center justify-center text-slate-300 bg-slate-50/50">
                                    <Users className="w-16 h-16 mb-4 opacity-10" />
                                    <p className="font-black text-sm uppercase tracking-widest text-slate-300">児童を選択してください</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div >

            {/* Modals */}
            <CalendarModal show={showCalendarModal} onClose={() => setShowCalendarModal(false)} selectedDate={selectedDate} setSelectedDate={setSelectedDate} existingReportDates={existingReportDates} onRebuild={handleRebuildIndex} />
            <SettingsModal show={showSettingsModal} onClose={() => setShowSettingsModal(false)} />
            <ExportModal show={showExportModal} onClose={() => setShowExportModal(false)} children={children} results={results} selectedDate={selectedDate} summaryC={summaryC} />

            {/* Interaction Blocker Overlay */}
            {loading && (
                <div className="fixed inset-0 z-[200] bg-slate-900/30 backdrop-blur-[2px] flex flex-col items-center justify-center pointer-events-auto">
                    <div className="bg-white rounded-2xl shadow-2xl p-8 flex flex-col items-center max-w-sm w-full mx-4">
                        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
                        <h3 className="text-lg font-black text-slate-800 mb-2">書類を作成中...</h3>
                        <p className="text-xs font-bold text-slate-500 text-center mb-6">しばらくこのままお待ちください。<br />※画面の操作はできません</p>

                        <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden shadow-inner relative">
                            <div
                                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300 ease-out"
                                style={{ width: `${smoothProgress}%` }}
                            />
                        </div>
                        <div className="text-center w-full mt-2">
                            <span className="text-xs font-black text-indigo-600 font-mono">{smoothProgress}%</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

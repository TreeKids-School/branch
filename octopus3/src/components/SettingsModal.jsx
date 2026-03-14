import { useState } from 'react';
import { Settings, Clipboard, X, ChevronDown, ChevronUp } from 'lucide-react';
import { defaultPrompts } from '../constants/defaultPrompts';

export default function SettingsModal({ show, onClose }) {
    const [apiKeyInput, setApiKeyInput] = useState(() => localStorage.getItem('care_pro_gemini_key') || '');

    // プロンプト設定の読み込み
    const [prompts, setPrompts] = useState(() => {
        try {
            const saved = localStorage.getItem('care_pro_prompts');
            if (saved) return { ...defaultPrompts, ...JSON.parse(saved) };
        } catch { }
        return defaultPrompts;
    });

    // アコーディオン開閉状態
    const [expanded, setExpanded] = useState({
        api: true, promptD: false, promptB: false, promptK: false, promptSummary: false
    });

    const toggleSection = (key) => setExpanded(p => ({ ...p, [key]: !p[key] }));

    if (!show) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 sm:p-6" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl flex flex-col w-full max-w-2xl max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-5 border-b border-slate-100 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <Settings className="w-6 h-6 text-indigo-600" />
                        <h3 className="text-lg font-bold text-slate-800">設定・AIプロンプト調整</h3>
                    </div>
                    <button onClick={onClose} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200"><X className="w-5 h-5 text-slate-500" /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
                    {/* API Key Section */}
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                        <button onClick={() => toggleSection('api')} className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 transition-colors">
                            <span className="font-bold text-slate-700 text-sm">システム設定 (Gemini API Key)</span>
                            {expanded.api ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                        </button>
                        {expanded.api && (
                            <div className="p-4 bg-white">
                                <div className="flex items-center justify-between mb-2">
                                    <label className="block text-xs font-bold text-slate-500">Google Gemini API Key</label>
                                    <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-500 hover:text-blue-700 underline font-bold">APIキーを取得する</a>
                                </div>
                                <div className="flex gap-2">
                                    <input type="password" value={apiKeyInput} onChange={e => setApiKeyInput(e.target.value)} placeholder="AIzaSy..." className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 transition-colors" />
                                    <button onClick={async () => { try { const text = await navigator.clipboard.readText(); if (text) setApiKeyInput(text); } catch { alert('クリップボードの読み取りに失敗しました。'); } }} className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200 flex items-center gap-1">
                                        <Clipboard className="w-4 h-4" /><span className="hidden sm:inline">貼付</span>
                                    </button>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-2">※キーはブラウザ内にのみ保存されます</p>
                            </div>
                        )}
                    </div>

                    {/* Prompts Section */}
                    {[
                        { key: 'promptD', title: 'ツリー通信 の指示', desc: '※ {{STAFF_NAME}}, {{STAFF_INSTRUCTION}} は自動で名前に置き換わります' },
                        { key: 'promptB', title: '専門的支援実施計画 の指示', desc: '※ 結果・予定・該当項目の抽出ルール' },
                        { key: 'promptK', title: '強行シート の指示', desc: '※ 各シーンの要約ルール' },
                        { key: 'promptSummary', title: '全体の様子 の指示', desc: '※ 全員の記録をもとにした総括ルール' }
                    ].map(block => (
                        <div key={block.key} className="border border-slate-200 rounded-lg overflow-hidden">
                            <button onClick={() => toggleSection(block.key)} className="w-full flex items-center justify-between p-3 bg-indigo-50/50 hover:bg-indigo-50 transition-colors">
                                <span className="font-bold text-indigo-900 text-sm">{block.title}</span>
                                {expanded[block.key] ? <ChevronUp className="w-4 h-4 text-indigo-400" /> : <ChevronDown className="w-4 h-4 text-indigo-400" />}
                            </button>
                            {expanded[block.key] && (
                                <div className="p-4 bg-white flex flex-col gap-2">
                                    <p className="text-[10px] text-slate-500 font-bold">{block.desc}</p>
                                    <textarea
                                        value={prompts[block.key]}
                                        onChange={e => setPrompts(p => ({ ...p, [block.key]: e.target.value }))}
                                        className="w-full min-h-[160px] text-sm p-3 bg-slate-50 border border-slate-200 rounded-lg font-mono leading-relaxed focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 resize-y"
                                    />
                                    <div className="flex justify-end mt-1">
                                        <button
                                            onClick={() => setPrompts(p => ({ ...p, [block.key]: defaultPrompts[block.key] }))}
                                            className="text-[10px] text-slate-400 hover:text-slate-600 underline"
                                        >
                                            初期値に戻す
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <div className="p-4 border-t border-slate-100 flex gap-3 flex-shrink-0 bg-slate-50 rounded-b-xl">
                    <button
                        onClick={() => {
                            localStorage.setItem('care_pro_gemini_key', apiKeyInput.trim());
                            localStorage.setItem('care_pro_prompts', JSON.stringify(prompts));
                            onClose();
                            alert('設定を保存しました');
                        }}
                        className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-colors shadow-sm"
                    >
                        保存
                    </button>
                    <button onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-slate-600 text-sm font-bold">閉じる</button>
                </div>
            </div>
        </div>
    );
}

import { useState, useRef } from 'react';
import { Send, ToggleLeft, ToggleRight, Edit2, Check, X } from 'lucide-react';

export default function MemoPanel({ child, messages, onSendMessage, onToggleMessage, onUpdateMessage }) {
    const [inputText, setInputText] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [editText, setEditText] = useState('');
    const inputRef = useRef(null);

    if (!child) {
        return (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 text-center text-slate-400 text-sm">
                左の一覧から児童を選択してください
            </div>
        );
    }

    const handleSend = () => {
        if (!inputText.trim()) return;
        onSendMessage(child.id, inputText.trim());
        setInputText('');
        inputRef.current?.focus();
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const startEdit = (msg) => {
        setEditingId(msg.id);
        setEditText(msg.text);
    };

    const saveEdit = (msgId) => {
        onUpdateMessage(child.id, msgId, editText);
        setEditingId(null);
    };

    const includedMessages = messages.filter(m => m.included !== false);
    const excludedMessages = messages.filter(m => m.included === false);

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col h-full">
            <div className="px-4 py-3 border-b border-slate-100">
                <h3 className="font-bold text-slate-700 text-sm">{child.name} のメモ</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">
                    {includedMessages.length}件 / 合計{messages.length}件
                </p>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
                {messages.length === 0 && (
                    <p className="text-center text-slate-400 text-sm py-4">メモを入力してください</p>
                )}
                {messages.map(msg => (
                    <div
                        key={msg.id}
                        className={`rounded-xl p-3 text-sm transition-all ${msg.included !== false
                                ? 'bg-indigo-50 border border-indigo-100'
                                : 'bg-slate-50 border border-slate-100 opacity-50'
                            }`}
                    >
                        {editingId === msg.id ? (
                            <div className="flex gap-2">
                                <textarea
                                    value={editText}
                                    onChange={e => setEditText(e.target.value)}
                                    className="flex-1 text-sm border border-indigo-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                                    rows={3}
                                    autoFocus
                                />
                                <div className="flex flex-col gap-1">
                                    <button onClick={() => saveEdit(msg.id)} className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                                        <Check className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={() => setEditingId(null)} className="p-1.5 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300">
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-start gap-2">
                                <p className="flex-1 text-slate-700 whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                                <div className="flex gap-1 flex-shrink-0">
                                    <button onClick={() => startEdit(msg)} className="p-1 text-slate-400 hover:text-indigo-600">
                                        <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={() => onToggleMessage(child.id, msg.id)} className="p-1 text-slate-400 hover:text-indigo-600">
                                        {msg.included !== false
                                            ? <ToggleRight className="w-4 h-4 text-indigo-500" />
                                            : <ToggleLeft className="w-4 h-4" />
                                        }
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Input */}
            <div className="p-3 border-t border-slate-100">
                <div className="flex gap-2">
                    <textarea
                        ref={inputRef}
                        value={inputText}
                        onChange={e => setInputText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="メモを入力（Enterで送信）"
                        className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                        rows={2}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!inputText.trim()}
                        className="px-3 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}

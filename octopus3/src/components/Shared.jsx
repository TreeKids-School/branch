import React, { useState } from 'react';
import { Copy, Check, Clipboard } from 'lucide-react';

export const CopyButton = ({ text, label }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => {
        if (!text) return;
        const markCopied = () => { setCopied(true); setTimeout(() => setCopied(false), 2000); };
        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(text).then(markCopied).catch(() => fallbackCopy(text, markCopied));
        } else { fallbackCopy(text, markCopied); }
    };
    const fallbackCopy = (value, onSuccess) => {
        try {
            const ta = document.createElement('textarea');
            ta.value = value; ta.style.position = 'fixed'; ta.style.opacity = '0';
            document.body.appendChild(ta); ta.select(); document.execCommand('copy');
            document.body.removeChild(ta); onSuccess();
        } catch { }
    };
    return (
        <button onClick={handleCopy} className="text-slate-400 hover:text-indigo-600 transition-colors flex items-center gap-1" title="Copy">
            {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
            {label && <span className="text-[10px] font-bold">{label}</span>}
        </button>
    );
};

export class ErrorBoundary extends React.Component {
    constructor(props) { super(props); this.state = { hasError: false, error: null }; }
    static getDerivedStateFromError() { return { hasError: true }; }
    componentDidCatch(error) { this.setState({ error }); }
    render() {
        if (this.state.hasError) return (
            <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
                <div className="text-red-800 max-w-lg">
                    <h1 className="text-2xl font-bold mb-4">エラーが発生しました</h1>
                    <p className="mb-4">アプリケーションで予期せぬエラーが発生しました。</p>
                    <details className="whitespace-pre-wrap font-mono text-xs bg-red-100 p-4 rounded mb-4 overflow-auto max-h-64">
                        {this.state.error?.toString()}
                    </details>
                    <button onClick={() => window.location.reload()} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-bold">
                        ページを再読み込み
                    </button>
                </div>
            </div>
        );
        return this.props.children;
    }
}

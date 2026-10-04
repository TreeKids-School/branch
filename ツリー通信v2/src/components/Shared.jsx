import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { copyToClipboard } from '../utils/clipboard';

export const CopyButton = ({ text, label }) => {
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState('');
    const handleCopy = async () => {
        if (!text) return;
        setError(''); setCopied(false);
        try {
            await copyToClipboard(text);
            setCopied(true); setTimeout(() => setCopied(false), 2000);
        } catch (reason) { setError(reason.message); }
    };
    return (
        <span className="inline-flex flex-col items-start gap-1"><button type="button" onClick={handleCopy} disabled={!text} className="text-slate-500 hover:text-emerald-700 transition-colors flex items-center gap-1 min-h-[40px]" title="コピー" aria-label={copied ? 'コピーしました' : label || 'コピー'}>
            {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
            {label && <span className="text-[10px] font-bold">{label}</span>}
        </button>{error && <span role="alert" className="text-[11px] text-amber-800 max-w-[260px]">{error}</span>}</span>
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

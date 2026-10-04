import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { applyOfficeTheme } from './utils/themeUtils'

// Apply initial office theme immediately from cached office to avoid color flash
applyOfficeTheme();


ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <div role="note" className="bg-amber-50 border-b border-amber-200 px-4 py-3 text-sm text-amber-950"><strong>ツリー通信v2</strong> · ローカル開発環境 · 既存データとの接続なし · AI・予約連携は準備中</div>
        <App />
    </React.StrictMode>,
)

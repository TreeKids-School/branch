import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from '../App';
import '../index.css';
import { subscribeSession, sendToPortal } from './sessionBridge';
import { applyOfficeTheme } from '../utils/themeUtils';

function PortalApplication() {
  const [session, setSession] = useState(null);
  useEffect(() => subscribeSession(value => {
    applyOfficeTheme();
    setSession(value);
    sendToPortal({type: 'tree-tsushin:started'});
  }), []);
  useEffect(() => {
    const edited = () => sendToPortal({type: 'tree-tsushin:state', dirty: true, busy: false});
    window.addEventListener('input', edited, true);
    return () => window.removeEventListener('input', edited, true);
  }, []);
  if (!session) return <main className="max-w-lg mx-auto p-8 space-y-4"><h1 className="text-2xl font-bold">ツリー通信v2</h1><p>予約システムのスタッフログインを確認しています。</p><p>直接開いた場合は、予約システムの「ツリー通信v2」メニューから開き直してください。</p><a className="underline" href="/#/communication/v2" target="_top">予約システムへ戻る</a></main>;
  return <><div role="note" className="bg-amber-50 border-b border-amber-200 p-3 text-sm leading-6 text-amber-950"><strong>ツリー通信v2・起動確認版</strong><p>入力はこのブラウザー内だけに仮保存します。スタッフ間の共有・既存データの移行・保護者への公開は未接続です。ブラウザーのデータ削除で消えるため、業務の正本としては使わないでください。</p></div><App /></>;
}

ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><PortalApplication /></React.StrictMode>);

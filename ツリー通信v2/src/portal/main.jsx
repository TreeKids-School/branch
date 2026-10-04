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
    const stateChanged = event => sendToPortal({type: 'tree-tsushin:state', dirty: Boolean(event.detail?.dirty), busy: Boolean(event.detail?.busy)});
    window.addEventListener('tree-tsushin:workstate', stateChanged);
    return () => window.removeEventListener('tree-tsushin:workstate', stateChanged);
  }, []);
  if (!session) return <main className="max-w-lg mx-auto p-8 space-y-4"><h1 className="text-2xl font-bold">ツリー通信v2</h1><p>予約システムのスタッフログインを確認しています。</p><p>直接開いた場合は、予約システムの「ツリー通信v2」メニューから開き直してください。</p><a className="underline" href="/#/communication/v2" target="_top">予約システムへ戻る</a></main>;
  return <><details role="note" className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs leading-5 text-amber-950"><summary className="cursor-pointer font-semibold">このブラウザー内の仮保存 · スタッフ間共有は未接続</summary><p className="pt-2">既存データの移行・保護者への公開は未接続です。ブラウザーのデータ削除で消えるため、業務の正本としては使わないでください。通信の入力完了やコピーだけでは、保護者に送信されません。</p></details><App /></>;
}

ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><PortalApplication /></React.StrictMode>);

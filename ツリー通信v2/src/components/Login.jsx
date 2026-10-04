import { useState } from 'react';
import { signInAnonymously } from 'firebase/auth';
import { auth } from '../firebase';

export default function Login({ onLoginSuccess }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function enter() {
    setPending(true); setError('');
    try { await signInAnonymously(auth); onLoginSuccess(); }
    catch { setError('ローカル環境に接続できません。別のターミナルで npm run emulators を起動してください。'); }
    finally { setPending(false); }
  }
  return <main className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
    <section className="w-full max-w-lg rounded-3xl bg-white border border-stone-200 p-8 space-y-5 shadow-sm">
      <img src="/logo.png" width="1254" height="1064" className="mx-auto w-32 h-auto" alt="Tree Kids School（ツリーキッズスクール）" />
      <p className="text-center text-sm text-emerald-800">ツリー通信システム</p>
      <h1 className="text-center text-3xl font-bold text-emerald-950">ツリー通信v2</h1>
      <p className="text-center text-stone-600 leading-8">日々のまなざしを、<br/>家族のあしあとに。</p>
      <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm leading-7"><strong>ローカル開発用の分離環境です。</strong><p>既存の通信・児童データは読み込みません。実在のお子さまの情報を入力せず、検証用の内容で操作してください。</p></div>
      <button type="button" disabled={pending} onClick={enter} className="w-full min-h-12 rounded-xl bg-emerald-800 p-4 font-bold text-white disabled:opacity-50">{pending ? '接続しています…' : 'ローカル開発環境を開く'}</button>
      {error && <p role="alert" className="text-red-800 text-sm">{error}</p>}
      <p className="text-xs leading-6 text-stone-500">実アカウントでのログイン・AI生成・予約システムへの送信は未接続です。開発用ログインはローカルの認証エミュレーターだけに作成されます。</p>
    </section>
  </main>;
}

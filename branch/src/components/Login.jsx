import { useState } from 'react';
import { auth } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { LogIn, Key, User, AlertCircle, Loader2 } from 'lucide-react';

export default function Login({ onLoginSuccess }) {
    const [id, setId] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        // Map special IDs to an internal email format
        const specialUsers = {
            'テスト': { email: 'test@tree-kids.com', paddedPass: '000001' },
            'ブラック': { email: 'black@tree-kids.com', paddedPass: '000001' }
        };
        const special = specialUsers[id];
        const email = special ? special.email : id;
        
        // Firebase requires at least 6 characters for passwords.
        // If it's a special user and they enter '0001', we internally use '000001' to satisfy the rule.
        const finalPassword = (special && password === '0001') ? special.paddedPass : password;

        try {
            await signInWithEmailAndPassword(auth, email, finalPassword);
            onLoginSuccess();
        } catch (err) {
            console.warn('Login attempt failed, checking for auto-creation:', err.code);
            
            // If it's a special user, try creating it on the fly
            if (special && password === '0001' && (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential' || err.code === 'auth/invalid-password')) {
                try {
                    await createUserWithEmailAndPassword(auth, email, finalPassword);
                    onLoginSuccess();
                    return;
                } catch (createErr) {
                    console.error('Auto-creation failed:', createErr);
                }
            }
            
            setError('IDまたはパスワードが正しくありません。（FirebaseコンソールでEmail/Password認証が有効になっているか確認してください）');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
            <div className="w-full max-w-md glass-card p-8 md:p-12 rounded-[3rem] shadow-premium border-white animate-in zoom-in-95 duration-500">
                <div className="text-center mb-10">
                    <div className="inline-flex p-4 bg-tree-500 rounded-3xl shadow-xl shadow-tree-100 mb-6">
                        <LogIn className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-3xl font-black text-slate-800 tracking-tight">サインイン</h2>
                    <p className="text-[10px] font-black text-tree-600 uppercase tracking-[0.2em] mt-2 opacity-80">Tree Kids School 支援管理</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-4">ID</label>
                        <div className="relative">
                            <User className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                            <input
                                type="text"
                                value={id}
                                onChange={(e) => setId(e.target.value)}
                                placeholder="IDを入力..."
                                required
                                className="w-full pl-14 pr-8 py-5 bg-slate-50 border-2 border-slate-100 rounded-full focus:border-tree-500 focus:bg-white focus:ring-8 focus:ring-tree-50 outline-none transition-all font-bold text-slate-700 shadow-inner"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-4">パスワード</label>
                        <div className="relative">
                            <Key className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••"
                                required
                                className="w-full pl-14 pr-8 py-5 bg-slate-50 border-2 border-slate-100 rounded-full focus:border-tree-500 focus:bg-white focus:ring-8 focus:ring-tree-50 outline-none transition-all font-bold text-slate-700 shadow-inner tracking-widest"
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 p-4 bg-apple-50 text-apple-600 rounded-2xl text-xs font-bold border border-apple-100 animate-in fade-in slide-in-from-top-2">
                            <AlertCircle className="w-4 h-4" />
                            <span>{error}</span>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-6 bg-tree-600 hover:bg-tree-700 text-white rounded-full font-black text-sm shadow-2xl shadow-tree-100 transition-all active:scale-95 disabled:grayscale flex items-center justify-center gap-3 uppercase tracking-widest"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
                        <span>ログイン</span>
                    </button>
                </form>

                <div className="mt-12 text-center">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                        &copy; 2026 Tree Kids School
                    </p>
                </div>
            </div>
        </div>
    );
}

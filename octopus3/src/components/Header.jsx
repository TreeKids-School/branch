import { Cloud, Settings, BookOpen } from 'lucide-react';

const APP_VERSION = '2.0.0';

export default function Header({ user, connectionStatus, isSyncing, onSettings }) {
    return (
        <header className="flex items-center justify-between mb-4 md:mb-6">
            <div className="flex items-center gap-2 md:gap-3">
                <img src="/logo.png" alt="Tree Kids School Logo" className="h-12 md:h-16 object-contain" />
                <div className="flex flex-col justify-center">
                    <div className="flex items-center gap-2" title={connectionStatus === 'online' ? 'クラウド同期中' : 'オフライン'}>
                        <Cloud className={`w-3 h-3 md:w-4 md:h-4 ${isSyncing ? 'text-green-500 animate-pulse' : connectionStatus === 'online' ? 'text-emerald-500' : 'text-slate-400'}`} />
                        <span className="text-[8px] md:text-[9px] text-slate-400 font-bold">
                            v{APP_VERSION} {connectionStatus !== 'online' && '(オフライン)'}
                        </span>
                    </div>
                    {user && (
                        <p className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                            Sync: {user.uid.substring(0, 8)}...
                        </p>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-2">
                <button
                    onClick={onSettings}
                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-full transition-colors"
                    title="設定"
                >
                    <Settings className="w-5 h-5 md:w-6 md:h-6" />
                </button>
            </div>
        </header>
    );
}

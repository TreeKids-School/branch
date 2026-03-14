import { useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

export default function CalendarModal({ show, onClose, selectedDate, setSelectedDate, existingReportDates, onRebuild }) {
    const [viewDate, setViewDate] = useState(new Date());



    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayStr = new Date().toISOString().split('T')[0];

    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(<div key={`b${i}`} className="aspect-square" />);
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const isSelected = selectedDate === dateStr;
        const isToday = dateStr === todayStr;
        const hasReport = existingReportDates.includes(dateStr);
        days.push(
            <button key={d} onClick={() => { setSelectedDate(dateStr); onClose(); }}
                className={`relative aspect-square rounded-2xl flex flex-col items-center justify-center font-bold text-sm transition-all
          ${isSelected ? 'bg-indigo-600 text-white shadow-lg scale-105 z-10'
                        : isToday ? 'bg-indigo-50 text-indigo-700 border-2 border-indigo-200'
                            : 'hover:bg-slate-50 text-slate-700'}`}>
                <span className={isToday ? 'scale-110' : ''}>{d}</span>
                <div className="flex gap-1 mt-1">
                    {hasReport && <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-emerald-500'}`} />}
                </div>
            </button>
        );
    }

    return (
        <div className={`fixed inset-0 z-[100] transition-opacity duration-300 ${show ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className={`absolute top-0 left-0 right-0 bg-white shadow-2xl flex flex-col items-center pt-8 pb-10 px-4 rounded-b-3xl border-b border-indigo-100 transition-transform duration-300 ease-out ${show ? 'translate-y-0' : '-translate-y-full'}`}>
                <div className="w-full max-w-lg">
                    <div className="flex items-center justify-between mb-8">
                        <button onClick={() => { const d = new Date(viewDate); d.setMonth(d.getMonth() - 1); setViewDate(d); }}
                            className="p-3 rounded-full hover:bg-slate-100 text-slate-500 hover:text-indigo-600 transition-colors">
                            <ChevronLeft className="w-6 h-6" />
                        </button>
                        <h2 className="text-2xl font-black text-indigo-900">
                            {viewDate.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' })}
                        </h2>
                        <button onClick={() => { const d = new Date(viewDate); d.setMonth(d.getMonth() + 1); setViewDate(d); }}
                            className="p-3 rounded-full hover:bg-slate-100 text-slate-500 hover:text-indigo-600 transition-colors">
                            <ChevronRight className="w-6 h-6" />
                        </button>
                    </div>
                    <div className="grid grid-cols-7 gap-2 mb-6">
                        {['日', '月', '火', '水', '木', '金', '土'].map((day, i) => (
                            <div key={day} className={`text-center text-xs font-bold py-2 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-slate-400'}`}>{day}</div>
                        ))}
                        {days}
                    </div>
                    <div className="flex items-center justify-center gap-6 text-xs text-slate-500 font-bold">
                        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500" /><span>日報作成済み</span></div>
                        <div className="flex items-center gap-2"><div className="w-6 h-6 rounded-lg bg-indigo-50 border-2 border-indigo-200 flex items-center justify-center text-[10px] text-indigo-700">1</div><span>今日</span></div>
                    </div>
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-12 h-1 bg-slate-200 rounded-full" />
                </div>
                <button onClick={onClose} className="mt-6 text-slate-400 hover:text-slate-600 font-bold text-sm flex items-center gap-2 px-6 py-2 rounded-full hover:bg-slate-100 transition-colors">
                    <X className="w-4 h-4" /> 閉じる
                </button>
                {onRebuild && (
                    <button onClick={() => { if (confirm('カレンダーの表示を修復しますか？')) onRebuild(); }} className="mt-4 text-[10px] text-slate-300 hover:text-indigo-400 underline transition-colors">
                        表示がおかしい場合は自動修復
                    </button>
                )}
            </div>
        </div>
    );
}

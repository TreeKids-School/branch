import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import './WorkflowModals.css';
const localDate = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export default function CalendarModal({ show, onClose, selectedDate, setSelectedDate, existingReportDates = [], onRebuild }) {
    const [viewDate, setViewDate] = useState(new Date());
    useEffect(() => { if (show && selectedDate) setViewDate(new Date(`${selectedDate}T12:00:00`)); }, [show, selectedDate]);
    if (!show) return null;
    const year = viewDate.getFullYear(), month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay(), daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = localDate(new Date());
    const select = date => { setSelectedDate(date); onClose(); };
    return <div className="workflow-overlay" onClick={onClose}><section className="workflow-dialog" style={{maxWidth:560}} role="dialog" aria-modal="true" aria-labelledby="calendar-title" onClick={e => e.stopPropagation()}>
      <header className="workflow-header"><div><p className="workflow-eyebrow">ツリー通信v2 / 日付の切替</p><h2 id="calendar-title">記録する日を選ぶ</h2><p>選択中: {selectedDate}</p></div><button className="workflow-icon" onClick={onClose} aria-label="カレンダーを閉じる"><X/></button></header>
      <div className="workflow-body"><div className="workflow-actions"><button className="workflow-icon" onClick={() => setViewDate(new Date(year,month-1,1))} aria-label="前の月"><ChevronLeft/></button><h3 className="font-bold text-lg">{year}年 {month+1}月</h3><button className="workflow-icon" onClick={() => setViewDate(new Date(year,month+1,1))} aria-label="次の月"><ChevronRight/></button></div>
        <div className="grid grid-cols-7 gap-1 my-5">{['日','月','火','水','木','金','土'].map(day => <span key={day} className="text-center py-2 text-sm text-slate-500">{day}</span>)}{Array.from({length:firstDay},(_,i) => <span key={`blank-${i}`}/>)}{Array.from({length:daysInMonth},(_,i) => {
          const date = `${year}-${String(month+1).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`;
          const selected = selectedDate === date, hasReport = existingReportDates.includes(date);
          return <button key={date} onClick={() => select(date)} aria-label={`${date}${hasReport ? ' 記録あり' : ''}`} aria-pressed={selected} className={`min-h-12 rounded-xl py-2 flex flex-col items-center justify-center font-bold ${selected ? 'bg-tree-700 text-white' : date === today ? 'bg-tree-50 border border-tree-300 text-tree-800' : 'hover:bg-tree-50'}`}><span>{i+1}</span><span className={`h-1.5 w-1.5 rounded-full mt-1 ${hasReport ? selected ? 'bg-white' : 'bg-tree-600' : 'bg-transparent'}`}/></button>;
        })}</div><p className="workflow-help">● 記録あり / 枠つきの日付は今日です。</p>
        {onRebuild && <button className="workflow-text-button mt-5" onClick={() => { if (window.confirm('記録のある日付を再取得しますか？')) onRebuild(); }}>記録ありの表示を再取得</button>}
      </div><footer className="workflow-footer"><div className="workflow-actions"><button className="workflow-secondary" onClick={onClose}>戻る</button><button className="workflow-primary" onClick={() => select(today)}>今日の記録へ</button></div></footer>
    </section></div>;
}

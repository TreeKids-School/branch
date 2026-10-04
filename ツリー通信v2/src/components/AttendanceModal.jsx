import React, { useState, useEffect } from 'react';
import { X, Save, Clock, Calendar, UserCheck } from 'lucide-react';
import { callStorage } from '../hooks/useStorage';
import { getRoleFromPost } from '../app_constants';

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

// 5分単位に丸めるヘルパー
const roundTo5Minutes = (timeStr) => {
    if (!timeStr) return '';
    const parts = timeStr.split(':');
    if (parts.length < 2) return timeStr;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return timeStr;
    
    const roundedMin = Math.round(m / 5) * 5;
    if (roundedMin === 60) {
        const nextHour = String((h + 1) % 24).padStart(2, '0');
        return `${nextHour}:00`;
    }
    return `${String(h).padStart(2, '0')}:${String(roundedMin).padStart(2, '0')}`;
};

export default function AttendanceModal({ onClose, selectedDate, officeId, staffList = [] }) {
    const [attendance, setAttendance] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // 1. その日の勤怠データの取得（事業所IDスコープ付き）
                const data = await callStorage({ action: 'getAttendance', date: selectedDate, officeId });
                
                // 初期値の設定
                const initialAttendance = {};
                staffList.forEach(staff => {
                    const role = getRoleFromPost(staff.post) || staff.role || '';
                    if (data && data[staff.id]) {
                        // 既存データがあっても role を最新の staffList から補完し、時間は5分刻みに丸める
                        const record = data[staff.id];
                        initialAttendance[staff.id] = { 
                            ...record, 
                            name: staff.name, 
                            role,
                            startTime: roundTo5Minutes(record.startTime || '09:30'),
                            endTime: roundTo5Minutes(record.endTime || '18:30')
                        };
                    } else {
                        initialAttendance[staff.id] = {
                            type: 'work',
                            startTime: '09:30',
                            endTime: '18:30',
                            name: staff.name,
                            role
                        };
                    }
                });
                setAttendance(initialAttendance);
            } catch (error) {
                console.error('Failed to fetch attendance data', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [selectedDate, officeId, staffList]);

    const handleTypeChange = (staffId, type) => {
        setAttendance(prev => ({
            ...prev,
            [staffId]: {
                ...prev[staffId],
                type
            }
        }));
    };

    const handleTimeChange = (staffId, field, value) => {
        setAttendance(prev => ({
            ...prev,
            [staffId]: {
                ...prev[staffId],
                [field]: value
            }
        }));
    };

    const handleSave = async () => {
        try {
            await callStorage({
                action: 'saveAttendance',
                date: selectedDate,
                officeId,
                data: attendance
            });
            onClose();
        } catch (error) {
            console.error('Failed to save attendance data', error);
            alert('保存に失敗しました。');
        }
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" onClick={onClose} />
            
            <div className="relative w-full max-w-6xl max-h-[95vh] bg-white rounded-[2rem] md:rounded-[4rem] shadow-2xl overflow-hidden flex flex-col border border-white animate-in zoom-in-95 duration-500">
                {/* Header */}
                <div className="p-5 md:p-8 bg-tree-600 flex items-center justify-between shadow-xl flex-shrink-0 z-10">
                    <div className="flex items-center gap-3 md:gap-5">
                        <div className="p-2 md:p-3 bg-white/10 rounded-2xl backdrop-blur-md ring-2 ring-white/20">
                            <UserCheck className="w-5 h-5 md:w-7 md:h-7 text-white" />
                        </div>
                        <div>
                            <h3 className="font-black text-lg md:text-2xl text-white tracking-tight">スタッフ勤怠管理</h3>
                            <p className="text-[9px] md:text-[10px] font-black text-tree-100 uppercase tracking-[0.2em] mt-1 opacity-80">
                                対象日: {selectedDate}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-white/10 rounded-xl transition-all text-white/80 hover:text-white">
                        <X className="w-5 h-5 md:w-6 md:h-6" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 md:p-8 bg-slate-50/30 custom-scrollbar">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-4">
                            <Clock className="w-10 h-10 text-tree-500 animate-spin" />
                            <p className="font-black text-slate-400 uppercase tracking-widest text-xs">Loading...</p>
                        </div>
                    ) : staffList.length === 0 ? (
                        <div className="text-center py-12 text-slate-400 font-bold">
                            スタッフが登録されていません。
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* デスクトップ用 (md以上) */}
                            <div className="hidden md:grid grid-cols-2 xl:grid-cols-3 gap-4">
                                {staffList.map(staff => {
                                    const record = attendance[staff.id] || { type: 'work', startTime: '09:30', endTime: '18:30' };
                                    const isWork = record.type === 'work';

                                    // 時間の分解
                                    const [startHour, startMin] = (record.startTime || '09:30').split(':');
                                    const [endHour, endMin] = (record.endTime || '18:30').split(':');

                                    const handleTimeUpdateLocal = (field, part, val) => {
                                        const currentVal = record[field] || (field === 'startTime' ? '09:30' : '18:30');
                                        const [h, m] = currentVal.split(':');
                                        let newTime = '';
                                        if (part === 'hour') {
                                            newTime = `${val}:${m || '00'}`;
                                        } else {
                                            newTime = `${h || '00'}:${val}`;
                                        }
                                        handleTimeChange(staff.id, field, newTime);
                                    };

                                    return (
                                        <div key={staff.id} className="glass-card p-4 rounded-2xl border border-white shadow-premium flex flex-col justify-between gap-3 hover:shadow-md transition-all">
                                            {/* Top: Staff Name */}
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-tree-100 flex items-center justify-center text-tree-600 font-black text-xs">
                                                    {staff.name.substring(0, 1)}
                                                </div>
                                                <span className="font-black text-slate-700 text-sm">{staff.name}</span>
                                            </div>

                                            {/* Bottom: Options & Inputs */}
                                            <div className="flex flex-wrap gap-2 items-center justify-between mt-1">
                                                {/* 区分選択 */}
                                                <div className="flex bg-slate-100 p-1 rounded-full border border-slate-200/50 shadow-inner">
                                                    <button
                                                        onClick={() => handleTypeChange(staff.id, 'work')}
                                                        className={`px-3 py-1.5 rounded-full text-[10px] font-black transition-all ${isWork ? 'bg-white text-tree-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                                    >
                                                        出勤
                                                    </button>
                                                    <button
                                                        onClick={() => handleTypeChange(staff.id, 'public_holiday')}
                                                        className={`px-3 py-1.5 rounded-full text-[10px] font-black transition-all ${record.type === 'public_holiday' ? 'bg-white text-wood-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                                    >
                                                        公休
                                                    </button>
                                                    <button
                                                        onClick={() => handleTypeChange(staff.id, 'paid_leave')}
                                                        className={`px-3 py-1.5 rounded-full text-[10px] font-black transition-all ${record.type === 'paid_leave' ? 'bg-white text-apple-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                                    >
                                                        有給
                                                    </button>
                                                </div>

                                                {/* 時間入力 */}
                                                <div className={`flex items-center gap-1 md:gap-1.5 transition-opacity ${isWork ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
                                                    {/* 開始時間 */}
                                                    <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shadow-sm">
                                                        <select
                                                            disabled={!isWork}
                                                            value={startHour || '09'}
                                                            onChange={e => handleTimeUpdateLocal('startTime', 'hour', e.target.value)}
                                                            className="bg-transparent text-xs font-bold text-slate-700 outline-none px-1 py-0.5 cursor-pointer appearance-none text-center min-w-[28px]"
                                                        >
                                                            {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                                                        </select>
                                                        <span className="text-slate-400 font-bold text-[10px] px-0.5">:</span>
                                                        <select
                                                            disabled={!isWork}
                                                            value={startMin || '30'}
                                                            onChange={e => handleTimeUpdateLocal('startTime', 'minute', e.target.value)}
                                                            className="bg-transparent text-xs font-bold text-slate-700 outline-none px-1 py-0.5 cursor-pointer appearance-none text-center min-w-[28px]"
                                                        >
                                                            {MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
                                                        </select>
                                                    </div>

                                                    <span className="text-slate-400 font-bold text-xs">〜</span>

                                                    {/* 終了時間 */}
                                                    <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shadow-sm">
                                                        <select
                                                            disabled={!isWork}
                                                            value={endHour || '18'}
                                                            onChange={e => handleTimeUpdateLocal('endTime', 'hour', e.target.value)}
                                                            className="bg-transparent text-xs font-bold text-slate-700 outline-none px-1 py-0.5 cursor-pointer appearance-none text-center min-w-[28px]"
                                                        >
                                                            {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                                                        </select>
                                                        <span className="text-slate-400 font-bold text-[10px] px-0.5">:</span>
                                                        <select
                                                            disabled={!isWork}
                                                            value={endMin || '30'}
                                                            onChange={e => handleTimeUpdateLocal('endTime', 'minute', e.target.value)}
                                                            className="bg-transparent text-xs font-bold text-slate-700 outline-none px-1 py-0.5 cursor-pointer appearance-none text-center min-w-[28px]"
                                                        >
                                                            {MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* モバイル用 (md未満で表示, スリムなリスト形式) */}
                            <div className="md:hidden flex flex-col divide-y divide-slate-100 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                                {staffList.map(staff => {
                                    const record = attendance[staff.id] || { type: 'work', startTime: '09:30', endTime: '18:30' };
                                    const isWork = record.type === 'work';
                                    const [startHour, startMin] = (record.startTime || '09:30').split(':');
                                    const [endHour, endMin] = (record.endTime || '18:30').split(':');

                                    const handleTimeUpdateLocal = (field, part, val) => {
                                        const currentVal = record[field] || (field === 'startTime' ? '09:30' : '18:30');
                                        const [h, m] = currentVal.split(':');
                                        let newTime = '';
                                        if (part === 'hour') {
                                            newTime = `${val}:${m || '00'}`;
                                        } else {
                                            newTime = `${h || '00'}:${val}`;
                                        }
                                        handleTimeChange(staff.id, field, newTime);
                                    };

                                    return (
                                        <div key={staff.id} className="p-3 flex flex-col gap-2 hover:bg-slate-50/50 transition-colors">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <div className="w-6 h-6 rounded-full bg-tree-50 flex items-center justify-center text-tree-600 font-black text-[10px] flex-shrink-0">
                                                        {staff.name.substring(0, 1)}
                                                    </div>
                                                    <span className="font-black text-slate-700 text-xs truncate max-w-[90px]">{staff.name}</span>
                                                </div>
                                                
                                                {/* 区分選択 */}
                                                <div className="flex bg-slate-100 p-0.5 rounded-full border border-slate-200/50 shadow-inner flex-shrink-0">
                                                    <button
                                                        onClick={() => handleTypeChange(staff.id, 'work')}
                                                        className={`px-2 py-1 rounded-full text-[9px] font-black transition-all ${isWork ? 'bg-white text-tree-600 shadow-sm' : 'text-slate-400'}`}
                                                    >
                                                        出勤
                                                    </button>
                                                    <button
                                                        onClick={() => handleTypeChange(staff.id, 'public_holiday')}
                                                        className={`px-2 py-1 rounded-full text-[9px] font-black transition-all ${record.type === 'public_holiday' ? 'bg-white text-wood-600 shadow-sm' : 'text-slate-400'}`}
                                                    >
                                                        公休
                                                    </button>
                                                    <button
                                                        onClick={() => handleTypeChange(staff.id, 'paid_leave')}
                                                        className={`px-2 py-1 rounded-full text-[9px] font-black transition-all ${record.type === 'paid_leave' ? 'bg-white text-apple-600 shadow-sm' : 'text-slate-400'}`}
                                                    >
                                                        有給
                                                    </button>
                                                </div>
                                            </div>

                                            {/* 時間選択 */}
                                            {isWork && (
                                                <div className="flex items-center justify-end gap-1 px-1 py-0.5 animate-in slide-in-from-top-1 duration-200">
                                                    <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg p-0.5 shadow-sm">
                                                        <select
                                                            value={startHour || '09'}
                                                            onChange={e => handleTimeUpdateLocal('startTime', 'hour', e.target.value)}
                                                            className="bg-transparent text-[10px] font-bold text-slate-700 outline-none px-1 py-0.5 cursor-pointer appearance-none text-center min-w-[22px]"
                                                        >
                                                            {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                                                        </select>
                                                        <span className="text-slate-400 font-bold text-[8px] px-0.5">:</span>
                                                        <select
                                                            value={startMin || '30'}
                                                            onChange={e => handleTimeUpdateLocal('startTime', 'minute', e.target.value)}
                                                            className="bg-transparent text-[10px] font-bold text-slate-700 outline-none px-1 py-0.5 cursor-pointer appearance-none text-center min-w-[22px]"
                                                        >
                                                            {MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
                                                        </select>
                                                    </div>

                                                    <span className="text-slate-400 font-bold text-[10px]">〜</span>

                                                    <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg p-0.5 shadow-sm">
                                                        <select
                                                            value={endHour || '18'}
                                                            onChange={e => handleTimeUpdateLocal('endTime', 'hour', e.target.value)}
                                                            className="bg-transparent text-[10px] font-bold text-slate-700 outline-none px-1 py-0.5 cursor-pointer appearance-none text-center min-w-[22px]"
                                                        >
                                                            {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                                                        </select>
                                                        <span className="text-slate-400 font-bold text-[8px] px-0.5">:</span>
                                                        <select
                                                            value={endMin || '30'}
                                                            onChange={e => handleTimeUpdateLocal('endTime', 'minute', e.target.value)}
                                                            className="bg-transparent text-[10px] font-bold text-slate-700 outline-none px-1 py-0.5 cursor-pointer appearance-none text-center min-w-[22px]"
                                                        >
                                                            {MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
                                                        </select>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-5 md:p-8 bg-slate-50/80 backdrop-blur-sm border-t border-slate-100 flex items-center justify-end gap-4 flex-shrink-0">
                    <button onClick={onClose} className="px-5 py-3 font-black text-[10px] md:text-xs text-slate-400 hover:text-slate-600 transition-all uppercase tracking-[0.2em]">
                        キャンセル
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={loading || staffList.length === 0}
                        className="px-6 md:px-10 py-4 bg-tree-600 hover:bg-tree-700 disabled:bg-slate-300 text-white rounded-full font-black text-[10px] md:text-sm shadow-xl transition-all active:scale-95 flex items-center gap-2 md:gap-3 uppercase tracking-[0.15em]"
                    >
                        <Save className="w-4 h-4 md:w-5 md:h-5" />
                        勤怠を保存
                    </button>
                </div>
            </div>
        </div>
    );
}

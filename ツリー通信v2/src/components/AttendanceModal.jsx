import React, { useEffect, useRef, useState } from 'react';
import { X, Save, Clock, AlertCircle, RefreshCw } from 'lucide-react';
import { callStorage } from '../hooks/useStorage';
import { getRoleFromPost } from '../app_constants';
import { ATTENDANCE_TYPES, attendancePatch, roundAttendanceTime } from '../utils/attendance.js';

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));
const control = 'min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-base text-slate-800 focus:ring-2 focus:ring-tree-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400';
function TimeField({ label, value, disabled, onChange }) {
    const [hour, minute] = (value || '09:30').split(':');
    return <div className="flex items-center gap-1">
        <select aria-label={label + '・時'} className={control + ' w-[68px]'} value={hour} disabled={disabled} onChange={e => onChange(e.target.value + ':' + minute)}>{HOURS.map(item => <option key={item}>{item}</option>)}</select>
        <span aria-hidden="true">:</span>
        <select aria-label={label + '・分'} className={control + ' w-[68px]'} value={minute} disabled={disabled} onChange={e => onChange(hour + ':' + e.target.value)}>{MINUTES.map(item => <option key={item}>{item}</option>)}</select>
    </div>;
}
export default function AttendanceModal({ onClose, onSaved, selectedDate, officeId, officeName, staffList = [], onDirtyChange }) {
    const [attendance, setAttendance] = useState({});
    const [registered, setRegistered] = useState(new Set());
    const [changed, setChanged] = useState(new Set());
    const [activeId, setActiveId] = useState(staffList[0]?.id || '');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [reload, setReload] = useState(0);
    const [loaded, setLoaded] = useState(false);
    const busyRef = useRef(false);
    const staffRef = useRef(staffList);
    staffRef.current = staffList;
    const staffSignature = JSON.stringify(staffList.map(staff => [staff.id, staff.name, staff.post, staff.role]));
    useEffect(() => { onDirtyChange?.(changed.size > 0 || saving); }, [changed.size, saving, onDirtyChange]);
    useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
    useEffect(() => {
        let active = true;
        setLoading(true); setLoaded(false); setError(''); setChanged(new Set());
        callStorage({ action: 'getAttendance', date: selectedDate, officeId }).then(data => {
            if (!active) return;
            const records = {};
            staffRef.current.forEach(staff => {
                const record = data?.[staff.id] || {};
                records[staff.id] = { ...record, name: staff.name, role: getRoleFromPost(staff.post) || staff.role || '',
                    type: record.type || 'work', startTime: roundAttendanceTime(record.startTime, '09:30'), endTime: roundAttendanceTime(record.endTime, '18:30') };
            });
            setAttendance(records); setRegistered(new Set(Object.keys(data || {})));
            setActiveId(current => records[current] ? current : staffRef.current[0]?.id || '');
            setLoaded(true);
        }).catch(failure => { if (active) setError('勤務を読み込めませんでした。再読込みしてから入力してください。' + (failure.message || '')); })
          .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [selectedDate, officeId, staffSignature, reload]);
    const change = (id, field, value) => {
        if (!loaded || busyRef.current) return;
        setAttendance(previous => ({ ...previous, [id]: { ...previous[id], [field]: value } }));
        setChanged(previous => new Set([...previous, id])); setError('');
    };
    const close = () => {
        if (busyRef.current) return;
        if (changed.size && !window.confirm('保存していない勤務の変更を破棄して戻りますか？')) return;
        onClose();
    };
    const save = async () => {
        if (!loaded || busyRef.current || !changed.size) return;
        busyRef.current = true; setSaving(true); setError('');
        try {
            const patch = attendancePatch(attendance, changed);
            // Send edited staff only; storage merges unrelated staff and fields.
            await callStorage({ action: 'saveAttendance', date: selectedDate, officeId, data: patch });
            setChanged(new Set()); onSaved?.(patch); onClose();
        } catch (failure) { setError('勤務を保存できませんでした。入力内容は残っています。' + (failure.message || '')); }
        finally { busyRef.current = false; setSaving(false); }
    };
    const typeButtons = (staff, record) => <div className="flex flex-wrap gap-1.5" role="group" aria-label={staff.name + 'の勤務区分'}>
        {ATTENDANCE_TYPES.map(type => <button key={type.value} type="button" disabled={saving}
            aria-pressed={record.type === type.value && (registered.has(staff.id) || changed.has(staff.id))}
            onClick={() => change(staff.id, 'type', type.value)}
            className={'min-h-[44px] px-4 rounded-xl border font-semibold text-sm ' + (record.type === type.value && (registered.has(staff.id) || changed.has(staff.id)) ? 'bg-tree-700 border-tree-700 text-white' : 'bg-white border-slate-200 text-slate-600')}>{type.label}</button>)}
    </div>;
    const status = id => changed.has(id) ? '未保存' : registered.has(id) ? '登録済み' : '未登録';
    const selectedStaff = staffList.find(staff => staff.id === activeId);
    const selectedRecord = attendance[activeId];
    return <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/45 p-0 md:p-6" role="presentation">
        <div className="absolute inset-0" onClick={close} />
        <section role="dialog" aria-modal="true" aria-labelledby="attendance-title" className="relative bg-slate-50 w-full h-[100dvh] md:h-auto md:max-h-[92dvh] max-w-6xl md:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <header className="flex justify-between items-center gap-4 px-5 py-4 bg-white border-b border-slate-200 shrink-0">
                <div><p className="text-xs text-slate-500 mb-1">ツリー通信v2 / 業務</p><h2 id="attendance-title" className="text-xl font-bold text-slate-800">スタッフ勤務</h2><p className="text-sm text-slate-600 mt-1">{officeName || officeId || '事業所未選択'} · {selectedDate}</p></div>
                <button aria-label="勤務画面を閉じる" onClick={close} disabled={saving} className="min-h-[44px] min-w-[44px] rounded-xl hover:bg-slate-100"><X className="w-5 h-5 mx-auto" /></button>
            </header>
            <div className="overflow-y-auto flex-1 p-4 md:p-6">
                {error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 flex flex-col gap-3"><span className="flex gap-2"><AlertCircle className="w-5 h-5 shrink-0" />{error}</span>
                    {!loaded && !loading && <button onClick={() => setReload(value => value + 1)} className="min-h-[44px] flex items-center justify-center gap-2 font-semibold rounded-lg bg-white border border-red-200"><RefreshCw className="w-4 h-4" />再読込み</button>}</div>}
                {loading ? <p className="flex items-center justify-center gap-2 py-12 text-slate-500"><Clock className="w-5 h-5 animate-pulse" />勤務を読み込んでいます</p>
                    : loaded && !staffList.length ? <p className="p-8 text-center text-slate-500">この事業所にスタッフが登録されていません。</p>
                    : loaded && <>
                        <p className="mb-5 text-sm text-slate-600">変更したスタッフだけを保存します。職種は表示のみです。未登録のスタッフは勤務区分を選択して登録してください。</p>
                        <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200 bg-white">
                            <table className="w-full text-left text-sm"><thead className="bg-slate-100 text-slate-600"><tr><th className="p-4">スタッフ / 職種</th><th className="p-4">勤務区分</th><th className="p-4">開始</th><th className="p-4">終了</th><th className="p-4">状態</th></tr></thead>
                                <tbody>{staffList.map(staff => { const record = attendance[staff.id]; if (!record) return null; return <tr key={staff.id} className="border-t border-slate-100">
                                    <th className="p-4 font-semibold text-slate-800">{staff.name}<span className="block text-xs text-slate-500 font-normal mt-1">{record.role || '職種未設定'}</span></th>
                                    <td className="p-3">{typeButtons(staff, record)}</td>
                                    <td className="p-3"><TimeField label={staff.name + 'の開始'} value={record.startTime} disabled={record.type !== 'work' || saving} onChange={value => change(staff.id, 'startTime', value)} /></td>
                                    <td className="p-3"><TimeField label={staff.name + 'の終了'} value={record.endTime} disabled={record.type !== 'work' || saving} onChange={value => change(staff.id, 'endTime', value)} /></td>
                                    <td className={'p-4 whitespace-nowrap ' + (changed.has(staff.id) ? 'text-amber-700' : 'text-slate-500')}>{status(staff.id)}</td></tr>; })}</tbody>
                            </table>
                        </div>
                        <div className="md:hidden space-y-4">
                            <label className="block text-sm font-semibold text-slate-700">スタッフを選択<select className={control + ' w-full mt-2'} value={activeId} onChange={event => setActiveId(event.target.value)} disabled={saving}>{staffList.map(staff => <option key={staff.id} value={staff.id}>{staff.name} · {status(staff.id)}</option>)}</select></label>
                            {selectedStaff && selectedRecord && <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-6">
                                <div className="flex justify-between gap-3"><div><h3 className="text-xl font-bold text-slate-800">{selectedStaff.name}</h3><p className="text-sm text-slate-500 mt-1">{selectedRecord.role || '職種未設定'}（表示のみ）</p></div><span className="text-sm text-amber-700">{status(activeId)}</span></div>
                                <div><p className="font-semibold text-sm mb-2">勤務区分</p>{typeButtons(selectedStaff, selectedRecord)}</div>
                                <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-5">
                                    <div><p className="text-sm font-semibold mb-2">開始時刻</p><TimeField label={selectedStaff.name + 'の開始'} value={selectedRecord.startTime} disabled={selectedRecord.type !== 'work' || saving} onChange={value => change(activeId, 'startTime', value)} /></div>
                                    <div><p className="text-sm font-semibold mb-2">終了時刻</p><TimeField label={selectedStaff.name + 'の終了'} value={selectedRecord.endTime} disabled={selectedRecord.type !== 'work' || saving} onChange={value => change(activeId, 'endTime', value)} /></div>
                                </div>
                                <p className="text-xs leading-relaxed text-slate-500">{selectedRecord.type === 'work' ? '時刻は5分単位です。' : '公休・有給では勤務時間を使いません。出勤に戻すと入力済みの時刻を使えます。'}</p>
                            </div>}
                        </div>
                    </>}
            </div>
            <footer className="shrink-0 border-t border-slate-200 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] flex flex-wrap items-center gap-3">
                <p className="text-sm text-slate-600 flex-1">{changed.size ? '変更 ' + changed.size + '名 · 未保存' : '保存する変更はありません'}</p>
                <button onClick={close} disabled={saving} className="min-h-[48px] px-5 rounded-xl border border-slate-200 font-semibold text-slate-600">戻る</button>
                <button onClick={save} disabled={loading || saving || !loaded || !changed.size} className="min-h-[48px] px-6 rounded-xl bg-tree-700 text-white font-bold disabled:opacity-40 flex items-center justify-center gap-2"><Save className="w-5 h-5" />{saving ? '保存中…' : '勤務を保存'}</button>
            </footer>
        </section>
    </div>;
}

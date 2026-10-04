export const ATTENDANCE_TYPES = [
    { value: 'work', label: '出勤' },
    { value: 'public_holiday', label: '公休' },
    { value: 'paid_leave', label: '有給' },
];

export function roundAttendanceTime(value, fallback = '') {
    if (!/^\d{1,2}:\d{2}$/.test(value || '')) return fallback;
    const [hour, minute] = value.split(':').map(Number);
    if (hour > 23 || minute > 59) return fallback;
    const total = (Math.round((hour * 60 + minute) / 5) * 5) % (24 * 60);
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function attendancePatch(records, changedIds) {
    return Object.fromEntries([...changedIds].map(id => {
        const record = records[id];
        if (!record || !ATTENDANCE_TYPES.some(type => type.value === record.type)) {
            throw new Error('勤務区分を選択してください。');
        }
        if (record.type === 'work' && [record.startTime, record.endTime].some(time => !/^([01]\d|2[0-3]):[0-5][05]$/.test(time || ''))) {
            throw new Error(`${record.name || 'スタッフ'}の開始・終了時刻を5分単位で入力してください。`);
        }
        return [id, { ...record }];
    }));
}

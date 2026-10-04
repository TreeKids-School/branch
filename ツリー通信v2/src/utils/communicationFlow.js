export const DEFAULT_TAGS = ['【ツリー式学習】', '【宿題】', '【プリント】', '【プログラム】', '【おやつ】', '【自由時間】', '【備考】', '【共有】'];
export const DEFAULT_INSERTS = {'【プログラム】': '{プログラム内容}', '【ツリー式学習】': 'ツリー式学習'};
export const DEFAULT_COLUMNS = {'【ツリー式学習】': 'learning', '【学習】': 'learning', '【宿題】': 'learning', '【プリント】': 'learning', '【プログラム】': 'program', '【備考】': 'remarks'};
export const emptyReport = () => ({children: [], results: {}, messages: {}, dailyTable: {}, globalLog: {}, summaryC: ''});
export const childName = child => child?.lastName ? `${child.lastName} ${child.firstName || ''}`.trim() : child?.name || '名称未設定';
export const childStatus = child => child?.isAbsent ? 'absent' : child?.isWaitlist ? 'waitlist' : 'regular';
export const memoTags = value => Array.isArray(value) ? value.flatMap(tag=>String(tag).split(' ')).filter(Boolean) : String(value || '').split(' ').filter(Boolean);
export const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export const offsetDate = (date, offset) => { const value = new Date(`${date}T12:00:00`); value.setDate(value.getDate()+offset); return localDate(value); };
export function columnText(messages = [], column, mapping = DEFAULT_COLUMNS) {
  return messages.filter(m => memoTags(m.tag).some(tag => mapping[tag] === column)).map(m => {
    const text = String(m.text || '').trim();
    const tags = memoTags(m.tag);
    return text && tags.length && !text.includes(tags[0]) ? `${tags.join(' ')}${text}` : text;
  }).filter(Boolean).join(column === 'learning' ? '\n' : ' / ');
}
export function patchResult(report, id, patch) {
  return {...report, results: {...report.results, [id]: {...report.results?.[id], ...patch}}};
}
export function assertExpectedResult(result = {}, expected = {}) {
  for (const key of Object.keys(expected)) {
    const value = key === 'isCompleted' ? Boolean(result[key]) : result[key] ?? '';
    const previous = key === 'isCompleted' ? Boolean(expected[key]) : expected[key] ?? '';
    if (value !== previous) throw new Error('保存済みの内容が変更されています。比較してから保存してください。');
  }
}
export const remarksText = (messages, mapping, table = {}) => [...new Set([columnText(messages,'remarks',mapping),String(table.notes || '').trim()].filter(Boolean))].join('\n');
export function patchTable(report, id, patch) {
  return {...report, dailyTable: {...report.dailyTable, [id]: {...report.dailyTable?.[id], ...patch}}};
}
export function mutateMemo(report, id, action, message) {
  const before = report.messages?.[id] || [];
  let messages;
  if (action === 'add') messages = before.some(item => item.id === message.id) ? before : [...before, message];
  else if (action === 'delete') messages = before.filter(item => item.id !== message.id);
  else {
    if (!before.some(item => item.id === message.id)) throw new Error('このメモは削除されています。再読み込みしてください。');
    messages = before.map(item => item.id === message.id ? {...item, ...message} : item);
  }
  const next = {...report, messages: {...report.messages, [id]: messages}};
  if (action === 'add' && messages !== before && memoTags(message.tag).includes('【共有】')) {
    const name = childName((report.children || []).find(item => item.id === id));
    const existing = report.globalLog?.activities || '';
    next.globalLog = {...report.globalLog, activities: [typeof existing === 'string' ? existing : JSON.stringify(existing), `[${name}] ${message.text}`].filter(Boolean).join('\n')};
  }
  return next;
}
export function programPatch(programs) {
  const first = programs[0] || {};
  return {programs, programTitle: first.title || '', programSummary: first.summary || '', programStaff: first.staff || ''};
}
export function combinedCommunication(children, results, ids) {
  const groups = new Map();
  for (const id of ids) {
    const child = children.find(item => item.id === id);
    if (!child || !(results[id]?.D || '').trim()) continue;
    const key = child.lastName || `id:${id}`;
    groups.set(key, [...(groups.get(key) || []), child]);
  }
  return [...groups.entries()].map(([key, group]) => {
    const name = key.startsWith('id:') ? `${childName(group[0])}さん` : group.length > 1 ? `【${key}${group.map(c=>`${c.firstName || ''}さん`).join('')}】` : `${key}${group[0].firstName || ''}さん`;
    return `${name}\n${[...new Set(group.map(c=>results[c.id].D.trim()))].join('\n')}`;
  }).join('\n\n');
}
export const BACKUP_HEADERS = ['児童名','日付','学習','プログラム','送迎時間','終了時間','迎え場所','ツリー通信','チャットメモ','今後の予定','備考','復元用データ','日次データ'];
export function backupRows(report, date, mapping) {
  return (report.children || []).filter(c=>!c.isPlaceholder).map(child => {
    const result = report.results?.[child.id] || {}, row = report.dailyTable?.[child.id] || {}, messages = report.messages?.[child.id] || [];
    return [childName(child),date,columnText(messages,'learning',mapping),columnText(messages,'program',mapping),row.transportTime || '',row.endTime || '',row.pickupLocation || '',result.D || '',messages.map(m=>`${memoTags(m.tag).join(' ')}${m.text || ''}`).join(' | '),result.futurePlan || '',remarksText(messages,mapping,row),JSON.stringify({v:1,m:messages,r:result,t:row}),JSON.stringify({summaryC:report.summaryC || '',globalLog:report.globalLog || {}})];
  });
}
export function exportDates(date, range) {
  if (range === 'day') return [date];
  const start = new Date(`${date}T12:00:00`);
  if (range === 'week') start.setDate(start.getDate()-6);
  else if (range === 'month') start.setMonth(start.getMonth()-1);
  else if (range === 'year') start.setFullYear(start.getFullYear()-1);
  else throw new Error('書出し期間が不正です。');
  const dates = [];
  for (let current = localDate(start); current <= date; current = offsetDate(current,1)) dates.push(current);
  return dates;
}

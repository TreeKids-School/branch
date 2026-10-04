import { parseForceSheet } from './parseForceSheet';
import { getRoleFromPost } from '../app_constants';

// ── 共通ヘルパー ──────────────────────────────────────────────

/** 勤怠レコード1件を { name, timeStr, timeEnd } 形式に変換 */
function formatAttendance(record) {
    if (!record) return { name: '', timeStr: '', timeEnd: '' };
    const name = record.name || '';
    if (record.type === 'public_holiday') return { name, timeStr: '公休', timeEnd: '' };
    if (record.type === 'paid_leave')    return { name, timeStr: '有給', timeEnd: '' };
    return { name, timeStr: record.startTime || '9:30', timeEnd: record.endTime || '18:30' };
}

/** 1行分の HTML を生成 */
function staffRow(fmt) {
    return `<td class="name-cell">${fmt.name}</td><td class="time-cell">${fmt.timeStr}</td><td class="time-cell">${fmt.timeEnd}</td>`;
}

/**
 * attendance オブジェクト + staffList から
 * 印刷用スタッフテーブルの HTML を生成する。
 *
 * 各勤怠レコードの role フィールドで振り分け:
 *   "管理者"           → 管理者セクション
 *   "児発管"           → 児発管セクション
 *   "児童指導員・保育士" → 児童指導員/保育士セクション
 *   "指導員"           → 指導員セクション
 *   未設定 / その他     → 児童指導員/保育士セクションに配置
 *
 * staffList (App側のスタッフマスタ) が渡された場合、
 * attendance に role が無くても staffList から補完する。
 */
export function buildStaffTableHTML(attendance = {}, globalLog = {}, staffList = []) {
    // staffList から post/role を補完するためのマップを作成
    const staffMap = {};
    staffList.forEach(s => {
        if (s.name) {
            staffMap[s.name] = s.post || s.role || '';
        }
    });

    const allRecords = [];

    if (staffList.length > 0) {
        // staffList が渡されている場合は、そのリスト全員を対象にして勤怠データをマッピング
        staffList.forEach(staff => {
            // IDまたは名前で紐付け
            const record = attendance[staff.id] || attendance[staff.name];
            if (record) {
                allRecords.push({
                    ...record,
                    name: staff.name,
                    // マスタ（staffMap）を最優先で役職を決定
                    role: staffMap[staff.name] || record.post || record.role || ''
                });
            } else {
                // そのスタッフの勤怠データがなければ、デフォルトで出勤(09:30〜18:30)にする
                allRecords.push({
                    name: staff.name,
                    type: 'work',
                    startTime: '09:30',
                    endTime: '18:30',
                    role: staffMap[staff.name] || ''
                });
            }
        });
    } else {
        // staffList が空の場合は、既存の attendance レコードのみを使用（後方互換）
        Object.values(attendance).forEach(record => {
            if (record && record.name) {
                allRecords.push({
                    ...record,
                    role: record.post || record.role || ''
                });
            }
        });
    }

    // role で分類
    const admins = [];       // 管理者
    const supervisors = [];  // 児発管
    const workers = [];      // 児童指導員・保育士
    const assistants = [];   // 指導員

    for (const record of allRecords) {
        // マスタ優先で役職を決定
        let roleVal = staffMap[record.name] || record.role || record.post || '';
        
        // 配列化する
        const rawRoles = Array.isArray(roleVal) ? roleVal : [roleVal];
        const fmt = formatAttendance(record);

        // 各役職を日本語名にマッピング
        const resolvedRoles = [];
        rawRoles.forEach(r => {
            const mapped = getRoleFromPost(r);
            if (mapped) {
                resolvedRoles.push(mapped);
            } else if (r && r !== 'staff' && r !== 'admin') {
                // すでに日本語名である場合や、英語のrole以外をそのまま追加
                resolvedRoles.push(r);
            }
        });

        // 役職が解決できない場合のデフォルト
        if (resolvedRoles.length === 0) {
            resolvedRoles.push('児童指導員・保育士');
        }

        // 重複を除去
        const uniqueRoles = Array.from(new Set(resolvedRoles));

        // 該当するすべての役職セクションに配置（掛け持ち対応）
        uniqueRoles.forEach(role => {
            if (role === '管理者') {
                admins.push(fmt);
            } else if (role === '児発管') {
                supervisors.push(fmt);
            } else if (role === '指導員') {
                assistants.push(fmt);
            } else {
                // "児童指導員・保育士"、"スタッフ"、未設定などはすべて「児童指導員・保育士」枠
                workers.push(fmt);
            }
        });
    }

    // 各セクション最低1行確保
    const empty = { name: '', timeStr: '', timeEnd: '' };
    if (admins.length === 0) admins.push(empty);
    if (supervisors.length === 0) supervisors.push(empty);
    if (workers.length === 0) workers.push(empty);
    // 児童指導員・保育士は最低4行に戻す
    while (workers.length < 4) workers.push(empty);
    if (assistants.length === 0) assistants.push(empty);

    let html = `<table class="staff-table">`;

    // 管理者セクション
    const adminRowspan = admins.length;
    html += `<tr><td class="role-cell"${adminRowspan > 1 ? ` rowspan="${adminRowspan}"` : ''}>管理者</td>${staffRow(admins[0])}</tr>`;
    for (let i = 1; i < admins.length; i++) {
        html += `<tr>${staffRow(admins[i])}</tr>`;
    }

    // 児発管セクション
    const superRowspan = supervisors.length;
    html += `<tr><td class="role-cell"${superRowspan > 1 ? ` rowspan="${superRowspan}"` : ''}>児発管</td>${staffRow(supervisors[0])}</tr>`;
    for (let i = 1; i < supervisors.length; i++) {
        html += `<tr>${staffRow(supervisors[i])}</tr>`;
    }

    // 児童指導員 / 保育士セクション
    const workerRowspan = workers.length;
    html += `<tr><td class="role-cell" rowspan="${workerRowspan}">児童指導員<br>保育士</td>${staffRow(workers[0])}</tr>`;
    for (let i = 1; i < workers.length; i++) {
        html += `<tr>${staffRow(workers[i])}</tr>`;
    }

    // 指導員セクション
    const assistRowspan = assistants.length;
    html += `<tr><td class="role-cell"${assistRowspan > 1 ? ` rowspan="${assistRowspan}"` : ''}>指導員</td>${staffRow(assistants[0])}</tr>`;
    for (let i = 1; i < assistants.length; i++) {
        html += `<tr>${staffRow(assistants[i])}</tr>`;
    }

    html += `</table>`;
    return html;
}

/** メモからテキストを抽出するヘルパー */
export function extractStudyText(dailyMessages, childId) {
    const msgs = dailyMessages[childId] || [];
    return msgs.filter(m => {
        const hasStudyTag = m.tag && (m.tag === '【ツリー式学習】' || m.tag === '【学習】' || m.tag === '【宿題】' || m.tag === '【プリント】');
        const hasTextPrefix = m.text.includes('【ツリー式学習】') || m.text.includes('【学習】') || m.text.includes('【宿題】') || m.text.includes('【プリント】');
        return hasStudyTag || hasTextPrefix;
    })
    .map(m => {
        // 文章は非表示にし、タグのみを表示する
        if (m.tag) return m.tag;
        const match = m.text.match(/^【[^】]+】/);
        return match ? match[0] : '';
    }).filter(t => t).join('\n');
}

export function extractProgramText(dailyMessages, childId) {
    const msgs = dailyMessages[childId] || [];
    return msgs.filter(m => {
        const hasProgTag = m.tag && m.tag === '【プログラム】';
        const hasTextPrefix = m.text.includes('【プログラム】');
        return hasProgTag || hasTextPrefix;
    })
    .map(m => {
        // 文章は非表示にし、タグのみを表示する
        if (m.tag) return m.tag;
        const match = m.text.match(/^【[^】]+】/);
        return match ? match[0] : '';
    }).filter(t => t).join('\n');
}

export function extractNotesText(dailyMessages, dailyTable, childId) {
    const tableNotes = dailyTable[childId]?.notes || '';
    const msgs = dailyMessages[childId] || [];
    
    // 【備考】タグのメッセージを抽出
    const chatNotes = msgs.filter(m => {
        const hasNotesTag = m.tag && m.tag === '【備考】';
        const hasTextPrefix = m.text.includes('【備考】');
        return hasNotesTag || hasTextPrefix;
    })
    .map(m => {
        let t = m.text.trim();
        // m.text から 【備考】 プレフィックスを削除する
        // （タグの表示は不要のため）
        if (m.tag && t.startsWith(m.tag)) {
            t = t.substring(m.tag.length).trim();
        } else {
            t = t.replace(/^【備考】\s*/, '').trim();
        }
        return t;
    }).filter(t => t).join('\n');

    // 両方を結合
    const combined = [];
    if (tableNotes.trim()) combined.push(tableNotes.trim());
    if (chatNotes.trim()) combined.push(chatNotes.trim());
    
    return combined.join('\n');
}

// ── 共通スタイル ──────────────────────────────────────────────

const COMMON_STYLES = `
  @page { size: A4 landscape; margin: 10mm; }
  html, body {
    background-color: #ffffff !important;
    background-image: none !important;
    color: #000000 !important;
    color-scheme: light !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    width: 100%;
    margin: 0;
    padding: 0;
  }
  body { font-family: 'Hiragino Kaku Gothic Pro', 'Meiryo', sans-serif; font-size: 10pt; }

  .page-break { page-break-after: always; }
  .page-break:last-child { page-break-after: avoid; }

  .header-table { width: 277mm; border-collapse: collapse; margin-bottom: 0; table-layout: fixed; }
  .header-table td { border: 1px solid black; padding: 4px; vertical-align: top; }
  .title { font-size: 18pt; font-weight: bold; padding: 12px 0; border: none !important; }
  .date-cell { border: none !important; text-align: right; font-size: 12pt; font-weight: bold; }

  .staff-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .staff-table td { border: 1px solid black; padding: 2px 4px; height: 1.6em; text-align: center; font-size: 9pt; }
  .role-cell { width: 30%; background: #eee; font-weight: bold; font-size: 9pt; }
  .time-cell { width: 20%; font-size: 8.5pt; }
  .name-cell { width: 50%; }

  .notes-section { height: 70px; padding: 4px; font-size: 9.5pt; white-space: pre-wrap; word-break: break-all; }
  .highlight-section { height: 70px; padding: 4px; font-size: 9.5pt; word-break: break-all; }
  .section-label { background: #eee; font-weight: bold; text-align: center !important; font-size: 9.5pt; }

  .children-table { width: 277mm; border-collapse: collapse; margin-top: -1px; table-layout: fixed; }
  .children-table th, .children-table td { border: 1px solid black; padding: 3px 5px; vertical-align: middle; }
  .children-table th { background: #eee; font-size: 9.5pt; font-weight: bold; }
  .col-no { width: 3%; text-align: center; font-size: 9pt; }
  .col-name { width: 11%; font-size: 9pt; }
  .col-time { width: 5%; text-align: center; font-size: 8.5pt; }
  .col-loc { width: 6%; text-align: center; font-size: 8.5pt; }
  .col-study { width: 18%; font-size: 9pt; white-space: pre-wrap; word-break: break-all; }
  .col-prog { width: 17%; font-size: 9pt; white-space: pre-wrap; word-break: break-all; }
  .col-notes { width: 30%; font-size: 9pt; word-break: break-all; }
`;

export const GROUP1_ITEMS = [
    { id: 'g1_1', label: '①今月のプログラム計画' },
    { id: 'g1_2', label: '②来月以降のプログラム計画' },
    { id: 'g1_3', label: '③次回個別支援の計画' },
    { id: 'g1_4', label: '④個別支援記録' },
    { id: 'g1_5', label: '⑤環境整備業務（清掃等）' },
    { id: 'g1_6', label: '⑥プログラム準備' },
    { id: 'g1_7', label: '⑦業務管理日誌記録' },
    { id: 'g1_8', label: '⑧その他（雑務）' },
];

export const GROUP2_ITEMS = [
    { id: 'g2_1', label: '❶支援プログラムの充実化' },
    { id: 'g2_2', label: '❷支援ツールの充実化' },
    { id: 'g2_3', label: '❸業務知識の習得' },
    { id: 'g2_4', label: '❹業務改善' },
    { id: 'g2_5', label: '❺認知度の向上' },
    { id: 'g2_6', label: '❻吉根小学校の児童獲得' },
    { id: 'g2_7', label: '❼保護者の満足度の向上' },
    { id: 'g2_8', label: '❽業務マニュアルなどの作成' },
    { id: 'g2_9', label: '❾意識向上、理念理解など' },
    { id: 'g2_10', label: '❿その他' },
];

/** 1 日分のページ HTML を生成 */
export function buildDayPageHTML(dateStr, children, dailyTable, dailyMessages, globalLog, summaryC, attendance, staffList = []) {
    const staffTable = buildStaffTableHTML(attendance, globalLog, staffList);

    const activities = globalLog.activities || '';
    let activityItemsHTML = '';
    if (activities) {
        if (typeof activities === 'object') {
            const group1 = activities.group1 || [];
            const group2 = activities.group2 || [];
            const selectedLabels = [];
            GROUP1_ITEMS.forEach(item => { if (group1.includes(item.id)) selectedLabels.push(item.label); });
            GROUP2_ITEMS.forEach(item => { if (group2.includes(item.id)) selectedLabels.push(item.label); });
            activityItemsHTML = selectedLabels.join('<br>');
        } else if (activities.trim().startsWith('{')) {
            try {
                const parsed = JSON.parse(activities);
                const group1 = parsed.group1 || [];
                const group2 = parsed.group2 || [];
                const selectedLabels = [];
                GROUP1_ITEMS.forEach(item => { if (group1.includes(item.id)) selectedLabels.push(item.label); });
                GROUP2_ITEMS.forEach(item => { if (group2.includes(item.id)) selectedLabels.push(item.label); });
                activityItemsHTML = selectedLabels.join('<br>');
            } catch {
                activityItemsHTML = activities.replace(/\n/g, '<br>');
            }
        } else {
            activityItemsHTML = activities.replace(/\n/g, '<br>');
        }
    }
    if (!activityItemsHTML) {
        activityItemsHTML = '<span style="color:#aaa;font-style:italic;">（未登録）</span>';
    }

    let html = `
      <table class="header-table">
        <tr>
          <td class="title" colspan="2">業務管理日誌</td>
          <td class="date-cell" colspan="1">${dateStr}</td>
        </tr>
        <tr>
          <td style="width: 30%; padding: 0;">
            ${staffTable}
          </td>
          <td style="width: 50%;">
            <div class="section-label">【本日の特記事項】</div>
            <div class="notes-section">${globalLog.notice || summaryC || ''}</div>
          </td>
          <td style="width: 20%;">
            <div class="section-label">共有事項</div>
            <div class="highlight-section" style="line-height: 1.2;">
              ${activityItemsHTML}
            </div>
          </td>
        </tr>
      </table>

      <table class="children-table">
        <tr>
          <th class="col-no">No.</th>
          <th class="col-name">氏名</th>
          <th class="col-time">開始時間</th>
          <th class="col-time">終了時間</th>
          <th class="col-loc">迎え場所</th>
          <th class="col-time">送迎時間</th>
          <th class="col-study">学習</th>
          <th class="col-prog">プログラム</th>
          <th class="col-notes">備考</th>
        </tr>
    `;

    const displayRows = children.filter(c => !c.isPlaceholder);
    const maxRows = Math.max(10, displayRows.length);
    for (let i = 0; i < maxRows; i++) {
        if (i < displayRows.length) {
            const child = displayRows[i];
            const rowData = dailyTable[child.id] || {};
            html += `
            <tr>
              <td class="col-no">${i + 1}</td>
              <td class="col-name">${child.name}</td>
              <td class="col-time"></td>
              <td class="col-time">${rowData.endTime || ''}</td>
              <td class="col-loc">${rowData.pickupLocation || ''}</td>
              <td class="col-time">${rowData.transportTime || ''}</td>
              <td class="col-study">${extractStudyText(dailyMessages, child.id)}</td>
              <td class="col-prog">${extractProgramText(dailyMessages, child.id)}</td>
              <td class="col-notes">${extractNotesText(dailyMessages, dailyTable, child.id)}</td>
            </tr>`;
        } else {
            html += `
            <tr>
              <td class="col-no">${i + 1}</td>
              <td class="col-name"></td>
              <td class="col-time"></td>
              <td class="col-time"></td>
              <td class="col-loc"></td>
              <td class="col-time"></td>
              <td class="col-study"></td>
              <td class="col-prog"></td>
              <td class="col-notes"></td>
            </tr>`;
        }
    }

    html += `</table>`;
    return html;
}

// ── エクスポート関数 ──────────────────────────────────────────

export function printChildDocument(child, result, selectedDate) {
    const printWindow = window.open('', '_blank');
    const force = parseForceSheet(result.K_sheet || '');
    const printContent = `
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <title>${child.name} - 書類</title>
      <style>
        body { font-family: 'Hiragino Kaku Gothic Pro', 'Meiryo', sans-serif; padding: 20px; }
        .header { text-align: center; font-size: 20px; font-weight: bold; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 10px; }
        .section { margin-bottom: 30px; page-break-inside: avoid; }
        .section h3 { font-size: 16px; font-weight: bold; margin-bottom: 10px; border-bottom: 1px solid #333; padding-bottom: 5px; }
        .label { font-size: 12px; color: #666; margin-bottom: 5px; }
        .content { font-size: 14px; line-height: 1.8; white-space: pre-wrap; }
        @page { margin: 2cm; }
      </style>
    </head>
    <body>
      <div class="header">Tree Kids School - ${child.name} 様</div>
      <div class="section">
        <h3>専門的支援実施計画</h3>
        <div class="label">実施した支援の内容・結果</div>
        <div class="content">${result.B_result || '---'}</div>
        <div class="label" style="margin-top:15px">今後の支援の予定</div>
        <div class="content">${result.B_plan || '---'}</div>
        <div class="label" style="margin-top:15px">該当項目</div>
        <div class="content">${result.B_item || '---'}</div>
      </div>
      ${result.K_sheet ? `
      <div class="section">
        <h3>強行シート</h3>
        <div class="label">学習</div><div class="content">${force.learning || '該当なし'}</div>
        <div class="label" style="margin-top:15px">自由遊び</div><div class="content">${force.play || '該当なし'}</div>
        <div class="label" style="margin-top:15px">プログラム</div><div class="content">${force.program || '該当なし'}</div>
        <div class="label" style="margin-top:15px">おやつ</div><div class="content">${force.snack || '該当なし'}</div>
      </div>` : ''}
      <div style="margin-top:50px;text-align:right;font-size:12px">印刷日: ${new Date().toLocaleDateString('ja-JP')}</div>
    </body>
    </html>
  `;
    printWindow.document.write(printContent);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 250);
}

export function printAllDocuments(children, results, summaryC, selectedDate, dailyTable = {}, dailyMessages = {}, globalLog = {}, attendance = {}, staffList = []) {
    const printWindow = window.open('', '_blank', 'width=1200,height=800,resizable=yes,scrollbars=yes');
    const dateObj = new Date(selectedDate);
    const dateStr = `${dateObj.getFullYear()}年${dateObj.getMonth() + 1}月 ${dateObj.getDate()}日`;

    const pageHTML = buildDayPageHTML(dateStr, children, dailyTable, dailyMessages, globalLog, summaryC, attendance, staffList);

    const allContent = `
    <!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=1040"><title>業務管理日誌 - ${selectedDate}</title>
    <style>${COMMON_STYLES}</style></head><body>
      ${pageHTML}
    </body></html>`;

    printWindow.document.write(allContent);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 250);
}

export function printMonthlyDocuments(monthStr, monthlyData, staffList = []) {
    const printWindow = window.open('', '_blank', 'width=1200,height=800,resizable=yes,scrollbars=yes');

    let pagesHTML = '';

    monthlyData.forEach(({ date, data }, pageIndex) => {
        const children      = data.children || [];
        const summaryC      = data.summaryC || '';
        const dailyTable    = data.dailyTable || {};
        const dailyMessages = data.dailyMessages || data.messages || {};
        const globalLog     = data.globalLog || {};
        const attendance    = data.attendance || {};

        const dateObj = new Date(date);
        const dateStr = `${dateObj.getFullYear()}年${dateObj.getMonth() + 1}月 ${dateObj.getDate()}日`;

        const pageHTML = buildDayPageHTML(dateStr, children, dailyTable, dailyMessages, globalLog, summaryC, attendance, staffList);
        pagesHTML += `<div class="page-break">${pageHTML}</div>`;
    });

    const allContent = `
    <!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=1040"><title>月間業務管理日誌 - ${monthStr}</title>
    <style>${COMMON_STYLES}</style></head><body>
      ${pagesHTML}
    </body></html>`;

    printWindow.document.write(allContent);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 250);
}

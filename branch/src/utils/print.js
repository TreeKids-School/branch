import { parseForceSheet } from './parseForceSheet';

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

export function printAllDocuments(children, results, summaryC, selectedDate, dailyTable = {}, dailyMessages = {}, globalLog = {}) {
    const printWindow = window.open('', '_blank');
    const dateObj = new Date(selectedDate);
    const dateStr = `${dateObj.getFullYear()}年${dateObj.getMonth() + 1}月 ${dateObj.getDate()}日`;

    const getStudyText = (childId) => {
        const msgs = dailyMessages[childId] || [];
        return msgs.filter(m => m.text.includes('【ツリー式学習】') || m.text.includes('【学習】') || m.text.includes('【宿題】') || m.text.includes('【プリント】'))
            .map(m => m.text.trim()).filter(t => t).join('\n');
    };
    const getProgramText = (childId) => {
        const msgs = dailyMessages[childId] || [];
        return msgs.filter(m => m.text.includes('【プログラム】'))
            .map(m => m.text.trim()).filter(t => t).join('\n');
    };

    let allContent = `
    <!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><title>業務管理日誌 - ${selectedDate}</title>
    <style>
      @page { size: A4 landscape; margin: 10mm; }
      body { font-family: 'Hiragino Kaku Gothic Pro', 'Meiryo', sans-serif; font-size: 9pt; margin: 0; padding: 0; }
      .container { width: 100%; border-collapse: collapse; }
      .header-table { width: 100%; border-collapse: collapse; margin-bottom: 0; }
      .header-table td { border: 1px solid black; padding: 4px; vertical-align: top; }
      .title { font-size: 16pt; font-weight: bold; padding: 10px 0; border: none !important; }
      .date-cell { border: none !important; text-align: right; font-size: 12pt; font-weight: bold; }
      
      .staff-table { width: 100%; border-collapse: collapse; }
      .staff-table td { border: 1px solid black; padding: 2px 5px; height: 1.5em; text-align: center; }
      .role-cell { width: 80px; background: #eee; font-weight: bold; font-size: 8pt; }
      .time-cell { width: 40px; font-size: 7pt; }
      .name-cell { width: 120px; }

      .notes-section { height: 100px; padding: 5px; font-size: 8pt; white-space: pre-wrap; }
      .highlight-section { height: 100px; padding: 5px; font-size: 7pt; }
      .section-label { background: #eee; font-weight: bold; text-align: center !important; }

      .children-table { width: 100%; border-collapse: collapse; margin-top: -1px; }
      .children-table th, .children-table td { border: 1px solid black; padding: 3px 5px; vertical-align: middle; }
      .children-table th { background: #eee; font-size: 8pt; font-weight: bold; }
      .col-no { width: 30px; text-align: center; }
      .col-name { width: 120px; }
      .col-time { width: 45px; text-align: center; font-size: 7.5pt; }
      .col-loc { width: 60px; text-align: center; font-size: 7.5pt; }
      .col-study { width: 180px; font-size: 7.5pt; white-space: pre-wrap; }
      .col-prog { width: 130px; font-size: 7.5pt; white-space: pre-wrap; }
      .col-notes { font-size: 7.5pt; }
      
      .sub-head { background: #f9f9f9; text-align: center; font-weight: bold; font-size: 10pt; }
    </style></head><body>
      <table class="header-table">
        <tr>
          <td class="title" colspan="2">業務管理日誌</td>
          <td class="date-cell" colspan="1">${dateStr}</td>
        </tr>
        <tr>
          <td style="width: 250px; padding: 0;">
            <table class="staff-table">
              <tr><td class="role-cell">管理者</td><td class="name-cell">${globalLog.admin || ''}</td><td class="time-cell">9:30</td><td class="time-cell">18:30</td></tr>
              <tr><td class="role-cell">児発管</td><td class="name-cell">${globalLog.supervisor || ''}</td><td class="time-cell">9:30</td><td class="time-cell">18:30</td></tr>
              <tr><td class="role-cell" rowspan="4">児童指導員<br>保育士</td><td class="name-cell"></td><td class="time-cell">9:30</td><td class="time-cell">18:30</td></tr>
              <tr><td class="name-cell"></td><td class="time-cell">9:30</td><td class="time-cell">18:30</td></tr>
              <tr><td class="name-cell"></td><td class="time-cell">9:30</td><td class="time-cell">18:30</td></tr>
              <tr><td class="name-cell"></td><td class="time-cell">9:30</td><td class="time-cell">18:30</td></tr>
              <tr><td class="role-cell">指導員</td><td class="name-cell"></td><td class="time-cell">9:30</td><td class="time-cell">18:30</td></tr>
            </table>
          </td>
          <td>
            <div class="section-label">【全体的な様子、特記事項】</div>
            <div class="notes-section">${globalLog.notice || summaryC || ''}</div>
          </td>
          <td style="width: 200px;">
            <div class="section-label">業務・活動内容</div>
            <div class="highlight-section" style="line-height: 1.2;">
              ① 今月のプログラム計画<br>
              ② 来月以降のプログラム計画<br>
              ③ 次回個別支援の計画<br>
              ④ 個別支援記録<br>
              ⑤ 環境整備業務（清掃等）<br>
              ⑥ プログラム準備<br>
              ⑦ 業務管理日誌記録<br>
              ⑧ その他（雑務）
            </div>
          </td>
        </tr>
      </table>

      <table class="children-table">
        <tr><th colspan="9" class="sub-head">児発・放デイ</th></tr>
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

    // Add child rows
    const displayRows = children.filter(c => !c.isPlaceholder);
    displayRows.forEach((child, index) => {
        const rowData = dailyTable[child.id] || {};
        allContent += `
        <tr>
          <td class="col-no">${index + 1}</td>
          <td class="col-name">${child.name}</td>
          <td class="col-time"></td>
          <td class="col-time">${rowData.endTime || ''}</td>
          <td class="col-loc">${rowData.pickupLocation || ''}</td>
          <td class="col-time">${rowData.transportTime || ''}</td>
          <td class="col-study">${getStudyText(child.id)}</td>
          <td class="col-prog">${getProgramText(child.id)}</td>
          <td class="col-notes">${rowData.notes || ''}</td>
        </tr>
      `;
    });

    // Add empty rows to fill the table (up to 15 rows)
    for (let i = displayRows.length; i < 15; i++) {
        allContent += `
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
        </tr>
      `;
    }

    allContent += `</table></body></html>`;

    printWindow.document.write(allContent);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 250);
}

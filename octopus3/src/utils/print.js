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
        body { font-family: 'MS Gothic', monospace; padding: 20px; }
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
      <div class="section">
        <h3>ツリー通信</h3>
        <div class="content">${result.D || '---'}</div>
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

export function printAllDocuments(children, results, summaryC, selectedDate) {
    const childrenWithResults = children.filter(c => results[c.id]);
    if (childrenWithResults.length === 0) {
        alert('印刷する書類がありません。');
        return;
    }
    const printWindow = window.open('', '_blank');
    const dateStr = new Date(selectedDate).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });

    let allContent = `
    <!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><title>日報 - ${selectedDate}</title>
    <style>
      body { font-family: 'MS Gothic', monospace; padding: 20px; }
      .main-header { text-align: center; font-size: 22px; font-weight: bold; margin-bottom: 40px; border-bottom: 3px solid #000; padding-bottom: 15px; }
      .summary-section { margin-bottom: 50px; padding: 20px; border: 2px solid #333; page-break-inside: avoid; }
      .child-page { page-break-before: always; }
      .child-header { font-size: 18px; font-weight: bold; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
      .section { margin-bottom: 30px; page-break-inside: avoid; }
      .section h3 { font-size: 16px; font-weight: bold; margin-bottom: 10px; border-bottom: 1px solid #333; padding-bottom: 5px; }
      .label { font-size: 12px; color: #666; margin-bottom: 5px; }
      .content { font-size: 14px; line-height: 1.8; white-space: pre-wrap; }
      @page { margin: 2cm; }
    </style></head><body>
    <div class="main-header">Tree Kids School 日報<br>${dateStr}</div>
  `;

    if (summaryC) {
        allContent += `<div class="summary-section"><h2>全体の様子（反省）</h2><div class="content">${summaryC}</div></div>`;
    }

    childrenWithResults.forEach((child, index) => {
        const result = results[child.id] || {};
        const force = parseForceSheet(result.K_sheet || '');
        allContent += `
      <div class="${index > 0 || summaryC ? 'child-page' : ''}">
        <div class="child-header">${child.name} 様</div>
        <div class="section">
          <h3>専門的支援実施計画</h3>
          <div class="label">実施した支援の内容・結果</div><div class="content">${result.B_result || '---'}</div>
          <div class="label" style="margin-top:15px">今後の支援の予定</div><div class="content">${result.B_plan || '---'}</div>
          <div class="label" style="margin-top:15px">該当項目</div><div class="content">${result.B_item || '---'}</div>
        </div>
        <div class="section"><h3>ツリー通信</h3><div class="content">${result.D || '---'}</div></div>
        ${result.K_sheet ? `
        <div class="section"><h3>強行シート</h3>
          <div class="label">学習</div><div class="content">${force.learning || '該当なし'}</div>
          <div class="label" style="margin-top:15px">自由遊び</div><div class="content">${force.play || '該当なし'}</div>
          <div class="label" style="margin-top:15px">プログラム</div><div class="content">${force.program || '該当なし'}</div>
          <div class="label" style="margin-top:15px">おやつ</div><div class="content">${force.snack || '該当なし'}</div>
        </div>` : ''}
      </div>
    `;
    });

    allContent += `<div style="margin-top:50px;text-align:right;font-size:12px">印刷日: ${new Date().toLocaleDateString('ja-JP')}</div></body></html>`;
    printWindow.document.write(allContent);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 250);
}

import * as XLSX from 'xlsx';
import { parseForceSheet } from './parseForceSheet';

export function exportToCSV(children, results, selectedDate) {
    const childrenWithResults = children.filter(c => results[c.id]);
    if (childrenWithResults.length === 0) {
        alert('エクスポートするデータがありません。');
        return;
    }
    let csvContent = '\ufeff';
    csvContent += '"児童名","日付","支援内容・結果","今後の予定","該当項目","ツリー通信","強行_学習","強行_自由遊び","強行_プログラム","強行_おやつ"\n';
    childrenWithResults.forEach(child => {
        const result = results[child.id] || {};
        const force = parseForceSheet(result.K_sheet || '');
        const row = [
            child.name, selectedDate,
            result.B_result || '', result.B_plan || '', result.B_item || '',
            result.D || '',
            force.learning || '', force.play || '', force.program || '', force.snack || ''
        ].map(field => `"${(field || '').replace(/"/g, '""')}"`).join(',');
        csvContent += row + '\n';
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `書類一括出力_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

export function exportToExcel(children, results, summaryC, selectedDate) {
    const childrenWithResults = children.filter(c => results[c.id]);
    if (childrenWithResults.length === 0) {
        alert('エクスポートするデータがありません。');
        return;
    }
    const wb = XLSX.utils.book_new();

    // 専門的支援実施計画
    const planData = [
        ['専門的支援実施計画', '', '', ''],
        ['日付', selectedDate, '', ''],
        [],
        ['児童名', '実施した支援の内容・結果', '今後の支援の予定', '該当項目']
    ];
    childrenWithResults.forEach(child => {
        const result = results[child.id] || {};
        planData.push([child.name, result.B_result || '', result.B_plan || '', result.B_item || '']);
    });
    const planSheet = XLSX.utils.aoa_to_sheet(planData);
    planSheet['!cols'] = [{ wch: 15 }, { wch: 40 }, { wch: 25 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, planSheet, '専門的支援実施計画');

    // ツリー通信
    const commData = [['ツリー通信', ''], ['日付', selectedDate], [], ['児童名', '内容']];
    childrenWithResults.forEach(child => {
        commData.push([child.name, (results[child.id] || {}).D || '']);
    });
    const commSheet = XLSX.utils.aoa_to_sheet(commData);
    commSheet['!cols'] = [{ wch: 15 }, { wch: 80 }];
    XLSX.utils.book_append_sheet(wb, commSheet, 'ツリー通信');

    // 強行シート
    const forceRows = childrenWithResults.filter(c => (results[c.id] || {}).K_sheet);
    if (forceRows.length > 0) {
        const forceData = [['強行シート', '', '', '', ''], ['日付', selectedDate], [], ['児童名', '学習', '自由遊び', 'プログラム', 'おやつ']];
        forceRows.forEach(child => {
            const force = parseForceSheet((results[child.id] || {}).K_sheet || '');
            forceData.push([child.name, force.learning || '該当なし', force.play || '該当なし', force.program || '該当なし', force.snack || '該当なし']);
        });
        const forceSheet = XLSX.utils.aoa_to_sheet(forceData);
        forceSheet['!cols'] = [{ wch: 15 }, { wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 30 }];
        XLSX.utils.book_append_sheet(wb, forceSheet, '強行シート');
    }

    // 全体の様子
    if (summaryC) {
        const summaryData = [['全体の様子（反省）'], ['日付', selectedDate], [], ['内容'], [summaryC]];
        const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
        summarySheet['!cols'] = [{ wch: 100 }];
        XLSX.utils.book_append_sheet(wb, summarySheet, '全体の様子');
    }

    XLSX.writeFile(wb, `日報_${selectedDate}.xlsx`);
}

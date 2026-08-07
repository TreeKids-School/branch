import React from 'react';
import { buildDayPageHTML } from '../utils/print';

// 印刷用CSSからWeb画面用に微調整したプレビュー用CSS
const PREVIEW_STYLES = `
  .print-preview-container {
    background: #3a3b3c;
    padding: 40px 20px;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    position: fixed;
    inset: 0;
    z-index: 150;
    overflow-y: auto;
  }
  .print-preview-paper {
    background: white;
    width: 297mm;
    min-height: 210mm;
    padding: 10mm;
    box-shadow: 0 15px 35px rgba(0,0,0,0.4);
    box-sizing: border-box;
    font-family: 'Hiragino Kaku Gothic Pro', 'Meiryo', sans-serif;
    font-size: 10pt;
    color: black;
    position: relative;
    border-radius: 4px;
    text-align: left;
  }
  .print-preview-paper .header-table { width: 277mm; border-collapse: collapse; margin-bottom: 0; table-layout: fixed; }
  .print-preview-paper .header-table td { border: 1px solid black; padding: 4px; vertical-align: top; }
  .print-preview-paper .title { font-size: 18pt; font-weight: bold; padding: 12px 0; border: none !important; }
  .print-preview-paper .date-cell { border: none !important; text-align: right; font-size: 12pt; font-weight: bold; }

  .print-preview-paper .staff-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .print-preview-paper .staff-table td { border: 1px solid black; padding: 2px 4px; height: 1.6em; text-align: center; color: black; font-size: 9pt; }
  .print-preview-paper .role-cell { width: 30%; background: #eee; font-weight: bold; font-size: 9pt; }
  .print-preview-paper .time-cell { width: 20%; font-size: 8.5pt; }
  .print-preview-paper .name-cell { width: 50%; }

  .print-preview-paper .notes-section { height: 70px; padding: 4px; font-size: 9.5pt; white-space: pre-wrap; word-break: break-all; text-align: left; }
  .print-preview-paper .highlight-section { height: 70px; padding: 4px; font-size: 9.5pt; line-height: 1.2; text-align: left; }
  .print-preview-paper .section-label { background: #eee; font-weight: bold; text-align: center !important; font-size: 9.5pt; }

  .print-preview-paper .children-table { width: 277mm; border-collapse: collapse; margin-top: -1px; table-layout: fixed; }
  .print-preview-paper .children-table th, .print-preview-paper .children-table td { border: 1px solid black; padding: 3px 5px; vertical-align: middle; color: black; }
  .print-preview-paper .children-table th { background: #eee; font-size: 9.5pt; font-weight: bold; }
  .print-preview-paper .col-no { width: 3%; text-align: center; font-size: 9pt; }
  .print-preview-paper .col-name { width: 11%; font-size: 9pt; }
  .print-preview-paper .col-time { width: 5%; text-align: center; font-size: 8.5pt; }
  .print-preview-paper .col-loc { width: 6%; text-align: center; font-size: 8.5pt; }
  .print-preview-paper .col-study { width: 18%; font-size: 9pt; white-space: pre-wrap; word-break: break-all; text-align: left; }
  .print-preview-paper .col-prog { width: 17%; font-size: 9pt; white-space: pre-wrap; word-break: break-all; text-align: left; }
  .print-preview-paper .col-notes { width: 30%; font-size: 9pt; word-break: break-all; text-align: left; }

  .print-preview-paper .sub-head { background: #f9f9f9; text-align: center; font-weight: bold; font-size: 10pt; }
`;

export function PrintPreview({
    selectedDate,
    children,
    dailyTable,
    dailyMessages,
    globalLog,
    summaryC,
    attendance,
    staffList = [],
    onClose,
    onPrint
}) {
    const dateObj = new Date(selectedDate);
    const dateStr = `${dateObj.getFullYear()}年${dateObj.getMonth() + 1}月 ${dateObj.getDate()}日`;

    const pageHTML = buildDayPageHTML(
        dateStr,
        children,
        dailyTable,
        dailyMessages,
        globalLog,
        summaryC,
        attendance,
        staffList
    );

    return (
        <div className="print-preview-container no-print">
            <style>{PREVIEW_STYLES}</style>
            
            {/* 上部ツールバー */}
            <div className="w-[297mm] max-w-full flex justify-between items-center mb-6 bg-slate-900/90 px-6 py-4 rounded-3xl border border-slate-700 shadow-xl text-white">
                <div className="flex items-center gap-3">
                    <span className="font-black text-base">日誌レイアウト プレビュー</span>
                    <span className="text-[10px] bg-slate-700 px-2.5 py-1 rounded-full font-bold">A4横長イメージ</span>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={onPrint}
                        className="px-5 py-2 bg-wood-600 hover:bg-wood-700 text-white rounded-full font-black text-xs shadow-md transition-all active:scale-95 flex items-center gap-2"
                    >
                        <span>このまま印刷</span>
                    </button>
                    <button
                        onClick={onClose}
                        className="px-5 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-full font-black text-xs transition-all active:scale-95"
                    >
                        閉じる（入力画面に戻る）
                    </button>
                </div>
            </div>

            {/* A4プレビュー用紙本体 */}
            <div className="print-preview-paper scale-[0.6] sm:scale-[0.75] md:scale-[0.85] lg:scale-[0.95] xl:scale-100 origin-top transition-transform mb-12">
                <div dangerouslySetInnerHTML={{ __html: pageHTML }} />
            </div>
        </div>
    );
}

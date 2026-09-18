import fs from 'fs';
let c = fs.readFileSync('src/components/MemoPanel.jsx', 'utf8');

const startMarker = `                    {/* Chat Memo Reference Section (Collapsible) */}`;
// End just before {hasConflict
const endMarker = `                                })()}\n                                                                {hasConflict`;

const startIdx = c.indexOf(startMarker);
const endIdx = c.indexOf(endMarker, startIdx);

if (startIdx === -1) { console.log('Start not found'); process.exit(1); }
if (endIdx === -1) { console.log('End not found'); process.exit(1); }

const afterEnd = endIdx + `                                })()}`.length + 1;  // keep just up to end of })()}

const newSection = `                    {/* === 3-Button Toolbar === */}
                    <div className="border-b border-slate-200 bg-white flex-shrink-0">
                        {/* Popover: チャットメモ */}
                        {activeToolbarMenu === 'memo' && (
                            <div className="max-h-[200px] overflow-y-auto bg-white p-2 border-b border-slate-200 flex flex-col gap-1.5 custom-scrollbar animate-in slide-in-from-top-2 duration-200">
                                <div className="flex justify-between items-center px-2 py-1 text-[9px] font-black text-slate-400 uppercase">
                                    <span>挿入するチャットメモを選択</span>
                                    <button onClick={() => setActiveToolbarMenu(null)} className="text-slate-500 hover:text-slate-800">閉じる</button>
                                </div>
                                {messages.length === 0 ? (
                                    <p className="text-center py-4 text-xs text-slate-400">チャットメモがありません</p>
                                ) : (
                                    messages.map((m, idx) => {
                                        let cleanedText = m.text.trim();
                                        for (const tag of tags) {
                                            if (cleanedText.startsWith(tag)) {
                                                cleanedText = cleanedText.substring(tag.length).trim();
                                                break;
                                            }
                                        }
                                        cleanedText = cleanedText.replace(/^(?:【[^】]+】|\\[[^\\]]+\\])\\s*/, '');
                                        return (
                                            <button
                                                key={m.id || idx}
                                                onClick={() => { insertTextAtCursor(cleanedText); setActiveToolbarMenu(null); }}
                                                className="text-left p-2 hover:bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-700 truncate active:scale-95 transition-all"
                                            >
                                                {m.tag && <span className="text-[9px] bg-red-50 text-red-600 px-1 rounded mr-1">{m.tag}</span>}
                                                {cleanedText}
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        )}

                        {/* Popover: プログラム */}
                        {activeToolbarMenu === 'program' && (
                            <div className="max-h-[200px] overflow-y-auto bg-white p-2 border-b border-slate-200 flex flex-col gap-1.5 custom-scrollbar animate-in slide-in-from-top-2 duration-200">
                                <div className="flex justify-between items-center px-2 py-1 text-[9px] font-black text-slate-400 uppercase">
                                    <span>挿入するプログラムを選択</span>
                                    <button onClick={() => setActiveToolbarMenu(null)} className="text-slate-500 hover:text-slate-800">閉じる</button>
                                </div>
                                {(() => {
                                    const programsList = (programs && programs.length > 0)
                                        ? programs
                                        : (programTitle || programSummary ? [{ title: programTitle, summary: programSummary }] : []);
                                    const validProgs = programsList.filter(p => p.title || p.summary);
                                    return validProgs.length === 0 ? (
                                        <p className="text-center py-4 text-xs text-slate-400">プログラムが登録されていません</p>
                                    ) : validProgs.map((prog, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => {
                                                const textToInsert = (prog.title && prog.summary) ? \`\${prog.title}：\${prog.summary}\` : prog.title || prog.summary || '';
                                                insertTextAtCursor(textToInsert);
                                                setActiveToolbarMenu(null);
                                            }}
                                            className="text-left p-2 hover:bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-700 active:scale-95 transition-all"
                                        >
                                            {prog.title && <span className="font-black text-wood-700">{prog.title}</span>}
                                            {prog.summary && <span className="text-slate-500 ml-1 text-[10px]">{prog.summary}</span>}
                                        </button>
                                    ));
                                })()}
                            </div>
                        )}

                        {/* Popover: 挨拶テンプレ */}
                        {activeToolbarMenu === 'template' && (
                            <div className="bg-white p-2 border-b border-slate-200 flex flex-col gap-2 animate-in slide-in-from-top-2 duration-200">
                                <div className="flex justify-between items-center px-2 py-1 text-[9px] font-black text-slate-400 uppercase">
                                    <span>{currentStaffName} の挨拶テンプレ</span>
                                    <button onClick={() => setActiveToolbarMenu(null)} className="text-slate-500 hover:text-slate-800">閉じる</button>
                                </div>
                                {isEditingTemplate ? (
                                    <>
                                        <textarea
                                            value={templateDraft}
                                            onChange={(e) => setTemplateDraft(e.target.value)}
                                            placeholder="お疲れ様です。ツリーキッズの〇〇です。等..."
                                            rows={3}
                                            className="w-full p-2 text-xs bg-white border border-slate-200 rounded-lg focus:border-tree-400 outline-none leading-normal font-medium text-slate-700 resize-y"
                                        />
                                        <div className="flex justify-end gap-1.5">
                                            <button type="button" onClick={() => setIsEditingTemplate(false)} className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-[9px] font-black transition-all active:scale-95">キャンセル</button>
                                            <button type="button" onClick={handleSaveTemplateClick} className="px-2.5 py-1 bg-tree-600 hover:bg-tree-700 text-white rounded-lg text-[9px] font-black transition-all active:scale-95 shadow-sm">保存</button>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex gap-2">
                                        <button type="button" onClick={() => { handleInsertTemplate(); setActiveToolbarMenu(null); }} className="flex-1 py-2 bg-tree-600 hover:bg-tree-700 text-white rounded-xl text-xs font-black shadow-sm transition-all active:scale-95 flex items-center justify-center gap-1">
                                            <Sparkles className="w-3.5 h-3.5" /><span>テンプレを挿入</span>
                                        </button>
                                        <button type="button" onClick={handleStartEditTemplate} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-black shadow-sm transition-all active:scale-95 flex items-center gap-1">
                                            <Settings className="w-3.5 h-3.5" /><span>編集</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Main 3 Buttons */}
                        <div className="flex items-center p-2 gap-2">
                            <button type="button" onClick={() => setActiveToolbarMenu(prev => prev === 'memo' ? null : 'memo')} className={\`flex-1 py-2 rounded-xl text-xs font-black shadow-sm border transition-all active:scale-95 flex items-center justify-center gap-1 \${activeToolbarMenu === 'memo' ? 'bg-red-500 text-white border-red-600' : 'bg-white text-red-600 border-red-200'}\`}>
                                <MessageSquare className="w-3.5 h-3.5" /><span>チャットメモ</span>
                            </button>
                            <button type="button" onClick={() => setActiveToolbarMenu(prev => prev === 'program' ? null : 'program')} className={\`flex-1 py-2 rounded-xl text-xs font-black shadow-sm border transition-all active:scale-95 flex items-center justify-center gap-1 \${activeToolbarMenu === 'program' ? 'bg-wood-500 text-white border-wood-600' : 'bg-white text-wood-700 border-wood-200'}\`}>
                                <FileText className="w-3.5 h-3.5" /><span>プログラム</span>
                            </button>
                            <button type="button" onClick={() => setActiveToolbarMenu(prev => prev === 'template' ? null : 'template')} className={\`flex-1 py-2 rounded-xl text-xs font-black shadow-sm border transition-all active:scale-95 flex items-center justify-center gap-1 \${activeToolbarMenu === 'template' ? 'bg-tree-600 text-white border-tree-700' : 'bg-white text-tree-600 border-tree-200'}\`}>
                                <Sparkles className="w-3.5 h-3.5" /><span>挨拶テンプレ</span>
                            </button>
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <div className="p-3 md:p-4 flex-1 flex flex-col gap-2 justify-between">
                        <div className="space-y-2 flex-1 flex flex-col">
                            <div className="space-y-1 flex-1 flex flex-col">
                                <div className="flex items-center justify-end gap-1.5 mb-1">
                                    {currentStaffName && (
                                        <span className="text-[9px] font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200/50">
                                            編集者: {currentStaffName}
                                        </span>
                                    )}
                                    {result?.staffName && (
                                        <span className="text-[9px] font-black text-tree-600 bg-tree-50 px-2 py-0.5 rounded-full border border-tree-100/50 shadow-sm">
                                            最終編集: {result.staffName}
                                        </span>
                                    )}
                                </div>
                                `;

const result = c.substring(0, startIdx) + newSection + c.substring(afterEnd);
fs.writeFileSync('src/components/MemoPanel.jsx', result);
console.log('Done. Lines:', result.split('\n').length);

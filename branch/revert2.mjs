import fs from 'fs';

let c = fs.readFileSync('src/components/MemoPanel.jsx', 'utf8');

// Find the toolbar block. It starts at {/* Mobile Keyboard Toolbar */}
// It ends right before {/* Highlights Overlay Layer */}
const startIdx = c.indexOf('{/* Mobile Keyboard Toolbar */}');
const endIdx = c.indexOf('{/* Highlights Overlay Layer */}');

if (startIdx !== -1 && endIdx !== -1) {
    let toolbarBlock = c.substring(startIdx, endIdx).trim();
    
    // Remove the toolbar from the current position
    c = c.substring(0, startIdx) + '                                    {/* Highlights Overlay Layer */}' + c.substring(endIdx + '{/* Highlights Overlay Layer */}'.length);
    
    // Change classes back
    toolbarBlock = toolbarBlock.replace('md:hidden bg-slate-50 border-2 border-slate-200 rounded-xl shadow-sm flex flex-col mb-3 overflow-hidden', 'md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-100 border-t border-slate-200 shadow-lg flex flex-col');
    toolbarBlock = toolbarBlock.replace('{isTree && (', '{isTree && isFocused && (');
    
    // Insert at the end of the file before the final closing div
    const endMarker = '        </div>\n    );\n}';
    c = c.replace(endMarker, toolbarBlock + '\n' + endMarker);
    
    // Add padding-bottom to the scroll container when isFocused is true
    c = c.replace('<div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">', '<div className={`flex-1 overflow-y-auto custom-scrollbar flex flex-col ${isFocused ? \'pb-[180px]\' : \'\'}`}>');
    
    fs.writeFileSync('src/components/MemoPanel.jsx', c);
    console.log('Success');
} else {
    console.log('Failed to find indices');
}

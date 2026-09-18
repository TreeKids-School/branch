import fs from 'fs';

let c = fs.readFileSync('src/components/MemoPanel.jsx', 'utf8');

// Find the toolbar block which is currently right before {/* Highlights Overlay Layer */}
const extractRegex = /\{\/\*\s*Mobile Keyboard Toolbar\s*\*\/\}(.|\n)*?<\/div>\s*\}\s*\{\/\*\s*Highlights Overlay Layer\s*\*\/\}/;
const match = c.match(extractRegex);
if(match) {
    let toolbar = match[0].replace(/\s*\{\/\*\s*Highlights Overlay Layer\s*\*\/\}/, '');
    c = c.replace(match[0], '                                    {/* Highlights Overlay Layer */}');
    
    // Change toolbar class back to fixed
    toolbar = toolbar.replace('md:hidden bg-slate-50 border-2 border-slate-200 rounded-xl shadow-sm flex flex-col mb-3 overflow-hidden', 'md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-100 border-t border-slate-200 shadow-lg flex flex-col');
    toolbar = toolbar.replace('{isTree && (', '{isTree && isFocused && (');
    
    // Insert before closing div of the component
    const endMarker = '        </div>\n    );\n}';
    c = c.replace(endMarker, toolbar + '\n' + endMarker);
    
    // Now add padding to the scroll container when isFocused is true
    // Find: <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
    c = c.replace('<div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">', '<div className={`flex-1 overflow-y-auto custom-scrollbar flex flex-col ${isFocused ? \'pb-48\' : \'\'}`}>');
    
    fs.writeFileSync('src/components/MemoPanel.jsx', c);
    console.log('Reverted toolbar and added padding.');
} else {
    console.log('Failed to extract toolbar.');
}

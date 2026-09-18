import fs from 'fs';

let c = fs.readFileSync('src/components/MemoPanel.jsx', 'utf8');

const marker1 = '{/* Mobile Keyboard Toolbar */}';
const marker2 = '    );\n}\n';

const idx1 = c.indexOf(marker1);
const idx2 = c.lastIndexOf(marker2);

if (idx1 !== -1 && idx2 !== -1 && idx2 > idx1) {
    // The toolbar block is from idx1 up to the closing tags
    const blockEndIndex = c.lastIndexOf('            )}', idx2) + 14;
    let toolbarBlock = c.substring(idx1, blockEndIndex);
    
    // Remove it from the original place
    c = c.substring(0, idx1).trimEnd() + '\n        </div>\n' + c.substring(blockEndIndex).trimStart();
    
    // Clean up the toolbar block 
    // Change wrapper style to not be fixed, but inline above the keyboard by placing it before textarea
    toolbarBlock = toolbarBlock.replace(
        '<div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-100 border-t border-slate-200 shadow-lg flex flex-col">',
        '<div className="md:hidden bg-slate-50 border-2 border-slate-200 rounded-xl shadow-sm flex flex-col mb-3 overflow-hidden">'
    );
    // Remove " && isFocused" to make it always visible or let's keep it but it will just be static. Actually, let's keep it.
    toolbarBlock = toolbarBlock.replace('{isTree && isFocused && (', '{isTree && (');

    // Insert it before the textarea block
    const insertMarker = '{/* Highlights Overlay Layer */}';
    c = c.replace(insertMarker, toolbarBlock + '\n                                    ' + insertMarker);

    fs.writeFileSync('src/components/MemoPanel.jsx', c);
    console.log('Successfully moved toolbar.');
} else {
    console.log('Failed to find indices.', {idx1, idx2});
}

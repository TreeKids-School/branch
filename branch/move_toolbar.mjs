import fs from 'fs';

let c = fs.readFileSync('src/components/MemoPanel.jsx', 'utf8');

// 1. Extract the Mobile Keyboard Toolbar
const toolbarStartMarker = '{/* Mobile Keyboard Toolbar */}';
const toolbarStartIndex = c.indexOf(toolbarStartMarker);

if (toolbarStartIndex !== -1) {
    // Find the end of the block: it's the last closing div of the toolbar block before the main closing div of MemoPanel
    // The toolbar block looks like:
    // {/* Mobile Keyboard Toolbar */}
    // {isTree && isFocused && ( ... )}
    // </div>
    // );
    
    // Let's use regex to extract and remove it
    const regex = /\{\/\*\s*Mobile Keyboard Toolbar\s*\*\/\}\s*\{isTree && isFocused && \([\s\S]*?\}\s*\)\}\s*<\/div>\s*\)\;\s*\}\s*$/;
    const match = c.match(regex);
    if (match) {
        let toolbarCode = match[0];
        
        // Remove it from the end
        c = c.replace(regex, '</div>\n    );\n}\n');
        
        // Clean up the toolbarCode to remove the trailing </div>\n);\n} parts that belong to the outer component
        toolbarCode = toolbarCode.replace(/<\/div>\s*\)\;\s*\}\s*$/, '');
        
        // Change the wrapper div of the toolbar to not be fixed, but a regular inline block
        toolbarCode = toolbarCode.replace(
            /<div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-100 border-t border-slate-200 shadow-lg flex flex-col">/,
            '<div className="md:hidden bg-white border-2 border-slate-200 rounded-xl shadow-sm flex flex-col mb-3 overflow-hidden animate-in fade-in duration-200">'
        );
        
        // Change the condition to just `isTree` or always true since we are placing it inside the isTree branch anyway
        toolbarCode = toolbarCode.replace(/\{isTree && isFocused && \(/, '{isTree && (');

        // Place the toolbar code right above the Highlights Overlay Layer / Actual Textarea
        const insertTarget = '{/* Highlights Overlay Layer */}';
        c = c.replace(insertTarget, toolbarCode + '\n                                    ' + insertTarget);
        
        fs.writeFileSync('src/components/MemoPanel.jsx', c);
        console.log('MemoPanel modified successfully.');
    } else {
        console.log('Toolbar regex match failed.');
    }
} else {
    console.log('Toolbar start marker not found.');
}

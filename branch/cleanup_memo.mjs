import fs from 'fs';
let c = fs.readFileSync('src/components/MemoPanel.jsx', 'utf8');

// Find the component closing brace position
const closingMarker = '        </div>\n    );\n}\n';
const idx = c.indexOf(closingMarker);
if (idx !== -1) {
    // Truncate everything after the component closing
    c = c.substring(0, idx + closingMarker.length);
    fs.writeFileSync('src/components/MemoPanel.jsx', c);
    console.log('Cleaned up. Total lines:', c.split('\n').length);
} else {
    console.log('Marker not found');
}

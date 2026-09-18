import fs from 'fs';
let c = fs.readFileSync('src/components/MemoPanel.jsx', 'utf8');

const startMarker = `                    {/* Chat Memo Reference Section (Collapsible) */}`;
const endMarker = `                                })()}\n                                                                {hasConflict`;

const startIdx = c.indexOf(startMarker);
const endIdx = c.indexOf(endMarker, startIdx);

if (startIdx === -1) { console.log('Start not found'); process.exit(1); }
if (endIdx === -1) { console.log('End not found'); process.exit(1); }

console.log('Found at:', startIdx, endIdx);
console.log('Snippet around end:');
console.log(JSON.stringify(c.substring(endIdx, endIdx + 50)));

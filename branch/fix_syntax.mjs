import fs from 'fs';

let c = fs.readFileSync('src/App.jsx', 'utf8');

c = c.replace(/onMouseLeave=\\{\(e\) => \{\s*if \(\!isPlaceholder\) cancelLongPress\(e, child\.id\);\s*\}\}\}\}\}/g, 'onMouseLeave={(e) => {\n                                                                        if (!isPlaceholder) cancelLongPress(e, child.id);\n                                                                    }}');

c = c.replace(/onMouseLeave=\\{\(e\) => cancelLongPress\(e, child\.id\)\}\}\}\}/g, 'onMouseLeave={(e) => cancelLongPress(e, child.id)}');

fs.writeFileSync('src/App.jsx', c);
console.log('Fixed syntax errors.');

import fs from 'fs';

let c = fs.readFileSync('src/App.jsx', 'utf8');

c = c.replace(/onMouseDown=\\{\(e\) => \{\s*if \(!isPlaceholder && !isLocked && !lockingChildId\) startLongPress\(e, child\.id, 'regular'\);\s*\}\}/g, `onTouchStart={(e) => {
                                                                        if (!isPlaceholder && !isLocked && !lockingChildId) startLongPress(e, child.id, 'regular');
                                                                    }}
                                                                    onTouchMove={(e) => {
                                                                        if (!isPlaceholder) cancelLongPress(e, child.id);
                                                                    }}
                                                                    onTouchEnd={(e) => {
                                                                        if (!isPlaceholder) cancelLongPress(e, child.id);
                                                                    }}
                                                                    onMouseDown={(e) => {
                                                                        if (!isPlaceholder && !isLocked && !lockingChildId) startLongPress(e, child.id, 'regular');
                                                                    }}`);

c = c.replace(/onMouseDown=\\{\(e\) => startLongPress\(e, child\.id, 'waitlist'\)\\}/g, `onTouchStart={(e) => startLongPress(e, child.id, 'waitlist')}
                                              onTouchMove={(e) => cancelLongPress(e, child.id)}
                                              onTouchEnd={(e) => cancelLongPress(e, child.id)}
                                              onMouseDown={(e) => startLongPress(e, child.id, 'waitlist')}`);

c = c.replace(/onMouseDown=\\{\(e\) => startLongPress\(e, child\.id, 'absent'\)\\}/g, `onTouchStart={(e) => startLongPress(e, child.id, 'absent')}
                                              onTouchMove={(e) => cancelLongPress(e, child.id)}
                                              onTouchEnd={(e) => cancelLongPress(e, child.id)}
                                              onMouseDown={(e) => startLongPress(e, child.id, 'absent')}`);

fs.writeFileSync('src/App.jsx', c);
console.log('Restored touch events.');

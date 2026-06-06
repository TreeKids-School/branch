// Check staff data in Firestore
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { readFileSync } from 'fs';

// Read firebase config from source
const srcContent = readFileSync('./src/firebase.js', 'utf-8');
const configMatch = srcContent.match(/const\s+firebaseConfig\s*=\s*(\{[\s\S]*?\});/);
if (!configMatch) { console.error('Could not find firebaseConfig'); process.exit(1); }
const firebaseConfig = eval('(' + configMatch[1] + ')');

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function main() {
    console.log('\n=== Staff Collection ===');
    let snap;
    try {
        snap = await getDocs(collection(db, 'staff'));
    } catch (e) {
        snap = await getDocs(collection(db, 'staffs'));
    }
    snap.docs.forEach(doc => {
        console.log(`  ID: ${doc.id}`, JSON.stringify(doc.data()));
    });
    
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });

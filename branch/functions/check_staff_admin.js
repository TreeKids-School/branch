const admin = require('firebase-admin');

admin.initializeApp({
  projectId: 'octopus2-ae965'
});

const db = admin.firestore();

async function main() {
  console.log('=== Staff List ===');
  let snap;
  try {
    snap = await db.collection('staff').get();
    console.log('Read from "staff" collection success:', snap.size);
  } catch (e) {
    console.error('Failed to read from "staff":', e.message);
    try {
      snap = await db.collection('staffs').get();
      console.log('Read from "staffs" collection success:', snap.size);
    } catch (e2) {
      console.error('Failed to read from "staffs":', e2.message);
      return;
    }
  }

  snap.forEach(doc => {
    console.log(`Doc ID: ${doc.id}`);
    console.log(JSON.stringify(doc.data(), null, 2));
  });
}

main().catch(console.error);

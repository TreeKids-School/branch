import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
    apiKey: "AIzaSyCY7R1DcN6pAmd5sa4XbVkFYPdeh33SW4U",
    authDomain: "octopus2-ae965.firebaseapp.com",
    databaseURL: "https://octopus2-ae965-default-rtdb.firebaseio.com",
    projectId: "octopus2-ae965",
    storageBucket: "octopus2-ae965.firebasestorage.app",
    messagingSenderId: "707672181406",
    appId: "1:707672181406:web:019558d5c266bce12b098f"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export default app;

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyAxlN4h0kEGv5CGw9YquaBAH5qr6A5h8Ow',
  authDomain: 'tracker-c1dde.firebaseapp.com',
  projectId: 'tracker-c1dde',
  storageBucket: 'tracker-c1dde.firebasestorage.app',
  messagingSenderId: '320165470314',
  appId: '1:320165470314:android:d30e72a86ea27ca90daa13',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function check() {
  console.log("Fetching users...");
  const users = await getDocs(collection(db, 'users'));
  users.forEach(doc => {
    console.log("User:", doc.id, "=>", doc.data().email);
  });

  console.log("\nFetching sessions...");
  const sessions = await getDocs(collection(db, 'trackingSessions'));
  sessions.forEach(doc => {
    const data = doc.data();
    console.log("Session:", doc.id);
    console.log("  tracker:", data.trackerId, data.trackerEmail);
    console.log("  target:", data.targetId, data.targetEmail);
    console.log("  status:", data.status);
  });
  
  process.exit(0);
}

check().catch(console.error);

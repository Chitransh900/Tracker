import { initializeApp } from 'firebase/app';
import { getFirestore, deleteDoc, doc } from 'firebase/firestore';

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

async function clean() {
  // Delete the ghost account that has no push token
  await deleteDoc(doc(db, 'users', '2C2tzymxpxTBKTa08J6475FztEP2'));
  // Delete the ghost session
  await deleteDoc(doc(db, 'trackingSessions', 'iRjKSNBqHoU7hrV4meBw'));
  console.log("Cleaned up ghost records!");
  process.exit(0);
}

clean().catch(console.error);

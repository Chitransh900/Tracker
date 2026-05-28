import { initializeApp } from 'firebase/app';
import { getFirestore, getDoc, doc } from 'firebase/firestore';

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
  const doc1 = await getDoc(doc(db, 'users', '2C2tzymxpxTBKTa08J6475FztEP2'));
  const doc2 = await getDoc(doc(db, 'users', 'BCVS4BJG13NmbiRVFJhzgGI9JAA3'));
  
  console.log("Doc 1:", doc1.data());
  console.log("Doc 2:", doc2.data());
  process.exit(0);
}

check().catch(console.error);

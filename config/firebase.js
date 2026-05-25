// Firebase Configuration
// =====================================================
// IMPORTANT: Replace the placeholder values below with
// your actual Firebase project configuration.
//
// To get your config:
// 1. Go to https://console.firebase.google.com
// 2. Create a new project (or use existing)
// 3. Click the gear icon → Project settings
// 4. Under "Your apps", click "Add app" → Web (</>)
// 5. Register the app and copy the config object
// 6. Enable Authentication (Email/Password + Google)
// 7. Create a Firestore database
// =====================================================

import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence, getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: 'AIzaSyAxlN4h0kEGv5CGw9YquaBAH5qr6A5h8Ow',
  authDomain: 'tracker-c1dde.firebaseapp.com',
  projectId: 'tracker-c1dde',
  storageBucket: 'tracker-c1dde.firebasestorage.app',
  messagingSenderId: '320165470314',
  appId: '1:320165470314:android:d30e72a86ea27ca90daa13',
};

import { Platform } from 'react-native';

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth conditionally based on platform
let auth;
if (Platform.OS === 'web') {
  auth = getAuth(app);
} else {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
}

// Initialize Firestore
const db = getFirestore(app);

export { app, auth, db };

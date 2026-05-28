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
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
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

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  sendEmailVerification,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        if (!firebaseUser.emailVerified) {
          setUser(null);
          setUserProfile(null);
          setLoading(false);
          return;
        }
        setUser(firebaseUser);
        // Fetch user profile from Firestore
        try {
          const profileDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (profileDoc.exists()) {
            setUserProfile(profileDoc.data());
          }
          
          // Register for Push Notifications
          if (Platform.OS !== 'web' && Device.isDevice) {
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;
            if (existingStatus !== 'granted') {
              const { status } = await Notifications.requestPermissionsAsync();
              finalStatus = status;
            }
            if (finalStatus === 'granted') {
              // Wait for token
              const projectId = Constants.expoConfig?.extra?.eas?.projectId || '61f51099-280f-4cb9-8007-10821dc8261b';
              const tokenData = await Notifications.getExpoPushTokenAsync({
                projectId
              }).catch(() => null);
              
              if (tokenData && tokenData.data) {
                await setDoc(doc(db, 'users', firebaseUser.uid), {
                  expoPushToken: tokenData.data
                }, { merge: true });
              }
            }
          }
        } catch (err) {
          console.warn('Failed to fetch user profile or push token:', err);
        }
      } else {
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Sign up with email & password
  const signUp = useCallback(async (email, password, displayName) => {
    setError(null);
    try {
      const { user: newUser } = await createUserWithEmailAndPassword(auth, email, password);
      
      // Update Firebase Auth profile
      await updateProfile(newUser, { displayName });
      
      // Create Firestore user document
      const profileData = {
        displayName,
        email,
        createdAt: serverTimestamp(),
        devices: [],
        role: null, // 'tracker' or 'target' — set during pairing
      };
      await setDoc(doc(db, 'users', newUser.uid), profileData);
      
      // Send verification email
      await sendEmailVerification(newUser);
      
      // Force sign out until verified
      await firebaseSignOut(auth);
      
      return newUser;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  // Sign in with email & password
  const signIn = useCallback(async (email, password) => {
    setError(null);
    try {
      const { user: existingUser } = await signInWithEmailAndPassword(auth, email, password);
      
      if (!existingUser.emailVerified) {
        await firebaseSignOut(auth);
        throw new Error('Please verify your email address before logging in. Check your inbox.');
      }
      
      return existingUser;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  // Sign out
  const signOut = useCallback(async () => {
    try {
      await firebaseSignOut(auth);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  // Clear error
  const clearError = useCallback(() => setError(null), []);

  const value = {
    user,
    userProfile,
    loading,
    error,
    signUp,
    signIn,
    signOut,
    clearError,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

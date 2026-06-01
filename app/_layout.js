import React, { useEffect, useState } from 'react';
import { View, Platform, StyleSheet, Dimensions } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../contexts/AuthContext';
import { Colors } from '../constants/colors';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { displayAlarmNotification, displayMessageNotification, setupChannels } from '../notifee-helper';

// =====================================================
// CRITICAL: Import the Notifee headless background handler
// This MUST happen before the React tree renders.
// It allows Notifee to handle notifications even when the
// app is fully killed / swiped away from recents.
// =====================================================
import '../notifee-background';

// =====================================================
// CRITICAL: Import LocationService to register the
// background location task (TaskManager.defineTask)
// This MUST be in the global scope so it runs in background.
// =====================================================
import '../services/LocationService';

const BACKGROUND_NOTIFICATION_TASK = 'BACKGROUND-NOTIFICATION-TASK';

// =====================================================
// Background Notification Task (Expo TaskManager)
// This runs when a push notification arrives and the app
// process is still alive in the background. It supplements
// the native notification that Android already shows.
// =====================================================
TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error('Background task error', error);
    return;
  }
  
  if (data && data.notification) {
    const payload = data.notification.request?.content?.data || data.notification.data;
    
    if (payload && payload.type === 'alarm') {
      await displayAlarmNotification();
    } else if (payload && payload.type === 'message') {
      const content = data.notification.request?.content || {};
      await displayMessageNotification(content.title, content.body);
    }
  }
});

if (Platform.OS !== 'web') {
  Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK).catch(console.warn);
}

export default function RootLayout() {
  const [isLargeScreen, setIsLargeScreen] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const checkScreen = () => setIsLargeScreen(window.innerWidth > 600);
      checkScreen();
      window.addEventListener('resize', checkScreen);
      return () => window.removeEventListener('resize', checkScreen);
    }
  }, []);

  // =====================================================
  // Foreground Notification Listener
  // When the app IS open and a push notification arrives,
  // this catches it and displays the Notifee alarm/message
  // so the user still sees the full-screen alarm overlay.
  // =====================================================
  useEffect(() => {
    if (Platform.OS === 'web') return;

    // Create alarm channel on app startup so it's ready
    // before any notification arrives
    setupChannels();

    // Listen for incoming notifications while the app is in the foreground
    const subscription = Notifications.addNotificationReceivedListener(async (notification) => {
      const data = notification.request?.content?.data;
      if (data?.type === 'alarm') {
        await displayAlarmNotification();
      }
      // Messages are handled by GlobalListener's Firestore listener when in foreground
    });

    return () => subscription.remove();
  }, []);

  const content = (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.background },
        animation: 'slide_from_right',
      }}
    />
  );

  if (Platform.OS === 'web') {
    return (
      <AuthProvider>
        <StatusBar style="light" backgroundColor={Colors.background} />
        <View style={styles.webContainer}>
          <View style={[styles.phoneFrame, isLargeScreen && styles.phoneFrameLarge]}>
            {content}
          </View>
        </View>
      </AuthProvider>
    );
  }

  return (
    <AuthProvider>
      <StatusBar style="light" backgroundColor={Colors.background} />
      {content}
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  webContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a', // Very dark background outside the phone
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneFrame: {
    flex: 1,
    width: '100%',
    backgroundColor: Colors.background,
    overflow: 'hidden',
  },
  phoneFrameLarge: {
    maxWidth: 400,
    maxHeight: 850,
    borderRadius: 40,
    borderWidth: 10,
    borderColor: '#111', // Looks like a physical phone bezel
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.8,
    shadowRadius: 30,
  }
});

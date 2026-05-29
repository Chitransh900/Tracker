import React, { useEffect, useState } from 'react';
import { View, Platform, StyleSheet, Dimensions } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../contexts/AuthContext';
import { Colors } from '../constants/colors';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import notifee, { AndroidImportance, AndroidCategory, AndroidVisibility } from '@notifee/react-native';

const BACKGROUND_NOTIFICATION_TASK = 'BACKGROUND-NOTIFICATION-TASK';

// Define the headless background task for push notifications
TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error('Background task error', error);
    return;
  }
  
  if (data && data.notification) {
    const payload = data.notification.request.content.data;
    
    if (payload && payload.type === 'alarm') {
      try {
        const channelId = await notifee.createChannel({
          id: 'alarm_full_screen',
          name: 'Critical Alarms',
          importance: AndroidImportance.HIGH,
          visibility: AndroidVisibility.PUBLIC,
          sound: 'default',
        });

        // Cancel previous alarms so Android allows the new one to pop up
        await notifee.cancelAllNotifications();

        await notifee.displayNotification({
          title: '🚨 PANIC ALARM TRIGGERED 🚨',
          body: 'Your tracker has activated the panic alarm!',
          android: {
            channelId,
            category: AndroidCategory.ALARM,
            fullScreenAction: {
              id: 'default',
            },
            importance: AndroidImportance.HIGH,
            visibility: AndroidVisibility.PUBLIC,
            pressAction: {
              id: 'default',
            },
          },
        });
      } catch (err) {
        console.error('Notifee background error:', err);
      }
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

import React, { useEffect, useState } from 'react';
import { View, Alert, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Audio } from 'expo-av';
import * as Notifications from 'expo-notifications';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../constants/colors';

// Ensure notifications show up when app is open
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function GlobalListener() {
  const { user } = useAuth();
  const [alarmSound, setAlarmSound] = useState(null);
  const [isAlarmPlaying, setIsAlarmPlaying] = useState(false);

  // Initialize Audio
  useEffect(() => {
    let soundObject = null;
    (async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          staysActiveInBackground: true,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
        const { sound } = await Audio.Sound.createAsync(
          { uri: 'https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg' },
          { shouldPlay: false, isLooping: true, volume: 1.0 }
        );
        soundObject = sound;
        setAlarmSound(sound);
      } catch (err) {
        console.warn('Failed to load alarm sound', err);
      }
    })();

    return () => {
      if (soundObject) {
        soundObject.unloadAsync();
      }
    };
  }, []);

  // Listen to Commands (Alarm)
  useEffect(() => {
    if (!user?.uid || !alarmSound) return;

    const q = query(
      collection(db, 'commands'),
      where('targetId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          const cmd = change.doc.data();
          if (cmd.command === 'ALARM' && cmd.createdAt) {
            // Only trigger if it's less than 30 seconds old
            if (Date.now() - cmd.createdAt.toMillis() < 30000) {
              try {
                setIsAlarmPlaying(true);
                await alarmSound.playAsync();
              } catch (err) {
                console.warn('Failed to play alarm', err);
              }
            }
          }
        }
      });
    });

    return unsubscribe;
  }, [user?.uid, alarmSound]);

  // Listen to Messages
  useEffect(() => {
    if (!user?.uid) return;

    const q = query(
      collection(db, 'messages'),
      where('receiverId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          const msg = change.doc.data();
          // Only notify for messages sent in the last 15 seconds
          if (msg.createdAt && (Date.now() - msg.createdAt.toMillis() < 15000)) {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: `New Message from ${msg.senderName}`,
                body: msg.text,
                sound: true,
              },
              trigger: null, // Send immediately
            });
          }
        }
      });
    });

    return unsubscribe;
  }, [user?.uid]);

  const stopAlarm = async () => {
    if (alarmSound) {
      await alarmSound.stopAsync();
      setIsAlarmPlaying(false);
    }
  };

  if (!isAlarmPlaying) return null;

  return (
    <View style={styles.alarmOverlay}>
      <View style={styles.alarmBox}>
        <Text style={styles.alarmTitle}>🚨 ALARM TRIGGERED 🚨</Text>
        <Text style={styles.alarmSubtitle}>Your tracker has activated the panic alarm.</Text>
        <TouchableOpacity style={styles.stopButton} onPress={stopAlarm}>
          <Text style={styles.stopText}>STOP ALARM</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  alarmOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alarmBox: {
    backgroundColor: Colors.surface,
    padding: 30,
    borderRadius: 20,
    alignItems: 'center',
    width: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
  },
  alarmTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.danger,
    marginBottom: 10,
    textAlign: 'center',
  },
  alarmSubtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: 30,
    textAlign: 'center',
  },
  stopButton: {
    backgroundColor: Colors.danger,
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 30,
  },
  stopText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

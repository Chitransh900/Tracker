import React, { useEffect, useState } from 'react';
import { View, Alert, TouchableOpacity, Text, StyleSheet, Platform, TextInput, KeyboardAvoidingView, Vibration } from 'react-native';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAudioPlayer } from 'expo-audio';
import * as Notifications from 'expo-notifications';
import { db } from '../config/firebase';

let VolumeManager = null;
try {
  VolumeManager = require('react-native-volume-manager').VolumeManager;
} catch (e) {
  console.log('VolumeManager not available (Expo Go / Web)');
}
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../constants/colors';

// Ensure notifications show up when app is open
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export default function GlobalListener() {
  const { user } = useAuth();
  // Initialize Audio
  const alarmSound = useAudioPlayer('https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg');
  const [isAlarmPlaying, setIsAlarmPlaying] = useState(false);
  const [previousVolume, setPreviousVolume] = useState(null);

  // Chat State
  const [incomingMessage, setIncomingMessage] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        // Request Notification Permissions (Native only)
        if (Platform.OS !== 'web') {
          const { status } = await Notifications.getPermissionsAsync();
          if (status !== 'granted') {
            await Notifications.requestPermissionsAsync();
          }

          if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('alarm-channel', {
              name: 'Alarm Notifications',
              importance: Notifications.AndroidImportance.MAX,
              vibrationPattern: [0, 250, 250, 250],
              lightColor: '#FF231F7C',
            });
          }
        }
        
        alarmSound.loop = true;
        alarmSound.volume = 1.0;

        // Force loop manually if native loop fails
        alarmSound.addListener('playbackStatusUpdate', (status) => {
          if (status.didJustFinish) {
            alarmSound.seekTo(0);
            alarmSound.play();
          }
        });
      } catch (err) {
        console.warn('Failed to configure audio/notifications', err);
      }
    })();
  }, [alarmSound]);

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
                
                // Force max hardware volume BEFORE playing the sound
                if (VolumeManager) {
                  try {
                    const res = await VolumeManager.getVolume();
                    if (res && typeof res.volume === 'number') {
                      setPreviousVolume(res.volume);
                    }
                    try {
                      // Some Android OEMs (like Samsung) silently ignore programmatic volume changes 
                      // unless the volume slider UI is explicitly requested to be shown on screen.
                      await VolumeManager.setVolume(1.0, { type: 'music', showUI: true });
                    } catch (e) {
                      console.log("Volume set error", e);
                    }
                  } catch (e) {
                    console.log("VolumeManager error", e);
                  }
                }
                
                // Vibrate continuously
                Vibration.vibrate([500, 1000, 500, 1000], true);
                
                // PLAY SOUND ONLY AFTER VOLUME IS SET
                alarmSound.play();
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
            // Show in-app chat modal
            setIncomingMessage({ ...msg, id: change.doc.id });
            
            // Still show push notification in case they are not looking at screen (Native only)
            if (Platform.OS !== 'web') {
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
        }
      });
    });

    return unsubscribe;
  }, [user?.uid]);

  const stopAlarm = async () => {
    if (alarmSound) {
      alarmSound.pause();
      setIsAlarmPlaying(false);
      Vibration.cancel();
      
      // Restore previous volume across all channels
      if (previousVolume !== null && VolumeManager) {
        VolumeManager.setVolume(previousVolume, { type: 'music', showUI: false }).catch(() => {});
        if (Platform.OS === 'android') {
          VolumeManager.setVolume(previousVolume, { type: 'alarm', showUI: false }).catch(() => {});
          VolumeManager.setVolume(previousVolume, { type: 'ring', showUI: false }).catch(() => {});
        }
        setPreviousVolume(null);
      }
    }
  };

  const handleReply = async () => {
    if (!replyText.trim() || !incomingMessage) return;
    setIsReplying(true);
    try {
      await addDoc(collection(db, 'messages'), {
        sessionId: incomingMessage.sessionId || null,
        senderId: user.uid,
        senderName: user.displayName || 'User',
        receiverId: incomingMessage.senderId, // send back to the tracker
        text: replyText.trim(),
        type: 'reply',
        read: false,
        createdAt: serverTimestamp(),
      });
      setReplyText('');
      setIncomingMessage(null);
    } catch (err) {
      Alert.alert('Error', 'Failed to send reply');
    } finally {
      setIsReplying(false);
    }
  };

  if (!isAlarmPlaying && !incomingMessage) return null;

  return (
    <>
      {/* Alarm Overlay */}
      {isAlarmPlaying && (
        <View style={styles.alarmOverlay}>
          <View style={styles.alarmBox}>
            <Text style={styles.alarmTitle}>🚨 ALARM TRIGGERED 🚨</Text>
            <Text style={styles.alarmSubtitle}>Your tracker has activated the panic alarm.</Text>
            <TouchableOpacity style={styles.stopButton} onPress={stopAlarm}>
              <Text style={styles.stopText}>STOP ALARM</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Incoming Message Chat Overlay */}
      {incomingMessage && !isAlarmPlaying && (
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={styles.chatOverlay}
        >
          <View style={styles.chatBox}>
            <View style={styles.chatHeader}>
              <Text style={styles.chatTitle}>Message from {incomingMessage.senderName}</Text>
              <TouchableOpacity onPress={() => setIncomingMessage(null)}>
                <Text style={styles.closeText}>Close</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.chatMessage}>{incomingMessage.text}</Text>
            <TextInput
              style={styles.replyInput}
              placeholder="Type your reply..."
              placeholderTextColor="#94A3B8"
              value={replyText}
              onChangeText={setReplyText}
              multiline
            />
            <TouchableOpacity 
              style={[styles.replyButton, isReplying && styles.disabledButton]} 
              onPress={handleReply}
              disabled={isReplying}
            >
              <Text style={styles.replyButtonText}>{isReplying ? 'Sending...' : 'Send Reply'}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </>
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
  chatOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    zIndex: 9998,
    justifyContent: 'flex-end', // slide up from bottom visually
  },
  chatBox: {
    backgroundColor: Colors.surface || '#18181B',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 20,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  chatTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.textPrimary || '#FAFAFA',
  },
  closeText: {
    fontSize: 14,
    color: Colors.textSecondary || '#A1A1AA',
    padding: 5,
  },
  chatMessage: {
    fontSize: 18,
    color: Colors.textPrimary || '#FAFAFA',
    marginBottom: 20,
    backgroundColor: Colors.primarySoft || 'rgba(16, 185, 129, 0.08)',
    padding: 15,
    borderRadius: 12,
    overflow: 'hidden',
  },
  replyInput: {
    backgroundColor: Colors.background || '#09090B',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    color: Colors.textPrimary || '#FAFAFA',
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 15,
    borderWidth: 1,
    borderColor: Colors.border || 'rgba(255,255,255,0.08)',
  },
  replyButton: {
    backgroundColor: Colors.primary || '#10B981',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.7,
  },
  replyButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

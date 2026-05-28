import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../config/firebase';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Colors } from '../../constants/colors';
import { Typography, Spacing, BorderRadius } from '../../constants/theme';

export default function SessionsScreen() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    if (!user) return;

    const sessionsRef = collection(db, 'trackingSessions');
    
    // We use two separate queries because Firestore 'or()' queries 
    // often fail silently if composite indexes aren't perfectly set up.
    const qTracker = query(sessionsRef, where('trackerId', '==', user.uid));
    const qTarget = query(sessionsRef, where('targetId', '==', user.uid));

    let trackerSessions = [];
    let targetSessions = [];

    const updateCombinedSessions = () => {
      // Map by ID to deduplicate (though they shouldn't overlap)
      const combinedMap = new Map();
      [...trackerSessions, ...targetSessions].forEach(s => combinedMap.set(s.id, s));
      
      const list = Array.from(combinedMap.values());
      // Sort: pending first, then active, then revoked
      list.sort((a, b) => {
        const order = { pending: 0, active: 1, revoked: 2 };
        return (order[a.status] || 3) - (order[b.status] || 3);
      });
      setSessions(list);
    };

    const unsubTracker = onSnapshot(qTracker, (snapshot) => {
      trackerSessions = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      updateCombinedSessions();
    }, (err) => console.error("Tracker query error:", err));

    const unsubTarget = onSnapshot(qTarget, (snapshot) => {
      targetSessions = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      updateCombinedSessions();
    }, (err) => console.error("Target query error:", err));

    return () => {
      unsubTracker();
      unsubTarget();
    };
  }, [user]);

  const handleAccept = async (sessionId) => {
    try {
      await updateDoc(doc(db, 'trackingSessions', sessionId), {
        status: 'active',
        consentGrantedAt: serverTimestamp(),
      });
    } catch (err) {
      Alert.alert('Error', 'Failed to accept invite');
    }
  };

  const handleRevoke = async (sessionId, isTracker) => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(
        isTracker
          ? 'Stop Tracking? You will no longer be able to see their location.'
          : 'Revoke Consent? They will no longer be able to see your location.'
      );
      if (confirmed) {
        try {
          await updateDoc(doc(db, 'trackingSessions', sessionId), { status: 'revoked' });
        } catch (err) {
          window.alert('Failed to update session');
        }
      }
      return;
    }

    Alert.alert(
      isTracker ? 'Stop Tracking?' : 'Revoke Consent?',
      isTracker
        ? 'You will no longer be able to see their location.'
        : 'They will no longer be able to see your location.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isTracker ? 'Stop' : 'Revoke',
          style: 'destructive',
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'trackingSessions', sessionId), {
                status: 'revoked',
              });
            } catch (err) {
              Alert.alert('Error', 'Failed to update session');
            }
          },
        },
      ]
    );
  };

  const handleDelete = async (sessionId) => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Delete Session? This cannot be undone.');
      if (confirmed) {
        try {
          await deleteDoc(doc(db, 'trackingSessions', sessionId));
        } catch (err) {
          window.alert('Failed to delete session');
        }
      }
      return;
    }

    Alert.alert('Delete Session?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDoc(doc(db, 'trackingSessions', sessionId));
          } catch (err) {
            Alert.alert('Error', 'Failed to delete session');
          }
        },
      },
    ]);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return Colors.success;
      case 'pending': return Colors.warning;
      case 'revoked': return Colors.danger;
      default: return Colors.textTertiary;
    }
  };

  const getStatusBg = (status) => {
    switch (status) {
      case 'active': return Colors.successSoft;
      case 'pending': return Colors.warningSoft;
      case 'revoked': return Colors.dangerSoft;
      default: return Colors.surface;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Tracking Sessions</Text>
        <Text style={styles.subtitle}>
          Manage who can track you and who you're tracking
        </Text>

        {sessions.length === 0 ? (
          <Card variant="glass" style={styles.emptyCard}>
            <Ionicons name="people-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No Sessions</Text>
            <Text style={styles.emptySubtitle}>
              Link a device to create your first tracking session
            </Text>
          </Card>
        ) : (
          sessions.map((session) => {
            const isTracker = session.trackerId === user?.uid;
            const isTarget = session.targetId === user?.uid;
            const isPending = session.status === 'pending';
            const isActive = session.status === 'active';

            return (
              <Card key={session.id} variant="glass" style={styles.sessionCard}>
                <View style={styles.sessionHeader}>
                  <View style={styles.sessionInfo}>
                    <View style={styles.nameRow}>
                      <Ionicons
                        name={isTracker ? 'eye' : 'radio'}
                        size={18}
                        color={isTracker ? Colors.primary : Colors.accent}
                        style={styles.roleIcon}
                      />
                      <Text style={styles.sessionName}>
                        {isTracker ? session.targetName : session.trackerName}
                      </Text>
                    </View>
                    <Text style={styles.sessionEmail}>
                      {isTracker ? session.targetEmail : session.trackerEmail}
                    </Text>
                    <Text style={styles.roleText}>
                      {isTracker ? 'You are tracking them' : 'They are tracking you'}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusBg(session.status) }]}>
                    <View style={[styles.statusDot, { backgroundColor: getStatusColor(session.status) }]} />
                    <Text style={[styles.statusText, { color: getStatusColor(session.status) }]}>
                      {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                    </Text>
                  </View>
                </View>

                <View style={styles.sessionActions}>
                  {/* Target can accept pending invites */}
                  {isTarget && isPending && (
                    <View style={styles.actionRow}>
                      <Button
                        title="Accept"
                        onPress={() => handleAccept(session.id)}
                        size="small"
                        style={styles.actionBtn}
                      />
                      <Button
                        title="Decline"
                        onPress={() => handleDelete(session.id)}
                        variant="danger"
                        size="small"
                        style={styles.actionBtn}
                      />
                    </View>
                  )}

                  {/* Active sessions can be revoked */}
                  {isActive && (
                    <Button
                      title={isTracker ? 'Stop Tracking' : 'Revoke Consent'}
                      onPress={() => handleRevoke(session.id, isTracker)}
                      variant="outline"
                      size="small"
                    />
                  )}

                  {/* Revoked sessions can be deleted */}
                  {session.status === 'revoked' && (
                    <Button
                      title="Delete"
                      onPress={() => handleDelete(session.id)}
                      variant="ghost"
                      size="small"
                    />
                  )}

                  {/* Tracker with pending can cancel */}
                  {isTracker && isPending && (
                    <Button
                      title="Cancel Invite"
                      onPress={() => handleDelete(session.id)}
                      variant="ghost"
                      size="small"
                    />
                  )}
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: Spacing.xl,
    paddingBottom: Spacing.massive,
  },
  title: {
    ...Typography.heading2,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.xxl,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
  },
  emptyTitle: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
    marginTop: Spacing.lg,
  },
  emptySubtitle: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  sessionCard: {
    marginBottom: Spacing.lg,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  sessionInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  roleIcon: {
    marginRight: Spacing.sm,
  },
  sessionName: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
  },
  sessionEmail: {
    ...Typography.small,
    color: Colors.textTertiary,
    marginTop: 2,
    marginLeft: 26,
  },
  roleText: {
    ...Typography.small,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    marginLeft: 26,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.full,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: Spacing.xs,
  },
  statusText: {
    ...Typography.smallMedium,
  },
  sessionActions: {
    marginTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.md,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  actionBtn: {
    flex: 1,
  },
});

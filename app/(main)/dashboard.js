import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, query, where, onSnapshot, or } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../config/firebase';
import Card from '../../components/ui/Card';
import { Colors, Gradients } from '../../constants/colors';
import { Typography, Spacing, BorderRadius } from '../../constants/theme';

export default function DashboardScreen() {
  const { user, userProfile, signOut } = useAuth();
  const router = useRouter();
  const [sessions, setSessions] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  // Listen to active tracking sessions
  useEffect(() => {
    if (!user) return;

    const sessionsRef = collection(db, 'trackingSessions');
    const q = query(
      sessionsRef,
      or(
        where('trackerId', '==', user.uid),
        where('targetId', '==', user.uid)
      )
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sessionList = [];
      snapshot.forEach((doc) => {
        sessionList.push({ id: doc.id, ...doc.data() });
      });
      setSessions(sessionList);
    }, (error) => {
      console.warn('Sessions listener error:', error);
    });

    return unsubscribe;
  }, [user]);

  const activeSessions = sessions.filter((s) => s.status === 'active');
  const pendingSessions = sessions.filter((s) => s.status === 'pending');

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>
              Hello, {user?.displayName?.split(' ')[0] || 'there'} 👋
            </Text>
            <Text style={styles.headerSubtitle}>
              {activeSessions.length > 0
                ? `${activeSessions.length} active session${activeSessions.length > 1 ? 's' : ''}`
                : 'No active sessions'}
            </Text>
          </View>
          <TouchableOpacity style={styles.avatarWrap}>
            <LinearGradient
              colors={Gradients.primary}
              style={styles.avatar}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.avatarText}>
                {getInitials(user?.displayName)}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => router.push('/(main)/link-device')}
          >
            <LinearGradient
              colors={Gradients.accent}
              style={styles.quickActionIcon}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="add" size={24} color="#FFF" />
            </LinearGradient>
            <Text style={styles.quickActionText}>Link Device</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => router.push('/(main)/sessions')}
          >
            <LinearGradient
              colors={Gradients.success}
              style={styles.quickActionIcon}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="list" size={24} color="#FFF" />
            </LinearGradient>
            <Text style={styles.quickActionText}>Sessions</Text>
          </TouchableOpacity>
        </View>

        {/* Pending Invites */}
        {pendingSessions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              <Ionicons name="time" size={16} color={Colors.warning} /> Pending Invites
            </Text>
            {pendingSessions.map((session) => {
              const isTarget = session.targetId === user?.uid;
              return (
                <Card key={session.id} variant="glass" style={styles.sessionCard}>
                  <View style={styles.sessionRow}>
                    <View style={styles.sessionInfo}>
                      <Text style={styles.sessionName}>
                        {isTarget ? session.trackerName : session.targetName}
                      </Text>
                      <Text style={styles.sessionRole}>
                        {isTarget ? 'Wants to track you' : 'Awaiting consent'}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: Colors.warningSoft }]}>
                      <Text style={[styles.statusText, { color: Colors.warning }]}>Pending</Text>
                    </View>
                  </View>
                </Card>
              );
            })}
          </View>
        )}

        {/* Active Sessions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="radio" size={16} color={Colors.success} /> Active Sessions
          </Text>
          {activeSessions.length === 0 ? (
            <Card variant="glass" style={styles.emptyCard}>
              <Ionicons name="location-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No Active Sessions</Text>
              <Text style={styles.emptySubtitle}>
                Link a device to start tracking
              </Text>
            </Card>
          ) : (
            activeSessions.map((session) => {
              const isTracker = session.trackerId === user?.uid;
              return (
                <TouchableOpacity
                  key={session.id}
                  onPress={() => {
                    if (isTracker) {
                      router.push(`/(main)/track?sessionId=${session.id}&targetId=${session.targetId}&targetName=${session.targetName}`);
                    }
                  }}
                  activeOpacity={isTracker ? 0.7 : 1}
                >
                  <Card variant="glass" style={styles.sessionCard}>
                    <View style={styles.sessionRow}>
                      <View style={styles.sessionDot} />
                      <View style={styles.sessionInfo}>
                        <Text style={styles.sessionName}>
                          {isTracker ? session.targetName : session.trackerName}
                        </Text>
                        <Text style={styles.sessionRole}>
                          {isTracker ? 'You are tracking' : 'Tracking you'}
                        </Text>
                      </View>
                      {isTracker && (
                        <Ionicons name="navigate" size={20} color={Colors.primary} />
                      )}
                    </View>
                  </Card>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: { flex: 1 },
  scrollContent: {
    padding: Spacing.xl,
    paddingBottom: Spacing.massive,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  greeting: {
    ...Typography.heading2,
    color: Colors.textPrimary,
  },
  headerSubtitle: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  avatarWrap: {},
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...Typography.bodySemiBold,
    color: '#FFF',
  },
  quickActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.xxl,
  },
  quickAction: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  quickActionText: {
    ...Typography.captionMedium,
    color: Colors.textPrimary,
  },
  section: {
    marginBottom: Spacing.xxl,
  },
  sectionTitle: {
    ...Typography.bodySemiBold,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  sessionCard: {
    marginBottom: Spacing.md,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sessionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.success,
    marginRight: Spacing.md,
    shadowColor: Colors.success,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 2,
  },
  sessionInfo: {
    flex: 1,
  },
  sessionName: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
  },
  sessionRole: {
    ...Typography.small,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  statusText: {
    ...Typography.smallMedium,
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
  },
});

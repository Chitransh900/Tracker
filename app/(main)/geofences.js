import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../config/firebase';
import Card from '../../components/ui/Card';
import { Colors } from '../../constants/colors';
import { Typography, Spacing, BorderRadius } from '../../constants/theme';

export default function GeofencesScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  const { targetId, targetName, sessionId } = params;
  const [geofences, setGeofences] = useState([]);

  useEffect(() => {
    if (!user?.uid) return;

    const geofencesRef = collection(db, 'geofences');

    // If targetId is provided, show geofences for that target only
    // Otherwise show all geofences created by this user
    const q = targetId
      ? query(
          geofencesRef,
          where('createdBy', '==', user.uid),
          where('targetId', '==', targetId)
        )
      : query(geofencesRef, where('createdBy', '==', user.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fences = [];
      snapshot.forEach((d) => {
        fences.push({ id: d.id, ...d.data() });
      });
      // Sort by creation date (newest first)
      fences.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || 0;
        const bTime = b.createdAt?.toMillis?.() || 0;
        return bTime - aTime;
      });
      setGeofences(fences);
    });

    return unsubscribe;
  }, [user?.uid, targetId]);

  const toggleGeofence = async (geofence) => {
    try {
      await updateDoc(doc(db, 'geofences', geofence.id), {
        enabled: !geofence.enabled,
      });
    } catch (err) {
      Alert.alert('Error', 'Failed to update geofence');
    }
  };

  const deleteGeofence = (geofence) => {
    Alert.alert(
      'Delete Geofence',
      `Remove "${geofence.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'geofences', geofence.id));
            } catch (err) {
              Alert.alert('Error', 'Failed to delete geofence');
            }
          },
        },
      ]
    );
  };

  const getAlertTypeLabel = (type) => {
    switch (type) {
      case 'enter':
        return 'On Enter';
      case 'exit':
        return 'On Exit';
      case 'both':
        return 'Enter & Exit';
      default:
        return type;
    }
  };

  const getAlertTypeIcon = (type) => {
    switch (type) {
      case 'enter':
        return 'arrow-down-circle';
      case 'exit':
        return 'arrow-up-circle';
      case 'both':
        return 'swap-vertical';
      default:
        return 'alert-circle';
    }
  };

  const formatRadius = (radius) => {
    if (radius >= 1000) return `${(radius / 1000).toFixed(1)} km`;
    return `${radius} m`;
  };

  const getStatusLabel = (geofence) => {
    if (!geofence.lastState) return null;
    return geofence.lastState === 'inside' ? 'Currently Inside' : 'Currently Outside';
  };

  const getStatusColor = (geofence) => {
    if (!geofence.lastState) return Colors.textTertiary;
    return geofence.lastState === 'inside' ? Colors.success : Colors.textSecondary;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.title}>Geofences</Text>
          {targetName && (
            <Text style={styles.subtitle}>for {targetName}</Text>
          )}
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Instructions */}
        <Card variant="glass" style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="information-circle" size={20} color={Colors.accent} />
            <Text style={styles.infoText}>
              Long-press on the map to create a new geofence at any location.
            </Text>
          </View>
        </Card>

        {/* Geofence List */}
        {geofences.length === 0 ? (
          <Card variant="glass" style={styles.emptyCard}>
            <Ionicons name="shield-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No Geofences Yet</Text>
            <Text style={styles.emptySubtitle}>
              Go to the track screen and long-press on the map to create one
            </Text>
          </Card>
        ) : (
          geofences.map((fence) => (
            <Card key={fence.id} variant="glass" style={styles.geofenceCard}>
              <View style={styles.geofenceHeader}>
                <View style={styles.geofenceInfo}>
                  <View style={styles.nameRow}>
                    <View
                      style={[
                        styles.statusDot,
                        {
                          backgroundColor: fence.enabled
                            ? Colors.success
                            : Colors.textMuted,
                        },
                      ]}
                    />
                    <Text style={styles.geofenceName}>{fence.name}</Text>
                  </View>

                  <View style={styles.detailsRow}>
                    <View style={styles.detailChip}>
                      <Ionicons name="resize" size={12} color={Colors.textSecondary} />
                      <Text style={styles.detailText}>
                        {formatRadius(fence.radius)}
                      </Text>
                    </View>
                    <View style={styles.detailChip}>
                      <Ionicons
                        name={getAlertTypeIcon(fence.alertType)}
                        size={12}
                        color={Colors.textSecondary}
                      />
                      <Text style={styles.detailText}>
                        {getAlertTypeLabel(fence.alertType)}
                      </Text>
                    </View>
                    {fence.targetName && (
                      <View style={styles.detailChip}>
                        <Ionicons name="person" size={12} color={Colors.textSecondary} />
                        <Text style={styles.detailText}>{fence.targetName}</Text>
                      </View>
                    )}
                  </View>

                  {/* Status indicator */}
                  {getStatusLabel(fence) && (
                    <Text style={[styles.statusLabel, { color: getStatusColor(fence) }]}>
                      {getStatusLabel(fence)}
                    </Text>
                  )}
                </View>

                <Switch
                  value={fence.enabled}
                  onValueChange={() => toggleGeofence(fence)}
                  trackColor={{ false: Colors.surface, true: Colors.primarySoft }}
                  thumbColor={fence.enabled ? Colors.primary : Colors.textTertiary}
                />
              </View>

              {/* Delete button */}
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => deleteGeofence(fence)}
              >
                <Ionicons name="trash-outline" size={16} color={Colors.danger} />
                <Text style={styles.deleteText}>Delete</Text>
              </TouchableOpacity>
            </Card>
          ))
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.glass,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  headerInfo: {
    flex: 1,
    marginLeft: Spacing.lg,
  },
  headerSpacer: {
    width: 44,
  },
  title: {
    ...Typography.heading3,
    color: Colors.textPrimary,
  },
  subtitle: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  scrollContent: {
    padding: Spacing.xl,
    paddingBottom: Spacing.massive,
  },
  infoCard: {
    marginBottom: Spacing.xl,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginLeft: Spacing.md,
    flex: 1,
    lineHeight: 20,
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
    paddingHorizontal: Spacing.xl,
  },
  geofenceCard: {
    marginBottom: Spacing.lg,
  },
  geofenceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  geofenceInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.sm,
  },
  geofenceName: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
  },
  detailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    marginLeft: Spacing.lg + Spacing.sm,
  },
  detailChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  detailText: {
    ...Typography.small,
    color: Colors.textSecondary,
  },
  statusLabel: {
    ...Typography.small,
    marginTop: Spacing.sm,
    marginLeft: Spacing.lg + Spacing.sm,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: Spacing.xs,
  },
  deleteText: {
    ...Typography.captionMedium,
    color: Colors.danger,
  },
});

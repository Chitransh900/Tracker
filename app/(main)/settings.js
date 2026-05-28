import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import LocationService from '../../services/LocationService';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { Colors, Gradients } from '../../constants/colors';
import { Typography, Spacing, BorderRadius } from '../../constants/theme';

export default function SettingsScreen() {
  const { user, userProfile, signOut } = useAuth();
  const router = useRouter();
  const [trackingEnabled, setTrackingEnabled] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState(userProfile?.phoneNumber || '');
  const [savingPhone, setSavingPhone] = useState(false);
  const [permissions, setPermissions] = useState({
    foreground: false,
    background: false,
  });

  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    const status = await LocationService.getPermissionStatus();
    setPermissions(status);
    const active = await LocationService.isTracking();
    setTrackingEnabled(active);
  };

  const handleSavePhone = async () => {
    if (!phoneNumber.trim()) return;
    setSavingPhone(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { phoneNumber: phoneNumber.trim() });
      Alert.alert('Success', 'Phone number saved successfully.');
    } catch (err) {
      Alert.alert('Error', 'Failed to save phone number.');
    } finally {
      setSavingPhone(false);
    }
  };

  const toggleTracking = async (value) => {
    if (value) {
      try {
        // Request permissions first
        const fg = await LocationService.requestForegroundPermission();
        if (!fg) {
          Alert.alert(
            'Permission Required',
            'Location permission is required for tracking. Please enable it in Settings.'
          );
          return;
        }

        const bg = await LocationService.requestBackgroundPermission();
        if (!bg) {
          Alert.alert(
            'Background Permission',
            'Background location is needed for continuous tracking. The app will only track while open.'
          );
        }

        await LocationService.startForegroundTracking(user.uid);
        if (bg) {
          await LocationService.startBackgroundTracking(user.uid);
        }
        setTrackingEnabled(true);
        checkPermissions();
      } catch (err) {
        Alert.alert('Error', 'Failed to start tracking: ' + err.message);
      }
    } else {
      await LocationService.stopTracking();
      setTrackingEnabled(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await LocationService.stopTracking();
          await signOut();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Settings</Text>

        {/* Profile Section */}
        <Card variant="glass" style={styles.profileCard}>
          <View style={styles.profileRow}>
            <View
              style={[styles.avatar, { backgroundColor: Colors.primaryDark }]}
            >
              <Text style={styles.avatarText}>{getInitials(user?.displayName)}</Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{user?.displayName || 'User'}</Text>
              <Text style={styles.profileEmail}>{user?.email}</Text>
            </View>
          </View>
        </Card>

        {/* Contact Info Section */}
        <Text style={styles.sectionTitle}>Contact Info</Text>
        <Card variant="glass" style={styles.settingsCard}>
          <View style={styles.settingRow}>
            <View style={{ flex: 1, marginRight: Spacing.md }}>
              <Input
                label="Phone Number"
                placeholder="+1 234 567 8900"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="phone-pad"
                icon="call-outline"
                style={{ marginBottom: 0 }}
              />
            </View>
            <Button
              title="Save"
              onPress={handleSavePhone}
              loading={savingPhone}
              size="small"
              style={{ marginTop: 24 }}
            />
          </View>
        </Card>

        {/* Location Section */}
        <Text style={styles.sectionTitle}>Location Sharing</Text>
        <Card variant="glass" style={styles.settingsCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <View style={styles.settingIconWrap}>
                <Ionicons name="location" size={20} color={Colors.primary} />
              </View>
              <View>
                <Text style={styles.settingLabel}>Share My Location</Text>
                <Text style={styles.settingDesc}>
                  {trackingEnabled ? 'Your location is being shared' : 'Enable to share with trackers'}
                </Text>
              </View>
            </View>
            <Switch
              value={trackingEnabled}
              onValueChange={toggleTracking}
              trackColor={{ false: Colors.surface, true: Colors.primarySoft }}
              thumbColor={trackingEnabled ? Colors.primary : Colors.textTertiary}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.permissionRow}>
            <Text style={styles.permLabel}>Foreground Permission</Text>
            <View style={[styles.permBadge, permissions.foreground && styles.permGranted]}>
              <Text style={[styles.permText, permissions.foreground && styles.permGrantedText]}>
                {permissions.foreground ? 'Granted' : 'Not Granted'}
              </Text>
            </View>
          </View>

          <View style={styles.permissionRow}>
            <Text style={styles.permLabel}>Background Permission</Text>
            <View style={[styles.permBadge, permissions.background && styles.permGranted]}>
              <Text style={[styles.permText, permissions.background && styles.permGrantedText]}>
                {permissions.background ? 'Granted' : 'Not Granted'}
              </Text>
            </View>
          </View>
        </Card>

        {/* About */}
        <Text style={styles.sectionTitle}>About</Text>
        <Card variant="glass" style={styles.settingsCard}>
          <TouchableOpacity style={styles.aboutRow}>
            <Ionicons name="information-circle-outline" size={20} color={Colors.textSecondary} />
            <Text style={styles.aboutText}>Version 1.2.1</Text>
          </TouchableOpacity>
        </Card>

        {/* Sign Out */}
        <Button
          title="Sign Out"
          onPress={handleSignOut}
          variant="danger"
          icon={<Ionicons name="log-out-outline" size={20} color="#FFF" />}
          style={styles.signOutBtn}
        />
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
    marginBottom: Spacing.xxl,
  },
  profileCard: {
    marginBottom: Spacing.xxl,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.lg,
  },
  avatarText: {
    ...Typography.heading3,
    color: '#FFF',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
  },
  profileEmail: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  sectionTitle: {
    ...Typography.captionMedium,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.md,
    marginLeft: Spacing.xs,
  },
  settingsCard: {
    marginBottom: Spacing.xxl,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  settingLabel: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
  },
  settingDesc: {
    ...Typography.small,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.lg,
  },
  permissionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  permLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  permBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.dangerSoft,
  },
  permGranted: {
    backgroundColor: Colors.successSoft,
  },
  permText: {
    ...Typography.smallMedium,
    color: Colors.danger,
  },
  permGrantedText: {
    color: Colors.success,
  },
  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aboutText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginLeft: Spacing.md,
  },
  signOutBtn: {
    marginTop: Spacing.lg,
  },
});

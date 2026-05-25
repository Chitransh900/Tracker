import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../config/firebase';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Card from '../../components/ui/Card';
import { Colors, Gradients } from '../../constants/colors';
import { Typography, Spacing, BorderRadius } from '../../constants/theme';

export default function LinkDeviceScreen() {
  const { user, userProfile } = useAuth();
  const [targetEmail, setTargetEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSendInvite = async () => {
    if (!targetEmail.trim()) {
      setError('Please enter an email address');
      return;
    }
    if (targetEmail.trim().toLowerCase() === user?.email?.toLowerCase()) {
      setError("You can't track yourself");
      return;
    }

    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      // Find target user by email
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', targetEmail.trim().toLowerCase()));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setError('No user found with this email. They need to install the app and create an account first.');
        setLoading(false);
        return;
      }

      const targetDoc = snapshot.docs[0];
      const targetId = targetDoc.id;
      const targetData = targetDoc.data();

      // Check if session already exists
      const sessionsRef = collection(db, 'trackingSessions');
      const existingQ = query(
        sessionsRef,
        where('trackerId', '==', user.uid),
        where('targetId', '==', targetId)
      );
      const existingSnap = await getDocs(existingQ);
      
      if (!existingSnap.empty) {
        const existing = existingSnap.docs[0].data();
        if (existing.status === 'active') {
          setError('You already have an active session with this user');
        } else if (existing.status === 'pending') {
          setError('You already have a pending invite for this user');
        } else {
          // Create new session (previous was revoked)
          await createSession(targetId, targetData);
        }
        setLoading(false);
        return;
      }

      await createSession(targetId, targetData);
    } catch (err) {
      console.error('Link device error:', err);
      setError('Failed to send invite. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const createSession = async (targetId, targetData) => {
    await addDoc(collection(db, 'trackingSessions'), {
      trackerId: user.uid,
      trackerName: user.displayName || 'Unknown',
      trackerEmail: user.email,
      targetId: targetId,
      targetName: targetData.displayName || 'Unknown',
      targetEmail: targetData.email,
      status: 'pending',
      createdAt: serverTimestamp(),
      consentGrantedAt: null,
    });
    setSuccess(true);
    setTargetEmail('');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <Text style={styles.title}>Link a Device</Text>
        <Text style={styles.subtitle}>
          Enter the email of the person you want to track. They'll receive a
          consent request in their app.
        </Text>

        {/* Invite Form */}
        <Card variant="glass" style={styles.formCard}>
          <View style={styles.formHeader}>
            <LinearGradient
              colors={Gradients.accent}
              style={styles.formIcon}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="person-add" size={24} color="#FFF" />
            </LinearGradient>
            <Text style={styles.formTitle}>Send Tracking Request</Text>
          </View>

          <Input
            label="Target's Email"
            placeholder="target@example.com"
            value={targetEmail}
            onChangeText={(t) => {
              setTargetEmail(t);
              setError('');
              setSuccess(false);
            }}
            keyboardType="email-address"
            icon="mail-outline"
            error={error}
          />

          {success && (
            <View style={styles.successBanner}>
              <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
              <Text style={styles.successText}>
                Invite sent! Waiting for consent...
              </Text>
            </View>
          )}

          <Button
            title="Send Invite"
            onPress={handleSendInvite}
            loading={loading}
            icon={<Ionicons name="send" size={18} color="#FFF" />}
          />
        </Card>

        {/* How It Works */}
        <View style={styles.howItWorks}>
          <Text style={styles.howTitle}>How It Works</Text>
          {[
            {
              icon: 'mail',
              title: 'Send Invite',
              desc: 'Enter their email to send a tracking request',
            },
            {
              icon: 'shield-checkmark',
              title: 'Get Consent',
              desc: 'They approve the request in their app',
            },
            {
              icon: 'location',
              title: 'Start Tracking',
              desc: 'View their live location on the map',
            },
          ].map((step, i) => (
            <View key={i} style={styles.step}>
              <View style={styles.stepIconWrap}>
                <Ionicons name={step.icon} size={20} color={Colors.accent} />
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepDesc}>{step.desc}</Text>
              </View>
              {i < 2 && <View style={styles.stepLine} />}
            </View>
          ))}
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
    lineHeight: 22,
  },
  formCard: {
    marginBottom: Spacing.xxxl,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  formIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  formTitle: {
    ...Typography.heading3,
    color: Colors.textPrimary,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.successSoft,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  successText: {
    ...Typography.caption,
    color: Colors.successLight,
    marginLeft: Spacing.sm,
  },
  howItWorks: {
    marginTop: Spacing.lg,
  },
  howTitle: {
    ...Typography.bodySemiBold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xl,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.xl,
    position: 'relative',
  },
  stepIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginRight: Spacing.lg,
    zIndex: 1,
  },
  stepContent: {
    flex: 1,
    paddingTop: 2,
  },
  stepTitle: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
  },
  stepDesc: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  stepLine: {
    position: 'absolute',
    left: 19,
    top: 42,
    width: 2,
    height: 24,
    backgroundColor: Colors.border,
  },
});

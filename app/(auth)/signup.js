import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { Colors, Gradients } from '../../constants/colors';
import { Typography, Spacing, BorderRadius } from '../../constants/theme';

export default function SignupScreen() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState('');
  const { signUp, clearError } = useAuth();
  const router = useRouter();

  const handleSignup = async () => {
    if (!displayName.trim() || !email.trim() || !password || !confirmPassword) {
      setLocalError('Please fill in all fields');
      return;
    }
    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setLocalError('Passwords do not match');
      return;
    }
    setLocalError('');
    clearError();
    setLoading(true);
    try {
      await signUp(email.trim(), password, displayName.trim());
      Alert.alert(
        'Account Created!',
        'We have sent a verification link to your email. Please verify your email before logging in.',
        [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
      );
    } catch (err) {
      setLocalError(getErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  const getErrorMessage = (code) => {
    switch (code) {
      case 'auth/email-already-in-use': return 'This email is already registered';
      case 'auth/invalid-email': return 'Invalid email address';
      default: return `Signup failed: ${code}`;
    }
  };

  return (
    <View style={styles.container}>
      {/* Clean background instead of topGlow gradient */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back button */}
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.textSecondary} />
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoWrap}>
              <View style={styles.logoGradient}>
                <Ionicons name="person-add" size={32} color="#FFF" />
              </View>
            </View>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join and start tracking safely</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {localError ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={18} color={Colors.danger} />
                <Text style={styles.errorBannerText}>{localError}</Text>
              </View>
            ) : null}

            <Input
              label="Full Name"
              placeholder="John Doe"
              value={displayName}
              onChangeText={(t) => { setDisplayName(t); setLocalError(''); }}
              autoCapitalize="words"
              icon="person-outline"
            />
            <Input
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChangeText={(t) => { setEmail(t); setLocalError(''); }}
              keyboardType="email-address"
              icon="mail-outline"
            />
            <Input
              label="Password"
              placeholder="Min 6 characters"
              value={password}
              onChangeText={(t) => { setPassword(t); setLocalError(''); }}
              secureTextEntry
              icon="lock-closed-outline"
            />
            <Input
              label="Confirm Password"
              placeholder="Re-enter password"
              value={confirmPassword}
              onChangeText={(t) => { setConfirmPassword(t); setLocalError(''); }}
              secureTextEntry
              icon="shield-checkmark-outline"
            />

            <Button
              title="Create Account"
              onPress={handleSignup}
              loading={loading}
              style={styles.signupBtn}
            />
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.footerLink}> Sign In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: { flex: 1 },
  // Removed topGlow
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.huge,
  },
  backBtn: {
    marginBottom: Spacing.lg,
    width: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  logoWrap: {
    marginBottom: Spacing.xl,
  },
  logoGradient: {
    width: 72,
    height: 72,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  title: {
    ...Typography.heading1,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  form: {
    marginBottom: Spacing.xxxl,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dangerSoft,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  errorBannerText: {
    ...Typography.caption,
    color: Colors.dangerLight,
    marginLeft: Spacing.sm,
    flex: 1,
  },
  signupBtn: {
    marginTop: Spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  footerLink: {
    color: Colors.primary,
  },
});

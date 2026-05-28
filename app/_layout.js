import React, { useEffect, useState } from 'react';
import { View, Platform, StyleSheet, Dimensions } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../contexts/AuthContext';
import { Colors } from '../constants/colors';

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

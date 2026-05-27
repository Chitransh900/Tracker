import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';
import { BorderRadius, Spacing, Shadows } from '../../constants/theme';

export default function Card({ children, style, variant = 'default' }) {
  return (
    <View
      style={[
        styles.card,
        variant === 'glass' && styles.glass,
        variant === 'elevated' && styles.elevated,
        variant === 'outlined' && styles.outlined,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  glass: {
    backgroundColor: Colors.glass,
    borderColor: Colors.glassBorder,
  },
  elevated: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    ...Shadows.lg,
  },
  outlined: {
    backgroundColor: 'transparent',
    borderColor: Colors.borderLight,
    borderWidth: 1.5,
  },
});

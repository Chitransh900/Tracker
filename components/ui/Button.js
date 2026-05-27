import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { Typography, BorderRadius, Spacing } from '../../constants/theme';

export default function Button({
  title,
  onPress,
  variant = 'primary', // 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size = 'large', // 'small' | 'medium' | 'large'
  loading = false,
  disabled = false,
  icon = null,
  style,
  textStyle,
}) {
  const isDisabled = disabled || loading;

  const sizeStyles = {
    small: { height: 40, paddingHorizontal: Spacing.lg },
    medium: { height: 48, paddingHorizontal: Spacing.xl },
    large: { height: 56, paddingHorizontal: Spacing.xxl },
  };

  const textSizes = {
    small: Typography.buttonSmall,
    medium: Typography.buttonSmall,
    large: Typography.button,
  };

  const renderContent = () => (
    <View style={styles.content}>
      {loading ? (
        <ActivityIndicator
          color={variant === 'outline' || variant === 'ghost' ? Colors.primary : '#FFF'}
          size="small"
        />
      ) : (
        <>
          {icon && <View style={styles.iconWrap}>{icon}</View>}
          <Text
            style={[
              textSizes[size],
              styles.text,
              variant === 'outline' && { color: Colors.primary },
              variant === 'ghost' && { color: Colors.textSecondary },
              variant === 'danger' && { color: '#FFF' },
              isDisabled && { opacity: 0.5 },
              textStyle,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </View>
  );

  if (variant === 'primary') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={isDisabled}
        activeOpacity={0.85}
        style={[style]}
      >
        <View
          style={[
            styles.base,
            sizeStyles[size],
            styles.primaryShadow,
            isDisabled && styles.disabled,
            { backgroundColor: isDisabled ? Colors.surface : Colors.primary }
          ]}
        >
          {renderContent()}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
      style={[
        styles.base,
        sizeStyles[size],
        variant === 'secondary' && styles.secondary,
        variant === 'outline' && styles.outline,
        variant === 'ghost' && styles.ghost,
        variant === 'danger' && styles.danger,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {renderContent()}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    marginRight: Spacing.sm,
  },
  text: {
    color: '#FFFFFF',
  },
  primaryShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  secondary: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: Colors.danger,
    shadowColor: Colors.danger,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  disabled: {
    opacity: 0.6,
  },
});

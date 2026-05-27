// Tracker App — Professional Midnight Emerald Palette
// Clean, corporate, high-contrast dark theme with Emerald Green accent

export const Colors = {
  // Core backgrounds (Deep Charcoal/Black)
  background: '#09090B', // Zinc 950
  backgroundSecondary: '#18181B', // Zinc 900
  backgroundTertiary: '#27272A', // Zinc 800
  surface: '#18181B',
  surfaceLight: '#27272A',
  
  // Clean overlays (Replacing Glassmorphism)
  glass: 'rgba(24, 24, 27, 0.9)', // Solid slightly translucent
  glassBorder: 'rgba(255, 255, 255, 0.05)',
  glassLight: 'rgba(255, 255, 255, 0.02)',
  
  // Primary — Emerald Green
  primary: '#10B981', // Emerald 500
  primaryLight: '#34D399', // Emerald 400
  primaryDark: '#059669', // Emerald 600
  primaryGlow: 'rgba(16, 185, 129, 0.15)',
  primarySoft: 'rgba(16, 185, 129, 0.08)',
  
  // Accent — Emerald Green (Monochromatic pairing)
  accent: '#10B981',
  accentLight: '#34D399',
  accentGlow: 'rgba(16, 185, 129, 0.15)',
  
  // Success
  success: '#10B981',
  successLight: '#34D399',
  successSoft: 'rgba(16, 185, 129, 0.1)',
  
  // Warning
  warning: '#F59E0B',
  warningLight: '#FBBF24',
  warningSoft: 'rgba(245, 158, 11, 0.1)',
  
  // Danger
  danger: '#EF4444',
  dangerLight: '#F87171',
  dangerSoft: 'rgba(239, 68, 68, 0.1)',
  
  // Text (High Contrast)
  textPrimary: '#FAFAFA', // Zinc 50
  textSecondary: '#A1A1AA', // Zinc 400
  textTertiary: '#71717A', // Zinc 500
  textMuted: '#52525B', // Zinc 600
  
  // Borders (Very subtle)
  border: 'rgba(255, 255, 255, 0.08)',
  borderLight: 'rgba(255, 255, 255, 0.04)',
  borderActive: '#10B981',
  
  // Map-specific
  mapTrail: '#10B981',
  mapTrailGlow: 'rgba(16, 185, 129, 0.2)',
  mapMarkerPulse: 'rgba(16, 185, 129, 0.15)',
  
  // Status
  online: '#10B981',
  offline: '#71717A',
  tracking: '#10B981',
};

// Stripping out playful multi-color gradients. Using subtle monochromatic fades.
export const Gradients = {
  primary: ['#10B981', '#059669'], // Emerald to Dark Emerald
  accent: ['#10B981', '#059669'],
  success: ['#10B981', '#059669'],
  danger: ['#EF4444', '#DC2626'],
  dark: ['#09090B', '#18181B'],
  card: ['#18181B', '#18181B'], // Solid cards instead of gradient cards
  header: ['#09090B', 'transparent'],
};

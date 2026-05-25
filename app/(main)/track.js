import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  Platform,
} from 'react-native';
import MapView, { Marker, Polyline, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, onSnapshot, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Colors, Gradients } from '../../constants/colors';
import { Typography, Spacing, BorderRadius } from '../../constants/theme';

const { width, height } = Dimensions.get('window');
const ASPECT_RATIO = width / height;
const LATITUDE_DELTA = 0.005;
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;

export default function TrackScreen() {
  const params = useLocalSearchParams();
  const { sessionId, targetId, targetName } = params;
  const router = useRouter();
  const mapRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(0)).current;

  const [location, setLocation] = useState(null);
  const [routeHistory, setRouteHistory] = useState([]);
  const [showRoute, setShowRoute] = useState(false);
  const [showInfo, setShowInfo] = useState(true);
  const [mapType, setMapType] = useState('standard');
  const [lastUpdated, setLastUpdated] = useState(null);

  // Pulse animation for live marker
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  // Real-time location listener
  useEffect(() => {
    if (!targetId) return;

    const unsubscribe = onSnapshot(
      doc(db, 'locations', targetId),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          setLocation(data);
          setLastUpdated(new Date());

          // Animate map to new position
          if (mapRef.current && data.latitude && data.longitude) {
            mapRef.current.animateToRegion(
              {
                latitude: data.latitude,
                longitude: data.longitude,
                latitudeDelta: LATITUDE_DELTA,
                longitudeDelta: LONGITUDE_DELTA,
              },
              800
            );
          }
        }
      },
      (error) => {
        console.warn('Location listener error:', error);
      }
    );

    return unsubscribe;
  }, [targetId]);

  // Load route history
  const loadRouteHistory = async () => {
    if (!targetId) return;
    try {
      const historyRef = collection(db, 'locations', targetId, 'history');
      const q = query(historyRef, orderBy('timestamp', 'desc'), limit(200));
      const snapshot = await getDocs(q);
      const points = [];
      snapshot.forEach((d) => {
        const data = d.data();
        if (data.latitude && data.longitude) {
          points.push({ latitude: data.latitude, longitude: data.longitude });
        }
      });
      setRouteHistory(points.reverse());
    } catch (err) {
      console.warn('Failed to load route history:', err);
    }
  };

  const toggleRoute = () => {
    if (!showRoute && routeHistory.length === 0) {
      loadRouteHistory();
    }
    setShowRoute(!showRoute);
  };

  const centerOnTarget = () => {
    if (mapRef.current && location) {
      mapRef.current.animateToRegion(
        {
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: LATITUDE_DELTA,
          longitudeDelta: LONGITUDE_DELTA,
        },
        600
      );
    }
  };

  const toggleMapType = () => {
    setMapType((prev) => (prev === 'standard' ? 'satellite' : 'standard'));
  };

  const formatTime = (date) => {
    if (!date) return '--';
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 10) return 'Just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    return date.toLocaleTimeString();
  };

  const getBatteryColor = (level) => {
    if (!level) return Colors.textTertiary;
    if (level > 50) return Colors.success;
    if (level > 20) return Colors.warning;
    return Colors.danger;
  };

  const getBatteryIcon = (level) => {
    if (!level) return 'battery-dead';
    if (level > 75) return 'battery-full';
    if (level > 50) return 'battery-three-quarters';
    if (level > 25) return 'battery-half';
    return 'battery-quarter';
  };

  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2.5],
  });

  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 0],
  });

  return (
    <View style={styles.container}>
      {/* Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        mapType={mapType}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={{
          latitude: location?.latitude || 28.6139,
          longitude: location?.longitude || 77.209,
          latitudeDelta: LATITUDE_DELTA,
          longitudeDelta: LONGITUDE_DELTA,
        }}
        customMapStyle={darkMapStyle}
        showsUserLocation={false}
        showsMyLocationButton={false}
      >
        {/* Accuracy circle */}
        {location && location.accuracy && (
          <Circle
            center={{
              latitude: location.latitude,
              longitude: location.longitude,
            }}
            radius={location.accuracy}
            fillColor="rgba(59, 130, 246, 0.08)"
            strokeColor="rgba(59, 130, 246, 0.2)"
            strokeWidth={1}
          />
        )}

        {/* Route polyline */}
        {showRoute && routeHistory.length > 1 && (
          <Polyline
            coordinates={routeHistory}
            strokeColor={Colors.mapTrail}
            strokeWidth={3}
            lineDashPattern={[0]}
          />
        )}

        {/* Target marker */}
        {location && (
          <Marker
            coordinate={{
              latitude: location.latitude,
              longitude: location.longitude,
            }}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.markerContainer}>
              {/* Pulse ring */}
              <Animated.View
                style={[
                  styles.pulseRing,
                  {
                    transform: [{ scale: pulseScale }],
                    opacity: pulseOpacity,
                  },
                ]}
              />
              {/* Marker dot */}
              <View style={styles.markerDot}>
                <Ionicons name="navigate" size={16} color="#FFF" />
              </View>
            </View>
          </Marker>
        )}
      </MapView>

      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.topBarTitle}>
          <Text style={styles.trackingName}>{targetName || 'Unknown'}</Text>
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </View>
        <View style={styles.topBarSpacer} />
      </View>

      {/* Map controls */}
      <View style={styles.mapControls}>
        <TouchableOpacity style={styles.mapControlBtn} onPress={centerOnTarget}>
          <Ionicons name="locate" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.mapControlBtn} onPress={toggleMapType}>
          <Ionicons name="layers" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.mapControlBtn, showRoute && styles.mapControlActive]}
          onPress={toggleRoute}
        >
          <Ionicons
            name="trail-sign"
            size={22}
            color={showRoute ? Colors.primary : Colors.textPrimary}
          />
        </TouchableOpacity>
      </View>

      {/* Info Panel */}
      {showInfo && location && (
        <View style={styles.infoPanel}>
          <LinearGradient
            colors={['rgba(17, 24, 39, 0.95)', 'rgba(10, 14, 26, 0.98)']}
            style={styles.infoPanelGradient}
          >
            <TouchableOpacity
              style={styles.infoPanelHandle}
              onPress={() => setShowInfo(!showInfo)}
            >
              <View style={styles.handleBar} />
            </TouchableOpacity>

            <View style={styles.infoGrid}>
              {/* Last Updated */}
              <View style={styles.infoItem}>
                <Ionicons name="time-outline" size={16} color={Colors.primary} />
                <Text style={styles.infoLabel}>Updated</Text>
                <Text style={styles.infoValue}>{formatTime(lastUpdated)}</Text>
              </View>

              {/* Battery */}
              <View style={styles.infoItem}>
                <Ionicons
                  name="battery-half"
                  size={16}
                  color={getBatteryColor(location.battery)}
                />
                <Text style={styles.infoLabel}>Battery</Text>
                <Text
                  style={[
                    styles.infoValue,
                    { color: getBatteryColor(location.battery) },
                  ]}
                >
                  {location.battery != null ? `${location.battery}%` : '--'}
                </Text>
              </View>

              {/* Speed */}
              <View style={styles.infoItem}>
                <Ionicons name="speedometer-outline" size={16} color={Colors.accent} />
                <Text style={styles.infoLabel}>Speed</Text>
                <Text style={styles.infoValue}>
                  {location.speed != null && location.speed >= 0
                    ? `${(location.speed * 3.6).toFixed(1)} km/h`
                    : '--'}
                </Text>
              </View>

              {/* Accuracy */}
              <View style={styles.infoItem}>
                <Ionicons name="radio-outline" size={16} color={Colors.success} />
                <Text style={styles.infoLabel}>Accuracy</Text>
                <Text style={styles.infoValue}>
                  {location.accuracy
                    ? `±${Math.round(location.accuracy)}m`
                    : '--'}
                </Text>
              </View>
            </View>

            {/* Coordinates */}
            <View style={styles.coordsRow}>
              <Ionicons name="location" size={14} color={Colors.textTertiary} />
              <Text style={styles.coordsText}>
                {location.latitude?.toFixed(6)}, {location.longitude?.toFixed(6)}
              </Text>
            </View>
          </LinearGradient>
        </View>
      )}
    </View>
  );
}

// Dark map style for Google Maps
const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
  { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#4b6878' }] },
  { featureType: 'land_parcel', elementType: 'labels.text.fill', stylers: [{ color: '#64779e' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#283d6a' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#6f9ba5' }] },
  { featureType: 'poi.park', elementType: 'geometry.fill', stylers: [{ color: '#023e58' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#3C7680' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#98a5be' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2c6675' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#255763' }] },
  { featureType: 'transit', elementType: 'labels.text.fill', stylers: [{ color: '#98a5be' }] },
  { featureType: 'transit.line', elementType: 'geometry.fill', stylers: [{ color: '#283d6a' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4e6d70' }] },
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },

  // Top bar
  topBar: {
    position: 'absolute',
    top: 50,
    left: Spacing.lg,
    right: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  topBarTitle: {
    alignItems: 'center',
  },
  trackingName: {
    ...Typography.bodySemiBold,
    color: Colors.textPrimary,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.danger,
    marginRight: 4,
  },
  liveText: {
    ...Typography.tiny,
    color: Colors.danger,
  },
  topBarSpacer: {
    width: 44,
  },

  // Map controls
  mapControls: {
    position: 'absolute',
    right: Spacing.lg,
    top: height * 0.35,
    gap: Spacing.sm,
  },
  mapControlBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.glass,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  mapControlActive: {
    borderColor: Colors.primaryGlow,
    backgroundColor: Colors.primarySoft,
  },

  // Marker
  markerContainer: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
  },
  markerDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 6,
  },

  // Info Panel
  infoPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  infoPanelGradient: {
    borderTopLeftRadius: BorderRadius.xxl,
    borderTopRightRadius: BorderRadius.xxl,
    padding: Spacing.xl,
    paddingBottom: Spacing.xxxl,
    borderTopWidth: 1,
    borderColor: Colors.glassBorder,
  },
  infoPanelHandle: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.textMuted,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  infoItem: {
    flex: 1,
    minWidth: '40%',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infoLabel: {
    ...Typography.small,
    color: Colors.textTertiary,
    marginTop: Spacing.xs,
  },
  infoValue: {
    ...Typography.bodySemiBold,
    color: Colors.textPrimary,
    marginTop: 2,
  },
  coordsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.lg,
    justifyContent: 'center',
  },
  coordsText: {
    ...Typography.small,
    color: Colors.textTertiary,
    marginLeft: Spacing.xs,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});

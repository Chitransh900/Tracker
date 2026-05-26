import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, onSnapshot, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Colors, Gradients } from '../../constants/colors';
import { Typography, Spacing, BorderRadius } from '../../constants/theme';

const { width, height } = Dimensions.get('window');

const MAP_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    body { padding: 0; margin: 0; background-color: #0A0E1A; overflow: hidden; }
    #map { height: 100vh; width: 100vw; }
    .leaflet-container { background: #0A0E1A; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    .leaflet-control-container { display: none; }
    .custom-marker {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: rgba(59, 130, 246, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }
    .custom-marker-inner {
      width: 14px;
      height: 14px;
      background: #3B82F6;
      border-radius: 50%;
      border: 2px solid white;
      box-shadow: 0 0 10px rgba(59, 130, 246, 0.8);
      position: absolute;
      top: 9px;
      left: 9px;
    }
    .pulse {
      position: absolute;
      width: 100%;
      height: 100%;
      border-radius: 50%;
      background: rgba(59, 130, 246, 0.5);
      animation: pulseAnim 1.5s infinite ease-out;
    }
    @keyframes pulseAnim {
      0% { transform: scale(0.5); opacity: 1; }
      100% { transform: scale(2); opacity: 0; }
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: false, attributionControl: false }).setView([28.6139, 77.209], 15);
    
    var tileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
    }).addTo(map);

    var marker = null;
    var accuracyCircle = null;
    var routePolyline = null;

    var customIcon = L.divIcon({
      className: 'custom-div-icon',
      html: "<div class='custom-marker'><div class='pulse'></div><div class='custom-marker-inner'></div></div>",
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    window.updateLocation = function(lat, lng, accuracy, shouldCenter) {
      if (!marker) {
        marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);
        if (accuracy) {
          accuracyCircle = L.circle([lat, lng], {
            radius: accuracy,
            color: '#3B82F6',
            weight: 1,
            fillColor: '#3B82F6',
            fillOpacity: 0.1
          }).addTo(map);
        }
        map.setView([lat, lng], 15);
      } else {
        marker.setLatLng([lat, lng]);
        if (accuracyCircle) {
          accuracyCircle.setLatLng([lat, lng]);
          accuracyCircle.setRadius(accuracy);
        }
        if (shouldCenter) {
          map.setView([lat, lng]);
        }
      }
    };

    window.centerMap = function() {
      if (marker) {
        map.setView(marker.getLatLng());
      }
    };

    window.setMapType = function(type) {
      if (type === 'satellite') {
        tileLayer.setUrl('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}');
      } else {
        tileLayer.setUrl('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png');
      }
    };

    window.drawRoute = function(pointsStr) {
      var points = JSON.parse(pointsStr);
      if (routePolyline) {
        map.removeLayer(routePolyline);
        routePolyline = null;
      }
      if (points && points.length > 1) {
        var latlngs = points.map(function(p) { return [p.latitude, p.longitude]; });
        routePolyline = L.polyline(latlngs, {color: '#8B5CF6', weight: 3}).addTo(map);
      }
    };
  </script>
</body>
</html>
`;

export default function TrackScreen() {
  const params = useLocalSearchParams();
  const { sessionId, targetId, targetName } = params;
  const router = useRouter();
  const webViewRef = useRef(null);

  const [location, setLocation] = useState(null);
  const [routeHistory, setRouteHistory] = useState([]);
  const [showRoute, setShowRoute] = useState(false);
  const [showInfo, setShowInfo] = useState(true);
  const [mapType, setMapType] = useState('standard');
  const [lastUpdated, setLastUpdated] = useState(null);


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
          if (webViewRef.current && data.latitude && data.longitude) {
            webViewRef.current.injectJavaScript(`window.updateLocation(${data.latitude}, ${data.longitude}, ${data.accuracy || 0}, false); true;`);
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
      const reversed = points.reverse();
      setRouteHistory(reversed);
      return reversed;
    } catch (err) {
      console.warn('Failed to load route history:', err);
      return [];
    }
  };

  const toggleRoute = () => {
    const newShowRoute = !showRoute;
    setShowRoute(newShowRoute);
    if (newShowRoute) {
      if (routeHistory.length === 0) {
        loadRouteHistory().then((points) => {
          if (webViewRef.current) {
            webViewRef.current.injectJavaScript(`window.drawRoute('${JSON.stringify(points)}'); true;`);
          }
        });
      } else {
        if (webViewRef.current) {
          webViewRef.current.injectJavaScript(`window.drawRoute('${JSON.stringify(routeHistory)}'); true;`);
        }
      }
    } else {
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(`window.drawRoute('[]'); true;`);
      }
    }
  };

  const centerOnTarget = () => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`window.centerMap(); true;`);
    }
  };

  const toggleMapType = () => {
    const newType = mapType === 'standard' ? 'satellite' : 'standard';
    setMapType(newType);
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`window.setMapType('${newType}'); true;`);
    }
  };

  const handleMapLoad = () => {
    if (location && webViewRef.current) {
      webViewRef.current.injectJavaScript(`window.updateLocation(${location.latitude}, ${location.longitude}, ${location.accuracy || 0}, true); true;`);
    }
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



  return (
    <View style={styles.container}>
      {/* Map */}
      <WebView
        ref={webViewRef}
        style={styles.map}
        source={{ html: MAP_HTML }}
        scrollEnabled={false}
        bounces={false}
        onLoadEnd={handleMapLoad}
      />

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

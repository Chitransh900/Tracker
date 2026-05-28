import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Colors } from '../../constants/colors';
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
    body { padding: 0; margin: 0; background-color: #0f172a; overflow: hidden; }
    #map { height: 100vh; width: 100vw; }
    .leaflet-container { background: transparent; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    .leaflet-control-container { display: none; }
    
    body.dark-map .leaflet-layer {
      filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%);
    }

    .custom-marker {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      margin-top: -30px;
    }
    .marker-dot {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: #3B82F6;
      border: 3px solid white;
      box-shadow: 0 0 10px rgba(0,0,0,0.5);
      z-index: 2;
    }
    .marker-label {
      background: rgba(30, 38, 66, 0.9);
      color: white;
      padding: 4px 8px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
      margin-bottom: 4px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.3);
      border: 1px solid rgba(255,255,255,0.2);
    }
  </style>
</head>
<body class="dark-map">
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: false, attributionControl: false }).setView([0, 0], 2);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

    var markers = {};
    var bounds = L.latLngBounds();

    window.updateLocations = function(locationsJson) {
      try {
        var targets = JSON.parse(locationsJson);
        bounds = L.latLngBounds();
        var hasValidCoords = false;

        targets.forEach(function(t) {
          if (t.lat && t.lng) {
            hasValidCoords = true;
            var latLng = [t.lat, t.lng];
            bounds.extend(latLng);

            if (markers[t.id]) {
              markers[t.id].setLatLng(latLng);
            } else {
              var iconHtml = "<div class='custom-marker'><div class='marker-label'>" + t.name + "</div><div class='marker-dot'></div></div>";
              var icon = L.divIcon({
                className: 'custom-div-icon',
                html: iconHtml,
                iconSize: [120, 60],
                iconAnchor: [60, 60]
              });
              markers[t.id] = L.marker(latLng, { icon: icon }).addTo(map);
            }
          }
        });
      } catch (e) {
        console.error("Map JS Error:", e);
      }
    };

    window.fitAll = function() {
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      }
    };

    window.addEventListener('message', function(event) {
      try {
        var data = JSON.parse(event.data);
        if (data.type === 'UPDATE_LOCATIONS') {
          window.updateLocations(data.locationsStr);
        } else if (data.type === 'FIT_ALL') {
          window.fitAll();
        }
      } catch(e) {}
    });
  </script>
</body>
</html>
`;

export default function GlobalMapScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const iframeRef = useRef(null);
  
  const [sessions, setSessions] = useState([]);
  const [locations, setLocations] = useState({});
  const [loading, setLoading] = useState(true);
  const [mapHtml, setMapHtml] = useState('');

  useEffect(() => {
    const blob = new Blob([MAP_HTML], { type: 'text/html' });
    setMapHtml(URL.createObjectURL(blob));
  }, []);

  const postMessageToMap = (data) => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage(JSON.stringify(data), '*');
    }
  };

  // 1. Fetch active sessions where user is the tracker
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'trackingSessions'),
      where('trackerId', '==', user.uid),
      where('status', '==', 'active')
    );
    
    const unsub = onSnapshot(q, (snap) => {
      const active = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setSessions(active);
      setLoading(false);
    });
    
    return unsub;
  }, [user]);

  // 2. Listen to locations for all active sessions
  useEffect(() => {
    if (sessions.length === 0) return;
    
    const unsubs = [];
    sessions.forEach(session => {
      // Locations are stored in a document where the ID is the targetId
      const targetId = session.targetId;
      if (!targetId) return;
      
      const unsub = onSnapshot(doc(db, 'locations', targetId), (snap) => {
        if (snap.exists()) {
          const locData = snap.data();
          setLocations(prev => ({
            ...prev,
            [session.id]: {
              id: session.id,
              name: session.targetName,
              lat: locData.latitude,
              lng: locData.longitude,
            }
          }));
        }
      });
      unsubs.push(unsub);
    });
    
    return () => unsubs.forEach(fn => fn());
  }, [sessions]);

  // 3. Send locations to WebView
  useEffect(() => {
    if (Object.keys(locations).length > 0) {
      const targets = Object.values(locations);
      postMessageToMap({
        type: 'UPDATE_LOCATIONS',
        locationsStr: JSON.stringify(targets)
      });
    }
  }, [locations]);

  const fitAllMarkers = () => {
    postMessageToMap({ type: 'FIT_ALL' });
  };

  return (
    <View style={styles.container}>
      {!!mapHtml && (
        <iframe
          ref={iframeRef}
          src={mapHtml}
          style={styles.map}
          title="Global Map"
          onLoad={() => {
            if (Object.keys(locations).length > 0) {
              const targets = Object.values(locations);
              postMessageToMap({
                type: 'UPDATE_LOCATIONS',
                locationsStr: JSON.stringify(targets)
              });
              setTimeout(fitAllMarkers, 100);
            }
          }}
        />
      )}
      
      {/* Header Back Button */}
      <SafeAreaView style={styles.headerSafeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>Global Map</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>

      {/* Floating Action Button for Fit All */}
      <TouchableOpacity style={styles.fab} onPress={fitAllMarkers}>
        <Ionicons name="scan-outline" size={24} color="#FFF" />
      </TouchableOpacity>
      
      {/* Target List Floating Card */}
      <View style={styles.targetListCard}>
        <Text style={styles.cardTitle}>Tracking {sessions.length} people</Text>
        {sessions.map(s => (
          <View key={s.id} style={styles.targetRow}>
            <View style={styles.targetDot} />
            <Text style={styles.targetName}>{s.targetName}</Text>
          </View>
        ))}
        {sessions.length === 0 && !loading && (
          <Text style={styles.emptyText}>No active sessions</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  map: {
    flex: 1,
    width: '100%',
    height: '100%',
    border: 'none',
  },
  headerSafeArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(30, 38, 66, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  title: {
    ...Typography.bodySemiBold,
    color: Colors.textPrimary,
    backgroundColor: 'rgba(30, 38, 66, 0.8)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    overflow: 'hidden',
  },
  fab: {
    position: 'absolute',
    bottom: 180,
    right: Spacing.xl,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 10,
  },
  targetListCard: {
    position: 'absolute',
    bottom: 40,
    left: Spacing.xl,
    right: Spacing.xl,
    backgroundColor: 'rgba(30, 38, 66, 0.95)',
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    zIndex: 10,
  },
  cardTitle: {
    ...Typography.bodySemiBold,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  targetDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginRight: Spacing.md,
  },
  targetName: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  emptyText: {
    ...Typography.body,
    color: Colors.textTertiary,
  },
});

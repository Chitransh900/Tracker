import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
  Modal,
  TextInput,
  ScrollView,
  Alert,
  Linking,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
// removed LinearGradient
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  doc,
  onSnapshot,
  collection,
  query,
  orderBy,
  limit,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Gradients } from '../../constants/colors';
import { Typography, Spacing, BorderRadius } from '../../constants/theme';
import {
  haversineDistance,
  formatDistance,
  estimateETA,
  reverseGeocode,
  getWeather,
  checkGeofences,
  getStreetViewUrl,
} from '../../services/GeoUtils';

const { width, height } = Dimensions.get('window');

// Preset quick messages
const QUICK_MESSAGES = [
  { text: 'Where are you heading?', icon: '🧭' },
  { text: 'Come home soon', icon: '🏠' },
  { text: 'Are you okay?', icon: '💙' },
  { text: 'Call me', icon: '📞' },
  { text: 'Stay safe!', icon: '🛡️' },
  { text: "I'm on my way", icon: '🚗' },
];

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const MAP_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    body { padding: 0; margin: 0; background-color: #f8fafc; overflow: hidden; transition: background-color 0.3s; }
    #map { height: 100vh; width: 100vw; }
    .leaflet-container { background: transparent; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    .leaflet-control-container { display: none; }
    
    /* Dark Mode map inversion */
    body.dark-map { background-color: #0f172a; }
    body.dark-map .leaflet-layer,
    body.dark-map .leaflet-control-zoom-in,
    body.dark-map .leaflet-control-zoom-out,
    body.dark-map .leaflet-control-attribution {
      filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%);
    }

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
    .geofence-label {
      background: rgba(139, 92, 246, 0.85);
      border: 1px solid rgba(139, 92, 246, 0.5);
      border-radius: 6px;
      padding: 2px 8px;
      color: white;
      font-size: 11px;
      font-weight: 600;
      white-space: nowrap;
      text-align: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }
    .tap-popup {
      background: rgba(30, 38, 66, 0.95);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      padding: 8px 12px;
      color: #F8FAFC;
      font-size: 12px;
      max-width: 220px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    }
    .tap-popup .leaflet-popup-tip { background: rgba(30, 38, 66, 0.95); }
    .leaflet-popup-content-wrapper { background: transparent; box-shadow: none; padding: 0; }
    .leaflet-popup-content { margin: 0; }
    .leaflet-popup-close-button { color: #94A3B8 !important; font-size: 16px !important; }
  </style>
</head>
<body class="dark-map">
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: false, attributionControl: false }).setView([28.6139, 77.209], 15);
    
    // Default to detailed OpenStreetMap
    var tileLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    var marker = null;
    var accuracyCircle = null;
    var routePolyline = null;
    var geofenceCircles = {};
    var geofenceLabels = {};
    var tapPopup = null;

    var customIcon = L.divIcon({
      className: 'custom-div-icon',
      html: "<div class='custom-marker'><div class='pulse'></div><div class='custom-marker-inner'></div></div>",
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    window.setTheme = function(theme) {
      if (theme === 'dark') {
        document.body.classList.add('dark-map');
      } else {
        document.body.classList.remove('dark-map');
      }
    };

    // ---- Location ----
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
        // Remove dark map inversion for satellite imagery
        document.body.classList.remove('dark-map');
        tileLayer.setUrl('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}');
      } else {
        // Re-apply theme class if it was dark
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'REQUEST_THEME' }));
        tileLayer.setUrl('https://tile.openstreetmap.org/{z}/{x}/{y}.png');
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

    // ---- Geofences ----
    window.addGeofence = function(id, lat, lng, radius, name) {
      if (geofenceCircles[id]) {
        map.removeLayer(geofenceCircles[id]);
      }
      if (geofenceLabels[id]) {
        map.removeLayer(geofenceLabels[id]);
      }
      geofenceCircles[id] = L.circle([lat, lng], {
        radius: radius,
        color: '#8B5CF6',
        weight: 2,
        dashArray: '8, 6',
        fillColor: '#8B5CF6',
        fillOpacity: 0.08
      }).addTo(map);

      geofenceLabels[id] = L.marker([lat, lng], {
        icon: L.divIcon({
          className: '',
          html: "<div class='geofence-label'>" + name + "</div>",
          iconSize: [80, 20],
          iconAnchor: [40, 10]
        })
      }).addTo(map);
    };

    window.removeGeofence = function(id) {
      if (geofenceCircles[id]) {
        map.removeLayer(geofenceCircles[id]);
        delete geofenceCircles[id];
      }
      if (geofenceLabels[id]) {
        map.removeLayer(geofenceLabels[id]);
        delete geofenceLabels[id];
      }
    };

    window.clearGeofences = function() {
      Object.keys(geofenceCircles).forEach(function(id) {
        map.removeLayer(geofenceCircles[id]);
        if (geofenceLabels[id]) map.removeLayer(geofenceLabels[id]);
      });
      geofenceCircles = {};
      geofenceLabels = {};
    };

    // ---- Map interactions ----
    // Use contextmenu for reliable long-press on mobile
    map.on('contextmenu', function(e) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'MAP_LONG_PRESS',
          lat: e.latlng.lat,
          lng: e.latlng.lng
        }));
      }
    });

    // Tap for address
    map.on('click', function(e) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'MAP_TAP',
          lat: e.latlng.lat,
          lng: e.latlng.lng
        }));
      }
    });

    window.showTapPopup = function(lat, lng, address) {
      if (tapPopup) { map.closePopup(tapPopup); }
      tapPopup = L.popup({ className: 'tap-popup', closeButton: true, maxWidth: 220 })
        .setLatLng([lat, lng])
        .setContent('<div class="tap-popup">' + address + '</div>')
        .openOn(map);
    };
  </script>
</body>
</html>
`;

export default function TrackScreen() {
  const params = useLocalSearchParams();
  const { sessionId, targetId, targetName } = params;
  const router = useRouter();
  const { user } = useAuth();
  const webViewRef = useRef(null);

  // Existing state
  const [location, setLocation] = useState(null);
  const [routeHistory, setRouteHistory] = useState([]);
  const [showRoute, setShowRoute] = useState(false);
  const [showInfo, setShowInfo] = useState(true);
  const [mapType, setMapType] = useState('standard');
  const [theme, setTheme] = useState('dark');
  const [lastUpdated, setLastUpdated] = useState(null);

  // New state — Address
  const [address, setAddress] = useState(null);

  // New state — Weather
  const [weather, setWeather] = useState(null);

  // New state — Distance & ETA
  const [trackerLocation, setTrackerLocation] = useState(null);
  const [distanceInfo, setDistanceInfo] = useState({ distance: null, eta: null });

  // New state — Quick Messages
  const [showQuickMessage, setShowQuickMessage] = useState(false);
  const [customMessage, setCustomMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [targetPhone, setTargetPhone] = useState(null);
  const [targetPushToken, setTargetPushToken] = useState(null);
  const [latestMessage, setLatestMessage] = useState(null);

  // New state — Geofences
  const [geofences, setGeofences] = useState([]);
  const [showGeofenceModal, setShowGeofenceModal] = useState(false);
  const [geofenceCoords, setGeofenceCoords] = useState(null);
  const [geofenceName, setGeofenceName] = useState('');
  const [geofenceRadius, setGeofenceRadius] = useState(500);
  const [geofenceAlertType, setGeofenceAlertType] = useState('both');
  const geofencePrevStates = useRef({});

  // ============================================
  // Get tracker's own location (for distance/ETA)
  // ============================================
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setTrackerLocation({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
        }
      } catch (err) {
        console.warn('Could not get tracker location:', err);
      }
    })();
  }, []);

  // ============================================
  // Real-time location listener
  // ============================================
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

  // ============================================
  // Address lookup (debounced)
  // ============================================
  useEffect(() => {
    if (!location?.latitude || !location?.longitude) return;

    const timer = setTimeout(async () => {
      const addr = await reverseGeocode(location.latitude, location.longitude);
      setAddress(addr);
    }, 2000); // 2s debounce

    return () => clearTimeout(timer);
  }, [location?.latitude, location?.longitude]);

  // ============================================
  // Fetch Target Phone (Real-time)
  // ============================================
  useEffect(() => {
    if (!targetId) return;
    const unsubscribe = onSnapshot(doc(db, 'users', targetId), (docSnap) => {
      if (docSnap.exists()) {
        setTargetPhone(docSnap.data().phoneNumber);
        setTargetPushToken(docSnap.data().expoPushToken);
      }
    });
    return unsubscribe;
  }, [targetId]);

  // ============================================
  // Incoming Message Listener
  // ============================================
  useEffect(() => {
    if (!sessionId || !user?.uid) return;
    const q = query(
      collection(db, 'messages'),
      where('sessionId', '==', sessionId)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const msg = change.doc.data();
          if (msg.receiverId === user.uid) {
            // Only show recent messages (last 10 seconds)
            if (!msg.createdAt || (Date.now() - msg.createdAt.toMillis() < 10000)) {
              setLatestMessage({ text: msg.text, sender: msg.senderName });
              setTimeout(() => setLatestMessage(null), 5000);
            }
          }
        }
      });
    });
    return unsubscribe;
  }, [sessionId, user?.uid]);

  // ============================================
  // Weather fetch
  // ============================================
  useEffect(() => {
    if (!location?.latitude || !location?.longitude) return;

    const fetchWeather = async () => {
      const data = await getWeather(location.latitude, location.longitude);
      setWeather(data);
    };

    fetchWeather();

    // Refresh every 10 minutes
    const interval = setInterval(fetchWeather, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [location?.latitude, location?.longitude]);

  // ============================================
  // Distance & ETA calculation
  // ============================================
  useEffect(() => {
    if (!trackerLocation || !location?.latitude) return;

    const dist = haversineDistance(
      trackerLocation.latitude,
      trackerLocation.longitude,
      location.latitude,
      location.longitude
    );

    const eta = estimateETA(dist, location.speed);
    setDistanceInfo({ distance: dist, eta });
  }, [trackerLocation, location?.latitude, location?.longitude, location?.speed]);

  // ============================================
  // Geofences listener
  // ============================================
  useEffect(() => {
    if (!user?.uid || !targetId) return;

    const geofencesRef = collection(db, 'geofences');
    const q = query(
      geofencesRef,
      where('createdBy', '==', user.uid),
      where('targetId', '==', targetId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fences = [];
      snapshot.forEach((d) => {
        fences.push({ id: d.id, ...d.data() });
      });
      setGeofences(fences);

      // Draw geofences on map
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(`window.clearGeofences(); true;`);
        fences.forEach((fence) => {
          if (fence.enabled) {
            const safeName = fence.name.replace(/'/g, "\\'");
            webViewRef.current.injectJavaScript(
              `window.addGeofence('${fence.id}', ${fence.latitude}, ${fence.longitude}, ${fence.radius}, '${safeName}'); true;`
            );
          }
        });
      }
    });

    return unsubscribe;
  }, [user?.uid, targetId]);

  // ============================================
  // Geofence checking on location update
  // ============================================
  useEffect(() => {
    if (!location?.latitude || !location?.longitude || geofences.length === 0) return;

    // Build fences with previous states
    const fencesWithState = geofences.map((f) => ({
      ...f,
      lastState: geofencePrevStates.current[f.id] || null,
    }));

    const events = checkGeofences(location.latitude, location.longitude, fencesWithState);

    // Update previous states
    geofences.forEach((f) => {
      const dist = haversineDistance(location.latitude, location.longitude, f.latitude, f.longitude);
      geofencePrevStates.current[f.id] = dist <= f.radius ? 'inside' : 'outside';
    });

    // Fire notifications for events
    events.forEach(async (ev) => {
      const action = ev.event === 'entered' ? 'arrived at' : 'left';
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `📍 Geofence Alert`,
          body: `${targetName || 'Target'} ${action} ${ev.geofence.name}`,
          sound: true,
        },
        trigger: null, // Immediate
      });

      // Update lastState in Firestore
      try {
        await updateDoc(doc(db, 'geofences', ev.geofence.id), {
          lastState: ev.event === 'entered' ? 'inside' : 'outside',
        });
      } catch (err) {
        console.warn('Failed to update geofence state:', err);
      }
    });
  }, [location?.latitude, location?.longitude, geofences]);

  // ============================================
  // Load route history
  // ============================================
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
          if (!points || points.length === 0) {
            Alert.alert("No Route History", "There is no recent location history for this target.");
            setShowRoute(false);
          } else {
            if (webViewRef.current) {
              webViewRef.current.injectJavaScript(`window.drawRoute('${JSON.stringify(points)}'); true;`);
            }
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

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`window.setTheme('${newTheme}'); true;`);
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
      webViewRef.current.injectJavaScript(`window.setTheme('${theme}'); true;`);
      webViewRef.current.injectJavaScript(`window.updateLocation(${location.latitude}, ${location.longitude}, ${location.accuracy || 0}, true); true;`);

      // Draw existing geofences
      geofences.forEach((fence) => {
        if (fence.enabled) {
          const safeName = fence.name.replace(/'/g, "\\'");
          webViewRef.current.injectJavaScript(
            `window.addGeofence('${fence.id}', ${fence.latitude}, ${fence.longitude}, ${fence.radius}, '${safeName}'); true;`
          );
        }
      });
    }
  };

  // ============================================
  // Handle messages from WebView (map taps)
  // ============================================
  const handleWebViewMessage = useCallback(async (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === 'REQUEST_THEME') {
        if (webViewRef.current) {
          webViewRef.current.injectJavaScript(`window.setTheme('${theme}'); true;`);
        }
      }

      if (data.type === 'MAP_LONG_PRESS') {
        // Open geofence creation modal
        setGeofenceCoords({ latitude: data.lat, longitude: data.lng });
        setGeofenceName('');
        setGeofenceRadius(500);
        setGeofenceAlertType('both');
        setShowGeofenceModal(true);
      }

      if (data.type === 'MAP_TAP') {
        // Reverse geocode tapped point
        const addr = await reverseGeocode(data.lat, data.lng);
        if (webViewRef.current && addr) {
          const safeAddr = addr.replace(/'/g, "\\'");
          webViewRef.current.injectJavaScript(
            `window.showTapPopup(${data.lat}, ${data.lng}, '${safeAddr}'); true;`
          );
        }
      }
    } catch (err) {
      // Not a JSON message
    }
  }, []);

  // ============================================
  // Create Geofence
  // ============================================
  const handleCreateGeofence = async () => {
    if (!geofenceName.trim() || !geofenceCoords) return;

    try {
      await addDoc(collection(db, 'geofences'), {
        createdBy: user.uid,
        sessionId: sessionId || null,
        targetId,
        targetName: targetName || 'Unknown',
        name: geofenceName.trim(),
        latitude: geofenceCoords.latitude,
        longitude: geofenceCoords.longitude,
        radius: geofenceRadius,
        alertType: geofenceAlertType,
        enabled: true,
        lastState: null,
        createdAt: serverTimestamp(),
      });

      setShowGeofenceModal(false);
    } catch (err) {
      Alert.alert('Error', 'Failed to create geofence');
    }
  };

  // ============================================
  // Send Quick Message
  // ============================================
  const handleSendMessage = async (text) => {
    if (!text.trim() || sendingMessage) return;
    setSendingMessage(true);

    try {
      await addDoc(collection(db, 'messages'), {
        sessionId: sessionId || null,
        senderId: user.uid,
        senderName: user.displayName || 'Unknown',
        receiverId: targetId,
        text: text.trim(),
        type: 'quick',
        read: false,
        createdAt: serverTimestamp(),
      });

      if (targetPushToken) {
        fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Accept-encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: targetPushToken,
            sound: 'default',
            priority: 'high',
            channelId: 'messages',
            title: `New Message from ${user.displayName || 'Tracker'}`,
            body: `${text.trim()} (${new Date().toLocaleTimeString()})`,
            data: { type: 'message', timestamp: Date.now() },
            _contentAvailable: true,
          }),
        }).catch(() => {});
      } else {
        Alert.alert('Notice', 'The target device has not registered for background notifications. They must open the app once to receive messages while closed.');
      }

      setShowQuickMessage(false);
      setCustomMessage('');
    } catch (err) {
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleCallTarget = () => {
    if (targetPhone) {
      Linking.openURL(`tel:${targetPhone}`);
    } else {
      Alert.alert(
        'No Phone Number', 
        'The target device has not set up a phone number in their Settings. They must log in and save their number first.'
      );
    }
  };

  const handleGetDirections = () => {
    if (!trackerLocation || !location) {
      Alert.alert('Location unavailable', 'Waiting for GPS signal to calculate route.');
      return;
    }
    const url = `https://www.google.com/maps/dir/?api=1&origin=${trackerLocation.latitude},${trackerLocation.longitude}&destination=${location.latitude},${location.longitude}`;
    Linking.openURL(url);
  };

  const handleTriggerAlarm = async () => {
    if (!targetId) return;
    try {
      await addDoc(collection(db, 'commands'), {
        targetId: targetId,
        command: 'ALARM',
        createdAt: serverTimestamp(),
      });

      // Send Push Notification to wake up the app and ring loudly
      if (targetPushToken) {
        // Send high-priority push notification with alarm channel
        // Android will show this natively even when the app is fully killed
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Accept-encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: targetPushToken,
            sound: 'default',
            priority: 'high',
            channelId: 'alarm_full_screen',
            title: '🚨 PANIC ALARM TRIGGERED 🚨',
            body: `Your tracker has activated the panic alarm! (${new Date().toLocaleTimeString()})`,
            data: { type: 'alarm', timestamp: Date.now() },
            _contentAvailable: true,
          }),
        }).catch(() => {});
        Alert.alert('Alarm Triggered', 'The target device will now play a loud siren.');
      } else {
        Alert.alert('Cannot Send Background Alarm', 'The target device has not registered for push notifications. They need to open the latest version of the app at least once to enable this feature.');
      }
    } catch (err) {
      console.warn('Failed to trigger alarm', err);
    }
  };

  // ============================================
  // Open Street View
  // ============================================
  const openStreetView = () => {
    if (!location?.latitude || !location?.longitude) return;
    const url = getStreetViewUrl(location.latitude, location.longitude);
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Could not open Street View');
    });
  };

  // ============================================
  // Helpers
  // ============================================
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

  const RADIUS_OPTIONS = [100, 200, 500, 1000, 2000, 5000];

  // Dynamic Theme Colors
  const tColors = theme === 'dark' ? {
    bg: Colors.background,
    surface: 'rgba(30, 41, 59, 0.7)',
    surfaceSolid: Colors.backgroundSecondary,
    border: 'rgba(255, 255, 255, 0.1)',
    text: Colors.textPrimary,
    textSec: Colors.textSecondary,
    textMuted: Colors.textMuted,
    panelBg: ['rgba(15, 23, 42, 0.85)', 'rgba(2, 6, 23, 0.95)'],
    glassBorder: 'rgba(255, 255, 255, 0.1)',
  } : {
    bg: '#F8FAFC',
    surface: 'rgba(255, 255, 255, 0.7)',
    surfaceSolid: '#FFFFFF',
    border: 'rgba(0, 0, 0, 0.1)',
    text: '#0F172A',
    textSec: '#475569',
    textMuted: '#94A3B8',
    panelBg: ['rgba(255, 255, 255, 0.85)', 'rgba(241, 245, 249, 0.95)'],
    glassBorder: 'rgba(0, 0, 0, 0.1)',
  };

  return (
    <View style={[styles.container, { backgroundColor: tColors.bg }]}>
      {/* Map */}
      <WebView
        ref={webViewRef}
        style={styles.map}
        source={{ html: MAP_HTML }}
        scrollEnabled={false}
        bounces={false}
        onLoadEnd={handleMapLoad}
        onMessage={handleWebViewMessage}
      />

      {/* Toast Notification for Incoming Message */}
      {latestMessage && (
        <View style={styles.toastContainer}>
          <View style={styles.toastContent}>
            <Ionicons name="chatbubble-ellipses" size={20} color={Colors.primary} />
            <Text style={styles.toastText}>
              <Text style={{ fontWeight: 'bold' }}>{latestMessage.sender}: </Text>
              {latestMessage.text}
            </Text>
          </View>
        </View>
      )}

      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={[styles.backButton, { backgroundColor: tColors.surface, borderColor: tColors.glassBorder }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={tColors.text} />
        </TouchableOpacity>
        <View style={styles.topBarTitle}>
          <Text style={[styles.trackingName, { color: tColors.text }]}>{targetName || 'Unknown'}</Text>
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </View>
        <View style={styles.topBarSpacer} />
      </View>

      {/* Map controls (Horizontal Toolbar at Top) */}
      <View style={styles.mapControls}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.sm }}>
          <TouchableOpacity style={[styles.mapControlBtn, { backgroundColor: tColors.surface, borderColor: tColors.glassBorder }]} onPress={centerOnTarget}>
            <Ionicons name="locate" size={20} color={tColors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.mapControlBtn, { backgroundColor: tColors.surface, borderColor: tColors.glassBorder }]} onPress={toggleTheme}>
            <Ionicons name={theme === 'dark' ? 'sunny' : 'moon'} size={20} color={tColors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.mapControlBtn, { backgroundColor: tColors.surface, borderColor: tColors.glassBorder }]} onPress={toggleMapType}>
            <Ionicons name={mapType === 'standard' ? 'earth' : 'map'} size={20} color={tColors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.mapControlBtn, { backgroundColor: tColors.surface, borderColor: tColors.glassBorder }, showRoute && styles.mapControlActive]}
            onPress={toggleRoute}
          >
            <Ionicons name="trail-sign" size={20} color={showRoute ? Colors.primary : tColors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.mapControlBtn, { backgroundColor: tColors.surface, borderColor: tColors.glassBorder }]} onPress={openStreetView}>
            <Ionicons name="eye" size={20} color={tColors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.mapControlBtn, { backgroundColor: tColors.surface, borderColor: tColors.glassBorder }]} onPress={handleGetDirections}>
            <Ionicons name="navigate" size={20} color={tColors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.mapControlBtn, { backgroundColor: tColors.surface, borderColor: tColors.glassBorder }]} onPress={handleTriggerAlarm}>
            <Ionicons name="warning" size={20} color={Colors.danger} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.mapControlBtn, { backgroundColor: tColors.surface, borderColor: tColors.glassBorder }, geofences.length > 0 && styles.mapControlActive]}
            onPress={() => router.push(`/(main)/geofences?targetId=${targetId}&targetName=${targetName || ''}&sessionId=${sessionId || ''}`)}
          >
            <Ionicons name="shield" size={20} color={geofences.length > 0 ? Colors.primary : tColors.text} />
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Bottom Container (Groups FAB and Info Panel to prevent overlap) */}
      <View style={styles.bottomContainer} pointerEvents="box-none">
        {/* Quick Message FAB */}
        {targetPhone && (
          <TouchableOpacity
            style={[styles.messageFab, { bottom: 100, backgroundColor: Colors.success }]}
            onPress={handleCallTarget}
          >
            <View style={[styles.messageFabGradient, { backgroundColor: Colors.success }]}>
              <Ionicons name="call" size={22} color="#FFF" />
            </View>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.messageFab}
          onPress={() => setShowQuickMessage(true)}
        >
          <View style={[styles.messageFabGradient, { backgroundColor: Colors.primary }]}>
            <Ionicons name="chatbubble" size={22} color="#FFF" />
          </View>
        </TouchableOpacity>

        {/* Info Panel */}
        {location && (
          <View style={styles.infoPanel}>
            <View
              style={[styles.infoPanelGradient, { backgroundColor: tColors.surface, borderColor: tColors.border }]}
            >
              <TouchableOpacity
                style={styles.infoPanelHandle}
                onPress={() => setShowInfo(!showInfo)}
              >
                <View style={styles.handleBar} />
              </TouchableOpacity>

              {showInfo && (
                <View>
                  {/* Address Row */}
                  {address && (
                    <View style={styles.addressRow}>
                      <Ionicons name="location" size={14} color={Colors.primary} />
                      <Text style={[styles.addressText, { color: tColors.text }]} numberOfLines={1}>
                        {address}
                      </Text>
                    </View>
                  )}

                  {/* Weather Row */}
                  {weather && (
                    <View style={[styles.weatherRow, { backgroundColor: tColors.surface, borderColor: tColors.border }]}>
                      <Text style={styles.weatherEmoji}>{weather.icon}</Text>
                      <Text style={[styles.weatherTemp, { color: tColors.text }]}>{weather.temp}°C</Text>
                      <Text style={[styles.weatherCondition, { color: tColors.textSec }]}>{weather.condition}</Text>
                    </View>
                  )}

                  <View style={styles.infoGrid}>
                    {/* Last Updated */}
                    <View style={[styles.infoItem, { backgroundColor: tColors.surface, borderColor: tColors.border }]}>
                      <Ionicons name="time-outline" size={16} color={Colors.primary} />
                      <Text style={[styles.infoLabel, { color: tColors.textSec }]}>Updated</Text>
                      <Text style={[styles.infoValue, { color: tColors.text }]}>{formatTime(lastUpdated)}</Text>
                    </View>

                    {/* Battery */}
                    <View style={[styles.infoItem, { backgroundColor: tColors.surface, borderColor: tColors.border }]}>
                      <Ionicons
                        name="battery-half"
                        size={16}
                        color={getBatteryColor(location.battery)}
                      />
                      <Text style={[styles.infoLabel, { color: tColors.textSec }]}>Battery</Text>
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
                    <View style={[styles.infoItem, { backgroundColor: tColors.surface, borderColor: tColors.border }]}>
                      <Ionicons name="speedometer-outline" size={16} color={Colors.accent} />
                      <Text style={[styles.infoLabel, { color: tColors.textSec }]}>Speed</Text>
                      <Text style={[styles.infoValue, { color: tColors.text }]}>
                        {location.speed != null && location.speed >= 0
                          ? `${(location.speed * 3.6).toFixed(1)} km/h`
                          : '--'}
                      </Text>
                    </View>

                    {/* Distance & ETA */}
                    <View style={[styles.infoItem, { backgroundColor: tColors.surface, borderColor: tColors.border }]}>
                      <Ionicons name="navigate-outline" size={16} color={Colors.success} />
                      <Text style={[styles.infoLabel, { color: tColors.textSec }]}>Distance</Text>
                      <Text style={[styles.infoValue, { color: tColors.text }]}>
                        {distanceInfo.distance != null
                          ? formatDistance(distanceInfo.distance)
                          : '--'}
                      </Text>
                      {distanceInfo.eta && (
                        <Text style={styles.infoEta}>ETA {distanceInfo.eta}</Text>
                      )}
                    </View>
                  </View>

                  {/* Coordinates */}
                  <View style={styles.coordsRow}>
                    <Ionicons name="compass-outline" size={14} color={tColors.textSec} />
                    <Text style={[styles.coordsText, { color: tColors.textSec }]}>
                      {location.latitude?.toFixed(6)}, {location.longitude?.toFixed(6)}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}
      </View>

      {/* ============================================ */}
      {/* Quick Message Modal */}
      {/* ============================================ */}
      <Modal
        visible={showQuickMessage}
        transparent
        animationType="slide"
        onRequestClose={() => setShowQuickMessage(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowQuickMessage(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHandle}>
              <View style={styles.handleBar} />
            </View>

            <Text style={styles.modalTitle}>Quick Message</Text>
            <Text style={styles.modalSubtitle}>
              Send a message to {targetName || 'target'}
            </Text>

            <ScrollView style={styles.quickMessageList} showsVerticalScrollIndicator={false}>
              {QUICK_MESSAGES.map((msg, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.quickMessageItem}
                  onPress={() => handleSendMessage(msg.text)}
                  disabled={sendingMessage}
                >
                  <Text style={styles.quickMessageEmoji}>{msg.icon}</Text>
                  <Text style={styles.quickMessageText}>{msg.text}</Text>
                  <Ionicons name="send" size={16} color={Colors.primary} />
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Custom message input */}
            <View style={styles.customMessageRow}>
              <TextInput
                style={styles.customMessageInput}
                placeholder="Type a message..."
                placeholderTextColor={Colors.textMuted}
                value={customMessage}
                onChangeText={setCustomMessage}
                returnKeyType="send"
                onSubmitEditing={() => customMessage.trim() && handleSendMessage(customMessage)}
              />
              <TouchableOpacity
                style={[
                  styles.customSendBtn,
                  (!customMessage.trim() || sendingMessage) && styles.customSendBtnDisabled,
                ]}
                onPress={() => handleSendMessage(customMessage)}
                disabled={!customMessage.trim() || sendingMessage}
              >
                <Ionicons name="send" size={18} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ============================================ */}
      {/* Geofence Creation Modal */}
      {/* ============================================ */}
      <Modal
        visible={showGeofenceModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowGeofenceModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowGeofenceModal(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHandle}>
              <View style={styles.handleBar} />
            </View>

            <Text style={styles.modalTitle}>Create Geofence</Text>
            <Text style={styles.modalSubtitle}>
              Get notified when {targetName || 'target'} enters or leaves this area
            </Text>

            {/* Name Input */}
            <Text style={styles.fieldLabel}>Zone Name</Text>
            <TextInput
              style={styles.geofenceInput}
              placeholder="e.g. Home, School, Office"
              placeholderTextColor={Colors.textMuted}
              value={geofenceName}
              onChangeText={setGeofenceName}
            />

            {/* Radius Selection */}
            <Text style={styles.fieldLabel}>Radius</Text>
            <View style={styles.radiusOptions}>
              {RADIUS_OPTIONS.map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[
                    styles.radiusOption,
                    geofenceRadius === r && styles.radiusOptionActive,
                  ]}
                  onPress={() => setGeofenceRadius(r)}
                >
                  <Text
                    style={[
                      styles.radiusOptionText,
                      geofenceRadius === r && styles.radiusOptionTextActive,
                    ]}
                  >
                    {r >= 1000 ? `${r / 1000}km` : `${r}m`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ marginTop: 15 }}>
              <Text style={styles.fieldLabel}>Custom Radius (meters)</Text>
              <TextInput
                style={styles.geofenceInput}
                placeholder="Enter custom meters (e.g. 23)"
                placeholderTextColor={Colors.textMuted}
                keyboardType="numeric"
                value={geofenceRadius ? geofenceRadius.toString() : ''}
                onChangeText={(text) => {
                  const val = parseInt(text.replace(/[^0-9]/g, ''), 10);
                  setGeofenceRadius(isNaN(val) ? 0 : val);
                }}
              />
            </View>

            {/* Alert Type */}
            <Text style={styles.fieldLabel}>Alert When</Text>
            <View style={styles.alertTypeOptions}>
              {[
                { value: 'enter', label: 'Enters', icon: 'arrow-down-circle' },
                { value: 'exit', label: 'Exits', icon: 'arrow-up-circle' },
                { value: 'both', label: 'Both', icon: 'swap-vertical' },
              ].map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.alertTypeOption,
                    geofenceAlertType === opt.value && styles.alertTypeOptionActive,
                  ]}
                  onPress={() => setGeofenceAlertType(opt.value)}
                >
                  <Ionicons
                    name={opt.icon}
                    size={18}
                    color={geofenceAlertType === opt.value ? Colors.primary : Colors.textTertiary}
                  />
                  <Text
                    style={[
                      styles.alertTypeText,
                      geofenceAlertType === opt.value && styles.alertTypeTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Create Button */}
            <TouchableOpacity
              style={[
                styles.createGeofenceBtn,
                !geofenceName.trim() && styles.createGeofenceBtnDisabled,
              ]}
              onPress={handleCreateGeofence}
              disabled={!geofenceName.trim()}
            >
              <View
                style={[styles.createGeofenceBtnGradient, { backgroundColor: geofenceName.trim() ? Colors.primary : Colors.surface }]}
              >
                <Ionicons name="shield-checkmark" size={20} color="#FFF" />
                <Text style={styles.createGeofenceBtnText}>Create Geofence</Text>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  toastContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 20,
    right: 20,
    zIndex: 100,
    alignItems: 'center',
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  toastText: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
    marginLeft: Spacing.sm,
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
    left: Spacing.lg,
    right: Spacing.lg,
    top: 110,
    height: 44,
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

  // Bottom Container
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'flex-end',
  },
  
  // Message FAB
  messageFab: {
    marginRight: Spacing.lg,
    marginBottom: Spacing.md,
  },
  messageFabGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },

  // Info Panel
  infoPanel: {
    width: '100%',
  },
  infoPanelGradient: {
    borderTopLeftRadius: BorderRadius.xxl,
    borderTopRightRadius: BorderRadius.xxl,
    padding: Spacing.xl,
    paddingBottom: Spacing.xxxl,
    borderTopWidth: 1,
  },
  infoPanelHandle: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.textMuted,
  },

  // Address row
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  addressText: {
    ...Typography.caption,
    color: Colors.textPrimary,
    marginLeft: Spacing.sm,
    flex: 1,
  },

  // Weather row
  weatherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  weatherEmoji: {
    fontSize: 18,
    marginRight: Spacing.sm,
  },
  weatherTemp: {
    ...Typography.bodySemiBold,
    color: Colors.textPrimary,
    marginRight: Spacing.sm,
  },
  weatherCondition: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  // Info grid
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
  infoEta: {
    ...Typography.small,
    color: Colors.accent,
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

  // ============================================
  // Modal shared styles
  // ============================================
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.backgroundSecondary,
    borderTopLeftRadius: BorderRadius.xxl,
    borderTopRightRadius: BorderRadius.xxl,
    padding: Spacing.xl,
    paddingBottom: Spacing.massive,
    maxHeight: height * 0.7,
    borderTopWidth: 1,
    borderColor: Colors.glassBorder,
  },
  modalHandle: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    ...Typography.heading3,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  modalSubtitle: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginBottom: Spacing.xl,
  },

  // Quick Messages
  quickMessageList: {
    maxHeight: 250,
    marginBottom: Spacing.lg,
  },
  quickMessageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickMessageEmoji: {
    fontSize: 20,
    marginRight: Spacing.md,
  },
  quickMessageText: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
    flex: 1,
  },
  customMessageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  customMessageInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    ...Typography.body,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  customSendBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customSendBtnDisabled: {
    backgroundColor: Colors.textMuted,
  },

  // Geofence Modal
  fieldLabel: {
    ...Typography.captionMedium,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  geofenceInput: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    ...Typography.body,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  radiusOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  radiusOption: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  radiusOptionActive: {
    backgroundColor: Colors.primarySoft,
    borderColor: Colors.primary,
  },
  radiusOptionText: {
    ...Typography.captionMedium,
    color: Colors.textSecondary,
  },
  radiusOptionTextActive: {
    color: Colors.primary,
  },
  alertTypeOptions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  alertTypeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.xs,
  },
  alertTypeOptionActive: {
    backgroundColor: Colors.primarySoft,
    borderColor: Colors.primary,
  },
  alertTypeText: {
    ...Typography.captionMedium,
    color: Colors.textSecondary,
  },
  alertTypeTextActive: {
    color: Colors.primary,
  },
  createGeofenceBtn: {
    marginTop: Spacing.xl,
  },
  createGeofenceBtnDisabled: {
    opacity: 0.6,
  },
  createGeofenceBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  createGeofenceBtnText: {
    ...Typography.button,
    color: '#FFF',
  },

  // Marker (unused but kept)
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
});

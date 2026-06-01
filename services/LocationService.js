import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Battery from 'expo-battery';
import { doc, setDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKGROUND_LOCATION_TASK = 'BACKGROUND_LOCATION_TASK';
const LOCATION_UPDATE_INTERVAL = 15000; // 15 seconds
const LOCATION_DISTANCE_INTERVAL = 10; // 10 meters

// ============================================================
// Define background task (must be at top level, outside component)
// ============================================================
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error('Background location error:', error.message);
    return;
  }
  if (data) {
    const { locations } = data;
    if (locations && locations.length > 0) {
      const location = locations[locations.length - 1]; // most recent
      try {
        // Get current userId from stored value or AsyncStorage if app was killed
        let userId = LocationService._currentUserId;
        if (!userId) {
          userId = await AsyncStorage.getItem('TRACKING_USER_ID');
        }
        
        if (userId) {
          await LocationService.uploadLocation(userId, location);
        }
      } catch (err) {
        console.error('Background upload error:', err);
      }
    }
  }
});

// ============================================================
// Location Service
// ============================================================
const LocationService = {
  _currentUserId: null,
  _foregroundSubscription: null,

  // Request foreground location permission
  async requestForegroundPermission() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  },

  // Request background location permission
  async requestBackgroundPermission() {
    const { status } = await Location.requestBackgroundPermissionsAsync();
    return status === 'granted';
  },

  // Check current permission status
  async getPermissionStatus() {
    const foreground = await Location.getForegroundPermissionsAsync();
    const background = await Location.getBackgroundPermissionsAsync();
    return {
      foreground: foreground.status === 'granted',
      background: background.status === 'granted',
    };
  },

  // Check if actively tracking
  async isTracking() {
    const isForeground = !!this._foregroundSubscription;
    const isBackground = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK).catch(() => false);
    return isForeground || isBackground;
  },

  // Start foreground location tracking
  async startForegroundTracking(userId, onLocationUpdate) {
    this._currentUserId = userId;
    await AsyncStorage.setItem('TRACKING_USER_ID', userId);

    const hasPermission = await this.requestForegroundPermission();
    if (!hasPermission) {
      throw new Error('Foreground location permission not granted');
    }

    // Stop existing subscription
    if (this._foregroundSubscription) {
      this._foregroundSubscription.remove();
    }

    this._foregroundSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: LOCATION_UPDATE_INTERVAL,
        distanceInterval: LOCATION_DISTANCE_INTERVAL,
      },
      async (location) => {
        try {
          await this.uploadLocation(userId, location);
          if (onLocationUpdate) {
            onLocationUpdate(location);
          }
        } catch (err) {
          console.error('Foreground location upload error:', err);
        }
      }
    );

    return true;
  },

  // Start background location tracking
  async startBackgroundTracking(userId) {
    this._currentUserId = userId;
    await AsyncStorage.setItem('TRACKING_USER_ID', userId);

    const hasBackground = await this.requestBackgroundPermission();
    if (!hasBackground) {
      throw new Error('Background location permission not granted');
    }

    const isTaskRunning = await Location.hasStartedLocationUpdatesAsync(
      BACKGROUND_LOCATION_TASK
    ).catch(() => false);

    if (isTaskRunning) {
      console.log('Background tracking already running');
      return true;
    }

    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: LOCATION_UPDATE_INTERVAL,
      distanceInterval: LOCATION_DISTANCE_INTERVAL,
      deferredUpdatesInterval: LOCATION_UPDATE_INTERVAL,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Tracker Active',
        notificationBody: 'Sharing your location',
        notificationColor: '#3B82F6',
      },
    });

    return true;
  },

  // Stop all tracking
  async stopTracking() {
    // Stop foreground
    if (this._foregroundSubscription) {
      this._foregroundSubscription.remove();
      this._foregroundSubscription = null;
    }

    // Stop background
    const isTaskRunning = await Location.hasStartedLocationUpdatesAsync(
      BACKGROUND_LOCATION_TASK
    ).catch(() => false);

    if (isTaskRunning) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    }

    this._currentUserId = null;
    await AsyncStorage.removeItem('TRACKING_USER_ID');
  },

  // Upload location to Firestore
  async uploadLocation(userId, location) {
    const { latitude, longitude, altitude, accuracy, speed, heading } =
      location.coords;
    const timestamp = location.timestamp;

    // Get battery level
    let batteryLevel = null;
    try {
      batteryLevel = await Battery.getBatteryLevelAsync();
      batteryLevel = Math.round(batteryLevel * 100);
    } catch (e) {
      // Battery API may not be available
    }

    const locationData = {
      latitude,
      longitude,
      altitude: altitude || null,
      accuracy: accuracy || null,
      speed: speed || null,
      heading: heading || null,
      timestamp,
      battery: batteryLevel,
      updatedAt: serverTimestamp(),
    };

    // Write to "latest" document (overwrite for fast reads)
    await setDoc(
      doc(db, 'locations', userId),
      locationData
    );

    // Append to history sub-collection
    await addDoc(
      collection(db, 'locations', userId, 'history'),
      locationData
    );
  },

  // Get current location (one-shot)
  async getCurrentLocation() {
    const hasPermission = await this.requestForegroundPermission();
    if (!hasPermission) {
      throw new Error('Location permission not granted');
    }
    return await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
  },
};

export default LocationService;
export { BACKGROUND_LOCATION_TASK };

// GeoUtils — Free geo utilities (no paid APIs)
// ============================================
// - Haversine distance (local math)
// - Reverse geocoding (Nominatim / OpenStreetMap)
// - Weather (wttr.in)
// - Geofence checking (local math)
// - ETA estimation (local math)

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const WTTR_BASE = 'https://wttr.in';

// Debounce tracking for Nominatim (1 req/sec rate limit)
let lastGeocodeFetch = 0;
let cachedAddress = { lat: null, lng: null, address: null };

// Weather cache (refresh every 10 min)
let cachedWeather = { lat: null, lng: null, data: null, fetchedAt: 0 };
const WEATHER_CACHE_MS = 10 * 60 * 1000; // 10 minutes

// ============================================
// Haversine Distance
// ============================================
/**
 * Calculate distance between two coordinates in meters
 */
export function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ============================================
// Format Distance
// ============================================
/**
 * Format meters to human-readable string
 */
export function formatDistance(meters) {
  if (meters == null || isNaN(meters)) return '--';
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

// ============================================
// Estimate ETA
// ============================================
/**
 * Estimate arrival time based on distance and speed
 * @param {number} distanceMeters - distance in meters
 * @param {number} speedMps - speed in meters per second (from GPS)
 * @returns {string} formatted ETA string
 */
export function estimateETA(distanceMeters, speedMps) {
  if (!distanceMeters || !speedMps || speedMps <= 0.5) {
    return null; // Target is stationary
  }

  const seconds = distanceMeters / speedMps;
  const minutes = Math.round(seconds / 60);

  if (minutes < 1) return '< 1 min';
  if (minutes < 60) return `~${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const remainMins = minutes % 60;
  if (remainMins === 0) return `~${hours}h`;
  return `~${hours}h ${remainMins}m`;
}

// ============================================
// Reverse Geocoding (Nominatim — Free)
// ============================================
/**
 * Reverse geocode coordinates to address string
 * Respects Nominatim's 1 req/sec rate limit with caching
 */
export async function reverseGeocode(lat, lng) {
  // Return cached if coordinates haven't moved much (< 50m)
  if (
    cachedAddress.lat &&
    cachedAddress.lng &&
    haversineDistance(lat, lng, cachedAddress.lat, cachedAddress.lng) < 50
  ) {
    return cachedAddress.address;
  }

  // Rate limit: 1 request per second
  const now = Date.now();
  if (now - lastGeocodeFetch < 1500) {
    return cachedAddress.address || 'Loading address...';
  }

  try {
    lastGeocodeFetch = now;
    const response = await fetch(
      `${NOMINATIM_BASE}/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'TrackerApp/1.0',
          Accept: 'application/json',
        },
      }
    );

    if (!response.ok) {
      return cachedAddress.address || 'Address unavailable';
    }

    const data = await response.json();
    const addr = data.address || {};

    // Build a clean address string
    const parts = [];
    if (addr.road || addr.pedestrian || addr.footway) {
      parts.push(addr.road || addr.pedestrian || addr.footway);
    }
    if (addr.neighbourhood || addr.suburb) {
      parts.push(addr.neighbourhood || addr.suburb);
    }
    if (addr.city || addr.town || addr.village) {
      parts.push(addr.city || addr.town || addr.village);
    }

    const address = parts.length > 0 ? parts.join(', ') : data.display_name?.split(',').slice(0, 3).join(',') || 'Unknown location';

    // Cache the result
    cachedAddress = { lat, lng, address };
    return address;
  } catch (error) {
    console.warn('Reverse geocode error:', error);
    return cachedAddress.address || 'Address unavailable';
  }
}

// ============================================
// Weather (wttr.in — 100% Free, no API key)
// ============================================
/**
 * Get weather at coordinates
 * Returns { temp, condition, icon }
 */
export async function getWeather(lat, lng) {
  const now = Date.now();

  // Return cached if recent and location hasn't changed much
  if (
    cachedWeather.data &&
    now - cachedWeather.fetchedAt < WEATHER_CACHE_MS &&
    cachedWeather.lat &&
    haversineDistance(lat, lng, cachedWeather.lat, cachedWeather.lng) < 5000
  ) {
    return cachedWeather.data;
  }

  try {
    const response = await fetch(
      `${WTTR_BASE}/${lat},${lng}?format=j1`,
      {
        headers: {
          'User-Agent': 'TrackerApp/1.0',
        },
      }
    );

    if (!response.ok) {
      return cachedWeather.data || null;
    }

    const data = await response.json();
    const current = data.current_condition?.[0];

    if (!current) return cachedWeather.data || null;

    const weatherData = {
      temp: current.temp_C,
      feelsLike: current.FeelsLikeC,
      condition: current.weatherDesc?.[0]?.value || 'Unknown',
      humidity: current.humidity,
      windSpeed: current.windspeedKmph,
      icon: getWeatherEmoji(parseInt(current.weatherCode, 10)),
    };

    // Cache result
    cachedWeather = { lat, lng, data: weatherData, fetchedAt: now };
    return weatherData;
  } catch (error) {
    console.warn('Weather fetch error:', error);
    return cachedWeather.data || null;
  }
}

/**
 * Map wttr.in weather codes to emoji
 */
function getWeatherEmoji(code) {
  if (!code) return '🌡️';
  // Clear / Sunny
  if (code === 113) return '☀️';
  // Partly cloudy
  if (code === 116) return '⛅';
  // Cloudy
  if (code === 119) return '☁️';
  // Overcast
  if (code === 122) return '🌥️';
  // Mist / Fog
  if ([143, 248, 260].includes(code)) return '🌫️';
  // Rain / Drizzle
  if ([176, 263, 266, 293, 296, 299, 302, 305, 308, 311, 314, 353, 356, 359].includes(code)) return '🌧️';
  // Thunderstorm
  if ([200, 386, 389, 392, 395].includes(code)) return '⛈️';
  // Snow
  if ([179, 182, 185, 227, 230, 317, 320, 323, 326, 329, 332, 335, 338, 350, 362, 365, 368, 371, 374, 377].includes(code)) return '🌨️';
  return '🌡️';
}

// ============================================
// Geofence Checking
// ============================================
/**
 * Check if a point is inside a geofence circle
 */
export function isInsideGeofence(lat, lng, fenceLat, fenceLng, radiusMeters) {
  const distance = haversineDistance(lat, lng, fenceLat, fenceLng);
  return distance <= radiusMeters;
}

/**
 * Check all geofences and return state changes
 * @param {number} lat - target latitude
 * @param {number} lng - target longitude
 * @param {Array} geofences - array of geofence objects
 * @returns {Array} array of { geofence, event: 'entered' | 'exited' }
 */
export function checkGeofences(lat, lng, geofences) {
  const events = [];

  geofences.forEach((fence) => {
    if (!fence.enabled) return;

    const isInside = isInsideGeofence(
      lat,
      lng,
      fence.latitude,
      fence.longitude,
      fence.radius
    );

    const wasInside = fence.lastState === 'inside';

    if (isInside && !wasInside) {
      // Entered
      if (fence.alertType === 'enter' || fence.alertType === 'both') {
        events.push({ geofence: fence, event: 'entered' });
      }
    } else if (!isInside && wasInside) {
      // Exited
      if (fence.alertType === 'exit' || fence.alertType === 'both') {
        events.push({ geofence: fence, event: 'exited' });
      }
    }
  });

  return events;
}

// ============================================
// Street View URL
// ============================================
/**
 * Generate Google Street View URL for given coordinates
 */
export function getStreetViewUrl(lat, lng) {
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;
}

// ============================================
// Clear caches (useful for testing)
// ============================================
export function clearCaches() {
  cachedAddress = { lat: null, lng: null, address: null };
  cachedWeather = { lat: null, lng: null, data: null, fetchedAt: 0 };
}

# 📍 Tracker - Real-Time Location & Safety App

**Tracker** is a powerful, real-time location sharing and personal safety application built with React Native and Expo. It allows users to track the live GPS locations of their friends and family, monitor their battery levels, and receive instant emergency alerts, all wrapped in a sleek, modern, dark-mode interface.

## ✨ Key Features

*   **🌍 Real-Time Global Map**: View all your active tracking targets simultaneously on a single, dynamic web-view map. The map automatically scales and frames all active users.
*   **🚨 Panic Alarm System**: If a user is in danger, they can trigger a high-priority panic alarm. The app is programmed to forcefully override Android audio channels and blast a siren at maximum hardware volume, while instantly notifying all connected trackers.
*   **📍 Live Telemetry**: Instantly see a target's current moving speed, battery percentage, and the exact distance they are from you.
*   **🛡️ Geofencing Alerts**: Set up custom "Safe Zones" or "Danger Zones" by long-pressing anywhere on the map. Receive instant notifications when a user enters or exits a designated boundary.
*   **💬 Quick Messaging**: Send predefined safety check-in messages (e.g., "Are you okay?", "Come home soon") or custom texts directly through the app without needing to switch to a messaging service.
*   **📡 Background Tracking**: The app utilizes Expo's background location tasks to continue securely transmitting coordinates even when the app is minimized or the phone is locked.

## 🛠️ Technology Stack

*   **Frontend**: React Native, Expo (SDK 50+), Expo Router
*   **Backend & Database**: Google Firebase (Firestore)
*   **Mapping**: Leaflet.js injected via React Native WebView
*   **Native Integrations**: Expo Location, Expo Notifications, Expo Audio, React Native Volume Manager

## 🚀 Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Chitransh900/Tracker.git
   cd Tracker
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npx expo start
   ```

4. **Testing on your device:**
   Download the **Expo Go** app from the Google Play Store or Apple App Store, and scan the QR code generated in your terminal to run the app on your physical device.

## 📦 Production Build (APK)

This app is configured to build a standalone Universal APK via Expo Application Services (EAS). To generate a shareable APK link for sideloading:

```bash
eas build --platform android --profile preview
```

## 🔒 Privacy & Permissions

Because this app handles sensitive location data, it requires stringent permissions on both iOS and Android:
*   `ACCESS_FINE_LOCATION`
*   `ACCESS_BACKGROUND_LOCATION`
*   `FOREGROUND_SERVICE`

Location data is only shared with users you explicitly accept tracking invites from, and sessions can be terminated at any time.

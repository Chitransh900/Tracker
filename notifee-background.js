// =====================================================
// Notifee Background Event Handler
// =====================================================
// This file MUST be imported at the very top of the app entry
// point (_layout.js) BEFORE React renders.
//
// Notifee's onBackgroundEvent runs as a HEADLESS native task —
// it works even when the app is fully killed / swiped away.
// This is the key to making alarms work when the app is closed.
// =====================================================

import { Platform } from 'react-native';

// Register the headless background event handler
if (Platform.OS !== 'web') {
  const NotifeeModule = require('@notifee/react-native');
  const notifee = NotifeeModule.default;
  const { EventType } = NotifeeModule;

  notifee.onBackgroundEvent(async ({ type, detail }) => {
    const { notification, pressAction } = detail;

    switch (type) {
      case EventType.PRESS:
        // User tapped the alarm notification — the app will open automatically
        // We can optionally dismiss the notification
        if (notification?.id) {
          await notifee.cancelNotification(notification.id);
        }
        break;

      case EventType.ACTION_PRESS:
        // User pressed a custom action button (if we add any in the future)
        if (notification?.id) {
          await notifee.cancelNotification(notification.id);
        }
        break;

      case EventType.DISMISSED:
        // User swiped away the notification — no action needed
        break;

      default:
        break;
    }
  });
}

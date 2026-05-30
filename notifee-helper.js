import notifee, { AndroidImportance, AndroidCategory, AndroidVisibility } from '@notifee/react-native';

// =====================================================
// Helper: Display alarm notification via Notifee
// =====================================================
export async function displayAlarmNotification() {
  try {
    const channelId = await notifee.createChannel({
      id: 'alarm_full_screen',
      name: 'Critical Alarms',
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC,
      sound: 'default',
      vibration: true,
      vibrationPattern: [300, 500, 200, 500, 200, 500],
      bypassDnd: true,
    });

    await notifee.cancelAllNotifications();

    await notifee.displayNotification({
      title: '🚨 PANIC ALARM TRIGGERED 🚨',
      body: 'Your tracker has activated the panic alarm! Tap to open.',
      android: {
        channelId,
        category: AndroidCategory.ALARM,
        fullScreenAction: {
          id: 'default',
        },
        importance: AndroidImportance.HIGH,
        visibility: AndroidVisibility.PUBLIC,
        sound: 'default',
        vibrationPattern: [300, 500, 200, 500, 200, 500],
        pressAction: {
          id: 'default',
        },
        ongoing: false,
        autoCancel: true,
      },
    });
  } catch (err) {
    console.error('Notifee displayAlarmNotification error:', err);
  }
}

// =====================================================
// Helper: Display message notification via Notifee
// =====================================================
export async function displayMessageNotification(title, body) {
  try {
    const channelId = await notifee.createChannel({
      id: 'messages',
      name: 'Messages',
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC,
      sound: 'default',
    });

    await notifee.displayNotification({
      title: title || 'New Message',
      body: body || 'You have a new message',
      android: {
        channelId,
        importance: AndroidImportance.HIGH,
        visibility: AndroidVisibility.PUBLIC,
        sound: 'default',
        pressAction: {
          id: 'default',
        },
      },
    });
  } catch (err) {
    console.error('Notifee displayMessageNotification error:', err);
  }
}

export function setupChannels() {
  notifee.createChannel({
    id: 'alarm_full_screen',
    name: 'Critical Alarms',
    importance: AndroidImportance.HIGH,
    visibility: AndroidVisibility.PUBLIC,
    sound: 'default',
    vibration: true,
    vibrationPattern: [300, 500, 200, 500, 200, 500],
    bypassDnd: true,
  }).catch(console.warn);

  notifee.createChannel({
    id: 'messages',
    name: 'Messages',
    importance: AndroidImportance.HIGH,
    visibility: AndroidVisibility.PUBLIC,
    sound: 'default',
  }).catch(console.warn);
}

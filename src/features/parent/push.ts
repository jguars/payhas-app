import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { deviceTimeZone } from '@/features/library/LibraryProvider';
import { tNow } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { color } from '@/theme/tokens';

// The FCM token this phone registered as a parent phone, if it opted in.
const KEY = 'payhas.pushToken';

export type AlertsResult = 'on' | 'denied' | 'unsupported' | 'notYetIos' | 'error';

if (Platform.OS !== 'web') {
  // Alerts arriving while Payhas is open still show as a banner.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

export function storedPushToken(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** Android needs the channel before the first alert; it's also what the user sees in system settings. */
function ensureChannel() {
  if (Platform.OS !== 'android') return Promise.resolve(null);
  return Notifications.setNotificationChannelAsync('parent', {
    name: tNow('parent.channelName'),
    description: tNow('parent.channelDescription'),
    importance: Notifications.AndroidImportance.HIGH,
    lightColor: color.ember,
  });
}

/** Opt this phone in (needs a live parent session). Asks for notification permission first. */
export async function enableParentAlerts(parent: string): Promise<AlertsResult> {
  if (Platform.OS === 'web' || !Device.isDevice) return 'unsupported';
  // Alerts are sent through Firebase Cloud Messaging, which reaches iPhones only
  // once an Apple push key is set up for Payhas. Until then, say so plainly.
  if (Platform.OS === 'ios') return 'notYetIos';
  await ensureChannel();
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return 'denied';
  try {
    const { data: token } = await Notifications.getDevicePushTokenAsync();
    const { error } = await supabase.rpc('register_push_device', {
      p_parent: parent,
      p_token: String(token),
      // The phone's name is often its owner's; the server keeps a fixed label instead.
      p_name: '',
      p_tz: deviceTimeZone(),
    });
    if (error) return 'error';
    localStorage.setItem(KEY, String(token));
    return 'on';
  } catch {
    return 'error';
  }
}

export async function disableParentAlerts() {
  const token = storedPushToken();
  if (token) await supabase.rpc('unregister_push_device', { p_token: token });
  localStorage.removeItem(KEY);
}

/**
 * While signed in: keep this phone's FCM token current on the server, and
 * open the dashboard (on the right child) when a parent alert is tapped,
 * including the tap that launched the app.
 */
export function useParentAlerts(signedIn: boolean) {
  useEffect(() => {
    if (!signedIn || Platform.OS === 'web') return;

    const old = storedPushToken();
    if (old) {
      ensureChannel()
        .then(() => Notifications.getDevicePushTokenAsync())
        .then(async ({ data }) => {
          const next = String(data);
          if (next === old) return;
          const { data: ok } = await supabase.rpc('refresh_push_device', { p_old: old, p_new: next });
          if (ok) localStorage.setItem(KEY, next);
        })
        .catch(() => {});
    }

    const open = (r: Notifications.NotificationResponse | null) => {
      if (!r) return;
      const d = r.notification.request.content.data as { profile_id?: string };
      Notifications.clearLastNotificationResponse();
      router.push({ pathname: '/parent', params: d?.profile_id ? { child: d.profile_id } : {} });
    };
    open(Notifications.getLastNotificationResponse());
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, [signedIn]);
}

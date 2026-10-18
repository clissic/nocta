import { Platform } from "react-native";
import Constants from "expo-constants";
import type { NotificationItem, NotificationType } from "@nocta/shared";
import { NOTIFICATION_TYPES } from "@nocta/shared";
import { api } from "./api";
import {
  notificationNavTarget,
  openNotificationTarget,
} from "./notificationHref";

type NotificationsModule = typeof import("expo-notifications");

let currentToken: string | null = null;
let listening = false;
let canOpenRef: () => boolean = () => false;
let navigateRef: { navigate: (...args: never[]) => void } | null = null;
const receivedListeners = new Set<() => void>();

function projectId() {
  const extra = Constants.expoConfig?.extra as
    | { eas?: { projectId?: string } }
    | undefined;
  return extra?.eas?.projectId || Constants.easConfig?.projectId || "";
}

async function loadNotifications(): Promise<NotificationsModule | null> {
  if (Platform.OS !== "android") return null;
  try {
    return await import("expo-notifications");
  } catch {
    return null;
  }
}

function asNotification(data: Record<string, unknown>): NotificationItem | null {
  const type = data.type;
  if (typeof type !== "string") return null;
  if (!NOTIFICATION_TYPES.includes(type as NotificationType)) return null;
  const href = typeof data.href === "string" ? data.href : undefined;
  const reportId = typeof data.reportId === "string" ? data.reportId : undefined;
  return {
    id: typeof data.notificationId === "string" ? data.notificationId : "push",
    type: type as NotificationType,
    title: "",
    href,
    data: reportId ? { reportId } : {},
    readAt: null,
    createdAt: new Date().toISOString(),
  };
}

export function onPushReceived(listener: () => void) {
  receivedListeners.add(listener);
  return () => {
    receivedListeners.delete(listener);
  };
}

export async function registerAndroidPush() {
  const Notifications = await loadNotifications();
  if (!Notifications) return;
  const id = projectId();
  if (!id) return;

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== "granted") {
    const asked = await Notifications.requestPermissionsAsync();
    status = asked.status;
  }
  if (status !== "granted") return;

  await Notifications.setNotificationChannelAsync("default", {
    name: "Avisos",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 200],
    lightColor: "#d6ff4b",
  });

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  let token = "";
  try {
    const device = await Notifications.getExpoPushTokenAsync({ projectId: id });
    token = device.data;
  } catch {
    return;
  }
  if (!token) return;
  currentToken = token;
  await api("/api/me/push-token", {
    method: "POST",
    body: JSON.stringify({ token, platform: "android" }),
  });
}

export async function unregisterAndroidPush() {
  const token = currentToken;
  currentToken = null;
  if (!token) return;
  try {
    await api("/api/me/push-token", {
      method: "DELETE",
      body: JSON.stringify({ token }),
    });
  } catch {
    /* el cierre de sesión sigue */
  }
}

export function setPushNavigation(
  canOpen: () => boolean,
  navigate: { navigate: (...args: never[]) => void }
) {
  canOpenRef = canOpen;
  navigateRef = navigate;
}

export async function listenAndroidPush() {
  if (listening) return;
  const Notifications = await loadNotifications();
  if (!Notifications) return;
  listening = true;

  const open = (data: Record<string, unknown> | undefined) => {
    if (!canOpenRef() || !data || !navigateRef) return;
    const item = asNotification(data);
    if (!item) return;
    const target = notificationNavTarget(item);
    if (target) openNotificationTarget(navigateRef, target);
  };

  Notifications.addNotificationReceivedListener(() => {
    for (const listener of receivedListeners) listener();
  });
  Notifications.addNotificationResponseReceivedListener((response) => {
    open(response.notification.request.content.data as Record<string, unknown>);
  });

  const last = await Notifications.getLastNotificationResponseAsync();
  if (last) {
    open(last.notification.request.content.data as Record<string, unknown>);
  }
}

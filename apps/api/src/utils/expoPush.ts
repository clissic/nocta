import { config } from "../config.js";
import { PushDevice } from "../models/PushDevice.js";
import type { NotificationDocument } from "../models/Notification.js";
import { serializeNotification } from "./notify.js";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export function isExpoPushToken(token: string) {
  return /^(ExponentPushToken|ExpoPushToken)\[.+\]$/.test(token);
}

type ExpoTicket = {
  status?: string;
  details?: { error?: string };
};

export function tokensToDrop(tickets: ExpoTicket[], tokens: string[]) {
  const drop: string[] = [];
  tickets.forEach((ticket, index) => {
    if (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
      const token = tokens[index];
      if (token) drop.push(token);
    }
  });
  return drop;
}

function pushData(doc: NotificationDocument) {
  const serialized = serializeNotification(doc);
  const data: Record<string, string> = {
    type: serialized.type,
    notificationId: serialized.id,
  };
  if (serialized.href) data.href = serialized.href;
  const reportId = serialized.data.reportId;
  if (typeof reportId === "string" && reportId) data.reportId = reportId;
  return { title: serialized.title, body: serialized.body ?? "", data };
}

export async function dispatchExpoPush(doc: NotificationDocument) {
  const devices = await PushDevice.find({ userId: doc.userId }).select("token").lean();
  const tokens = devices
    .map((device) => device.token)
    .filter((token) => isExpoPushToken(token));
  if (!tokens.length) return;

  const content = pushData(doc);
  const messages = tokens.map((token) => ({
    to: token,
    title: content.title,
    body: content.body,
    data: content.data,
    sound: "default",
    channelId: "default",
    priority: "high" as const,
  }));

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (config.expo.accessToken) {
    headers.Authorization = `Bearer ${config.expo.accessToken}`;
  }

  let tickets: ExpoTicket[] = [];
  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(messages),
    });
    if (!response.ok) {
      console.warn(`[push] Expo respondió ${response.status}`);
      return;
    }
    const payload = (await response.json()) as { data?: ExpoTicket[] };
    tickets = payload.data ?? [];
    for (const ticket of tickets) {
      if (ticket.status === "error") {
        console.warn(
          `[push] Expo rechazó el aviso: ${ticket.details?.error ?? "error"}`
        );
      }
    }
  } catch (err) {
    console.warn("[push] no se pudo enviar", err);
    return;
  }

  const drop = tokensToDrop(tickets, tokens);
  if (drop.length) {
    await PushDevice.deleteMany({ token: { $in: drop } });
  }
}

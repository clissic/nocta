import { NOTIFICATION_READ_TTL_DAYS } from "@nocta/shared";
import { Notification } from "../models/Notification.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export function notificationExpiresAt(from: Date = new Date()) {
  return new Date(from.getTime() + NOTIFICATION_READ_TTL_DAYS * DAY_MS);
}

/** Borra leídas vencidas (backup del TTL de Mongo). */
export async function purgeExpiredReadNotifications(userId?: string) {
  const cutoff = new Date(
    Date.now() - NOTIFICATION_READ_TTL_DAYS * DAY_MS
  );
  const filter: Record<string, unknown> = {
    readAt: { $ne: null, $lte: cutoff },
  };
  if (userId) filter.userId = userId;
  await Notification.deleteMany(filter);
}

import { Presence } from "../models/Presence.js";
import { createNotification } from "./notify.js";

/**
 * Marca como expired las presencias activas cuya endsAt ya pasó.
 * Sin userId/venueId: limpia todo (útil antes del deck).
 */
export async function expireStalePresences(opts?: {
  userId?: string;
  venueId?: string;
}) {
  const filter: Record<string, unknown> = {
    status: "active",
    endsAt: { $ne: null, $lte: new Date() },
  };
  if (opts?.userId) filter.userId = opts.userId;
  if (opts?.venueId) filter.venueId = opts.venueId;

  const stale = await Presence.find(filter).select("_id userId venueId").limit(200);
  if (!stale.length) return;

  const ids = stale.map((p) => p._id);
  await Presence.updateMany(
    { _id: { $in: ids } },
    { $set: { status: "expired" } }
  );

  for (const presence of stale) {
    const userId = presence.userId.toString();
    void createNotification({
      userId,
      type: "presence_expired",
      title: "Tu publicación venció",
      body: "Volvé a publicarte en un Espacio para aparecer en Discover",
      href: "/venues",
      data: {
        venueId: presence.venueId.toString(),
        presenceId: presence._id.toString(),
      },
      dedupeKey: `presence_expired:${presence._id.toString()}`,
    });
  }
}

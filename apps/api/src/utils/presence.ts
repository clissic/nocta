import { Presence } from "../models/Presence.js";

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
  await Presence.updateMany(filter, { $set: { status: "expired" } });
}

import { Presence } from "../models/Presence.js";
import { Swipe } from "../models/Swipe.js";
import { createNotification } from "./notify.js";

function normalizeVenueIds(
  venueIds: Array<string | { toString(): string }>
): string[] {
  return [
    ...new Set(
      venueIds
        .map((id) => id?.toString?.() ?? String(id))
        .filter(Boolean)
    ),
  ];
}

/**
 * Borra likes salientes y entrantes del usuario en esos Espacios
 * (p. ej. al salir o vencer la publicación). Los matches y chats se conservan.
 */
export async function clearLikesForVenues(
  userId: string,
  venueIds: Array<string | { toString(): string }>
) {
  const ids = normalizeVenueIds(venueIds);
  if (!ids.length) return;
  await Swipe.deleteMany({
    venueId: { $in: ids },
    direction: "like",
    $or: [{ fromUserId: userId }, { toUserId: userId }],
  });
}

/** @deprecated Preferí clearLikesForVenues (también limpia likes entrantes). */
export async function clearOutgoingLikesForVenues(
  userId: string,
  venueIds: Array<string | { toString(): string }>
) {
  return clearLikesForVenues(userId, venueIds);
}

/**
 * Revoca (o marca expired) las presencias activas y limpia likes
 * de esos Espacios. Los matches persisten.
 */
export async function endActivePresences(
  userId: string,
  status: "revoked" | "expired" = "revoked",
  opts?: { venueId?: string }
) {
  const filter: Record<string, unknown> = {
    userId,
    status: "active",
  };
  if (opts?.venueId) filter.venueId = opts.venueId;

  const active = await Presence.find(filter).select("_id venueId");
  if (!active.length) return [];

  const venueIds = active.map((p) => p.venueId);
  await Presence.updateMany(
    { _id: { $in: active.map((p) => p._id) } },
    { $set: { status } }
  );
  await clearLikesForVenues(userId, venueIds);
  return active;
}

/**
 * Si hay más presencias activas que `keep`, revoca las más viejas
 * (queda la(s) más reciente(s) por startsAt).
 */
export async function keepNewestActivePresences(
  userId: string,
  keep: number
) {
  const limit = Math.max(0, keep);
  const active = await Presence.find({
    userId,
    status: "active",
  })
    .sort({ startsAt: -1, _id: -1 })
    .select("_id venueId");
  if (active.length <= limit) return [];

  const toEnd = active.slice(limit);
  const venueIds = toEnd.map((p) => p.venueId);
  await Presence.updateMany(
    { _id: { $in: toEnd.map((p) => p._id) } },
    { $set: { status: "revoked" } }
  );
  await clearLikesForVenues(userId, venueIds);
  return toEnd;
}

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

  const stale = await Presence.find(filter)
    .select("_id userId venueId")
    .limit(200);
  if (!stale.length) return;

  const ids = stale.map((p) => p._id);
  await Presence.updateMany(
    { _id: { $in: ids } },
    { $set: { status: "expired" } }
  );

  const likesByUser = new Map<string, string[]>();
  for (const presence of stale) {
    const userId = presence.userId.toString();
    const venueId = presence.venueId.toString();
    const list = likesByUser.get(userId) ?? [];
    list.push(venueId);
    likesByUser.set(userId, list);
  }
  await Promise.all(
    [...likesByUser.entries()].map(([userId, venueIds]) =>
      clearLikesForVenues(userId, venueIds)
    )
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

import type { CreateNotificationInput } from "./notify.js";
import { notifyMany } from "./notify.js";
import { Follow } from "../models/Follow.js";
import { User } from "../models/User.js";
import { blockedPeerIds } from "../models/Block.js";
import { resolveShowActivityToFollowers } from "./activityVisibility.js";

/** Notifica a seguidores del actor (opcionalmente solo Premium). */
export async function notifyUserFollowers(opts: {
  actorId: string;
  requireShowActivity?: boolean;
  premiumOnly?: boolean;
  notification: Omit<CreateNotificationInput, "userId" | "dedupeKey"> & {
    dedupePrefix?: string;
  };
}) {
  const actor = await User.findById(opts.actorId).select(
    "showActivityToFollowers hideActivityFromFollowers profile.name"
  );
  if (!actor) return;

  if (
    opts.requireShowActivity !== false &&
    !resolveShowActivityToFollowers(actor)
  ) {
    return;
  }

  const follows = await Follow.find({
    targetType: "user",
    targetId: opts.actorId,
  }).select("followerId");

  let followerIds = follows.map((f) => f.followerId.toString());
  if (!followerIds.length) return;

  const blocked = new Set(await blockedPeerIds(opts.actorId));
  followerIds = followerIds.filter((id) => !blocked.has(id));
  if (!followerIds.length) return;

  if (opts.premiumOnly) {
    const premiumUsers = await User.find({
      _id: { $in: followerIds },
      premium: true,
    }).select("_id");
    followerIds = premiumUsers.map((u) => u._id.toString());
    if (!followerIds.length) return;
  }

  await notifyMany(followerIds, {
    type: opts.notification.type,
    title: opts.notification.title,
    body: opts.notification.body,
    href: opts.notification.href,
    data: {
      ...(opts.notification.data ?? {}),
      actorId: opts.actorId,
    },
    dedupeKeyFor: opts.notification.dedupePrefix
      ? (userId) => `${opts.notification.dedupePrefix}:${userId}`
      : undefined,
  });
}

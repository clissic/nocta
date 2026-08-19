import mongoose from "mongoose";
import { Follow } from "../models/Follow.js";
import { FollowRequest } from "../models/FollowRequest.js";
import { User } from "../models/User.js";
import { Venue } from "../models/Venue.js";
import { Block, blockedPeerIds } from "../models/Block.js";
import type { FollowTargetType } from "@nocta/shared";
import { createNotification } from "./notify.js";

export async function isFollowing(
  followerId: string | mongoose.Types.ObjectId,
  targetType: FollowTargetType,
  targetId: string | mongoose.Types.ObjectId
) {
  const row = await Follow.exists({
    followerId,
    targetType,
    targetId,
  });
  return Boolean(row);
}

export async function hasPendingFollowRequest(
  fromUserId: string | mongoose.Types.ObjectId,
  toUserId: string | mongoose.Types.ObjectId
) {
  const row = await FollowRequest.exists({
    fromUserId,
    toUserId,
    status: "pending",
  });
  return Boolean(row);
}

export async function venueFollowersCount(
  venueId: string | mongoose.Types.ObjectId
) {
  const venue = await Venue.findById(venueId).select("followersCount");
  if (venue && typeof venue.followersCount === "number") {
    return venue.followersCount;
  }
  return Follow.countDocuments({ targetType: "venue", targetId: venueId });
}

/** Follow instantáneo (Espacios) o seed de users ya aceptados. */
export async function followTarget(opts: {
  followerId: string;
  targetType: FollowTargetType;
  targetId: string;
}): Promise<
  { ok: true; created: boolean } | { error: string; status: number }
> {
  const { followerId, targetType, targetId } = opts;

  if (targetType === "user" && followerId === targetId) {
    return { error: "No podés seguirte a vos mismo", status: 400 };
  }

  if (targetType === "user") {
    const peers = await blockedPeerIds(followerId);
    if (peers.includes(targetId)) {
      return { error: "No podés seguir a este usuario", status: 403 };
    }
    const target = await User.findById(targetId);
    if (!target || !target.profileComplete || !target.profile) {
      return { error: "Usuario no encontrado", status: 404 };
    }
  } else {
    const venue = await Venue.findOne({ _id: targetId, active: true });
    if (!venue) {
      return { error: "Espacio no encontrado", status: 404 };
    }
  }

  try {
    await Follow.create({
      followerId,
      targetType,
      targetId,
    });
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: number }).code === 11000
    ) {
      return { ok: true, created: false };
    }
    throw err;
  }

  if (targetType === "user") {
    await Promise.all([
      User.updateOne({ _id: followerId }, { $inc: { followingUsersCount: 1 } }),
      User.updateOne({ _id: targetId }, { $inc: { followersCount: 1 } }),
    ]);
  } else {
    await Promise.all([
      User.updateOne(
        { _id: followerId },
        { $inc: { followingVenuesCount: 1 } }
      ),
      Venue.updateOne({ _id: targetId }, { $inc: { followersCount: 1 } }),
    ]);
  }

  return { ok: true, created: true };
}

/** Solicitud de follow entre usuarios (no crea Follow hasta aceptar). */
export async function requestUserFollow(opts: {
  fromUserId: string;
  toUserId: string;
}): Promise<
  | { ok: true; status: "pending" | "following"; created: boolean }
  | { error: string; status: number }
> {
  const { fromUserId, toUserId } = opts;
  if (fromUserId === toUserId) {
    return { error: "No podés seguirte a vos mismo", status: 400 };
  }

  const peers = await blockedPeerIds(fromUserId);
  if (peers.includes(toUserId)) {
    return { error: "No podés seguir a este usuario", status: 403 };
  }

  const target = await User.findById(toUserId);
  if (!target || !target.profileComplete || !target.profile) {
    return { error: "Usuario no encontrado", status: 404 };
  }

  if (await isFollowing(fromUserId, "user", toUserId)) {
    return { ok: true, status: "following", created: false };
  }

  const autoAccept = Boolean(target.autoAcceptFollowRequests);

  async function acceptNow() {
    const ensured = await followTarget({
      followerId: fromUserId,
      targetType: "user",
      targetId: toUserId,
    });
    if ("error" in ensured) return ensured;
    return { ok: true as const, status: "following" as const, created: ensured.created };
  }

  const existing = await FollowRequest.findOne({ fromUserId, toUserId });
  if (existing) {
    if (existing.status === "pending") {
      return { ok: true, status: "pending", created: false };
    }
    if (existing.status === "accepted") {
      return acceptNow();
    }
    // rejected → reintento
    if (autoAccept) {
      const result = await acceptNow();
      if ("error" in result) return result;
      existing.status = "accepted";
      await existing.save();
      if (result.created) {
        const fromName =
          (await User.findById(fromUserId).select("profile.name"))?.profile
            ?.name ?? "Alguien";
        void createNotification({
          userId: toUserId,
          type: "new_follower",
          title: "Nuevo seguidor",
          body: `${fromName} empezó a seguirte`,
          href: "/profile",
          data: { actorId: fromUserId },
        });
      }
      return result;
    }
    existing.status = "pending";
    await existing.save();
    const fromName =
      (await User.findById(fromUserId).select("profile.name"))?.profile?.name ??
      "Alguien";
    void createNotification({
      userId: toUserId,
      type: "follow_request",
      title: "Nueva solicitud de seguimiento",
      body: `${fromName} quiere seguirte`,
      href: "/profile",
      data: { actorId: fromUserId },
    });
    return { ok: true, status: "pending", created: true };
  }

  if (autoAccept) {
    const result = await acceptNow();
    if ("error" in result) return result;
    try {
      await FollowRequest.create({
        fromUserId,
        toUserId,
        status: "accepted",
      });
    } catch (err: unknown) {
      if (
        !(
          err &&
          typeof err === "object" &&
          "code" in err &&
          (err as { code: number }).code === 11000
        )
      ) {
        throw err;
      }
    }
    if (result.created) {
      const fromName =
        (await User.findById(fromUserId).select("profile.name"))?.profile
          ?.name ?? "Alguien";
      void createNotification({
        userId: toUserId,
        type: "new_follower",
        title: "Nuevo seguidor",
        body: `${fromName} empezó a seguirte`,
        href: "/profile",
        data: { actorId: fromUserId },
      });
    }
    return result;
  }

  try {
    await FollowRequest.create({
      fromUserId,
      toUserId,
      status: "pending",
    });
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: number }).code === 11000
    ) {
      return { ok: true, status: "pending", created: false };
    }
    throw err;
  }

  const fromName =
    (await User.findById(fromUserId).select("profile.name"))?.profile?.name ??
    "Alguien";
  void createNotification({
    userId: toUserId,
    type: "follow_request",
    title: "Nueva solicitud de seguimiento",
    body: `${fromName} quiere seguirte`,
    href: "/profile",
    data: { actorId: fromUserId },
  });

  return { ok: true, status: "pending", created: true };
}

export async function cancelUserFollowRequest(opts: {
  fromUserId: string;
  toUserId: string;
}): Promise<{ ok: true; cancelled: boolean }> {
  const deleted = await FollowRequest.findOneAndDelete({
    fromUserId: opts.fromUserId,
    toUserId: opts.toUserId,
    status: "pending",
  });
  return { ok: true, cancelled: Boolean(deleted) };
}

export async function acceptFollowRequest(opts: {
  requestId: string;
  toUserId: string;
}): Promise<
  { ok: true; fromUserId: string } | { error: string; status: number }
> {
  const request = await FollowRequest.findById(opts.requestId);
  if (!request || request.toUserId.toString() !== opts.toUserId) {
    return { error: "Solicitud no encontrada", status: 404 };
  }
  if (request.status !== "pending") {
    return { error: "Esta solicitud ya fue respondida", status: 409 };
  }

  const fromUserId = request.fromUserId.toString();
  const result = await followTarget({
    followerId: fromUserId,
    targetType: "user",
    targetId: opts.toUserId,
  });
  if ("error" in result) return result;

  request.status = "accepted";
  await request.save();

  const accepterName =
    (await User.findById(opts.toUserId).select("profile.name"))?.profile
      ?.name ?? "Alguien";
  void createNotification({
    userId: fromUserId,
    type: "follow_accepted",
    title: "Solicitud aceptada",
    body: `${accepterName} aceptó tu solicitud`,
    href: "/profile",
    data: { actorId: opts.toUserId },
  });

  return { ok: true, fromUserId };
}

export async function rejectFollowRequest(opts: {
  requestId: string;
  toUserId: string;
}): Promise<{ ok: true } | { error: string; status: number }> {
  const request = await FollowRequest.findById(opts.requestId);
  if (!request || request.toUserId.toString() !== opts.toUserId) {
    return { error: "Solicitud no encontrada", status: 404 };
  }
  if (request.status !== "pending") {
    return { error: "Esta solicitud ya fue respondida", status: 409 };
  }
  request.status = "rejected";
  await request.save();
  return { ok: true };
}

export async function unfollowTarget(opts: {
  followerId: string;
  targetType: FollowTargetType;
  targetId: string;
}): Promise<{ ok: true } | { error: string; status: number }> {
  const { followerId, targetType, targetId } = opts;
  const deleted = await Follow.findOneAndDelete({
    followerId,
    targetType,
    targetId,
  });
  if (!deleted) {
    return { ok: true };
  }

  if (targetType === "user") {
    await Promise.all([
      User.updateOne(
        { _id: followerId, followingUsersCount: { $gt: 0 } },
        { $inc: { followingUsersCount: -1 } }
      ),
      User.updateOne(
        { _id: targetId, followersCount: { $gt: 0 } },
        { $inc: { followersCount: -1 } }
      ),
      FollowRequest.findOneAndUpdate(
        { fromUserId: followerId, toUserId: targetId },
        { $set: { status: "rejected" } }
      ),
    ]);
  } else {
    await Promise.all([
      User.updateOne(
        { _id: followerId, followingVenuesCount: { $gt: 0 } },
        { $inc: { followingVenuesCount: -1 } }
      ),
      Venue.updateOne(
        { _id: targetId, followersCount: { $gt: 0 } },
        { $inc: { followersCount: -1 } }
      ),
    ]);
  }

  return { ok: true };
}

/** Ids bloqueados entre viewer y candidate (bidireccional). */
export async function areBlocked(a: string, b: string) {
  const row = await Block.exists({
    $or: [
      { blockerId: a, blockedId: b },
      { blockerId: b, blockedId: a },
    ],
  });
  return Boolean(row);
}

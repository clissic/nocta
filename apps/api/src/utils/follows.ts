import mongoose from "mongoose";
import { Follow } from "../models/Follow.js";
import { User } from "../models/User.js";
import { Venue } from "../models/Venue.js";
import { Block, blockedPeerIds } from "../models/Block.js";
import type { FollowTargetType } from "@nocta/shared";

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

export async function venueFollowersCount(
  venueId: string | mongoose.Types.ObjectId
) {
  return Follow.countDocuments({ targetType: "venue", targetId: venueId });
}

export async function followTarget(opts: {
  followerId: string;
  targetType: FollowTargetType;
  targetId: string;
}): Promise<{ ok: true } | { error: string; status: number }> {
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
      return { error: "Local no encontrado", status: 404 };
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
      return { ok: true };
    }
    throw err;
  }

  if (targetType === "user") {
    await Promise.all([
      User.updateOne({ _id: followerId }, { $inc: { followingUsersCount: 1 } }),
      User.updateOne({ _id: targetId }, { $inc: { followersCount: 1 } }),
    ]);
  } else {
    await User.updateOne(
      { _id: followerId },
      { $inc: { followingVenuesCount: 1 } }
    );
  }

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
    ]);
  } else {
    await User.updateOne(
      { _id: followerId, followingVenuesCount: { $gt: 0 } },
      { $inc: { followingVenuesCount: -1 } }
    );
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

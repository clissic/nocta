import {
  DAILY_LIKE_LIMIT,
  LIKE_RECHARGE_HOURS,
  type LikeAllowance,
} from "@nocta/shared";
import { User } from "../models/User.js";
import { createNotification } from "./notify.js";

const RECHARGE_MS = LIKE_RECHARGE_HOURS * 60 * 60 * 1000;

function serializeAllowance(opts: {
  premium: boolean;
  remainingLikes?: number | null;
  likesRechargeAt?: Date | null;
}): LikeAllowance {
  if (opts.premium) {
    return {
      remainingLikes: null,
      limit: null,
      rechargeAt: null,
      unlimited: true,
    };
  }
  return {
    remainingLikes: opts.remainingLikes ?? DAILY_LIKE_LIMIT,
    limit: DAILY_LIKE_LIMIT,
    rechargeAt: opts.likesRechargeAt?.toISOString() ?? null,
    unlimited: false,
  };
}

export async function getLikeAllowance(userId: string): Promise<LikeAllowance> {
  // Documentos creados antes de esta feature no tienen el campo persistido.
  await User.updateOne(
    { _id: userId, remainingLikes: { $exists: false } },
    { $set: { remainingLikes: DAILY_LIKE_LIMIT, likesRechargeAt: null } }
  );

  let user = await User.findById(userId).select(
    "premium remainingLikes likesRechargeAt"
  );
  if (!user) throw new Error("Usuario no encontrado");

  if (user.premium) return serializeAllowance({ premium: true });

  const remaining = user.remainingLikes ?? DAILY_LIKE_LIMIT;
  const rechargeAt = user.likesRechargeAt ?? null;
  if (remaining <= 0 && rechargeAt && rechargeAt.getTime() <= Date.now()) {
    const previousRechargeAt = rechargeAt;
    user = await User.findByIdAndUpdate(
      userId,
      { $set: { remainingLikes: DAILY_LIKE_LIMIT, likesRechargeAt: null } },
      { new: true }
    ).select("premium remainingLikes likesRechargeAt");
    if (!user) throw new Error("Usuario no encontrado");
    void createNotification({
      userId,
      type: "likes_recharged",
      title: "Tus likes se recargaron",
      body: `Ya tenés ${DAILY_LIKE_LIMIT} likes disponibles`,
      href: "/discover",
      data: {},
      dedupeKey: `likes_recharged:${userId}:${previousRechargeAt.toISOString()}`,
    });
  } else if (remaining <= 0 && !rechargeAt) {
    user.likesRechargeAt = new Date(Date.now() + RECHARGE_MS);
    await user.save();
  }

  return serializeAllowance({
    premium: Boolean(user.premium),
    remainingLikes: user.remainingLikes,
    likesRechargeAt: user.likesRechargeAt,
  });
}

export async function consumeLike(userId: string): Promise<{
  allowed: boolean;
  allowance: LikeAllowance;
  consumed: boolean;
}> {
  const current = await getLikeAllowance(userId);
  if (current.unlimited) {
    return { allowed: true, allowance: current, consumed: false };
  }
  if ((current.remainingLikes ?? 0) <= 0) {
    return { allowed: false, allowance: current, consumed: false };
  }

  const updated = await User.findOneAndUpdate(
    {
      _id: userId,
      premium: { $ne: true },
      remainingLikes: { $gt: 0 },
    },
    { $inc: { remainingLikes: -1 } },
    { new: true }
  ).select("premium remainingLikes likesRechargeAt");

  if (!updated) {
    const allowance = await getLikeAllowance(userId);
    return { allowed: false, allowance, consumed: false };
  }

  if ((updated.remainingLikes ?? 0) === 0) {
    const rechargeAt = new Date(Date.now() + RECHARGE_MS);
    await User.updateOne(
      { _id: userId, remainingLikes: 0 },
      { $set: { likesRechargeAt: rechargeAt } }
    );
    updated.likesRechargeAt = rechargeAt;
  }

  return {
    allowed: true,
    consumed: true,
    allowance: serializeAllowance({
      premium: false,
      remainingLikes: updated.remainingLikes,
      likesRechargeAt: updated.likesRechargeAt,
    }),
  };
}

export async function refundLike(userId: string) {
  const updated = await User.findOneAndUpdate(
    {
      _id: userId,
      premium: { $ne: true },
      remainingLikes: { $lt: DAILY_LIKE_LIMIT },
    },
    { $inc: { remainingLikes: 1 } },
    { new: true }
  ).select("remainingLikes");

  if (updated && (updated.remainingLikes ?? 0) > 0) {
    await User.updateOne(
      { _id: userId },
      { $set: { likesRechargeAt: null } }
    );
  }
}

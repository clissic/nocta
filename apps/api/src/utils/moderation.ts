import type { SuspensionDuration } from "@nocta/shared";
import { User, type UserDocument } from "../models/User.js";

export type ActiveSuspension = {
  suspendedAt: Date;
  suspendedUntil?: Date;
  duration: SuspensionDuration;
  permanent: boolean;
};

function durationOf(user: UserDocument): SuspensionDuration {
  const value = user.suspensionDuration;
  return value === 30 ||
    value === 90 ||
    value === 180 ||
    value === 360 ||
    value === "permanent"
    ? value
    : "permanent";
}

export function getActiveSuspension(
  user: UserDocument,
  now = new Date()
): ActiveSuspension | null {
  if (user.moderationStatus !== "suspended" || !user.suspendedAt) return null;
  const duration = durationOf(user);
  if (duration !== "permanent") {
    if (!user.suspendedUntil || user.suspendedUntil.getTime() <= now.getTime()) {
      return null;
    }
  }
  return {
    suspendedAt: user.suspendedAt,
    suspendedUntil:
      duration === "permanent"
        ? undefined
        : (user.suspendedUntil ?? undefined),
    duration,
    permanent: duration === "permanent",
  };
}

export async function refreshExpiredSuspension(user: UserDocument) {
  if (
    user.moderationStatus === "suspended" &&
    user.suspensionDuration !== "permanent" &&
    user.suspendedUntil &&
    user.suspendedUntil.getTime() <= Date.now()
  ) {
    user.moderationStatus = "active";
    await User.updateOne(
      { _id: user._id, moderationStatus: "suspended" },
      { $set: { moderationStatus: "active" } }
    );
  }
  return getActiveSuspension(user);
}

export function suspensionError(suspension: ActiveSuspension) {
  return {
    error: suspension.permanent
      ? "Tu cuenta está bloqueada permanentemente"
      : `Tu cuenta está bloqueada por ${suspension.duration} días`,
    code: suspension.permanent
      ? "ACCOUNT_PERMANENTLY_SUSPENDED"
      : "ACCOUNT_TEMPORARILY_SUSPENDED",
    suspendedAt: suspension.suspendedAt.toISOString(),
    suspendedUntil: suspension.suspendedUntil?.toISOString(),
    duration: suspension.duration,
  };
}

export function moderationVisibleUserFilter(now = new Date()) {
  return {
    $or: [
      { moderationStatus: { $ne: "suspended" } },
      {
        moderationStatus: "suspended",
        suspensionDuration: { $ne: "permanent" },
        suspendedUntil: { $lte: now },
      },
    ],
  };
}

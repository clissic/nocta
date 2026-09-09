import { Block } from "../models/Block.js";
import { Follow } from "../models/Follow.js";
import { FollowRequest } from "../models/FollowRequest.js";
import { Notification } from "../models/Notification.js";
import { Swipe } from "../models/Swipe.js";
import { User } from "../models/User.js";
import { dissolveAllMatchesBetween } from "./matchActions.js";

async function refreshSocialCounts(userId: string) {
  const [followersCount, followingUsersCount, followingVenuesCount] =
    await Promise.all([
      Follow.countDocuments({ targetType: "user", targetId: userId }),
      Follow.countDocuments({ followerId: userId, targetType: "user" }),
      Follow.countDocuments({ followerId: userId, targetType: "venue" }),
    ]);
  await User.updateOne(
    { _id: userId },
    { followersCount, followingUsersCount, followingVenuesCount }
  );
}

export async function blockUser(
  blockerId: string,
  blockedId: string
): Promise<
  | { ok: true; blocked: true; blockedUserId: string }
  | { error: string; status: number }
> {
  if (blockerId === blockedId) {
    return { error: "No podés bloquearte a vos mismo", status: 400 } as const;
  }

  try {
    await Block.updateOne(
      { blockerId, blockedId },
      { $setOnInsert: { blockerId, blockedId } },
      { upsert: true }
    );
  } catch (err: unknown) {
    const isDuplicate =
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: number }).code === 11000;
    if (!isDuplicate) throw err;
  }

  await Promise.all([
    Follow.deleteMany({
      targetType: "user",
      $or: [
        { followerId: blockerId, targetId: blockedId },
        { followerId: blockedId, targetId: blockerId },
      ],
    }),
    FollowRequest.deleteMany({
      $or: [
        { fromUserId: blockerId, toUserId: blockedId },
        { fromUserId: blockedId, toUserId: blockerId },
      ],
    }),
    Swipe.updateMany(
      {
        $or: [
          { fromUserId: blockerId, toUserId: blockedId },
          { fromUserId: blockedId, toUserId: blockerId },
        ],
      },
      { $set: { direction: "pass" } }
    ),
    Notification.deleteMany({
      $or: [
        { userId: blockerId, "data.actorId": blockedId },
        { userId: blockedId, "data.actorId": blockerId },
      ],
    }),
    dissolveAllMatchesBetween(blockerId, blockedId),
  ]);

  await Promise.all([
    refreshSocialCounts(blockerId),
    refreshSocialCounts(blockedId),
  ]);

  return { ok: true, blocked: true, blockedUserId: blockedId } as const;
}

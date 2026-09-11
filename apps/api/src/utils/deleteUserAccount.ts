import { ActivityEvent } from "../models/ActivityEvent.js";
import { Block } from "../models/Block.js";
import { Follow } from "../models/Follow.js";
import { FollowRequest } from "../models/FollowRequest.js";
import { Match } from "../models/Match.js";
import { Message } from "../models/Message.js";
import { Notification } from "../models/Notification.js";
import { Presence } from "../models/Presence.js";
import { PromoPurchase } from "../models/PromoPurchase.js";
import { Report } from "../models/Report.js";
import { Swipe } from "../models/Swipe.js";
import { User, type UserDocument } from "../models/User.js";
import { UserPost } from "../models/UserPost.js";
import { Venue } from "../models/Venue.js";
import { VenueRequest } from "../models/VenueRequest.js";
import { VenueReview } from "../models/VenueReview.js";
import { purgeAllUserImages } from "../image-lifecycle/accountImages.js";
import { recomputeVenueRatings } from "./venueRatings.js";

/**
 * Eliminación definitiva de cuenta (post período de 30 días o admin).
 * Purga imágenes (Image Service + legacy) y datos asociados.
 */
export async function deleteUserAccount(user: UserDocument) {
  const userId = user._id;
  const [matches, follows, reviews] = await Promise.all([
    Match.find({ users: userId }).select("_id"),
    Follow.find({
      $or: [
        { followerId: userId },
        { targetType: "user", targetId: userId },
      ],
    }).lean(),
    VenueReview.find({ userId }).lean(),
  ]);

  const matchIds = matches.map((match) => match._id);
  const affectedUserIds = new Set<string>();
  const affectedVenueIds = new Set<string>();
  for (const follow of follows) {
    if (follow.targetType === "user") {
      affectedUserIds.add(follow.targetId.toString());
      affectedUserIds.add(follow.followerId.toString());
    } else {
      affectedVenueIds.add(follow.targetId.toString());
    }
  }
  affectedUserIds.delete(userId.toString());

  await purgeAllUserImages(user);

  await Promise.all([
    Message.deleteMany({ matchId: { $in: matchIds } }),
    Match.deleteMany({ _id: { $in: matchIds } }),
    Follow.deleteMany({
      $or: [
        { followerId: userId },
        { targetType: "user", targetId: userId },
      ],
    }),
    FollowRequest.deleteMany({
      $or: [{ fromUserId: userId }, { toUserId: userId }],
    }),
    Block.deleteMany({
      $or: [{ blockerId: userId }, { blockedId: userId }],
    }),
    Swipe.deleteMany({
      $or: [{ fromUserId: userId }, { toUserId: userId }],
    }),
    Presence.deleteMany({ userId }),
    PromoPurchase.deleteMany({ userId }),
    Report.deleteMany({
      $or: [{ reporterId: userId }, { reportedUserId: userId }],
    }),
    Notification.deleteMany({ userId }),
    ActivityEvent.deleteMany({ actorId: userId }),
    VenueReview.deleteMany({ userId }),
    UserPost.deleteMany({ authorId: userId }),
    VenueRequest.deleteMany({ requesterId: userId }),
    Venue.updateMany({ ownerId: userId }, { $unset: { ownerId: 1 } }),
  ]);

  await User.deleteOne({ _id: userId });

  await Promise.all([
    ...[...affectedUserIds].map(async (id) => {
      const [followersCount, followingUsersCount, followingVenuesCount] =
        await Promise.all([
          Follow.countDocuments({ targetType: "user", targetId: id }),
          Follow.countDocuments({ followerId: id, targetType: "user" }),
          Follow.countDocuments({ followerId: id, targetType: "venue" }),
        ]);
      await User.updateOne(
        { _id: id },
        { followersCount, followingUsersCount, followingVenuesCount }
      );
    }),
    ...[...affectedVenueIds].map(async (id) => {
      const followersCount = await Follow.countDocuments({
        targetType: "venue",
        targetId: id,
      });
      await Venue.updateOne({ _id: id }, { followersCount });
    }),
    ...[...new Set(reviews.map((review) => review.venueId.toString()))].map(
      (id) => recomputeVenueRatings(id)
    ),
  ]);
}

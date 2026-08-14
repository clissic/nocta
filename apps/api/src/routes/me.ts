import { Router } from "express";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { User } from "../models/User.js";
import { Follow } from "../models/Follow.js";
import { Venue } from "../models/Venue.js";
import { serializePublicUser, serializeVenue } from "../utils/serialize.js";
import { venueFollowersCount } from "../utils/follows.js";

const router = Router();

router.get("/following", requireAuth, async (req: AuthedRequest, res) => {
  const me = req.user!._id;
  const rows = await Follow.find({ followerId: me }).sort({ createdAt: -1 });

  const userIds = rows
    .filter((r) => r.targetType === "user")
    .map((r) => r.targetId);
  const venueIds = rows
    .filter((r) => r.targetType === "venue")
    .map((r) => r.targetId);

  const [users, venues] = await Promise.all([
    User.find({ _id: { $in: userIds }, profileComplete: true }),
    Venue.find({ _id: { $in: venueIds }, active: true }),
  ]);

  const userMap = new Map(users.map((u) => [u._id.toString(), u]));
  const venueMap = new Map(venues.map((v) => [v._id.toString(), v]));

  const publicUsers = userIds
    .map((id) => userMap.get(id.toString()))
    .filter(Boolean)
    .map((u) => serializePublicUser(u!, { isFollowing: true }));

  const publicVenues = await Promise.all(
    venueIds
      .map((id) => venueMap.get(id.toString()))
      .filter(Boolean)
      .map(async (v) =>
        serializeVenue(v!, {
          followersCount: await venueFollowersCount(v!._id),
          isFollowing: true,
        })
      )
  );

  return res.json({ users: publicUsers, venues: publicVenues });
});

router.get("/followers", requireAuth, async (req: AuthedRequest, res) => {
  const me = req.user!._id.toString();
  const rows = await Follow.find({
    targetType: "user",
    targetId: me,
  }).sort({ createdAt: -1 });

  const followerIds = rows.map((r) => r.followerId);
  const users = await User.find({
    _id: { $in: followerIds },
    profileComplete: true,
  });
  const map = new Map(users.map((u) => [u._id.toString(), u]));

  const followingBack = await Follow.find({
    followerId: me,
    targetType: "user",
    targetId: { $in: followerIds },
  });
  const backSet = new Set(followingBack.map((f) => f.targetId.toString()));

  const list = followerIds
    .map((id) => map.get(id.toString()))
    .filter(Boolean)
    .map((u) =>
      serializePublicUser(u!, {
        isFollower: true,
        isFollowing: backSet.has(u!._id.toString()),
      })
    );

  return res.json({ users: list });
});

export default router;

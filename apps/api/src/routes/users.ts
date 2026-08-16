import { Router } from "express";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { optionalAuth } from "../middleware/optionalAuth.js";
import { User } from "../models/User.js";
import { Follow } from "../models/Follow.js";
import { Venue } from "../models/Venue.js";
import { serializePublicUser, serializeVenue } from "../utils/serialize.js";
import { isObjectId, paramId } from "../utils/ids.js";
import {
  areBlocked,
  cancelUserFollowRequest,
  hasPendingFollowRequest,
  isFollowing,
  requestUserFollow,
  unfollowTarget,
} from "../utils/follows.js";

const router = Router();

async function loadPublicUser(id: string) {
  if (!isObjectId(id)) return null;
  const user = await User.findById(id);
  if (!user || !user.profileComplete || !user.profile) return null;
  return user;
}

router.get("/:id", optionalAuth, async (req: AuthedRequest, res) => {
  const id = paramId(req.params.id);
  const user = await loadPublicUser(id);
  if (!user) {
    return res.status(404).json({ error: "Usuario no encontrado" });
  }

  const viewerId = req.user?._id.toString();
  if (viewerId && (await areBlocked(viewerId, id))) {
    return res.status(404).json({ error: "Usuario no encontrado" });
  }

  let following = false;
  let follower = false;
  let followRequested = false;
  if (viewerId) {
    following = await isFollowing(viewerId, "user", id);
    follower = await isFollowing(id, "user", viewerId);
    followRequested = following
      ? false
      : await hasPendingFollowRequest(viewerId, id);
  }

  return res.json({
    user: serializePublicUser(user, {
      isFollowing: viewerId ? following : undefined,
      isFollower: viewerId ? follower : undefined,
      isFollowRequested: viewerId ? followRequested : undefined,
    }),
  });
});

router.post("/:id/follow", requireAuth, async (req: AuthedRequest, res) => {
  const id = paramId(req.params.id);
  const result = await requestUserFollow({
    fromUserId: req.user!._id.toString(),
    toUserId: id,
  });
  if ("error" in result) {
    return res.status(result.status).json({ error: result.error });
  }
  const target = await User.findById(id);
  return res.json({
    ok: true,
    followersCount: target?.followersCount ?? 0,
    isFollowing: result.status === "following",
    isFollowRequested: result.status === "pending",
    status: result.status,
  });
});

router.delete("/:id/follow", requireAuth, async (req: AuthedRequest, res) => {
  const id = paramId(req.params.id);
  const me = req.user!._id.toString();
  const following = await isFollowing(me, "user", id);
  if (following) {
    const result = await unfollowTarget({
      followerId: me,
      targetType: "user",
      targetId: id,
    });
    if ("error" in result) {
      return res.status(result.status).json({ error: result.error });
    }
  } else {
    await cancelUserFollowRequest({ fromUserId: me, toUserId: id });
  }
  const target = await User.findById(id);
  return res.json({
    ok: true,
    followersCount: target?.followersCount ?? 0,
    isFollowing: false,
    isFollowRequested: false,
    status: "none",
  });
});

router.get("/:id/followers", optionalAuth, async (req: AuthedRequest, res) => {
  const id = paramId(req.params.id);
  const target = await loadPublicUser(id);
  if (!target) {
    return res.status(404).json({ error: "Usuario no encontrado" });
  }

  const rows = await Follow.find({
    targetType: "user",
    targetId: id,
  }).sort({ createdAt: -1 });
  const ids = rows.map((r) => r.followerId);
  const users = await User.find({ _id: { $in: ids }, profileComplete: true });
  const map = new Map(users.map((u) => [u._id.toString(), u]));

  const viewerId = req.user?._id.toString();
  let followingSet = new Set<string>();
  if (viewerId) {
    const mine = await Follow.find({
      followerId: viewerId,
      targetType: "user",
      targetId: { $in: ids },
    });
    followingSet = new Set(mine.map((f) => f.targetId.toString()));
  }

  const list = ids
    .map((fid) => map.get(fid.toString()))
    .filter(Boolean)
    .map((u) =>
      serializePublicUser(u!, {
        isFollowing: viewerId
          ? followingSet.has(u!._id.toString())
          : undefined,
      })
    );

  return res.json({ users: list, followersCount: target.followersCount ?? 0 });
});

router.get("/:id/venues", optionalAuth, async (req: AuthedRequest, res) => {
  const id = paramId(req.params.id);
  const user = await loadPublicUser(id);
  if (!user) {
    return res.status(404).json({ error: "Usuario no encontrado" });
  }

  const viewerId = req.user?._id.toString();
  if (viewerId && (await areBlocked(viewerId, id))) {
    return res.status(404).json({ error: "Usuario no encontrado" });
  }

  const venues = await Venue.find({ ownerId: id, active: true }).sort({
    name: 1,
  });
  return res.json({
    venues: venues.map((v) =>
      serializeVenue(v, { followersCount: v.followersCount ?? 0 })
    ),
  });
});

router.get("/:id/following", optionalAuth, async (req: AuthedRequest, res) => {
  const id = paramId(req.params.id);
  const target = await loadPublicUser(id);
  if (!target) {
    return res.status(404).json({ error: "Usuario no encontrado" });
  }

  const rows = await Follow.find({
    followerId: id,
    targetType: "user",
  }).sort({ createdAt: -1 });
  const ids = rows.map((r) => r.targetId);
  const users = await User.find({ _id: { $in: ids }, profileComplete: true });
  const map = new Map(users.map((u) => [u._id.toString(), u]));

  const viewerId = req.user?._id.toString();
  let followingSet = new Set<string>();
  if (viewerId) {
    const mine = await Follow.find({
      followerId: viewerId,
      targetType: "user",
      targetId: { $in: ids },
    });
    followingSet = new Set(mine.map((f) => f.targetId.toString()));
  }

  const list = ids
    .map((tid) => map.get(tid.toString()))
    .filter(Boolean)
    .map((u) =>
      serializePublicUser(u!, {
        isFollowing: viewerId
          ? followingSet.has(u!._id.toString())
          : undefined,
      })
    );

  return res.json({
    users: list,
    followingUsersCount: target.followingUsersCount ?? 0,
  });
});

export default router;

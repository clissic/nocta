import { Router } from "express";
import { z } from "zod";
import { MY_REVIEWS_PAGE_SIZE } from "@nocta/shared";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { User } from "../models/User.js";
import { Follow } from "../models/Follow.js";
import { Venue } from "../models/Venue.js";
import { VenueReview } from "../models/VenueReview.js";
import { PromoPurchase } from "../models/PromoPurchase.js";
import {
  serializePublicUser,
  serializeReducedProfile,
  serializeUser,
  serializeVenue,
  serializeVenueReview,
  serializePromoPurchase,
} from "../utils/serialize.js";
import {
  acceptFollowRequest,
  rejectFollowRequest,
  unfollowTarget,
  venueFollowersCount,
} from "../utils/follows.js";
import { FollowRequest } from "../models/FollowRequest.js";
import { isObjectId, paramId } from "../utils/ids.js";

const router = Router();

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const settingsSchema = z
  .object({
    autoAcceptFollowRequests: z.boolean().optional(),
    showActivityToFollowers: z.boolean().optional(),
  })
  .refine(
    (body) =>
      body.autoAcceptFollowRequests !== undefined ||
      body.showActivityToFollowers !== undefined,
    { message: "Nada para actualizar" }
  );

router.patch("/settings", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos" });
  }

  const updates: {
    autoAcceptFollowRequests?: boolean;
    showActivityToFollowers?: boolean;
  } = {};
  if (parsed.data.autoAcceptFollowRequests !== undefined) {
    updates.autoAcceptFollowRequests = parsed.data.autoAcceptFollowRequests;
  }
  if (parsed.data.showActivityToFollowers !== undefined) {
    updates.showActivityToFollowers = parsed.data.showActivityToFollowers;
  }

  const user = await User.findByIdAndUpdate(
    req.user!._id,
    {
      $set: updates,
      ...(parsed.data.showActivityToFollowers !== undefined
        ? { $unset: { hideActivityFromFollowers: 1 } }
        : {}),
    },
    { new: true }
  );
  if (!user) {
    return res.status(404).json({ error: "Usuario no encontrado" });
  }

  return res.json({ user: serializeUser(user) });
});

router.get("/reviews", requireAuth, async (req: AuthedRequest, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(
    20,
    Math.max(1, Number(req.query.limit) || MY_REVIEWS_PAGE_SIZE)
  );
  const q =
    typeof req.query.q === "string" ? req.query.q.trim().slice(0, 80) : "";
  const skip = (page - 1) * limit;
  const me = req.user!._id;

  const filter: Record<string, unknown> = {
    userId: me,
    active: true,
  };

  if (q) {
    const escaped = escapeRegex(q);
    const matchingVenues = await Venue.find({
      name: { $regex: escaped, $options: "i" },
    })
      .select("_id")
      .limit(50);
    filter.$or = [
      { venueId: { $in: matchingVenues.map((v) => v._id) } },
      { body: { $regex: escaped, $options: "i" } },
    ];
  }

  const [total, rows] = await Promise.all([
    VenueReview.countDocuments(filter),
    VenueReview.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
  ]);

  const venueIds = [...new Set(rows.map((r) => r.venueId.toString()))];
  const venues = await Venue.find({ _id: { $in: venueIds } }).select(
    "name photos"
  );
  const venueMap = new Map(
    venues.map((v) => [
      v._id.toString(),
      { name: v.name, photo: v.photos?.[0] },
    ])
  );

  const totalPages = Math.max(1, Math.ceil(total / limit));
  return res.json({
    reviews: rows.map((review) => {
      const venue = venueMap.get(review.venueId.toString());
      return serializeVenueReview(review, {
        venueName: venue?.name,
        venuePhoto: venue?.photo,
      });
    }),
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasMore: page < totalPages,
    },
  });
});

router.get("/venues/owned", requireAuth, async (req: AuthedRequest, res) => {
  const venues = await Venue.find({
    ownerId: req.user!._id,
    active: true,
  }).sort({ name: 1 });
  return res.json({
    venues: venues.map((v) =>
      serializeVenue(v, { followersCount: v.followersCount ?? 0 })
    ),
  });
});

router.get("/promo-purchases", requireAuth, async (req: AuthedRequest, res) => {
  const purchases = await PromoPurchase.find({
    userId: req.user!._id,
  }).sort({ purchasedAt: -1 });

  const venueIds = [...new Set(purchases.map((p) => p.venueId.toString()))];
  const venues = await Venue.find({ _id: { $in: venueIds } }).select(
    "name photos"
  );
  const venueMap = new Map(
    venues.map((v) => [
      v._id.toString(),
      { name: v.name, photo: v.photos?.[0] },
    ])
  );

  return res.json({
    purchases: purchases.map((p) => {
      const meta = venueMap.get(p.venueId.toString());
      return serializePromoPurchase(p, {
        venueName: meta?.name,
        venuePhoto: meta?.photo,
      });
    }),
  });
});

router.get(
  "/promo-purchases/:id",
  requireAuth,
  async (req: AuthedRequest, res) => {
    const id = paramId(req.params.id);
    if (!isObjectId(id)) {
      return res.status(400).json({ error: "Id inválido" });
    }
    const purchase = await PromoPurchase.findOne({
      _id: id,
      userId: req.user!._id,
    });
    if (!purchase) {
      return res.status(404).json({ error: "Promo no encontrada" });
    }
    const venue = await Venue.findById(purchase.venueId).select("name photos");
    return res.json({
      purchase: serializePromoPurchase(purchase, {
        venueName: venue?.name,
        venuePhoto: venue?.photos?.[0],
      }),
    });
  }
);

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

router.delete(
  "/followers/:id",
  requireAuth,
  async (req: AuthedRequest, res) => {
    const followerId = paramId(req.params.id);
    if (!isObjectId(followerId)) {
      return res.status(400).json({ error: "Id inválido" });
    }

    const result = await unfollowTarget({
      followerId,
      targetType: "user",
      targetId: req.user!._id.toString(),
    });
    if ("error" in result) {
      return res.status(result.status).json({ error: result.error });
    }
    return res.json({ ok: true });
  }
);

router.get("/follow-requests", requireAuth, async (req: AuthedRequest, res) => {
  const me = req.user!._id;
  const rows = await FollowRequest.find({
    toUserId: me,
    status: "pending",
  }).sort({ createdAt: -1 });

  const fromIds = rows.map((r) => r.fromUserId);
  const users = await User.find({
    _id: { $in: fromIds },
    profileComplete: true,
  });
  const map = new Map(users.map((u) => [u._id.toString(), u]));

  const requests = rows
    .map((row) => {
      const from = map.get(row.fromUserId.toString());
      if (!from?.profile?.birthDate) return null;
      const publicUser = serializePublicUser(from);
      return {
        id: row._id.toString(),
        status: row.status as "pending",
        createdAt: row.createdAt.toISOString(),
        fromUser: {
          id: publicUser.id,
          name: publicUser.name,
          photo: publicUser.photo,
          age: publicUser.age,
        },
      };
    })
    .filter(Boolean);

  return res.json({ requests });
});

router.get(
  "/follow-requests/:id/profile",
  requireAuth,
  async (req: AuthedRequest, res) => {
    const id = paramId(req.params.id);
    if (!isObjectId(id)) {
      return res.status(400).json({ error: "Id inválido" });
    }

    const request = await FollowRequest.findOne({
      _id: id,
      toUserId: req.user!._id,
      status: "pending",
    });
    if (!request) {
      return res.status(404).json({ error: "Solicitud no encontrada" });
    }

    const requester = await User.findOne({
      _id: request.fromUserId,
      profileComplete: true,
    });
    if (!requester?.profile?.birthDate) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    return res.json({ profile: serializeReducedProfile(requester) });
  }
);

router.post(
  "/follow-requests/:id/accept",
  requireAuth,
  async (req: AuthedRequest, res) => {
    const id = paramId(req.params.id);
    if (!isObjectId(id)) {
      return res.status(400).json({ error: "Id inválido" });
    }
    const result = await acceptFollowRequest({
      requestId: id,
      toUserId: req.user!._id.toString(),
    });
    if ("error" in result) {
      return res.status(result.status).json({ error: result.error });
    }
    return res.json({ ok: true, fromUserId: result.fromUserId });
  }
);

router.post(
  "/follow-requests/:id/reject",
  requireAuth,
  async (req: AuthedRequest, res) => {
    const id = paramId(req.params.id);
    if (!isObjectId(id)) {
      return res.status(400).json({ error: "Id inválido" });
    }
    const result = await rejectFollowRequest({
      requestId: id,
      toUserId: req.user!._id.toString(),
    });
    if ("error" in result) {
      return res.status(result.status).json({ error: result.error });
    }
    return res.json({ ok: true });
  }
);

export default router;

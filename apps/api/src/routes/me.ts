import { Router } from "express";
import { z } from "zod";
import { MY_REVIEWS_PAGE_SIZE } from "@nocta/shared";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { resolveNearestAppCity } from "../utils/appCities.js";
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
  resolvePublicAssetUrl,
} from "../utils/serialize.js";
import {
  acceptFollowRequest,
  rejectFollowRequest,
  unfollowTarget,
} from "../utils/follows.js";
import { FollowRequest } from "../models/FollowRequest.js";
import { Block } from "../models/Block.js";
import { Report } from "../models/Report.js";
import { isObjectId, paramId } from "../utils/ids.js";
import { isPremiumActive } from "../utils/premium.js";
import { endActivePresences } from "../utils/presence.js";
import {
  collectIdentityVerificationFiles,
  deleteIdentityVerificationMulterFiles,
  handleMulterError,
  identityVerificationRequestFiles,
  uploadIdentityVerificationFiles,
} from "../uploads/index.js";
import {
  ingestCollectedIdentityUpload,
  ingestErrorResponse,
  removeIdentityStoredRef,
} from "../image-service/index.js";
import { sendIdentityVerificationSubmittedEmail } from "../mail/mailer.js";
import { requireSensitiveImageRateLimit } from "../middleware/requireImageRateLimit.js";

const router = Router();

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const settingsSchema = z
  .object({
    autoAcceptFollowRequests: z.boolean().optional(),
    showActivityToFollowers: z.boolean().optional(),
    rogueMode: z.boolean().optional(),
    teleportMode: z.boolean().optional(),
    discoverDisabled: z.boolean().optional(),
  })
  .refine(
    (body) =>
      body.autoAcceptFollowRequests !== undefined ||
      body.showActivityToFollowers !== undefined ||
      body.rogueMode !== undefined ||
      body.teleportMode !== undefined ||
      body.discoverDisabled !== undefined,
    { message: "Nada para actualizar" }
  );

router.patch("/settings", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos" });
  }

  if (parsed.data.rogueMode !== undefined && !isPremiumActive(req.user!)) {
    return res.status(403).json({
      error: "El modo pícaro es exclusivo de Nocta Premium",
      code: "PREMIUM_REQUIRED",
    });
  }

  if (parsed.data.teleportMode !== undefined && !isPremiumActive(req.user!)) {
    return res.status(403).json({
      error: "El modo Teleport es exclusivo de Nocta Premium",
      code: "PREMIUM_REQUIRED",
    });
  }

  const updates: {
    autoAcceptFollowRequests?: boolean;
    showActivityToFollowers?: boolean;
    rogueMode?: boolean;
    teleportMode?: boolean;
    discoverDisabled?: boolean;
  } = {};
  if (parsed.data.autoAcceptFollowRequests !== undefined) {
    updates.autoAcceptFollowRequests = parsed.data.autoAcceptFollowRequests;
  }
  if (parsed.data.showActivityToFollowers !== undefined) {
    updates.showActivityToFollowers = parsed.data.showActivityToFollowers;
  }
  if (parsed.data.rogueMode !== undefined) {
    updates.rogueMode = parsed.data.rogueMode;
  }
  if (parsed.data.teleportMode !== undefined) {
    updates.teleportMode = parsed.data.teleportMode;
  }
  if (parsed.data.discoverDisabled !== undefined) {
    updates.discoverDisabled = parsed.data.discoverDisabled;
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

  if (parsed.data.discoverDisabled === true) {
    await endActivePresences(user._id.toString(), "revoked");
  }

  return res.json({ user: await serializeUser(user) });
});

const teleportLocationSchema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
});

router.put("/teleport-location", requireAuth, async (req: AuthedRequest, res) => {
  if (!isPremiumActive(req.user!)) {
    return res.status(403).json({
      error: "El modo Teleport es exclusivo de Nocta Premium",
      code: "PREMIUM_REQUIRED",
    });
  }

  const parsed = teleportLocationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Ubicación inválida" });
  }

  const user = await User.findById(req.user!._id);
  if (!user) {
    return res.status(404).json({ error: "Usuario no encontrado" });
  }
  if (!user.teleportMode) {
    return res.status(409).json({
      error: "Activá el modo Teleport antes de elegir una ubicación",
      code: "TELEPORT_OFF",
    });
  }

  const nearest = await resolveNearestAppCity(
    parsed.data.lat,
    parsed.data.lng
  );
  if (!nearest) {
    return res.status(404).json({ error: "No hay ciudades activas" });
  }
  user.teleportCity = {
    country: nearest.country,
    city: nearest.city,
    lat: parsed.data.lat,
    lng: parsed.data.lng,
  };
  await user.save();

  return res.json({ user: await serializeUser(user) });
});

const blockedUsersPaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(10).max(50).default(20),
});

router.get("/reports/:id", requireAuth, async (req: AuthedRequest, res) => {
  const id = paramId(req.params.id);
  if (!isObjectId(id)) {
    return res.status(400).json({ error: "Id inválido" });
  }
  const report = await Report.findOne({
    _id: id,
    reporterId: req.user!._id,
  }).lean();
  if (!report) {
    return res.status(404).json({ error: "Denuncia no encontrada" });
  }
  return res.json({
    report: {
      id: report._id.toString(),
      reason: report.reason,
      details: report.details ?? undefined,
      status: report.status ?? "open",
      source: report.source ?? (report.matchId ? "match" : "profile"),
      createdAt: report.createdAt.toISOString(),
      resolution: report.resolution
        ? {
            action: report.resolution.action,
            reason: report.resolution.reason ?? undefined,
            duration: report.resolution.duration ?? undefined,
            suspendedUntil:
              report.resolution.suspendedUntil?.toISOString() ?? undefined,
            resolvedAt: report.resolution.resolvedAt.toISOString(),
          }
        : undefined,
    },
  });
});

router.get("/blocked-users", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = blockedUsersPaginationSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Paginación inválida" });
  }
  const { page, limit } = parsed.data;
  const filter = { blockerId: req.user!._id };
  const [blocks, total] = await Promise.all([
    Block.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Block.countDocuments(filter),
  ]);
  const users = await User.find({
    _id: { $in: blocks.map((block) => block.blockedId) },
  })
    .select("profile.name profile.photos")
    .lean();
  const usersById = new Map(
    users.map((user) => [user._id.toString(), user])
  );

  return res.json({
    users: (
      await Promise.all(
        blocks.map(async (block) => {
          const user = usersById.get(block.blockedId.toString());
          if (!user) return null;
          return {
            id: user._id.toString(),
            name: user.profile?.name ?? "Usuario",
            photo: await resolvePublicAssetUrl(user.profile?.photos?.[0]),
            blockedAt: block.createdAt.toISOString(),
          };
        })
      )
    ).filter((row): row is NonNullable<typeof row> => Boolean(row)),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total,
    },
  });
});

router.delete(
  "/blocked-users/:id",
  requireAuth,
  async (req: AuthedRequest, res) => {
    const blockedId = paramId(req.params.id);
    if (!isObjectId(blockedId)) {
      return res.status(400).json({ error: "Usuario inválido" });
    }
    await Block.deleteOne({
      blockerId: req.user!._id,
      blockedId,
    });
    return res.json({ ok: true, blocked: false, blockedUserId: blockedId });
  }
);

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
    reviews: await Promise.all(
      rows.map(async (review) => {
        const venue = venueMap.get(review.venueId.toString());
        return serializeVenueReview(review, {
          venueName: venue?.name,
          venuePhoto: venue?.photo,
        });
      })
    ),
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
  }).sort({ name: 1 });
  return res.json({
    venues: await Promise.all(
      venues.map((v) =>
        serializeVenue(v, { followersCount: v.followersCount ?? 0 })
      )
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
    purchases: await Promise.all(
      purchases.map(async (p) => {
        const meta = venueMap.get(p.venueId.toString());
        return serializePromoPurchase(p, {
          venueName: meta?.name,
          venuePhoto: meta?.photo,
        });
      })
    ),
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
      purchase: await serializePromoPurchase(purchase, {
        venueName: venue?.name,
        venuePhoto: venue?.photos?.[0],
      }),
    });
  }
);

const CONNECTIONS_LIST_LIMIT = 10;

router.get("/following", requireAuth, async (req: AuthedRequest, res) => {
  const me = req.user!._id;
  const limit = Math.min(
    CONNECTIONS_LIST_LIMIT,
    Math.max(1, Number(req.query.limit) || CONNECTIONS_LIST_LIMIT)
  );
  const q =
    typeof req.query.q === "string" ? req.query.q.trim().slice(0, 80) : "";
  const typeRaw =
    typeof req.query.type === "string" ? req.query.type.trim() : "all";
  const wantUsers = typeRaw === "all" || typeRaw === "user";
  const wantVenues = typeRaw === "all" || typeRaw === "venue";

  let publicUsers: Awaited<ReturnType<typeof serializePublicUser>>[] = [];
  let publicVenues: Awaited<ReturnType<typeof serializeVenue>>[] = [];

  if (wantUsers) {
    if (q) {
      const allIds = (
        await Follow.find({ followerId: me, targetType: "user" })
          .select("targetId")
          .lean()
      ).map((r) => r.targetId);
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const users = allIds.length
        ? await User.find({
            _id: { $in: allIds },
            profileComplete: true,
            "profile.name": { $regex: escaped, $options: "i" },
          })
            .select("profile")
            .limit(limit)
            .lean()
        : [];
      publicUsers = await Promise.all(
        users.map((u) =>
          serializePublicUser(u as never, { isFollowing: true })
        )
      );
    } else {
      // Oversample por si algún perfil está incompleto.
      const userRows = await Follow.find({
        followerId: me,
        targetType: "user",
      })
        .sort({ createdAt: -1 })
        .select("targetId")
        .limit(limit * 5)
        .lean();
      const userIds = userRows.map((r) => r.targetId);
      const users = userIds.length
        ? await User.find({
            _id: { $in: userIds },
            profileComplete: true,
          })
            .select("profile")
            .lean()
        : [];
      const userMap = new Map(users.map((u) => [u._id.toString(), u]));
      const ordered = userIds
        .map((id) => userMap.get(id.toString()))
        .filter(Boolean)
        .slice(0, limit);
      publicUsers = await Promise.all(
        ordered.map((u) =>
          serializePublicUser(u as never, { isFollowing: true })
        )
      );
    }
  }

  if (wantVenues) {
    if (q) {
      const allIds = (
        await Follow.find({ followerId: me, targetType: "venue" })
          .select("targetId")
          .lean()
      ).map((r) => r.targetId);
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const venues = allIds.length
        ? await Venue.find({
            _id: { $in: allIds },
            active: true,
            name: { $regex: escaped, $options: "i" },
          })
            .limit(limit)
            .lean()
        : [];
      publicVenues = await Promise.all(
        venues.map((v) =>
          serializeVenue(v as never, {
            followersCount:
              typeof v.followersCount === "number" ? v.followersCount : 0,
            isFollowing: true,
          })
        )
      );
    } else {
      const venueRows = await Follow.find({
        followerId: me,
        targetType: "venue",
      })
        .sort({ createdAt: -1 })
        .select("targetId")
        .limit(limit * 5)
        .lean();
      const venueIds = venueRows.map((r) => r.targetId);
      const venues = venueIds.length
        ? await Venue.find({ _id: { $in: venueIds }, active: true }).lean()
        : [];
      const venueMap = new Map(venues.map((v) => [v._id.toString(), v]));
      const ordered = venueIds
        .map((id) => venueMap.get(id.toString()))
        .filter(Boolean)
        .slice(0, limit);
      publicVenues = await Promise.all(
        ordered.map((v) =>
          serializeVenue(v as never, {
            followersCount:
              typeof v!.followersCount === "number" ? v!.followersCount : 0,
            isFollowing: true,
          })
        )
      );
    }
  }

  return res.json({ users: publicUsers, venues: publicVenues });
});

router.get("/followers", requireAuth, async (req: AuthedRequest, res) => {
  const me = req.user!._id.toString();
  const limit = Math.min(
    CONNECTIONS_LIST_LIMIT,
    Math.max(1, Number(req.query.limit) || CONNECTIONS_LIST_LIMIT)
  );
  const q =
    typeof req.query.q === "string" ? req.query.q.trim().slice(0, 80) : "";

  let ordered: Array<{ _id: { toString(): string } } & Record<string, unknown>> =
    [];

  if (q) {
    const allIds = (
      await Follow.find({
        targetType: "user",
        targetId: me,
      })
        .select("followerId")
        .lean()
    ).map((r) => r.followerId);
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    ordered = allIds.length
      ? ((await User.find({
          _id: { $in: allIds },
          profileComplete: true,
          "profile.name": { $regex: escaped, $options: "i" },
        })
          .select("profile")
          .limit(limit)
          .lean()) as typeof ordered)
      : [];
  } else {
    const rows = await Follow.find({
      targetType: "user",
      targetId: me,
    })
      .sort({ createdAt: -1 })
      .select("followerId")
      .limit(limit * 5)
      .lean();
    const followerIds = rows.map((r) => r.followerId);
    const users = followerIds.length
      ? await User.find({
          _id: { $in: followerIds },
          profileComplete: true,
        })
          .select("profile")
          .lean()
      : [];
    const map = new Map(users.map((u) => [u._id.toString(), u]));
    ordered = followerIds
      .map((id) => map.get(id.toString()))
      .filter(Boolean)
      .slice(0, limit) as typeof ordered;
  }

  const orderedIds = ordered.map((u) => u._id);
  const followingBack = orderedIds.length
    ? await Follow.find({
        followerId: me,
        targetType: "user",
        targetId: { $in: orderedIds },
      })
        .select("targetId")
        .lean()
    : [];
  const backSet = new Set(followingBack.map((f) => f.targetId.toString()));

  const list = await Promise.all(
    ordered.map((u) =>
      serializePublicUser(u as never, {
        isFollower: true,
        isFollowing: backSet.has(u._id.toString()),
      })
    )
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

  const requests = (
    await Promise.all(
      rows.map(async (row) => {
        const from = map.get(row.fromUserId.toString());
        if (!from?.profile?.birthDate) return null;
        const publicUser = await serializePublicUser(from);
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
    )
  ).filter(Boolean);

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

    return res.json({ profile: await serializeReducedProfile(requester) });
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

router.post(
  "/identity-verification",
  requireAuth,
  requireSensitiveImageRateLimit,
  (req: AuthedRequest, res, next) => {
    uploadIdentityVerificationFiles(req, res, (err) => {
      if (err) {
        const files = identityVerificationRequestFiles(req);
        deleteIdentityVerificationMulterFiles([
          files.documentFront,
          files.selfieWithDocument,
        ]);
        return handleMulterError(err, req, res, next);
      }
      next();
    });
  },
  async (req: AuthedRequest, res) => {
    const collected = collectIdentityVerificationFiles(req);
    const uploaded = identityVerificationRequestFiles(req);
    const cleanupUploaded = () =>
      deleteIdentityVerificationMulterFiles([
        uploaded.documentFront,
        uploaded.selfieWithDocument,
      ]);

    if (!collected.ok) {
      cleanupUploaded();
      return res.status(400).json({ error: collected.error });
    }
    if (!uploaded.documentFront || !uploaded.selfieWithDocument) {
      cleanupUploaded();
      return res.status(400).json({ error: "Faltan archivos de verificación" });
    }

    const user = await User.findById(req.user!._id);
    if (!user) {
      cleanupUploaded();
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const currentStatus =
      (user.identityVerification as { status?: string } | undefined)?.status ??
      "none";
    if (currentStatus === "pending") {
      cleanupUploaded();
      return res.status(409).json({
        error: "Ya tenés una solicitud en revisión",
        code: "IDENTITY_VERIFICATION_PENDING",
      });
    }
    if (currentStatus === "approved") {
      cleanupUploaded();
      return res.status(409).json({
        error: "Tu cuenta ya está verificada",
        code: "IDENTITY_VERIFICATION_APPROVED",
      });
    }

    const previous = user.identityVerification as
      | {
          documentFrontPath?: string | null;
          selfieWithDocumentPath?: string | null;
        }
      | undefined;

    let documentImageId: string;
    let selfieImageId: string;
    try {
      const docIngested = await ingestCollectedIdentityUpload({
        path: uploaded.documentFront.path,
        mimetype: uploaded.documentFront.mimetype,
        ownerId: user._id.toString(),
      });
      const selfieIngested = await ingestCollectedIdentityUpload({
        path: uploaded.selfieWithDocument.path,
        mimetype: uploaded.selfieWithDocument.mimetype,
        ownerId: user._id.toString(),
      });
      documentImageId = docIngested.imageId;
      selfieImageId = selfieIngested.imageId;
    } catch (err) {
      cleanupUploaded();
      const mapped = ingestErrorResponse(err);
      return res.status(mapped.status).json(mapped.body);
    }

    await removeIdentityStoredRef(previous?.documentFrontPath);
    await removeIdentityStoredRef(previous?.selfieWithDocumentPath);

    user.identityVerification = {
      status: "pending",
      // imageId privado (no URL pública); legacy usaba filename en disco
      documentFrontPath: documentImageId,
      selfieWithDocumentPath: selfieImageId,
      submittedAt: new Date(),
      reviewedAt: undefined,
      reviewedById: undefined,
      rejectionReason: undefined,
    } as typeof user.identityVerification;
    await user.save();

    try {
      await sendIdentityVerificationSubmittedEmail({
        userId: user._id.toString(),
        email: user.email,
        name: user.profile?.name || undefined,
      });
    } catch (err) {
      console.error("[mail] identity verification notify failed", err);
    }

    return res.json({ user: await serializeUser(user) });
  }
);

router.delete("/account", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = z.object({ confirmation: z.literal("Eliminar") }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Escribí "Eliminar" para confirmar',
    });
  }

  const user = req.user!;
  if (user.role === "admin") {
    const adminCount = await User.countDocuments({
      role: "admin",
      $or: [
        { deletionRequestedAt: null },
        { deletionRequestedAt: { $exists: false } },
      ],
    });
    if (adminCount <= 1) {
      return res.status(409).json({
        error: "No podés eliminar la última cuenta administradora",
      });
    }
  }

  const {
    requestAccountDeletion,
    ACCOUNT_DELETION_RECOVERY_DAYS,
    accountDeletionPurgeAt,
  } = await import("../image-lifecycle/accountDeletion.js");

  const updated = await requestAccountDeletion(user);
  const purgeAt = accountDeletionPurgeAt(updated.deletionRequestedAt!);
  return res.json({
    ok: true,
    pendingDeletion: true,
    recoveryDays: ACCOUNT_DELETION_RECOVERY_DAYS,
    deletionRequestedAt: updated.deletionRequestedAt!.toISOString(),
    purgeAt: purgeAt.toISOString(),
    user: await serializeUser(updated),
  });
});

router.post("/account/restore", requireAuth, async (req: AuthedRequest, res) => {
  const user = req.user!;
  if (!user.deletionRequestedAt) {
    return res.status(400).json({
      error: "Tu cuenta no está pendiente de eliminación",
      code: "ACCOUNT_NOT_PENDING_DELETION",
    });
  }
  const { restoreAccount } = await import("../image-lifecycle/accountDeletion.js");
  const restored = await restoreAccount(user);
  return res.json({
    ok: true,
    user: await serializeUser(restored),
  });
});

export default router;

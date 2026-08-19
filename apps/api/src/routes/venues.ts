import { Router } from "express";
import { z } from "zod";
import {
  DEFAULT_URUGUAY_CITY,
  MAX_REVIEW_BODY_LENGTH,
  MAX_REVIEW_PHOTOS,
  MAX_VENUE_RATING,
  MIN_VENUE_RATING,
  REVIEWS_PAGE_SIZE,
  URUGUAY_CITIES,
  VENUE_TYPES,
  VENUES_PAGE_SIZE,
} from "@nocta/shared";
import { Venue } from "../models/Venue.js";
import { Promotion } from "../models/Promotion.js";
import { VenueNews } from "../models/VenueNews.js";
import { VenueRequest } from "../models/VenueRequest.js";
import { VenueReview } from "../models/VenueReview.js";
import { Follow } from "../models/Follow.js";
import { User } from "../models/User.js";
import {
  requireAuth,
  requireAdmin,
  type AuthedRequest,
} from "../middleware/auth.js";
import { optionalAuth } from "../middleware/optionalAuth.js";
import {
  requireProfileComplete,
  requireVerified,
} from "../middleware/gates.js";
import {
  serializeVenue,
  serializePromotion,
  serializePublicUser,
  serializeVenueNews,
  serializeVenueRequest,
  serializeVenueReview,
} from "../utils/serialize.js";
import { isObjectId, paramId } from "../utils/ids.js";
import { resolveVenueLocation, reverseGeocode } from "../utils/geocode.js";
import {
  currentlyValidPromoFilter,
  parsePromoValidityRange,
  resolveUserTimeZone,
} from "../utils/promoValidity.js";
import {
  followTarget,
  isFollowing,
  unfollowTarget,
  venueFollowersCount,
} from "../utils/follows.js";
import { canManageVenue } from "../utils/venueAccess.js";
import { recomputeVenueRatings } from "../utils/venueRatings.js";
import {
  deactivateReviewActivity,
  recordActivity,
} from "../utils/activity.js";
import { createNotification } from "../utils/notify.js";
import { notifyUserFollowers } from "../utils/notifyFollowers.js";
import { sendVenueRequestNotificationEmail } from "../mail/mailer.js";
import {
  assertUploadsAreImages,
  collectUploadedFiles,
  deleteLocalUploads,
  handleMulterError,
  uploadPhotosFlexible,
  uploadSinglePhoto,
} from "../uploads/index.js";

const router = Router();

const locationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const photoUrlSchema = z
  .string()
  .min(1)
  .refine(
    (v) => v.startsWith("/uploads/") || /^https?:\/\//i.test(v),
    "URL de foto inválida"
  );

const uruguayCityLabels = URUGUAY_CITIES.map((c) => c.label) as [
  string,
  ...string[],
];

const venueRequestSchema = z.object({
  name: z.string().min(2).max(120),
  type: z.enum(VENUE_TYPES),
  /** Dirección para mostrar (pública). */
  address: z.string().min(5).max(200),
  city: z.enum(uruguayCityLabels).default(DEFAULT_URUGUAY_CITY.label),
  description: z.string().max(1000).optional(),
  photos: z.array(photoUrlSchema).max(1).default([]),
  contactEmail: z.preprocess(
    (v) => (typeof v === "string" && !v.trim() ? undefined : v),
    z.string().email().optional()
  ),
  contactPhone: z.preprocess(
    (v) => (typeof v === "string" && !v.trim() ? undefined : v),
    z.string().trim().max(40).optional()
  ),
  location: locationSchema,
  geocodedAddress: z.string().min(3).max(300),
});

function parseRequestBody(raw: Record<string, unknown>) {
  const locationRaw = raw.location;
  let location: unknown = locationRaw;
  if (typeof locationRaw === "string") {
    try {
      location = JSON.parse(locationRaw);
    } catch {
      location = undefined;
    }
  }

  let photos: unknown = raw.photos;
  if (typeof photos === "string") {
    try {
      photos = JSON.parse(photos);
    } catch {
      photos = photos ? [photos] : [];
    }
  }

  return venueRequestSchema.safeParse({
    name: raw.name,
    type: raw.type,
    address: raw.address ?? raw.displayAddress,
    city: raw.city,
    description:
      typeof raw.description === "string" && raw.description.trim()
        ? raw.description
        : undefined,
    photos: photos ?? [],
    contactEmail:
      typeof raw.contactEmail === "string" ? raw.contactEmail : undefined,
    contactPhone:
      typeof raw.contactPhone === "string" ? raw.contactPhone : undefined,
    location,
    geocodedAddress: raw.geocodedAddress,
  });
}

const venueSchema = z.object({
  name: z.string().min(2).max(120),
  type: z.enum(VENUE_TYPES),
  address: z.string().min(3),
  city: z.string().min(2).default("Montevideo"),
  description: z.string().max(1000).optional(),
  photos: z.array(z.string().url()).default([]),
  location: locationSchema.optional().nullable(),
  active: z.boolean().optional(),
  ownerId: z.string().min(1),
});

const venuePatchSchema = venueSchema.partial().extend({
  ownerId: z.string().min(1).optional().nullable(),
});

const ymdSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Usá fechas YYYY-MM-DD");

const promoSchema = z.object({
  title: z.string().min(2).max(120),
  description: z.string().min(2).max(500),
  priceUyu: z.number().finite().min(0).max(1_000_000),
  validFrom: ymdSchema,
  validUntil: ymdSchema,
  active: z.boolean().optional(),
});

const newsSchema = z.object({
  title: z.string().min(2).max(120),
  body: z.string().min(2).max(4000),
  photos: z.array(photoUrlSchema).min(1).max(1),
  publishedAt: z.string().optional(),
  active: z.boolean().optional(),
});

const reviewSchema = z.object({
  rating: z.coerce
    .number()
    .int()
    .min(MIN_VENUE_RATING)
    .max(MAX_VENUE_RATING),
  body: z
    .string()
    .trim()
    .max(MAX_REVIEW_BODY_LENGTH)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  photos: z.array(photoUrlSchema).max(MAX_REVIEW_PHOTOS).default([]),
});

function parseReviewBody(raw: Record<string, unknown>) {
  // Preferir `photos` (ya mergeado con uploads) sobre `existingPhotos`.
  let photos: unknown =
    raw.photos !== undefined ? raw.photos : raw.existingPhotos;
  if (typeof photos === "string") {
    try {
      photos = JSON.parse(photos);
    } catch {
      photos = photos ? [photos] : [];
    }
  }
  return reviewSchema.safeParse({
    ...raw,
    photos: photos ?? [],
  });
}

function parseNewsBody(raw: Record<string, unknown>) {
  let photos: unknown = raw.photos;
  if (typeof photos === "string") {
    try {
      photos = JSON.parse(photos);
    } catch {
      photos = photos ? [photos] : [];
    }
  }
  let active = raw.active;
  if (typeof active === "string") {
    active = active === "true" || active === "1";
  }
  return newsSchema.safeParse({
    ...raw,
    photos: photos ?? [],
    active,
  });
}

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(VENUES_PAGE_SIZE)
    .default(VENUES_PAGE_SIZE),
  type: z.enum(VENUE_TYPES).optional(),
  q: z.string().trim().max(120).optional(),
});

async function resolveOwnerId(ownerId: string) {
  if (!isObjectId(ownerId)) return null;
  const owner = await User.findById(ownerId);
  if (!owner || owner.role !== "user") return null;
  return owner;
}

router.get("/", async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Parámetros inválidos" });
  }

  const { page, limit, type } = parsed.data;
  const q = parsed.data.q?.trim();

  const filter: Record<string, unknown> = { active: true };
  if (type) filter.type = type;
  if (q) {
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "i");
    filter.$or = [
      { name: regex },
      { address: regex },
      { city: regex },
      { description: regex },
    ];
  }

  const skip = (page - 1) * limit;
  const [total, venues] = await Promise.all([
    Venue.countDocuments(filter),
    Venue.find(filter).sort({ name: 1 }).skip(skip).limit(limit),
  ]);

  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

  return res.json({
    venues: venues.map((v) => serializeVenue(v)),
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasMore: page < totalPages,
    },
  });
});

router.get(
  "/admin/all",
  requireAuth,
  requireAdmin,
  async (_req: AuthedRequest, res) => {
    const venues = await Venue.find().sort({ createdAt: -1 });
    const ownerIds = [
      ...new Set(
        venues
          .map((v) => (v.ownerId ? v.ownerId.toString() : null))
          .filter((id): id is string => Boolean(id))
      ),
    ];
    const owners = ownerIds.length
      ? await User.find({ _id: { $in: ownerIds } })
      : [];
    const ownersById = new Map(owners.map((u) => [u._id.toString(), u]));

    return res.json({
      venues: venues.map((v) => {
        const ownerId = v.ownerId ? v.ownerId.toString() : undefined;
        const owner = ownerId ? ownersById.get(ownerId) : undefined;
        return serializeVenue(v, {
          owner:
            owner && owner.profile?.name
              ? {
                  id: owner._id.toString(),
                  name: owner.profile.name,
                  photo: owner.profile.photos?.[0],
                }
              : owner
                ? {
                    id: owner._id.toString(),
                    name: owner.email,
                  }
                : undefined,
        });
      }),
    });
  }
);

router.post(
  "/requests",
  requireAuth,
  (req: AuthedRequest, res, next) => {
    uploadSinglePhoto(req, res, (err) => {
      if (err) return handleMulterError(err, req, res, next);
      next();
    });
  },
  async (req: AuthedRequest, res) => {
    const uploaded = collectUploadedFiles(req);
    if (uploaded.length > 0) {
      const checked = assertUploadsAreImages(uploaded);
      if (!checked.ok) {
        deleteLocalUploads(uploaded.map((u) => u.url));
        return res
          .status(400)
          .json({ error: checked.error, code: "UPLOAD_INVALID" });
      }
    }

    const body = { ...(req.body as Record<string, unknown>) };
    if (uploaded[0]?.url) {
      body.photos = [uploaded[0].url];
    }

    const parsed = parseRequestBody(body);
    if (!parsed.success) {
      deleteLocalUploads(uploaded.map((u) => u.url));
      return res.status(400).json({
        error: "Datos inválidos",
        details: parsed.error.flatten(),
      });
    }

    const pending = await VenueRequest.countDocuments({
      requesterId: req.user!._id,
      status: "pending",
    });
    if (pending >= 5) {
      deleteLocalUploads(uploaded.map((u) => u.url));
      return res.status(400).json({
        error: "Ya tenés demasiadas solicitudes pendientes",
      });
    }

    const request = await VenueRequest.create({
      requesterId: req.user!._id,
      name: parsed.data.name,
      type: parsed.data.type,
      address: parsed.data.address,
      city: parsed.data.city,
      description: parsed.data.description,
      photos: parsed.data.photos,
      contactEmail: parsed.data.contactEmail,
      contactPhone: parsed.data.contactPhone,
      location: parsed.data.location,
      geocodedAddress: parsed.data.geocodedAddress,
      status: "pending",
    });

    try {
      await sendVenueRequestNotificationEmail({
        request: {
          id: request._id.toString(),
          name: request.name,
          type: request.type,
          address: request.address,
          city: request.city,
          geocodedAddress: request.geocodedAddress ?? undefined,
          description: request.description ?? undefined,
          contactEmail: request.contactEmail ?? undefined,
          contactPhone: request.contactPhone ?? undefined,
          photoUrl: request.photos?.[0],
        },
        requester: {
          email: req.user!.email,
          name: req.user!.profile?.name ?? undefined,
        },
      });
    } catch (err) {
      console.error(
        "[mail] No se pudo notificar la solicitud de Espacio:",
        err instanceof Error ? err.message : err
      );
    }

    return res.status(201).json({
      request: serializeVenueRequest(request),
    });
  }
);

router.get("/requests/mine", requireAuth, async (req: AuthedRequest, res) => {
  const rows = await VenueRequest.find({ requesterId: req.user!._id }).sort({
    createdAt: -1,
  });
  return res.json({ requests: rows.map((r) => serializeVenueRequest(r)) });
});

router.get("/geocode/reverse", requireAuth, async (req: AuthedRequest, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: "Coordenadas inválidas" });
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({ error: "Coordenadas fuera de rango" });
  }

  const result = await reverseGeocode(lat, lng);
  if (!result) {
    return res.status(404).json({ error: "No se pudo obtener la dirección" });
  }

  return res.json({
    address: result.address,
    city: result.city,
    displayName: result.displayName,
    location: { lat, lng },
  });
});

router.get("/:id", optionalAuth, async (req: AuthedRequest, res) => {
  const id = paramId(req.params.id);
  if (!isObjectId(id)) {
    return res.status(400).json({ error: "Id inválido" });
  }
  const venue = await Venue.findById(id);
  if (!venue || !venue.active) {
    return res.status(404).json({ error: "Espacio no encontrado" });
  }

  if (
    venue.location?.lat == null ||
    venue.location?.lng == null ||
    !Number.isFinite(venue.location.lat) ||
    !Number.isFinite(venue.location.lng)
  ) {
    const resolved = await resolveVenueLocation({
      address: venue.address,
      city: venue.city,
    });
    if (resolved) {
      venue.location = resolved;
      await venue.save();
    }
  }

  const [promotions, news, owner] = await Promise.all([
    Promotion.find({
      venueId: venue._id,
      active: true,
      ...currentlyValidPromoFilter(),
    })
      .sort({ createdAt: -1 })
      .limit(3),
    VenueNews.find({
      venueId: venue._id,
      active: true,
    })
      .sort({ publishedAt: -1 })
      .limit(3),
    venue.ownerId ? User.findById(venue.ownerId) : Promise.resolve(null),
  ]);

  const followersCount = await venueFollowersCount(venue._id);
  const viewerId = req.user?._id.toString();
  const following = viewerId
    ? await isFollowing(viewerId, "venue", venue._id)
    : undefined;

  const myReviewDoc =
    viewerId
      ? await VenueReview.findOne({
          venueId: venue._id,
          userId: viewerId,
          active: true,
        })
      : null;

  const ownerSummary =
    owner?.profile?.name
      ? {
          id: owner._id.toString(),
          name: owner.profile.name,
          photo: owner.profile.photos?.[0],
        }
      : undefined;

  const myReview = myReviewDoc
    ? serializeVenueReview(myReviewDoc, {
        author: req.user?.profile?.name
          ? {
              id: req.user._id.toString(),
              name: req.user.profile.name,
              photo: req.user.profile.photos?.[0],
            }
          : undefined,
        venueName: venue.name,
        venuePhoto: venue.photos?.[0],
      })
    : undefined;

  return res.json({
    venue: serializeVenue(venue, {
      followersCount,
      isFollowing: following,
      owner: ownerSummary,
      myReview,
    }),
    promotions: promotions.map((p) => serializePromotion(p)),
    news: news.map((n) => serializeVenueNews(n)),
  });
});

router.post("/:id/follow", requireAuth, async (req: AuthedRequest, res) => {
  const id = paramId(req.params.id);
  if (!isObjectId(id)) {
    return res.status(400).json({ error: "Id inválido" });
  }
  const venue = await Venue.findOne({ _id: id, active: true });
  if (!venue) return res.status(404).json({ error: "Espacio no encontrado" });

  const result = await followTarget({
    followerId: req.user!._id.toString(),
    targetType: "venue",
    targetId: id,
  });
  if ("error" in result) {
    return res.status(result.status).json({ error: result.error });
  }

  if (result.created) {
    void recordActivity({
      actorId: req.user!._id.toString(),
      type: "venue_followed",
      venueId: id,
      payload: { venueName: venue.name },
    }).catch(() => undefined);

    if (venue.ownerId) {
      const ownerId = venue.ownerId.toString();
      if (ownerId !== req.user!._id.toString()) {
        const followerName = req.user!.profile?.name ?? "Alguien";
        void createNotification({
          userId: ownerId,
          type: "venue_new_follower",
          title: "Nuevo seguidor de tu Espacio",
          body: `${followerName} empezó a seguir ${venue.name}`,
          href: `/venues/${id}/manage`,
          data: {
            venueId: id,
            actorId: req.user!._id.toString(),
          },
        });
      }
    }
  }

  return res.json({
    ok: true,
    followersCount: await venueFollowersCount(id),
    isFollowing: true,
  });
});

router.delete("/:id/follow", requireAuth, async (req: AuthedRequest, res) => {
  const id = paramId(req.params.id);
  if (!isObjectId(id)) {
    return res.status(400).json({ error: "Id inválido" });
  }
  const result = await unfollowTarget({
    followerId: req.user!._id.toString(),
    targetType: "venue",
    targetId: id,
  });
  if ("error" in result) {
    return res.status(result.status).json({ error: result.error });
  }
  return res.json({
    ok: true,
    followersCount: await venueFollowersCount(id),
    isFollowing: false,
  });
});

router.get(
  "/:id/followers",
  optionalAuth,
  async (req: AuthedRequest, res) => {
    const id = paramId(req.params.id);
    if (!isObjectId(id)) {
      return res.status(400).json({ error: "Id inválido" });
    }
    const venue = await Venue.findOne({ _id: id, active: true });
    if (!venue) {
      return res.status(404).json({ error: "Espacio no encontrado" });
    }

    const rows = await Follow.find({
      targetType: "venue",
      targetId: id,
    }).sort({ createdAt: -1 });
    const ids = rows.map((r) => r.followerId);
    const users = await User.find({
      _id: { $in: ids },
      profileComplete: true,
    });
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

    return res.json({
      users: list,
      followersCount: await venueFollowersCount(id),
    });
  }
);

router.get(
  "/:id/reviews",
  optionalAuth,
  async (req: AuthedRequest, res) => {
    const id = paramId(req.params.id);
    if (!isObjectId(id)) {
      return res.status(400).json({ error: "Id inválido" });
    }
    const venue = await Venue.findOne({ _id: id, active: true });
    if (!venue) {
      return res.status(404).json({ error: "Espacio no encontrado" });
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(
      30,
      Math.max(1, Number(req.query.limit) || REVIEWS_PAGE_SIZE)
    );
    const skip = (page - 1) * limit;

    const filter = { venueId: id, active: true };
    const [total, rows] = await Promise.all([
      VenueReview.countDocuments(filter),
      VenueReview.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    ]);

    const userIds = rows.map((r) => r.userId);
    const authors = await User.find({
      _id: { $in: userIds },
      profileComplete: true,
    }).select("profile");
    const authorMap = new Map(
      authors.map((u) => [
        u._id.toString(),
        {
          id: u._id.toString(),
          name: u.profile?.name ?? "Usuario",
          photo: u.profile?.photos?.[0],
        },
      ])
    );

    const totalPages = Math.max(1, Math.ceil(total / limit));
    return res.json({
      reviews: rows.map((r) =>
        serializeVenueReview(r, {
          author: authorMap.get(r.userId.toString()),
          venueName: venue.name,
          venuePhoto: venue.photos?.[0],
        })
      ),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
      ratingAvg: venue.ratingCount ? venue.ratingAvg : undefined,
      ratingCount: venue.ratingCount ?? 0,
    });
  }
);

router.post(
  "/:id/reviews",
  requireAuth,
  requireVerified,
  requireProfileComplete,
  (req: AuthedRequest, res, next) => {
    uploadPhotosFlexible(req, res, (err) => {
      if (err) return handleMulterError(err, req, res, next);
      next();
    });
  },
  async (req: AuthedRequest, res) => {
    const id = paramId(req.params.id);
    if (!isObjectId(id)) {
      return res.status(400).json({ error: "Id inválido" });
    }
    const venue = await Venue.findOne({ _id: id, active: true });
    if (!venue) return res.status(404).json({ error: "Espacio no encontrado" });

    const uploaded = collectUploadedFiles(req);
    if (uploaded.length > 0) {
      const checked = assertUploadsAreImages(uploaded);
      if (!checked.ok) {
        deleteLocalUploads(uploaded.map((u) => u.url));
        return res
          .status(400)
          .json({ error: checked.error, code: "UPLOAD_INVALID" });
      }
    }

    const body = { ...(req.body as Record<string, unknown>) };
    if (uploaded.length > 0) {
      const existingRaw = body.existingPhotos ?? body.photos;
      const existingPhotos = Array.isArray(existingRaw)
        ? (existingRaw as string[])
        : typeof existingRaw === "string"
          ? (() => {
              try {
                return JSON.parse(existingRaw) as string[];
              } catch {
                return [];
              }
            })()
          : [];
      body.photos = [
        ...existingPhotos.filter((p) => typeof p === "string"),
        ...uploaded.map((u) => u.url),
      ].slice(0, MAX_REVIEW_PHOTOS);
      delete body.existingPhotos;
    } else if (body.existingPhotos !== undefined && body.photos === undefined) {
      body.photos = body.existingPhotos;
      delete body.existingPhotos;
    }

    const parsed = parseReviewBody(body);
    if (!parsed.success) {
      deleteLocalUploads(uploaded.map((u) => u.url));
      return res.status(400).json({
        error: "Datos inválidos",
        details: parsed.error.flatten(),
      });
    }

    const userId = req.user!._id;
    const existing = await VenueReview.findOne({ venueId: id, userId });
    const isUpdate = Boolean(existing);
    let review: typeof existing;

    if (existing) {
      existing.rating = parsed.data.rating;
      existing.body = parsed.data.body;
      existing.photos = parsed.data.photos;
      existing.active = true;
      review = await existing.save();
    } else {
      review = await VenueReview.create({
        venueId: id,
        userId,
        rating: parsed.data.rating,
        body: parsed.data.body,
        photos: parsed.data.photos,
        active: true,
      });
    }

    await recomputeVenueRatings(id);
    void recordActivity({
      actorId: userId.toString(),
      type: isUpdate ? "venue_review_updated" : "venue_review_created",
      venueId: id,
      reviewId: review!._id.toString(),
      payload: {
        rating: review!.rating,
        body: review!.body,
        photos: review!.photos ?? [],
        venueName: venue.name,
      },
    }).catch(() => undefined);

    const authorName = req.user?.profile?.name ?? "Alguien";
    void notifyUserFollowers({
      actorId: userId.toString(),
      notification: {
        type: "followed_user_review",
        title: isUpdate ? "Actualizó una reseña" : "Nueva reseña",
        body: `${authorName} ${isUpdate ? "actualizó su reseña de" : "reseñó"} ${venue.name}`,
        href: `/venues/${id}`,
        data: {
          venueId: id,
          reviewId: review!._id.toString(),
        },
        dedupePrefix: `followed_user_review:${review!._id.toString()}`,
      },
    }).catch(() => undefined);

    if (!isUpdate && venue.ownerId) {
      const ownerId = venue.ownerId.toString();
      if (ownerId !== userId.toString()) {
        void createNotification({
          userId: ownerId,
          type: "venue_new_review",
          title: "Nueva reseña en tu Espacio",
          body: `${authorName} reseñó ${venue.name}`,
          href: `/venues/${id}`,
          data: {
            venueId: id,
            reviewId: review!._id.toString(),
            actorId: userId.toString(),
          },
        });
      }
    }

    const author = req.user?.profile?.name
      ? {
          id: userId.toString(),
          name: req.user.profile.name,
          photo: req.user.profile.photos?.[0],
        }
      : undefined;

    return res.status(isUpdate ? 200 : 201).json({
      review: serializeVenueReview(review!, {
        author,
        venueName: venue.name,
        venuePhoto: venue.photos?.[0],
      }),
    });
  }
);

router.patch(
  "/:id/reviews/:reviewId",
  requireAuth,
  requireVerified,
  requireProfileComplete,
  (req: AuthedRequest, res, next) => {
    uploadPhotosFlexible(req, res, (err) => {
      if (err) return handleMulterError(err, req, res, next);
      next();
    });
  },
  async (req: AuthedRequest, res) => {
    const venueId = paramId(req.params.id);
    const reviewId = paramId(req.params.reviewId);
    if (!isObjectId(venueId) || !isObjectId(reviewId)) {
      return res.status(400).json({ error: "Id inválido" });
    }
    const venue = await Venue.findOne({ _id: venueId, active: true });
    if (!venue) return res.status(404).json({ error: "Espacio no encontrado" });

    const review = await VenueReview.findOne({
      _id: reviewId,
      venueId,
      userId: req.user!._id,
    });
    if (!review) return res.status(404).json({ error: "Reseña no encontrada" });

    const uploaded = collectUploadedFiles(req);
    if (uploaded.length > 0) {
      const checked = assertUploadsAreImages(uploaded);
      if (!checked.ok) {
        deleteLocalUploads(uploaded.map((u) => u.url));
        return res
          .status(400)
          .json({ error: checked.error, code: "UPLOAD_INVALID" });
      }
    }

    const body = { ...(req.body as Record<string, unknown>) };
    if (uploaded.length > 0 || body.photos !== undefined || body.existingPhotos !== undefined) {
      const existingRaw = body.existingPhotos ?? body.photos;
      let photos: string[] = Array.isArray(existingRaw)
        ? (existingRaw as string[])
        : typeof existingRaw === "string"
          ? (() => {
              try {
                return JSON.parse(existingRaw) as string[];
              } catch {
                return review.photos ?? [];
              }
            })()
          : [...(review.photos ?? [])];
      if (uploaded.length > 0) {
        photos = [...photos, ...uploaded.map((u) => u.url)].slice(
          0,
          MAX_REVIEW_PHOTOS
        );
      }
      body.photos = photos;
      delete body.existingPhotos;
    } else {
      body.photos = review.photos ?? [];
    }
    if (body.rating === undefined) body.rating = review.rating;
    if (body.body === undefined) body.body = review.body ?? "";

    const parsed = parseReviewBody(body);
    if (!parsed.success) {
      deleteLocalUploads(uploaded.map((u) => u.url));
      return res.status(400).json({
        error: "Datos inválidos",
        details: parsed.error.flatten(),
      });
    }

    review.rating = parsed.data.rating;
    review.body = parsed.data.body;
    review.photos = parsed.data.photos;
    review.active = true;
    await review.save();
    await recomputeVenueRatings(venueId);

    void recordActivity({
      actorId: req.user!._id.toString(),
      type: "venue_review_updated",
      venueId,
      reviewId: review._id.toString(),
      payload: {
        rating: review.rating,
        body: review.body,
        photos: review.photos ?? [],
        venueName: venue.name,
      },
    }).catch(() => undefined);

    const authorName = req.user?.profile?.name ?? "Alguien";
    void notifyUserFollowers({
      actorId: req.user!._id.toString(),
      notification: {
        type: "followed_user_review",
        title: "Actualizó una reseña",
        body: `${authorName} actualizó su reseña de ${venue.name}`,
        href: `/venues/${venueId}`,
        data: {
          venueId,
          reviewId: review._id.toString(),
        },
        dedupePrefix: `followed_user_review:${review._id.toString()}:upd`,
      },
    }).catch(() => undefined);

    return res.json({
      review: serializeVenueReview(review, {
        author: req.user?.profile?.name
          ? {
              id: req.user._id.toString(),
              name: req.user.profile.name,
              photo: req.user.profile.photos?.[0],
            }
          : undefined,
        venueName: venue.name,
        venuePhoto: venue.photos?.[0],
      }),
    });
  }
);

router.delete(
  "/:id/reviews/:reviewId",
  requireAuth,
  async (req: AuthedRequest, res) => {
    const venueId = paramId(req.params.id);
    const reviewId = paramId(req.params.reviewId);
    if (!isObjectId(venueId) || !isObjectId(reviewId)) {
      return res.status(400).json({ error: "Id inválido" });
    }
    const venue = await Venue.findById(venueId);
    if (!venue) return res.status(404).json({ error: "Espacio no encontrado" });

    const review = await VenueReview.findOne({ _id: reviewId, venueId });
    if (!review) return res.status(404).json({ error: "Reseña no encontrada" });

    const isAuthor = review.userId.toString() === req.user!._id.toString();
    const isAdmin = req.user!.role === "admin";
    if (!isAuthor && !isAdmin) {
      return res.status(403).json({ error: "Sin permiso" });
    }

    review.active = false;
    await review.save();
    await recomputeVenueRatings(venueId);
    await deactivateReviewActivity(reviewId);

    return res.json({
      review: serializeVenueReview(review, {
        venueName: venue.name,
        venuePhoto: venue.photos?.[0],
      }),
    });
  }
);

router.post(
  "/",
  requireAuth,
  requireAdmin,
  async (req: AuthedRequest, res) => {
    const parsed = venueSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Datos inválidos",
        details: parsed.error.flatten(),
      });
    }

    const owner = await resolveOwnerId(parsed.data.ownerId);
    if (!owner) {
      return res.status(400).json({ error: "Organizador inválido" });
    }

    const location = await resolveVenueLocation({
      address: parsed.data.address,
      city: parsed.data.city,
      location: parsed.data.location,
    });
    const venue = await Venue.create({
      ...parsed.data,
      ownerId: owner._id,
      location,
      followersCount: 0,
    });
    return res.status(201).json({ venue: serializeVenue(venue) });
  }
);

router.patch(
  "/:id",
  requireAuth,
  requireAdmin,
  async (req: AuthedRequest, res) => {
    const id = paramId(req.params.id);
    if (!isObjectId(id)) {
      return res.status(400).json({ error: "Id inválido" });
    }
    const parsed = venuePatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Datos inválidos" });
    }

    const existing = await Venue.findById(id);
    if (!existing) return res.status(404).json({ error: "Espacio no encontrado" });

    const nextAddress = parsed.data.address ?? existing.address;
    const nextCity = parsed.data.city ?? existing.city;
    const addressChanged =
      (parsed.data.address !== undefined &&
        parsed.data.address !== existing.address) ||
      (parsed.data.city !== undefined && parsed.data.city !== existing.city);

    let location = existing.location
      ? { lat: existing.location.lat, lng: existing.location.lng }
      : undefined;

    if (parsed.data.location === null) {
      location = undefined;
    } else if (parsed.data.location) {
      location = parsed.data.location;
    } else if (addressChanged || !location) {
      location = await resolveVenueLocation({
        address: nextAddress,
        city: nextCity,
        location: null,
      });
    }

    let ownerId = existing.ownerId;
    if (parsed.data.ownerId === null) {
      ownerId = undefined;
    } else if (parsed.data.ownerId) {
      const owner = await resolveOwnerId(parsed.data.ownerId);
      if (!owner) {
        return res.status(400).json({ error: "Organizador inválido" });
      }
      ownerId = owner._id;
    }

    const { location: _ignored, ownerId: _ownerIgnored, ...rest } = parsed.data;
    const venue = await Venue.findByIdAndUpdate(
      id,
      { ...rest, location, ownerId },
      { new: true }
    );
    if (!venue) return res.status(404).json({ error: "Espacio no encontrado" });
    return res.json({ venue: serializeVenue(venue) });
  }
);

router.delete(
  "/:id",
  requireAuth,
  requireAdmin,
  async (req: AuthedRequest, res) => {
    const venue = await Venue.findByIdAndUpdate(
      req.params.id,
      { active: false },
      { new: true }
    );
    if (!venue) return res.status(404).json({ error: "Espacio no encontrado" });
    return res.json({ venue: serializeVenue(venue) });
  }
);

router.post(
  "/:id/promotions",
  requireAuth,
  async (req: AuthedRequest, res) => {
    const venue = await Venue.findById(req.params.id);
    if (!venue) return res.status(404).json({ error: "Espacio no encontrado" });
    if (!canManageVenue(req, venue)) {
      return res.status(403).json({ error: "Sin permiso" });
    }

    const parsed = promoSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Datos inválidos" });
    }

    const timeZone = resolveUserTimeZone(req.user?.profile?.livesIn?.country);
    const range = parsePromoValidityRange(
      parsed.data.validFrom,
      parsed.data.validUntil,
      timeZone
    );
    if (!range.ok) {
      return res.status(400).json({ error: range.error });
    }

    const promo = await Promotion.create({
      venueId: venue._id,
      title: parsed.data.title,
      description: parsed.data.description,
      priceUyu: parsed.data.priceUyu,
      validFrom: range.validFrom,
      validUntil: range.validUntil,
      active: parsed.data.active ?? true,
    });

    return res.status(201).json({ promotion: serializePromotion(promo) });
  }
);

router.get("/:id/promotions", requireAuth, async (req: AuthedRequest, res) => {
  const id = paramId(req.params.id);
  if (!isObjectId(id)) {
    return res.status(400).json({ error: "Id inválido" });
  }
  const venue = await Venue.findById(id);
  if (!venue) return res.status(404).json({ error: "Espacio no encontrado" });
  if (!canManageVenue(req, venue)) {
    return res.status(403).json({ error: "Sin permiso" });
  }
  const promotions = await Promotion.find({ venueId: id }).sort({
    createdAt: -1,
  });
  return res.json({ promotions: promotions.map((p) => serializePromotion(p)) });
});

router.get("/:id/news", optionalAuth, async (req: AuthedRequest, res) => {
  const id = paramId(req.params.id);
  if (!isObjectId(id)) {
    return res.status(400).json({ error: "Id inválido" });
  }
  const venue = await Venue.findById(id);
  if (!venue) return res.status(404).json({ error: "Espacio no encontrado" });

  const manage = canManageVenue(req, venue);
  const filter: Record<string, unknown> = { venueId: id };
  if (!manage) filter.active = true;

  const news = await VenueNews.find(filter).sort({ publishedAt: -1 });
  return res.json({ news: news.map((n) => serializeVenueNews(n)) });
});

router.post(
  "/:id/news",
  requireAuth,
  (req: AuthedRequest, res, next) => {
    uploadSinglePhoto(req, res, (err) => {
      if (err) return handleMulterError(err, req, res, next);
      next();
    });
  },
  async (req: AuthedRequest, res) => {
    const venue = await Venue.findById(req.params.id);
    if (!venue) return res.status(404).json({ error: "Espacio no encontrado" });
    if (!canManageVenue(req, venue)) {
      return res.status(403).json({ error: "Sin permiso" });
    }

    const uploaded = collectUploadedFiles(req);
    if (uploaded.length > 0) {
      const checked = assertUploadsAreImages(uploaded);
      if (!checked.ok) {
        deleteLocalUploads(uploaded.map((u) => u.url));
        return res
          .status(400)
          .json({ error: checked.error, code: "UPLOAD_INVALID" });
      }
    }

    const body = { ...(req.body as Record<string, unknown>) };
    if (uploaded[0]?.url) {
      body.photos = [uploaded[0].url];
    }

    const hasPhoto =
      Array.isArray(body.photos) && (body.photos as unknown[]).length > 0;
    if (!hasPhoto) {
      return res.status(400).json({ error: "La imagen es obligatoria" });
    }

    const parsed = parseNewsBody(body);
    if (!parsed.success) {
      deleteLocalUploads(uploaded.map((u) => u.url));
      return res.status(400).json({
        error: "Datos inválidos",
        details: parsed.error.flatten(),
      });
    }

    const news = await VenueNews.create({
      venueId: venue._id,
      title: parsed.data.title,
      body: parsed.data.body,
      photos: parsed.data.photos ?? [],
      publishedAt: parsed.data.publishedAt
        ? new Date(parsed.data.publishedAt)
        : new Date(),
      active: parsed.data.active ?? true,
    });

    return res.status(201).json({ news: serializeVenueNews(news) });
  }
);

router.patch(
  "/:id/news/:newsId",
  requireAuth,
  async (req: AuthedRequest, res) => {
    const venueId = paramId(req.params.id);
    const newsId = paramId(req.params.newsId);
    if (!isObjectId(venueId) || !isObjectId(newsId)) {
      return res.status(400).json({ error: "Id inválido" });
    }
    const venue = await Venue.findById(venueId);
    if (!venue) return res.status(404).json({ error: "Espacio no encontrado" });
    if (!canManageVenue(req, venue)) {
      return res.status(403).json({ error: "Sin permiso" });
    }

    const parsed = newsSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Datos inválidos" });
    }

    const update: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.publishedAt !== undefined) {
      update.publishedAt = parsed.data.publishedAt
        ? new Date(parsed.data.publishedAt)
        : new Date();
    }

    const news = await VenueNews.findOneAndUpdate(
      { _id: newsId, venueId },
      update,
      { new: true }
    );
    if (!news) return res.status(404).json({ error: "Noticia no encontrada" });
    return res.json({ news: serializeVenueNews(news) });
  }
);

router.delete(
  "/:id/news/:newsId",
  requireAuth,
  async (req: AuthedRequest, res) => {
    const venueId = paramId(req.params.id);
    const newsId = paramId(req.params.newsId);
    if (!isObjectId(venueId) || !isObjectId(newsId)) {
      return res.status(400).json({ error: "Id inválido" });
    }
    const venue = await Venue.findById(venueId);
    if (!venue) return res.status(404).json({ error: "Espacio no encontrado" });
    if (!canManageVenue(req, venue)) {
      return res.status(403).json({ error: "Sin permiso" });
    }

    const news = await VenueNews.findOneAndUpdate(
      { _id: newsId, venueId },
      { active: false },
      { new: true }
    );
    if (!news) return res.status(404).json({ error: "Noticia no encontrada" });
    return res.json({ news: serializeVenueNews(news) });
  }
);

router.patch(
  "/:id/promotions/:promoId",
  requireAuth,
  async (req: AuthedRequest, res) => {
    const venueId = paramId(req.params.id);
    const promoId = paramId(req.params.promoId);
    if (!isObjectId(venueId) || !isObjectId(promoId)) {
      return res.status(400).json({ error: "Id inválido" });
    }
    const venue = await Venue.findById(venueId);
    if (!venue) return res.status(404).json({ error: "Espacio no encontrado" });
    if (!canManageVenue(req, venue)) {
      return res.status(403).json({ error: "Sin permiso" });
    }

    const parsed = promoSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Datos inválidos" });
    }

    const update: Record<string, unknown> = {};
    if (parsed.data.title !== undefined) update.title = parsed.data.title;
    if (parsed.data.description !== undefined) {
      update.description = parsed.data.description;
    }
    if (parsed.data.priceUyu !== undefined) update.priceUyu = parsed.data.priceUyu;
    if (parsed.data.active !== undefined) update.active = parsed.data.active;

    if (
      parsed.data.validFrom !== undefined ||
      parsed.data.validUntil !== undefined
    ) {
      if (!parsed.data.validFrom || !parsed.data.validUntil) {
        return res
          .status(400)
          .json({ error: "Indicá fecha de inicio y de fin" });
      }
      const timeZone = resolveUserTimeZone(req.user?.profile?.livesIn?.country);
      const range = parsePromoValidityRange(
        parsed.data.validFrom,
        parsed.data.validUntil,
        timeZone
      );
      if (!range.ok) {
        return res.status(400).json({ error: range.error });
      }
      update.validFrom = range.validFrom;
      update.validUntil = range.validUntil;
    }

    const promo = await Promotion.findOneAndUpdate(
      { _id: promoId, venueId },
      update,
      { new: true }
    );
    if (!promo) return res.status(404).json({ error: "Promo no encontrada" });
    return res.json({ promotion: serializePromotion(promo) });
  }
);

router.delete(
  "/:id/promotions/:promoId",
  requireAuth,
  async (req: AuthedRequest, res) => {
    const venueId = paramId(req.params.id);
    const promoId = paramId(req.params.promoId);
    if (!isObjectId(venueId) || !isObjectId(promoId)) {
      return res.status(400).json({ error: "Id inválido" });
    }
    const venue = await Venue.findById(venueId);
    if (!venue) return res.status(404).json({ error: "Espacio no encontrado" });
    if (!canManageVenue(req, venue)) {
      return res.status(403).json({ error: "Sin permiso" });
    }

    const promo = await Promotion.findOneAndUpdate(
      { _id: promoId, venueId },
      { active: false },
      { new: true }
    );
    if (!promo) return res.status(404).json({ error: "Promo no encontrada" });
    return res.json({ promotion: serializePromotion(promo) });
  }
);

export default router;


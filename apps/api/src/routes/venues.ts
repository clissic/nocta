import { Router } from "express";
import { z } from "zod";
import { VENUE_TYPES, VENUES_PAGE_SIZE } from "@nocta/shared";
import { Venue } from "../models/Venue.js";
import { Promotion } from "../models/Promotion.js";
import { Follow } from "../models/Follow.js";
import { User } from "../models/User.js";
import {
  requireAuth,
  requireAdmin,
  type AuthedRequest,
} from "../middleware/auth.js";
import { optionalAuth } from "../middleware/optionalAuth.js";
import {
  serializeVenue,
  serializePromotion,
  serializePublicUser,
} from "../utils/serialize.js";
import { isObjectId, paramId } from "../utils/ids.js";
import { resolveVenueLocation } from "../utils/geocode.js";
import {
  followTarget,
  isFollowing,
  unfollowTarget,
  venueFollowersCount,
} from "../utils/follows.js";

const router = Router();

const locationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const venueSchema = z.object({
  name: z.string().min(2).max(120),
  type: z.enum(VENUE_TYPES),
  address: z.string().min(3),
  city: z.string().min(2).default("Buenos Aires"),
  description: z.string().max(1000).optional(),
  photos: z.array(z.string().url()).default([]),
  location: locationSchema.optional().nullable(),
  active: z.boolean().optional(),
});

const promoSchema = z.object({
  title: z.string().min(2).max(120),
  description: z.string().min(2).max(500),
  validUntil: z.string().optional(),
  active: z.boolean().optional(),
});

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
    return res.json({ venues: venues.map((v) => serializeVenue(v)) });
  }
);

router.get("/:id", optionalAuth, async (req: AuthedRequest, res) => {
  const id = paramId(req.params.id);
  if (!isObjectId(id)) {
    return res.status(400).json({ error: "Id inválido" });
  }
  const venue = await Venue.findById(id);
  if (!venue || !venue.active) {
    return res.status(404).json({ error: "Local no encontrado" });
  }

  // Si el local no tiene coords, geocodificar una vez y persistir
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

  const promotions = await Promotion.find({
    venueId: venue._id,
    active: true,
    $or: [{ validUntil: null }, { validUntil: { $gte: new Date() } }],
  });

  const followersCount = await venueFollowersCount(venue._id);
  const viewerId = req.user?._id.toString();
  const following = viewerId
    ? await isFollowing(viewerId, "venue", venue._id)
    : undefined;

  return res.json({
    venue: serializeVenue(venue, {
      followersCount,
      isFollowing: following,
    }),
    promotions: promotions.map(serializePromotion),
  });
});

router.post("/:id/follow", requireAuth, async (req: AuthedRequest, res) => {
  const id = paramId(req.params.id);
  if (!isObjectId(id)) {
    return res.status(400).json({ error: "Id inválido" });
  }
  const result = await followTarget({
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
      return res.status(404).json({ error: "Local no encontrado" });
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

router.post(
  "/",
  requireAuth,
  requireAdmin,
  async (req: AuthedRequest, res) => {
    const parsed = venueSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Datos inválidos", details: parsed.error.flatten() });
    }
    const location = await resolveVenueLocation({
      address: parsed.data.address,
      city: parsed.data.city,
      location: parsed.data.location,
    });
    const venue = await Venue.create({
      ...parsed.data,
      location,
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
    const parsed = venueSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Datos inválidos" });
    }

    const existing = await Venue.findById(id);
    if (!existing) return res.status(404).json({ error: "Local no encontrado" });

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

    const { location: _ignored, ...rest } = parsed.data;
    const venue = await Venue.findByIdAndUpdate(
      id,
      { ...rest, location },
      { new: true }
    );
    if (!venue) return res.status(404).json({ error: "Local no encontrado" });
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
    if (!venue) return res.status(404).json({ error: "Local no encontrado" });
    return res.json({ venue: serializeVenue(venue) });
  }
);

router.post(
  "/:id/promotions",
  requireAuth,
  requireAdmin,
  async (req: AuthedRequest, res) => {
    const venue = await Venue.findById(req.params.id);
    if (!venue) return res.status(404).json({ error: "Local no encontrado" });

    const parsed = promoSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Datos inválidos" });
    }

    const promo = await Promotion.create({
      venueId: venue._id,
      title: parsed.data.title,
      description: parsed.data.description,
      validUntil: parsed.data.validUntil
        ? new Date(parsed.data.validUntil)
        : undefined,
      active: parsed.data.active ?? true,
    });

    return res.status(201).json({ promotion: serializePromotion(promo) });
  }
);

router.get(
  "/:id/promotions",
  requireAuth,
  requireAdmin,
  async (req: AuthedRequest, res) => {
    const id = paramId(req.params.id);
    if (!isObjectId(id)) {
      return res.status(400).json({ error: "Id inválido" });
    }
    const promotions = await Promotion.find({ venueId: id }).sort({
      createdAt: -1,
    });
    return res.json({ promotions: promotions.map(serializePromotion) });
  }
);

export default router;

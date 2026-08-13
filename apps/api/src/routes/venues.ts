import { Router } from "express";
import { z } from "zod";
import { VENUE_TYPES, VENUES_PAGE_SIZE } from "@nocta/shared";
import { Venue } from "../models/Venue.js";
import { Promotion } from "../models/Promotion.js";
import {
  requireAuth,
  requireAdmin,
  type AuthedRequest,
} from "../middleware/auth.js";
import { serializeVenue, serializePromotion } from "../utils/serialize.js";
import { isObjectId, paramId } from "../utils/ids.js";

const router = Router();

const venueSchema = z.object({
  name: z.string().min(2).max(120),
  type: z.enum(VENUE_TYPES),
  address: z.string().min(3),
  city: z.string().min(2).default("Buenos Aires"),
  description: z.string().max(1000).optional(),
  photos: z.array(z.string().url()).default([]),
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
    venues: venues.map(serializeVenue),
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
    return res.json({ venues: venues.map(serializeVenue) });
  }
);

router.get("/:id", async (req, res) => {
  const id = paramId(req.params.id);
  if (!isObjectId(id)) {
    return res.status(400).json({ error: "Id inválido" });
  }
  const venue = await Venue.findById(id);
  if (!venue || !venue.active) {
    return res.status(404).json({ error: "Local no encontrado" });
  }
  const promotions = await Promotion.find({
    venueId: venue._id,
    active: true,
    $or: [{ validUntil: null }, { validUntil: { $gte: new Date() } }],
  });
  return res.json({
    venue: serializeVenue(venue),
    promotions: promotions.map(serializePromotion),
  });
});

router.post(
  "/",
  requireAuth,
  requireAdmin,
  async (req: AuthedRequest, res) => {
    const parsed = venueSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Datos inválidos", details: parsed.error.flatten() });
    }
    const venue = await Venue.create(parsed.data);
    return res.status(201).json({ venue: serializeVenue(venue) });
  }
);

router.patch(
  "/:id",
  requireAuth,
  requireAdmin,
  async (req: AuthedRequest, res) => {
    const parsed = venueSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Datos inválidos" });
    }
    const venue = await Venue.findByIdAndUpdate(req.params.id, parsed.data, {
      new: true,
    });
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

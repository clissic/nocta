import { Router } from "express";
import { existsSync } from "node:fs";
import { z } from "zod";
import {
  DAILY_LIKE_LIMIT,
  DEFAULT_URUGUAY_CITY,
  DEFAULT_VENUE_COUNTRY,
  DRINKING,
  EDUCATION_LEVELS,
  ENABLED_VENUE_COUNTRIES,
  FITNESS,
  INTERESTS,
  LANGUAGES,
  LOOKING_FOR,
  PETS,
  PREMIUM_PERIOD_MONTHS,
  PREMIUM_PLAN_IDS,
  SEXUAL_ORIENTATIONS,
  SOCIAL_NETWORKS,
  SUSPENSION_DURATION_LABELS,
  VENUE_REQUEST_REJECT_REASON_LABELS,
  VENUE_REQUEST_REJECT_REASONS,
  VENUE_REQUEST_STATUSES,
  VENUE_TYPES,
  WORK_STATUS,
  ZODIAC_SIGNS,
  getPremiumPlan,
  premiumPeriodLabel,
} from "@nocta/shared";
import { requireAuth, requireAdmin, type AuthedRequest } from "../middleware/auth.js";
import { User } from "../models/User.js";
import { Venue, type VenueDocument } from "../models/Venue.js";
import { Presence } from "../models/Presence.js";
import { Match } from "../models/Match.js";
import { Promotion } from "../models/Promotion.js";
import { PromoPurchase } from "../models/PromoPurchase.js";
import { Report } from "../models/Report.js";
import { VenueRequest } from "../models/VenueRequest.js";
import { VenueNews } from "../models/VenueNews.js";
import { serializeUser, serializePromotion, serializeVenue, serializeVenueRequest, serializeVenueNews, resolvePublicAssetUrl } from "../utils/serialize.js";
import { isObjectId, paramId } from "../utils/ids.js";
import { expireStalePresences, endActivePresences } from "../utils/presence.js";
import { resolveVenueLocation } from "../utils/geocode.js";
import {
  sendAccountSuspendedEmail,
  sendReportResolutionEmail,
  sendVenueRequestApprovedEmail,
  sendVenueRequestRejectedEmail,
  sendIdentityVerificationApprovedEmail,
  sendIdentityVerificationRejectedEmail,
} from "../mail/mailer.js";
import { createNotification } from "../utils/notify.js";
import {
  assertUploadsAreImages,
  collectUploadedFiles,
  deleteCollectedUploads,
  handleMulterError,
  safeClaimEvidencePath,
  safeIdentityVerificationPath,
  uploadSinglePhoto,
} from "../uploads/index.js";
import {
  ingestCollectedPublicUpload,
  ingestErrorResponse,
  isAllowedPhotoRef,
  looksLikeManagedImageId,
  removeIdentityStoredRef,
  removePhotoRef,
  resolveAuthorizedPrivateRead,
} from "../image-service/index.js";
import { Types } from "mongoose";
import {
  parsePromoValidityRange,
  resolveUserTimeZone,
} from "../utils/promoValidity.js";
import { getActiveSuspension } from "../utils/moderation.js";
import { AppCity } from "../models/AppCity.js";
import {
  isActiveAppCity,
  serializeAppCity,
} from "../utils/appCities.js";
import {
  adminGrantPremium,
  revokePremium,
} from "../utils/premium.js";
import { PremiumPurchase } from "../models/PremiumPurchase.js";
import { AdminAuditEvent } from "../models/AdminAuditEvent.js";
import { recordAdminAudit } from "../utils/adminAudit.js";
import { buildAdminOverview } from "../utils/adminOverview.js";

const router = Router();

router.use(requireAuth, requireAdmin);

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(10).max(100).default(10),
  q: z.string().trim().max(100).optional(),
});

function paginationMeta(page: number, limit: number, total: number) {
  const totalPages = Math.ceil(total / limit);
  return { page, limit, total, totalPages, hasMore: page < totalPages };
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const ymdSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Usá fechas YYYY-MM-DD");

const promoSchema = z.object({
  title: z.string().min(2).max(120),
  description: z.string().min(2).max(500),
  priceUyu: z.number().finite().min(0).max(1_000_000).optional(),
  validFrom: ymdSchema.optional(),
  validUntil: ymdSchema.optional(),
  active: z.boolean().optional(),
});

const nullableText = (max: number) =>
  z.string().trim().max(max).nullable().optional();

const adminProfileUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(60).optional(),
    birthDate: z.string().nullable().optional(),
    heightCm: z.number().int().min(100).max(250).nullable().optional(),
    lookingFor: z.array(z.enum(LOOKING_FOR)).max(1).optional(),
    bio: nullableText(500),
    interests: z.array(z.enum(INTERESTS)).optional(),
    workStatus: z.enum(WORK_STATUS).nullable().optional(),
    gender: nullableText(60),
    interestedIn: z.array(z.string().trim().min(1).max(60)).optional(),
    livesIn: z
      .object({
        country: z.string().trim().min(2).max(60),
        city: z.string().trim().min(2).max(80),
      })
      .nullable()
      .optional(),
    sexualOrientation: z.enum(SEXUAL_ORIENTATIONS).nullable().optional(),
    languages: z.array(z.enum(LANGUAGES)).optional(),
    zodiac: z.enum(ZODIAC_SIGNS).nullable().optional(),
    educationLevel: z.enum(EDUCATION_LEVELS).nullable().optional(),
    pets: z.enum(PETS).nullable().optional(),
    drinking: z.enum(DRINKING).nullable().optional(),
    fitness: z.enum(FITNESS).nullable().optional(),
    socials: z
      .object({
        instagram: nullableText(80),
        tiktok: nullableText(80),
        x: nullableText(80),
        facebook: nullableText(80),
        linkedin: nullableText(80),
      })
      .strict()
      .optional(),
    jobTitle: nullableText(80),
    company: nullableText(80),
    studiedAt: nullableText(120),
  })
  .strict();

const adminUserUpdateSchema = z
  .object({
    email: z.string().trim().email().max(254).optional(),
    role: z.enum(["user", "admin"]).optional(),
    premium: z.boolean().optional(),
    premiumPlanId: z.enum(PREMIUM_PLAN_IDS).optional(),
    premiumPeriodMonths: z
      .number()
      .refine((v): v is (typeof PREMIUM_PERIOD_MONTHS)[number] =>
        (PREMIUM_PERIOD_MONTHS as readonly number[]).includes(v)
      )
      .optional(),
    emailVerified: z.boolean().optional(),
    boostsRemaining: z.number().int().min(0).max(999).optional(),
    heartshotsRemaining: z.number().int().min(0).max(999).optional(),
    spyMode: z.boolean().optional(),
    teleportMode: z.boolean().optional(),
    discoverDisabled: z.boolean().optional(),
    rogueMode: z.boolean().optional(),
    profile: adminProfileUpdateSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "No hay cambios")
  .superRefine((value, ctx) => {
    if (value.premium === true && !value.premiumPlanId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["premiumPlanId"],
        message: "Elegí un plan Premium",
      });
    }
  });

const photoUrlSchema = z
  .string()
  .min(1)
  .refine(isAllowedPhotoRef, "URL de foto inválida");

const enabledVenueCountries = [...ENABLED_VENUE_COUNTRIES] as [
  string,
  ...string[],
];

const approveCreateLocationSchema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
});

const approveCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  type: z.enum(VENUE_TYPES),
  address: z.string().trim().min(5).max(200),
  country: z.enum(enabledVenueCountries).default(DEFAULT_VENUE_COUNTRY),
  city: z.string().trim().min(2).default(DEFAULT_URUGUAY_CITY.label),
  description: z.preprocess(
    (v) => (typeof v === "string" && v.trim() ? v.trim() : undefined),
    z.string().max(1000).optional()
  ),
  contactEmail: z.preprocess(
    (v) => (typeof v === "string" && !v.trim() ? undefined : v),
    z.string().email().optional()
  ),
  contactPhone: z.preprocess(
    (v) => (typeof v === "string" && !v.trim() ? undefined : v),
    z.string().trim().max(40).optional()
  ),
  location: approveCreateLocationSchema,
  geocodedAddress: z.string().trim().min(3).max(300),
  adminNote: z.preprocess(
    (v) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 500) : undefined),
    z.string().max(500).optional()
  ),
});

function parseApproveCreateBody(raw: Record<string, unknown>) {
  let location: unknown = raw.location;
  if (typeof location === "string") {
    try {
      location = JSON.parse(location);
    } catch {
      location = undefined;
    }
  }
  return approveCreateSchema.safeParse({
    name: raw.name,
    type: raw.type,
    address: raw.address,
    country: raw.country,
    city: raw.city,
    description: raw.description,
    contactEmail: raw.contactEmail,
    contactPhone: raw.contactPhone,
    location,
    geocodedAddress: raw.geocodedAddress,
    adminNote: raw.adminNote,
  });
}

const rejectVenueRequestSchema = z
  .object({
    reason: z.enum(VENUE_REQUEST_REJECT_REASONS),
    adminNote: z.preprocess(
      (v) =>
        typeof v === "string" && v.trim() ? v.trim().slice(0, 500) : undefined,
      z.string().max(500).optional()
    ),
  })
  .superRefine((data, ctx) => {
    if (data.reason === "other" && !data.adminNote) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["adminNote"],
        message: "Agregá una explicación para el motivo «Otro»",
      });
    }
  });

function formatRejectionMessage(
  reason: (typeof VENUE_REQUEST_REJECT_REASONS)[number],
  adminNote?: string
) {
  const label = VENUE_REQUEST_REJECT_REASON_LABELS[reason];
  const extra = adminNote?.trim();
  return extra ? `${label}\n\n${extra}` : label;
}

router.get("/stats", async (_req: AuthedRequest, res) => {
  await expireStalePresences();
  const now = new Date();
  const premiumActiveFilter = {
    premium: true,
    $or: [
      { premiumExpiresAt: null },
      { premiumExpiresAt: { $gt: now } },
    ],
  };
  const [
    users,
    admins,
    venues,
    ownerlessVenues,
    activePresences,
    matches,
    pendingRequests,
    openReports,
    promoMetrics,
    premiumActive,
    premiumByPlanRows,
    premiumPurchaseMetrics,
  ] =
    await Promise.all([
      User.countDocuments({ role: "user" }),
      User.countDocuments({ role: "admin" }),
      Venue.countDocuments({ active: true }),
      Venue.countDocuments({ $or: [{ ownerId: null }, { ownerId: { $exists: false } }] }),
      Presence.countDocuments({ status: "active" }),
      Match.countDocuments(),
      VenueRequest.countDocuments({ status: "pending" }),
      Report.countDocuments({ status: "open" }),
      PromoPurchase.aggregate<{ purchases: number; revenueUyu: number }>([
        {
          $group: {
            _id: null,
            purchases: { $sum: 1 },
            revenueUyu: { $sum: { $ifNull: ["$priceUyu", 0] } },
          },
        },
      ]),
      User.countDocuments(premiumActiveFilter),
      User.aggregate<{ _id: string | null; count: number }>([
        { $match: premiumActiveFilter },
        { $group: { _id: "$premiumPlanId", count: { $sum: 1 } } },
      ]),
      PremiumPurchase.aggregate<{ purchases: number; revenueUsd: number }>([
        { $match: { status: "approved" } },
        {
          $group: {
            _id: null,
            purchases: { $sum: 1 },
            revenueUsd: { $sum: { $ifNull: ["$amount", 0] } },
          },
        },
      ]),
    ]);

  const premiumByPlan: Partial<
    Record<(typeof PREMIUM_PLAN_IDS)[number], number>
  > = {};
  for (const row of premiumByPlanRows) {
    if (
      row._id &&
      (PREMIUM_PLAN_IDS as readonly string[]).includes(row._id)
    ) {
      premiumByPlan[row._id as (typeof PREMIUM_PLAN_IDS)[number]] = row.count;
    }
  }

  return res.json({
    stats: {
      users,
      admins,
      venues,
      ownerlessVenues,
      activePresences,
      matches,
      pendingVenueRequests: pendingRequests,
      openReports,
      promoPurchases: promoMetrics[0]?.purchases ?? 0,
      promoRevenueUyu: promoMetrics[0]?.revenueUyu ?? 0,
      premiumActive,
      premiumByPlan,
      premiumPurchasesApproved: premiumPurchaseMetrics[0]?.purchases ?? 0,
      premiumRevenueUsd: premiumPurchaseMetrics[0]?.revenueUsd ?? 0,
    },
  });
});

router.get("/overview", async (_req: AuthedRequest, res) => {
  const overview = await buildAdminOverview();
  return res.json({ overview });
});

router.get("/users", async (req: AuthedRequest, res) => {
  const parsed = paginationSchema
    .extend({ role: z.enum(["user", "admin"]).optional() })
    .safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Paginación inválida" });
  }
  const { page, limit, q, role } = parsed.data;
  await User.updateMany(
    {
      premium: { $ne: true },
      remainingLikes: 0,
      likesRechargeAt: { $lte: new Date() },
    },
    { $set: { remainingLikes: DAILY_LIKE_LIMIT, likesRechargeAt: null } }
  );
  const filter: Record<string, unknown> = {};
  if (role) filter.role = role;
  if (q) {
    filter.$or = [
          { email: { $regex: escapeRegex(q), $options: "i" } },
          { "profile.name": { $regex: escapeRegex(q), $options: "i" } },
        ];
  }
  const [users, total] = await Promise.all([
    User.find(filter)
      .sort({ role: 1, createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments(filter),
  ]);
  return res.json({
    users: users.map(serializeUser),
    pagination: paginationMeta(page, limit, total),
  });
});

router.get("/users/:id", async (req: AuthedRequest, res) => {
  const id = paramId(req.params.id);
  if (!isObjectId(id)) {
    return res.status(400).json({ error: "Id inválido" });
  }
  const user = await User.findById(id);
  if (!user) {
    return res.status(404).json({ error: "Usuario no encontrado" });
  }
  return res.json({ user: await serializeUser(user) });
});

router.patch("/users/:id", async (req: AuthedRequest, res) => {
  const id = paramId(req.params.id);
  if (!isObjectId(id)) {
    return res.status(400).json({ error: "Id inválido" });
  }
  const parsed = adminUserUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Datos de usuario inválidos",
      details: parsed.error.flatten(),
    });
  }

  const user = await User.findById(id);
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
  const previousRole = user.role;

  if (parsed.data.email) {
    const email = parsed.data.email.toLowerCase();
    const duplicate = await User.exists({ email, _id: { $ne: user._id } });
    if (duplicate) {
      return res.status(409).json({ error: "Ese email ya está registrado" });
    }
    user.email = email;
  }

  if (parsed.data.role && parsed.data.role !== user.role) {
    if (user.role === "admin" && parsed.data.role === "user") {
      const adminCount = await User.countDocuments({ role: "admin" });
      if (adminCount <= 1) {
        return res.status(409).json({
          error: "No podés quitar el rol al último administrador",
        });
      }
    }
    user.role = parsed.data.role;
  }

  if (parsed.data.emailVerified !== undefined) {
    user.emailVerified = parsed.data.emailVerified;
    if (user.emailVerified) {
      user.emailVerificationToken = undefined;
      user.emailVerificationExpires = undefined;
    }
  }

  if (parsed.data.profile) {
    const current = (user.toObject().profile ?? {}) as Record<string, unknown>;
    const next: Record<string, unknown> = { ...current };
    for (const [key, value] of Object.entries(parsed.data.profile)) {
      if (key === "birthDate" || key === "socials") continue;
      next[key] = value === null ? undefined : value;
    }
    if (parsed.data.profile.birthDate !== undefined) {
      if (parsed.data.profile.birthDate === null) {
        next.birthDate = undefined;
      } else {
        const birthDate = new Date(parsed.data.profile.birthDate);
        if (Number.isNaN(birthDate.getTime())) {
          return res.status(400).json({ error: "Fecha de nacimiento inválida" });
        }
        next.birthDate = birthDate;
      }
    }
    if (parsed.data.profile.socials !== undefined) {
      const socials: Record<string, string> = {};
      for (const network of SOCIAL_NETWORKS) {
        const value = parsed.data.profile.socials[network];
        if (value?.trim()) socials[network] = value.trim().replace(/^@/, "");
      }
      next.socials = Object.keys(socials).length ? socials : undefined;
    }
    user.set("profile", next);
    user.markModified("profile");
  }

  if (parsed.data.boostsRemaining !== undefined) {
    user.boostsRemaining = parsed.data.boostsRemaining;
  }
  if (parsed.data.heartshotsRemaining !== undefined) {
    user.heartshotsRemaining = parsed.data.heartshotsRemaining;
  }
  if (parsed.data.spyMode !== undefined) {
    user.spyMode = parsed.data.spyMode;
  }
  if (parsed.data.teleportMode !== undefined) {
    user.teleportMode = parsed.data.teleportMode;
  }
  if (parsed.data.discoverDisabled !== undefined) {
    user.discoverDisabled = parsed.data.discoverDisabled;
  }
  if (parsed.data.rogueMode !== undefined) {
    user.rogueMode = parsed.data.rogueMode;
  }

  await user.save();

  if (parsed.data.discoverDisabled === true) {
    await endActivePresences(id, "revoked");
  }
  let result = user;
  let premiumAction: "grant" | "revoke" | "update_plan" | null = null;
  if (parsed.data.premium === true) {
    const granted = await adminGrantPremium({
      userId: id,
      planId: parsed.data.premiumPlanId ?? "nocta_2am",
      periodMonths: parsed.data.premiumPeriodMonths ?? 1,
    });
    if (!granted) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
    result = granted;
    premiumAction = "grant";
  } else if (parsed.data.premium === false) {
    const revoked = await revokePremium(id);
    if (!revoked) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
    result = revoked;
    premiumAction = "revoke";
  } else if (
    parsed.data.premiumPlanId !== undefined ||
    parsed.data.premiumPeriodMonths !== undefined
  ) {
    if (!result.premium) {
      return res.status(400).json({
        error: "Activá Premium para asignar plan o periodo",
      });
    }
    const granted = await adminGrantPremium({
      userId: id,
      planId:
        parsed.data.premiumPlanId ??
        (result.premiumPlanId as (typeof PREMIUM_PLAN_IDS)[number]) ??
        "nocta_2am",
      periodMonths:
        parsed.data.premiumPeriodMonths ??
        ((result.premiumPeriodMonths as
          | (typeof PREMIUM_PERIOD_MONTHS)[number]
          | undefined) ||
          1),
    });
    if (!granted) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
    result = granted;
    premiumAction = "update_plan";
  }

  // Re-apply cupos if set after grant (grant resets allowances)
  if (
    premiumAction &&
    (parsed.data.boostsRemaining !== undefined ||
      parsed.data.heartshotsRemaining !== undefined)
  ) {
    if (parsed.data.boostsRemaining !== undefined) {
      result.boostsRemaining = parsed.data.boostsRemaining;
    }
    if (parsed.data.heartshotsRemaining !== undefined) {
      result.heartshotsRemaining = parsed.data.heartshotsRemaining;
    }
    await result.save();
  }

  const actorId = req.user!._id.toString();
  if (premiumAction === "grant" || premiumAction === "update_plan") {
    await recordAdminAudit({
      actorId,
      action:
        premiumAction === "grant" ? "user.premium_grant" : "user.premium_plan",
      targetType: "user",
      targetId: id,
      meta: {
        planId: result.premiumPlanId,
        periodMonths: result.premiumPeriodMonths,
      },
    });
  } else if (premiumAction === "revoke") {
    await recordAdminAudit({
      actorId,
      action: "user.premium_revoke",
      targetType: "user",
      targetId: id,
    });
  }
  if (parsed.data.role && parsed.data.role !== previousRole) {
    await recordAdminAudit({
      actorId,
      action: "user.role_change",
      targetType: "user",
      targetId: id,
      meta: { from: previousRole, to: parsed.data.role },
    });
  }
  if (
    parsed.data.boostsRemaining !== undefined ||
    parsed.data.heartshotsRemaining !== undefined
  ) {
    await recordAdminAudit({
      actorId,
      action: "user.allowances",
      targetType: "user",
      targetId: id,
      meta: {
        boostsRemaining: result.boostsRemaining,
        heartshotsRemaining: result.heartshotsRemaining,
      },
    });
  }
  if (
    parsed.data.spyMode !== undefined ||
    parsed.data.teleportMode !== undefined ||
    parsed.data.discoverDisabled !== undefined ||
    parsed.data.rogueMode !== undefined
  ) {
    await recordAdminAudit({
      actorId,
      action: "user.flags",
      targetType: "user",
      targetId: id,
      meta: {
        spyMode: result.spyMode,
        teleportMode: result.teleportMode,
        discoverDisabled: result.discoverDisabled,
        rogueMode: result.rogueMode,
      },
    });
  }

  return res.json({ user: await serializeUser(result) });
});

router.post("/users/:id/end-presence", async (req: AuthedRequest, res) => {
  const id = paramId(req.params.id);
  if (!isObjectId(id)) {
    return res.status(400).json({ error: "Id inválido" });
  }
  const parsed = z
    .object({
      venueId: z.string().trim().optional(),
    })
    .safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos" });
  }
  if (parsed.data.venueId && !isObjectId(parsed.data.venueId)) {
    return res.status(400).json({ error: "venueId inválido" });
  }

  const user = await User.findById(id);
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

  const ended = await endActivePresences(id, "revoked", {
    venueId: parsed.data.venueId,
  });
  await recordAdminAudit({
    actorId: req.user!._id.toString(),
    action: "user.end_presence",
    targetType: "user",
    targetId: id,
    meta: {
      venueId: parsed.data.venueId ?? null,
      ended: ended.length,
    },
  });

  return res.json({
    ok: true,
    ended: ended.length,
    user: await serializeUser(user),
  });
});

router.get("/audit", async (req: AuthedRequest, res) => {
  const parsed = paginationSchema
    .extend({
      action: z.string().trim().max(80).optional(),
    })
    .safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Paginación inválida" });
  }
  const { page, limit, q, action } = parsed.data;
  const filter: Record<string, unknown> = {};
  if (action) filter.action = action;
  if (q) {
    const escaped = escapeRegex(q);
    filter.$or = [
      { action: { $regex: escaped, $options: "i" } },
      { targetId: { $regex: escaped, $options: "i" } },
      { targetType: { $regex: escaped, $options: "i" } },
    ];
  }
  const [rows, total] = await Promise.all([
    AdminAuditEvent.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    AdminAuditEvent.countDocuments(filter),
  ]);
  const actorIds = [...new Set(rows.map((row) => row.actorId.toString()))];
  const actors = await User.find({ _id: { $in: actorIds } })
    .select("email profile.name")
    .lean();
  const byId = new Map(actors.map((u) => [u._id.toString(), u]));

  return res.json({
    events: rows.map((row) => {
      const actor = byId.get(row.actorId.toString());
      return {
        id: row._id.toString(),
        action: row.action,
        targetType: row.targetType,
        targetId: row.targetId,
        meta: (row.meta as Record<string, unknown>) ?? {},
        createdAt: row.createdAt.toISOString(),
        actor: {
          id: row.actorId.toString(),
          name: actor?.profile?.name ?? actor?.email ?? "Admin",
          email: actor?.email ?? "Cuenta eliminada",
        },
      };
    }),
    pagination: paginationMeta(page, limit, total),
  });
});

router.get("/venue-requests", async (req: AuthedRequest, res) => {
  const parsed = paginationSchema
    .extend({ status: z.enum(VENUE_REQUEST_STATUSES).optional() })
    .safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Consulta inválida" });
  }

  const { page, limit, q, status } = parsed.data;
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (q) {
    const escaped = escapeRegex(q);
    const requesters = await User.find({
      $or: [
        { email: { $regex: escaped, $options: "i" } },
        { "profile.name": { $regex: escaped, $options: "i" } },
      ],
    })
      .select("_id")
      .lean();
    filter.$or = [
      { name: { $regex: escaped, $options: "i" } },
      { city: { $regex: escaped, $options: "i" } },
      { address: { $regex: escaped, $options: "i" } },
      { requesterId: { $in: requesters.map((u) => u._id) } },
    ];
  }

  const [rows, total] = await Promise.all([
    VenueRequest.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    VenueRequest.countDocuments(filter),
  ]);
  const requesterIds = [...new Set(rows.map((r) => r.requesterId.toString()))];
  const users = await User.find({ _id: { $in: requesterIds } });
  const byId = new Map(users.map((u) => [u._id.toString(), u]));

  return res.json({
    requests: await Promise.all(
      rows.map(async (r) => {
        const u = byId.get(r.requesterId.toString());
        return serializeVenueRequest(r, {
          requester: u
            ? {
                id: u._id.toString(),
                email: u.email,
                name: u.profile?.name ?? undefined,
              }
            : undefined,
        });
      })
    ),
    pagination: paginationMeta(page, limit, total),
  });
});

router.get("/venue-requests/:id", async (req: AuthedRequest, res) => {
  const id = paramId(req.params.id);
  if (!isObjectId(id)) {
    return res.status(400).json({ error: "Id inválido" });
  }

  const request = await VenueRequest.findById(id);
  if (!request) {
    return res.status(404).json({ error: "Solicitud no encontrada" });
  }

  const requester = await User.findById(request.requesterId);
  const targetVenue = request.targetVenueId
    ? await Venue.findById(request.targetVenueId)
    : null;
  return res.json({
    request: await serializeVenueRequest(request, {
      requester: requester
        ? {
            id: requester._id.toString(),
            email: requester.email,
            name: requester.profile?.name ?? undefined,
          }
        : undefined,
    }),
    venue: targetVenue ? await serializeVenue(targetVenue) : undefined,
  });
});

router.get(
  "/venue-requests/:id/evidence/:fileId",
  async (req: AuthedRequest, res) => {
    const id = paramId(req.params.id);
    if (!isObjectId(id)) {
      return res.status(400).json({ error: "Id inválido" });
    }
    const request = await VenueRequest.findById(id);
    if (!request) {
      return res.status(404).json({ error: "Solicitud no encontrada" });
    }
    const file = request.evidenceFiles?.find(
      (candidate) => candidate.id === req.params.fileId
    );
    if (!file) {
      return res.status(404).json({ error: "Comprobante no encontrado" });
    }
    if (looksLikeManagedImageId(file.filename)) {
      const resolved = await resolveAuthorizedPrivateRead({
        imageIdOrRef: file.filename,
        viewer: {
          id: req.user!._id.toString(),
          role: req.user!.role,
        },
      });
      if (!resolved.ok) {
        return res.status(resolved.status).json({ error: resolved.error });
      }
      res.setHeader("Cache-Control", "private, no-store");
      return res.redirect(302, resolved.url);
    }
    const path = safeClaimEvidencePath(file.filename);
    if (!path || !existsSync(path)) {
      return res.status(404).json({ error: "Archivo no disponible" });
    }
    return res.download(path, file.originalName);
  }
);

router.post(
  "/venue-requests/:id/approve",
  (req: AuthedRequest, res, next) => {
    const contentType = String(req.headers["content-type"] ?? "");
    if (!contentType.includes("multipart/form-data")) {
      next();
      return;
    }
    uploadSinglePhoto(req, res, (err) => {
      if (err) return handleMulterError(err, req, res, next);
      next();
    });
  },
  async (req: AuthedRequest, res) => {
    const id = paramId(req.params.id);
    const uploaded = collectUploadedFiles(req);
    const cleanup = () =>
      deleteCollectedUploads(uploaded);

    if (!isObjectId(id)) {
      cleanup();
      return res.status(400).json({ error: "Id inválido" });
    }

    const request = await VenueRequest.findById(id);
    if (!request) {
      cleanup();
      return res.status(404).json({ error: "Solicitud no encontrada" });
    }
    if (request.status !== "pending") {
      cleanup();
      return res.status(400).json({ error: "La solicitud ya fue revisada" });
    }

    const owner = await User.findById(request.requesterId);
    if (!owner || !["user", "admin"].includes(owner.role)) {
      cleanup();
      return res.status(400).json({ error: "Solicitante inválido" });
    }

    const isClaim = (request.requestType ?? "create") === "claim";

    let venue: VenueDocument;
    if (isClaim) {
      cleanup();
      if (!request.targetVenueId) {
        return res
          .status(400)
          .json({ error: "La reclamación no tiene un Espacio asociado" });
      }
      const claimed = await Venue.findOneAndUpdate(
        {
          _id: request.targetVenueId,
          active: true,
          $or: [{ ownerId: { $exists: false } }, { ownerId: null }],
        },
        { $set: { ownerId: owner._id } },
        { new: true }
      );
      if (!claimed) {
        return res.status(409).json({
          error: "El Espacio ya tiene Organizador o dejó de estar disponible",
        });
      }
      venue = claimed;
      if (typeof req.body?.adminNote === "string" && req.body.adminNote.trim()) {
        request.adminNote = req.body.adminNote.trim().slice(0, 500);
      }
    } else {
      if (uploaded.length !== 1) {
        cleanup();
        return res.status(400).json({
          error: "La imagen de portada del Espacio es obligatoria",
          code: "UPLOAD_REQUIRED",
        });
      }
      const checked = assertUploadsAreImages(uploaded);
      if (!checked.ok) {
        cleanup();
        return res
          .status(400)
          .json({ error: checked.error, code: "UPLOAD_INVALID" });
      }

      const parsed = parseApproveCreateBody(
        req.body as Record<string, unknown>
      );
      if (!parsed.success) {
        cleanup();
        return res.status(400).json({
          error: "Datos inválidos",
          details: parsed.error.flatten(),
        });
      }
      if (!(await isActiveAppCity(parsed.data.country, parsed.data.city))) {
        cleanup();
        return res.status(400).json({
          error: "La ciudad no corresponde al país seleccionado",
        });
      }

      const location = await resolveVenueLocation({
        address: parsed.data.address,
        country: parsed.data.country,
        city: parsed.data.city,
        location: parsed.data.location,
      });

      const provisionalSpaceId = new Types.ObjectId().toString();
      let coverRef: string;
      try {
        const ingested = await ingestCollectedPublicUpload({
          upload: uploaded[0],
          type: "space",
          ownerId: req.user!._id.toString(),
          entityType: "space",
          entityId: provisionalSpaceId,
          context: { spaceId: provisionalSpaceId },
        });
        coverRef = ingested.mediaRef;
      } catch (err) {
        const mapped = ingestErrorResponse(err);
        return res.status(mapped.status).json(mapped.body);
      }

      try {
        venue = await Venue.create({
          _id: new Types.ObjectId(provisionalSpaceId),
          name: parsed.data.name,
          type: parsed.data.type,
          address: parsed.data.address,
          country: parsed.data.country,
          city: parsed.data.city,
          description: parsed.data.description,
          photos: [coverRef],
          location,
          ownerId: request.wantsToManage !== false ? owner._id : undefined,
          followersCount: 0,
          active: true,
        });
      } catch (err) {
        await removePhotoRef(coverRef);
        throw err;
      }

      request.name = parsed.data.name;
      request.type = parsed.data.type;
      request.address = parsed.data.address;
      request.country = parsed.data.country;
      request.city = parsed.data.city;
      request.description = parsed.data.description;
      request.contactEmail = parsed.data.contactEmail;
      request.contactPhone = parsed.data.contactPhone;
      request.location = parsed.data.location;
      request.geocodedAddress = parsed.data.geocodedAddress;
      request.photos = [coverRef];
      if (parsed.data.adminNote) {
        request.adminNote = parsed.data.adminNote;
      }
    }

    request.status = "approved";
    request.venueId = venue._id;
    request.reviewedBy = req.user!._id;
    await request.save();

    try {
      await sendVenueRequestApprovedEmail({
        requestType: request.requestType ?? "create",
        wantsToManage: request.wantsToManage !== false,
        to: owner.email,
        requesterName: owner.profile?.name ?? undefined,
        venueId: venue._id.toString(),
        venueName: venue.name,
        venueType: venue.type,
        city: venue.city,
        address: venue.address,
        adminNote: request.adminNote ?? undefined,
      });
    } catch (err) {
      console.error("[mail] venue request approved notify failed", err);
    }

    void createNotification({
      userId: owner._id.toString(),
      type: "venue_request_resolved",
      title:
        (request.requestType ?? "create") === "claim"
          ? "Reclamación aprobada"
          : request.wantsToManage !== false
            ? "Solicitud de Espacio aprobada"
            : "Sugerencia de Espacio aprobada",
      body:
        (request.requestType ?? "create") === "claim" ||
        request.wantsToManage !== false
          ? `${venue.name} ya está disponible para gestionar`
          : `${venue.name} ya fue publicado en Nocta`,
      href:
        (request.requestType ?? "create") === "claim" ||
        request.wantsToManage !== false
          ? `/venues/${venue._id.toString()}/manage`
          : `/venues/${venue._id.toString()}`,
      data: {
        requestId: request._id.toString(),
        venueId: venue._id.toString(),
        status: "approved",
      },
    });

    return res.json({
      request: await serializeVenueRequest(request, {
        requester: {
          id: owner._id.toString(),
          email: owner.email,
          name: owner.profile?.name ?? undefined,
        },
      }),
      venue: await serializeVenue(venue),
    });
  }
);

router.post(
  "/venue-requests/:id/reject",
  async (req: AuthedRequest, res) => {
    const id = paramId(req.params.id);
    if (!isObjectId(id)) {
      return res.status(400).json({ error: "Id inválido" });
    }

    const parsed = rejectVenueRequestSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({
        error: "Datos inválidos",
        details: parsed.error.flatten(),
      });
    }

    const request = await VenueRequest.findById(id);
    if (!request) {
      return res.status(404).json({ error: "Solicitud no encontrada" });
    }
    if (request.status !== "pending") {
      return res.status(400).json({ error: "La solicitud ya fue revisada" });
    }

    const rejectionMessage = formatRejectionMessage(
      parsed.data.reason,
      parsed.data.adminNote
    );

    request.status = "rejected";
    request.reviewedBy = req.user!._id;
    request.rejectionReason = parsed.data.reason;
    request.adminNote = rejectionMessage.slice(0, 500);
    await request.save();

    try {
      const requester = await User.findById(request.requesterId);
      if (requester?.email) {
        await sendVenueRequestRejectedEmail({
          requestType: request.requestType ?? "create",
          wantsToManage: request.wantsToManage !== false,
          to: requester.email,
          requesterName: requester.profile?.name ?? undefined,
          venueName: request.name,
          venueType: request.type,
          city: request.city,
          adminNote: rejectionMessage,
        });
      }
    } catch (err) {
      console.error("[mail] venue request rejected notify failed", err);
    }

    void createNotification({
      userId: request.requesterId.toString(),
      type: "venue_request_resolved",
      title:
        (request.requestType ?? "create") === "claim"
          ? "Reclamación rechazada"
          : request.wantsToManage !== false
            ? "Solicitud de Espacio rechazada"
            : "Sugerencia de Espacio rechazada",
      body: rejectionMessage,
      href: "/profile/venue-request",
      data: {
        requestId: request._id.toString(),
        status: "rejected",
        reason: parsed.data.reason,
      },
    });

    return res.json({ request: await serializeVenueRequest(request) });
  }
);

router.get("/reports", async (req: AuthedRequest, res) => {
  const parsed = paginationSchema
    .extend({
      status: z.enum(["open", "reviewed", "dismissed"]).optional(),
    })
    .safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Consulta inválida" });
  }
  const { page, limit, status, q } = parsed.data;
  const filter: Record<string, unknown> = status ? { status } : {};
  if (q) {
    const escaped = escapeRegex(q);
    const matchedUsers = await User.find({
      $or: [
        { email: { $regex: escaped, $options: "i" } },
        { "profile.name": { $regex: escaped, $options: "i" } },
      ],
    })
      .select("_id")
      .lean();
    const userIds = matchedUsers.map((u) => u._id);
    filter.$or = [
      { reason: { $regex: escaped, $options: "i" } },
      { details: { $regex: escaped, $options: "i" } },
      { reporterId: { $in: userIds } },
      { reportedUserId: { $in: userIds } },
    ];
  }
  const [reports, total] = await Promise.all([
    Report.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Report.countDocuments(filter),
  ]);

  const userIds = [
    ...new Set(
      reports.flatMap((r) => [
        r.reporterId.toString(),
        r.reportedUserId.toString(),
      ])
    ),
  ];
  const users = await User.find({ _id: { $in: userIds } });
  const byId = new Map(users.map((u) => [u._id.toString(), u]));

  return res.json({
    reports: reports.map((r) => {
      const reporter = byId.get(r.reporterId.toString());
      const reported = byId.get(r.reportedUserId.toString());
      return {
        id: r._id.toString(),
        reason: r.reason,
        details: r.details ?? undefined,
        status: r.status ?? "open",
        source: r.source ?? (r.matchId ? "match" : "profile"),
        createdAt: r.createdAt.toISOString(),
        matchId: r.matchId?.toString(),
        reporter: {
          id: r.reporterId.toString(),
          name: reporter?.profile?.name ?? reporter?.email ?? "Usuario",
        },
        reportedUser: {
          id: r.reportedUserId.toString(),
          name: reported?.profile?.name ?? reported?.email ?? "Usuario",
        },
        resolution: r.resolution
          ? {
              action: r.resolution.action,
              reason: r.resolution.reason ?? undefined,
              duration: r.resolution.duration ?? undefined,
              suspendedUntil:
                r.resolution.suspendedUntil?.toISOString() ?? undefined,
              resolvedAt: r.resolution.resolvedAt.toISOString(),
              resolvedBy: r.resolution.resolvedBy.toString(),
            }
          : undefined,
      };
    }),
    pagination: paginationMeta(page, limit, total),
  });
});

router.get("/promo-purchases", async (req: AuthedRequest, res) => {
  const parsed = paginationSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Paginación inválida" });
  }

  const { page, limit, q } = parsed.data;
  const filter: Record<string, unknown> = {};
  if (q) {
    const escaped = escapeRegex(q);
    const matchedUsers = await User.find({
      $or: [
        { email: { $regex: escaped, $options: "i" } },
        { "profile.name": { $regex: escaped, $options: "i" } },
      ],
    })
      .select("_id")
      .lean();
    const matchedVenues = await Venue.find({
      name: { $regex: escaped, $options: "i" },
    })
      .select("_id")
      .lean();
    const or: Record<string, unknown>[] = [
      { title: { $regex: escaped, $options: "i" } },
      { userId: { $in: matchedUsers.map((u) => u._id) } },
      { venueId: { $in: matchedVenues.map((v) => v._id) } },
    ];
    if (isObjectId(q)) {
      or.push({ _id: q });
    }
    filter.$or = or;
  }

  const [rows, total] = await Promise.all([
    PromoPurchase.find(filter)
      .sort({ purchasedAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    PromoPurchase.countDocuments(filter),
  ]);

  const userIds = [...new Set(rows.map((row) => row.userId.toString()))];
  const venueIds = [...new Set(rows.map((row) => row.venueId.toString()))];
  const promotionIds = [
    ...new Set(rows.map((row) => row.promotionId.toString())),
  ];
  const [users, venues, promotions] = await Promise.all([
    User.find({ _id: { $in: userIds } }).select("email profile.name").lean(),
    Venue.find({ _id: { $in: venueIds } }).select("name").lean(),
    Promotion.find({ _id: { $in: promotionIds } }).select("title").lean(),
  ]);
  const usersById = new Map(users.map((user) => [user._id.toString(), user]));
  const venuesById = new Map(venues.map((venue) => [venue._id.toString(), venue]));
  const promotionsById = new Map(
    promotions.map((promotion) => [promotion._id.toString(), promotion])
  );
  const totalPages = Math.ceil(total / limit);

  return res.json({
    purchases: rows.map((row) => {
      const user = usersById.get(row.userId.toString());
      const venue = venuesById.get(row.venueId.toString());
      const promotion = promotionsById.get(row.promotionId.toString());
      return {
        id: row._id.toString(),
        title: row.title,
        priceUyu: row.priceUyu ?? undefined,
        status: row.status,
        purchasedAt: row.purchasedAt.toISOString(),
        validUntil: row.validUntil?.toISOString(),
        redeemedAt: row.redeemedAt?.toISOString(),
        user: {
          id: row.userId.toString(),
          name: user?.profile?.name ?? user?.email ?? "Usuario",
          email: user?.email ?? "Cuenta eliminada",
        },
        venue: {
          id: row.venueId.toString(),
          name: venue?.name ?? "Espacio no disponible",
        },
        promotion: {
          id: row.promotionId.toString(),
          title: promotion?.title ?? row.title,
        },
      };
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

router.get("/premium-purchases", async (req: AuthedRequest, res) => {
  const parsed = paginationSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Paginación inválida" });
  }

  const { page, limit, q } = parsed.data;
  const filter: Record<string, unknown> = {};
  if (q) {
    const escaped = escapeRegex(q);
    const matchedUsers = await User.find({
      $or: [
        { email: { $regex: escaped, $options: "i" } },
        { "profile.name": { $regex: escaped, $options: "i" } },
      ],
    })
      .select("_id")
      .lean();
    const or: Record<string, unknown>[] = [
      { planId: { $regex: escaped, $options: "i" } },
      { mpPaymentId: { $regex: escaped, $options: "i" } },
      { userId: { $in: matchedUsers.map((u) => u._id) } },
    ];
    if (isObjectId(q)) {
      or.push({ _id: q });
    }
    filter.$or = or;
  }

  const [rows, total] = await Promise.all([
    PremiumPurchase.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    PremiumPurchase.countDocuments(filter),
  ]);

  const userIds = [...new Set(rows.map((row) => row.userId.toString()))];
  const users = await User.find({ _id: { $in: userIds } })
    .select("email profile.name")
    .lean();
  const usersById = new Map(users.map((user) => [user._id.toString(), user]));
  const totalPages = Math.ceil(total / limit);

  return res.json({
    purchases: rows.map((row) => {
      const user = usersById.get(row.userId.toString());
      const planId = row.planId as (typeof PREMIUM_PLAN_IDS)[number];
      const periodMonths = row.periodMonths as
        (typeof PREMIUM_PERIOD_MONTHS)[number];
      const plan = getPremiumPlan(planId);
      return {
        id: row._id.toString(),
        planId,
        planName: plan?.name ?? planId,
        periodMonths,
        periodLabel: premiumPeriodLabel(periodMonths),
        amount: row.amount,
        currency: row.currency,
        status: row.status,
        kind: row.kind ?? "charge",
        createdAt: row.createdAt.toISOString(),
        startsAt: row.startsAt?.toISOString(),
        endsAt: row.endsAt?.toISOString(),
        user: {
          id: row.userId.toString(),
          name: user?.profile?.name ?? user?.email ?? "Usuario",
          email: user?.email ?? "Cuenta eliminada",
        },
      };
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

const reportActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("dismiss"),
    reason: z.string().trim().min(3).max(1000),
  }),
  z.object({
    action: z.literal("suspend"),
    reason: z.string().trim().min(3).max(1000),
    duration: z.union([
      z.literal(30),
      z.literal(90),
      z.literal(180),
      z.literal(360),
      z.literal("permanent"),
    ]),
  }),
]);

router.post("/reports/:id/actions", async (req: AuthedRequest, res) => {
  const id = paramId(req.params.id);
  if (!isObjectId(id)) {
    return res.status(400).json({ error: "Id inválido" });
  }
  const parsed = reportActionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Acción de moderación inválida" });
  }
  const existing = await Report.findById(id);
  if (!existing) {
    return res.status(404).json({ error: "Denuncia no encontrada" });
  }
  if (existing.status !== "open" || existing.resolution) {
    return res.status(409).json({
      error: "Esta denuncia ya fue resuelta",
      code: "REPORT_ALREADY_RESOLVED",
    });
  }

  const reporter = await User.findById(existing.reporterId);
  const reported = await User.findById(existing.reportedUserId);
  if (!reported) {
    return res.status(404).json({ error: "El usuario denunciado ya no existe" });
  }

  const now = new Date();
  let suspendedUntil: Date | undefined;
  if (parsed.data.action === "suspend") {
    if (getActiveSuspension(reported)) {
      return res.status(409).json({
        error: "El usuario ya tiene una suspensión activa",
      });
    }
    if (reported._id.toString() === req.user!._id.toString()) {
      return res.status(400).json({
        error: "No podés suspender tu propia cuenta",
      });
    }
    if (reported.role === "admin") {
      const activeAdmins = await User.countDocuments({
        role: "admin",
        $or: [
          { moderationStatus: { $ne: "suspended" } },
          {
            moderationStatus: "suspended",
            suspensionDuration: { $ne: "permanent" },
            suspendedUntil: { $lte: now },
          },
        ],
      });
      if (activeAdmins <= 1) {
        return res.status(409).json({
          error: "No podés suspender al último administrador activo",
        });
      }
    }
    if (parsed.data.duration !== "permanent") {
      suspendedUntil = new Date(
        now.getTime() + parsed.data.duration * 24 * 60 * 60 * 1000
      );
    }
  }

  const nextStatus =
    parsed.data.action === "dismiss" ? "dismissed" : "reviewed";
  const resolution = {
    action: parsed.data.action,
    reason: parsed.data.reason,
    duration:
      parsed.data.action === "suspend" ? parsed.data.duration : undefined,
    suspendedUntil,
    resolvedAt: now,
    resolvedBy: req.user!._id,
  };
  const report = await Report.findOneAndUpdate(
    { _id: id, status: "open", resolution: { $exists: false } },
    { $set: { status: nextStatus, resolution } },
    { new: true }
  );
  if (!report) {
    return res.status(409).json({
      error: "Esta denuncia ya fue resuelta",
      code: "REPORT_ALREADY_RESOLVED",
    });
  }

  if (parsed.data.action === "suspend") {
    reported.moderationStatus = "suspended";
    reported.suspendedAt = now;
    reported.suspendedUntil = suspendedUntil;
    reported.suspensionDuration = parsed.data.duration;
    reported.suspendedBy = req.user!._id;
    reported.suspensionReportId = report._id;
    reported.suspensionReason = parsed.data.reason;
    reported.authVersion = (reported.authVersion ?? 0) + 1;
    try {
      await Promise.all([
        reported.save(),
        endActivePresences(reported._id.toString(), "revoked"),
      ]);
    } catch (err) {
      await Report.updateOne(
        { _id: report._id, "resolution.resolvedAt": now },
        { $set: { status: "open" }, $unset: { resolution: 1 } }
      );
      throw err;
    }
  }

  await recordAdminAudit({
    actorId: req.user!._id.toString(),
    action:
      parsed.data.action === "suspend"
        ? "report.suspend"
        : "report.dismiss",
    targetType: "report",
    targetId: id,
    meta: {
      reportedUserId: reported._id.toString(),
      reason: parsed.data.reason,
      duration:
        parsed.data.action === "suspend" ? parsed.data.duration : undefined,
    },
  });

  void createNotification({
    userId: report.reporterId.toString(),
    type: "report_resolved",
    title: "Tu denuncia fue resuelta",
    body:
      parsed.data.action === "dismiss"
        ? "La denuncia fue descartada. Te enviamos el motivo por email."
        : "Revisamos la denuncia y tomamos medidas.",
    href: `/reports/${report._id.toString()}`,
    data: {
      reportId: report._id.toString(),
      status: nextStatus,
    },
    dedupeKey: `report_resolved:${report._id.toString()}`,
  });

  if (reporter) {
    void sendReportResolutionEmail({
      to: reporter.email,
      reporterName: reporter.profile?.name ?? undefined,
      reportId: report._id.toString(),
      action: parsed.data.action,
      resolutionReason: parsed.data.reason,
    }).catch((err) =>
      console.error("[mail] report resolution send failed", err)
    );
  }
  if (parsed.data.action === "suspend") {
    const durationLabel = SUSPENSION_DURATION_LABELS[parsed.data.duration];
    void sendAccountSuspendedEmail({
      to: reported.email,
      userName: reported.profile?.name ?? undefined,
      suspendedAt: now.toLocaleString("es-UY"),
      suspendedUntil: suspendedUntil?.toLocaleString("es-UY"),
      durationLabel,
      resolutionReason: parsed.data.reason,
    }).catch((err) =>
      console.error("[mail] suspension send failed", err)
    );
  }

  return res.json({
    report: {
      id: report._id.toString(),
      status: report.status,
      resolution: {
        action: report.resolution!.action,
        reason: report.resolution!.reason ?? undefined,
        duration: report.resolution!.duration ?? undefined,
        suspendedUntil:
          report.resolution!.suspendedUntil?.toISOString() ?? undefined,
        resolvedAt: report.resolution!.resolvedAt.toISOString(),
        resolvedBy: report.resolution!.resolvedBy.toString(),
      },
    },
  });
});

router.patch("/promotions/:id", async (req: AuthedRequest, res) => {
  const id = paramId(req.params.id);
  if (!isObjectId(id)) {
    return res.status(400).json({ error: "Id inválido" });
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

  const promo = await Promotion.findByIdAndUpdate(id, update, {
    new: true,
  });
  if (!promo) return res.status(404).json({ error: "Promo no encontrada" });
  return res.json({ promotion: await serializePromotion(promo) });
});

router.delete("/promotions/:id", async (req: AuthedRequest, res) => {
  const id = paramId(req.params.id);
  if (!isObjectId(id)) {
    return res.status(400).json({ error: "Id inválido" });
  }
  const promo = await Promotion.findByIdAndUpdate(
    id,
    { active: false },
    { new: true }
  );
  if (!promo) return res.status(404).json({ error: "Promo no encontrada" });
  return res.json({ promotion: await serializePromotion(promo) });
});

router.patch("/news/:id", async (req: AuthedRequest, res) => {
  const id = paramId(req.params.id);
  if (!isObjectId(id)) {
    return res.status(400).json({ error: "Id inválido" });
  }
  const parsed = z
    .object({
      title: z.string().min(2).max(120).optional(),
      body: z.string().min(2).max(4000).optional(),
      photos: z.array(photoUrlSchema).max(1).optional(),
      publishedAt: z.string().optional(),
      active: z.boolean().optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos" });
  }
  const update: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.publishedAt !== undefined) {
    update.publishedAt = new Date(parsed.data.publishedAt);
  }
  const news = await VenueNews.findByIdAndUpdate(id, update, { new: true });
  if (!news) return res.status(404).json({ error: "Noticia no encontrada" });
  return res.json({ news: await serializeVenueNews(news) });
});

router.delete("/news/:id", async (req: AuthedRequest, res) => {
  const id = paramId(req.params.id);
  if (!isObjectId(id)) {
    return res.status(400).json({ error: "Id inválido" });
  }
  const news = await VenueNews.findByIdAndUpdate(
    id,
    { active: false },
    { new: true }
  );
  if (!news) return res.status(404).json({ error: "Noticia no encontrada" });
  return res.json({ news: await serializeVenueNews(news) });
});

const identityListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(10).max(100).default(10),
  q: z.string().trim().max(100).optional(),
  status: z
    .enum(["pending", "approved", "rejected", "all"])
    .default("pending"),
});

async function serializeAdminIdentityVerification(user: InstanceType<typeof User>) {
  const verification = user.identityVerification as
    | {
        status?: string;
        submittedAt?: Date | null;
        reviewedAt?: Date | null;
        rejectionReason?: string | null;
        documentFrontPath?: string | null;
        selfieWithDocumentPath?: string | null;
      }
    | undefined;
  const status = verification?.status;
  if (
    status !== "pending" &&
    status !== "approved" &&
    status !== "rejected"
  ) {
    return null;
  }
  const photo = user.profile?.photos?.[0];
  return {
    userId: user._id.toString(),
    email: user.email,
    name: user.profile?.name ?? "Usuario",
    photo: photo ? await resolvePublicAssetUrl(photo) : undefined,
    status,
    submittedAt: verification?.submittedAt?.toISOString(),
    reviewedAt: verification?.reviewedAt?.toISOString(),
    rejectionReason: verification?.rejectionReason ?? undefined,
    hasDocumentFront: Boolean(verification?.documentFrontPath),
    hasSelfie: Boolean(verification?.selfieWithDocumentPath),
  };
}

router.get("/identity-verifications", async (req: AuthedRequest, res) => {
  const parsed = identityListSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Parámetros inválidos" });
  }
  const { page, limit, status, q } = parsed.data;
  const filter: Record<string, unknown> =
    status === "all"
      ? {
          "identityVerification.status": {
            $in: ["pending", "approved", "rejected"],
          },
        }
      : { "identityVerification.status": status };
  if (q) {
    const escaped = escapeRegex(q);
    filter.$or = [
      { email: { $regex: escaped, $options: "i" } },
      { "profile.name": { $regex: escaped, $options: "i" } },
    ];
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .sort({ "identityVerification.submittedAt": -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments(filter),
  ]);

  return res.json({
    verifications: (
      await Promise.all(
        users.map((user) => serializeAdminIdentityVerification(user))
      )
    ).filter(Boolean),
    pagination: paginationMeta(page, limit, total),
  });
});

router.get(
  "/identity-verifications/:userId/files/:kind",
  async (req: AuthedRequest, res) => {
    const userId = paramId(req.params.userId);
    const kind = req.params.kind;
    if (!isObjectId(userId)) {
      return res.status(400).json({ error: "Id inválido" });
    }
    if (kind !== "documentFront" && kind !== "selfie") {
      return res.status(400).json({ error: "Archivo inválido" });
    }
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
    const verification = user.identityVerification as
      | {
          documentFrontPath?: string | null;
          selfieWithDocumentPath?: string | null;
        }
      | undefined;
    const filename =
      kind === "documentFront"
        ? verification?.documentFrontPath
        : verification?.selfieWithDocumentPath;
    if (!filename) {
      return res.status(404).json({ error: "Archivo no encontrado" });
    }
    if (looksLikeManagedImageId(filename)) {
      const resolved = await resolveAuthorizedPrivateRead({
        imageIdOrRef: filename,
        viewer: {
          id: req.user!._id.toString(),
          role: req.user!.role,
        },
      });
      if (!resolved.ok) {
        return res.status(resolved.status).json({ error: resolved.error });
      }
      res.setHeader("Cache-Control", "private, no-store");
      return res.redirect(302, resolved.url);
    }
    const path = safeIdentityVerificationPath(filename);
    if (!path || !existsSync(path)) {
      return res.status(404).json({ error: "Archivo no disponible" });
    }
    return res.sendFile(path);
  }
);

router.post(
  "/identity-verifications/:userId/approve",
  async (req: AuthedRequest, res) => {
    const userId = paramId(req.params.userId);
    if (!isObjectId(userId)) {
      return res.status(400).json({ error: "Id inválido" });
    }
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
    const verification = user.identityVerification as
      | {
          status?: string;
          documentFrontPath?: string | null;
          selfieWithDocumentPath?: string | null;
          submittedAt?: Date | null;
          rejectionReason?: string | null;
        }
      | undefined;
    if (verification?.status !== "pending") {
      return res.status(409).json({
        error: "No hay una solicitud pendiente para este usuario",
      });
    }
    if (
      !verification.documentFrontPath ||
      !verification.selfieWithDocumentPath
    ) {
      return res.status(409).json({
        error: "Faltan documentos en la solicitud",
      });
    }

    user.identityVerification = {
      ...verification,
      status: "approved",
      reviewedAt: new Date(),
      reviewedById: req.user!._id,
      rejectionReason: undefined,
    } as typeof user.identityVerification;
    await user.save();

    const name = user.profile?.name || undefined;
    void createNotification({
      userId: user._id.toString(),
      type: "identity_verification_approved",
      title: "Cuenta verificada",
      body: "Tu verificación de identidad fue aprobada.",
      href: "/profile",
      dedupeKey: `identity_verification_approved:${user._id.toString()}`,
    });
    try {
      await sendIdentityVerificationApprovedEmail({
        to: user.email,
        name,
      });
    } catch (err) {
      console.error("[mail] identity approved failed", err);
    }

    return res.json({
      verification: await serializeAdminIdentityVerification(user),
      user: await serializeUser(user),
    });
  }
);

const rejectIdentitySchema = z.object({
  reason: z.string().trim().min(5).max(1000),
});

router.post(
  "/identity-verifications/:userId/reject",
  async (req: AuthedRequest, res) => {
    const userId = paramId(req.params.userId);
    if (!isObjectId(userId)) {
      return res.status(400).json({ error: "Id inválido" });
    }
    const parsed = rejectIdentitySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Indicá el motivo del rechazo (mínimo 5 caracteres)",
      });
    }
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
    const verification = user.identityVerification as
      | {
          status?: string;
          documentFrontPath?: string | null;
          selfieWithDocumentPath?: string | null;
          submittedAt?: Date | null;
        }
      | undefined;
    if (verification?.status !== "pending") {
      return res.status(409).json({
        error: "No hay una solicitud pendiente para este usuario",
      });
    }

    await removeIdentityStoredRef(verification.documentFrontPath);
    await removeIdentityStoredRef(verification.selfieWithDocumentPath);

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          "identityVerification.status": "rejected",
          "identityVerification.reviewedAt": new Date(),
          "identityVerification.reviewedById": req.user!._id,
          "identityVerification.rejectionReason": parsed.data.reason,
        },
        $unset: {
          "identityVerification.documentFrontPath": 1,
          "identityVerification.selfieWithDocumentPath": 1,
        },
      }
    );
    const refreshed = await User.findById(user._id);
    if (!refreshed) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const name = refreshed.profile?.name || undefined;
    void createNotification({
      userId: refreshed._id.toString(),
      type: "identity_verification_rejected",
      title: "Verificación no aprobada",
      body: parsed.data.reason,
      href: "/profile",
      data: { reason: parsed.data.reason },
      dedupeKey: `identity_verification_rejected:${refreshed._id.toString()}:${Date.now()}`,
    });
    try {
      await sendIdentityVerificationRejectedEmail({
        to: refreshed.email,
        name,
        reason: parsed.data.reason,
      });
    } catch (err) {
      console.error("[mail] identity rejected failed", err);
    }

    return res.json({
      verification: await serializeAdminIdentityVerification(refreshed),
      user: await serializeUser(refreshed),
    });
  }
);

const adminCitiesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(10).max(100).default(10),
  country: z.string().trim().min(2).max(60).optional(),
  active: z.enum(["true", "false", "all"]).optional().default("all"),
  q: z.string().trim().max(100).optional(),
});

const adminCityBodySchema = z.object({
  country: z.enum(enabledVenueCountries),
  name: z.string().trim().min(2).max(80),
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
  active: z.boolean().optional(),
});

const adminCityPatchSchema = z
  .object({
    country: z.enum(enabledVenueCountries).optional(),
    name: z.string().trim().min(2).max(80).optional(),
    lat: z.number().finite().min(-90).max(90).optional(),
    lng: z.number().finite().min(-180).max(180).optional(),
    active: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "No hay cambios");

router.get("/cities", async (req: AuthedRequest, res) => {
  const parsed = adminCitiesQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Parámetros inválidos" });
  }
  const { page, limit, country, active, q } = parsed.data;
  if (country && !ENABLED_VENUE_COUNTRIES.includes(country as (typeof ENABLED_VENUE_COUNTRIES)[number])) {
    return res.status(400).json({ error: "País no habilitado" });
  }

  const filter: Record<string, unknown> = {};
  if (country) filter.country = country;
  if (active === "true") filter.active = true;
  else if (active === "false") filter.active = false;
  if (q) {
    filter.name = { $regex: escapeRegex(q), $options: "i" };
  }

  const [cities, total] = await Promise.all([
    AppCity.find(filter)
      .sort({ country: 1, name: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    AppCity.countDocuments(filter),
  ]);

  return res.json({
    cities: cities.map((city) => serializeAppCity(city)),
    pagination: paginationMeta(page, limit, total),
  });
});

router.post("/cities", async (req: AuthedRequest, res) => {
  const parsed = adminCityBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos" });
  }

  try {
    const city = await AppCity.create({
      country: parsed.data.country,
      name: parsed.data.name,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      active: parsed.data.active ?? true,
    });
    return res.status(201).json({ city: serializeAppCity(city) });
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: number }).code === 11000
    ) {
      return res.status(409).json({
        error: "Ya existe una ciudad con ese nombre en el país",
      });
    }
    throw err;
  }
});

router.patch("/cities/:id", async (req: AuthedRequest, res) => {
  const id = paramId(req.params.id);
  if (!isObjectId(id)) {
    return res.status(400).json({ error: "Id inválido" });
  }
  const parsed = adminCityPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos" });
  }

  const city = await AppCity.findById(id);
  if (!city) {
    return res.status(404).json({ error: "Ciudad no encontrada" });
  }

  if (parsed.data.country !== undefined) {
    city.country = parsed.data.country as (typeof ENABLED_VENUE_COUNTRIES)[number];
  }
  if (parsed.data.name !== undefined) city.name = parsed.data.name;
  if (parsed.data.lat !== undefined) city.lat = parsed.data.lat;
  if (parsed.data.lng !== undefined) city.lng = parsed.data.lng;
  if (parsed.data.active !== undefined) city.active = parsed.data.active;

  try {
    await city.save();
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: number }).code === 11000
    ) {
      return res.status(409).json({
        error: "Ya existe una ciudad con ese nombre en el país",
      });
    }
    throw err;
  }

  return res.json({ city: serializeAppCity(city) });
});

router.post("/cities/:id/deactivate", async (req: AuthedRequest, res) => {
  const id = paramId(req.params.id);
  if (!isObjectId(id)) {
    return res.status(400).json({ error: "Id inválido" });
  }
  const city = await AppCity.findById(id);
  if (!city) {
    return res.status(404).json({ error: "Ciudad no encontrada" });
  }
  city.active = false;
  await city.save();
  return res.json({ city: serializeAppCity(city) });
});

export default router;

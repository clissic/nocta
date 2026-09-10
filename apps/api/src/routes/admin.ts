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
  isVenueCity,
  LANGUAGES,
  LOOKING_FOR,
  PETS,
  SEXUAL_ORIENTATIONS,
  SOCIAL_NETWORKS,
  SUSPENSION_DURATION_LABELS,
  VENUE_REQUEST_REJECT_REASON_LABELS,
  VENUE_REQUEST_REJECT_REASONS,
  VENUE_REQUEST_STATUSES,
  VENUE_TYPES,
  WORK_STATUS,
  ZODIAC_SIGNS,
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
import {
  serializeUser,
  serializePromotion,
  serializeVenue,
  serializeVenueRequest,
  serializeVenueNews,
} from "../utils/serialize.js";
import { isObjectId, paramId } from "../utils/ids.js";
import { expireStalePresences } from "../utils/presence.js";
import { resolveVenueLocation } from "../utils/geocode.js";
import {
  sendAccountSuspendedEmail,
  sendReportResolutionEmail,
  sendVenueRequestApprovedEmail,
  sendVenueRequestRejectedEmail,
} from "../mail/mailer.js";
import { createNotification } from "../utils/notify.js";
import {
  assertUploadsAreImages,
  assertVenueCoverUpload,
  collectUploadedFiles,
  deleteLocalUploads,
  handleMulterError,
  safeClaimEvidencePath,
  uploadSinglePhoto,
} from "../uploads/index.js";
import {
  parsePromoValidityRange,
  resolveUserTimeZone,
} from "../utils/promoValidity.js";
import { getActiveSuspension } from "../utils/moderation.js";

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
    emailVerified: z.boolean().optional(),
    profile: adminProfileUpdateSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "No hay cambios");

const photoUrlSchema = z
  .string()
  .min(1)
  .refine(
    (v) => v.startsWith("/uploads/") || /^https?:\/\//i.test(v),
    "URL de foto inválida"
  );

const enabledVenueCountries = [...ENABLED_VENUE_COUNTRIES] as [
  string,
  ...string[],
];

const approveCreateLocationSchema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
});

const approveCreateSchema = z
  .object({
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
  })
  .superRefine((data, ctx) => {
    if (!isVenueCity(data.country, data.city)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["city"],
        message: "La ciudad no corresponde al país seleccionado",
      });
    }
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
    ]);

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
    },
  });
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
  return res.json({ user: serializeUser(user) });
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
  if (parsed.data.premium !== undefined) {
    user.premium = parsed.data.premium;
    if (user.premium) user.likesRechargeAt = null;
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

  await user.save();
  return res.json({ user: serializeUser(user) });
});

router.get("/venue-requests", async (req: AuthedRequest, res) => {
  const parsed = paginationSchema
    .extend({ status: z.enum(VENUE_REQUEST_STATUSES).optional() })
    .safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Consulta inválida" });
  }

  const filter: Record<string, unknown> = {};
  if (parsed.data.status) filter.status = parsed.data.status;
  const { page, limit } = parsed.data;

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
    requests: rows.map((r) => {
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
    }),
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
    request: serializeVenueRequest(request, {
      requester: requester
        ? {
            id: requester._id.toString(),
            email: requester.email,
            name: requester.profile?.name ?? undefined,
          }
        : undefined,
    }),
    venue: targetVenue ? serializeVenue(targetVenue) : undefined,
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
      deleteLocalUploads(uploaded.map((item) => item.url));

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
          error: "La portada WebP de 1600×1200 píxeles es obligatoria",
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
      const coverCheck = await assertVenueCoverUpload(uploaded[0]);
      if (!coverCheck.ok) {
        cleanup();
        return res
          .status(400)
          .json({ error: coverCheck.error, code: "UPLOAD_INVALID" });
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

      const location = await resolveVenueLocation({
        address: parsed.data.address,
        country: parsed.data.country,
        city: parsed.data.city,
        location: parsed.data.location,
      });

      try {
        venue = await Venue.create({
          name: parsed.data.name,
          type: parsed.data.type,
          address: parsed.data.address,
          country: parsed.data.country,
          city: parsed.data.city,
          description: parsed.data.description,
          photos: [uploaded[0].url],
          location,
          ownerId: request.wantsToManage !== false ? owner._id : undefined,
          followersCount: 0,
          active: true,
        });
      } catch (err) {
        cleanup();
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
      request.photos = [uploaded[0].url];
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
      request: serializeVenueRequest(request, {
        requester: {
          id: owner._id.toString(),
          email: owner.email,
          name: owner.profile?.name ?? undefined,
        },
      }),
      venue: serializeVenue(venue),
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

    return res.json({ request: serializeVenueRequest(request) });
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
  const { page, limit, status } = parsed.data;
  const filter = status ? { status } : {};
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

  const { page, limit } = parsed.data;
  const [rows, total] = await Promise.all([
    PromoPurchase.find()
      .sort({ purchasedAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    PromoPurchase.countDocuments(),
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
        Presence.updateMany(
          { userId: reported._id, status: "active" },
          { $set: { status: "revoked" } }
        ),
      ]);
    } catch (err) {
      await Report.updateOne(
        { _id: report._id, "resolution.resolvedAt": now },
        { $set: { status: "open" }, $unset: { resolution: 1 } }
      );
      throw err;
    }
  }

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
  return res.json({ promotion: serializePromotion(promo) });
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
  return res.json({ promotion: serializePromotion(promo) });
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
  return res.json({ news: serializeVenueNews(news) });
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
  return res.json({ news: serializeVenueNews(news) });
});

export default router;

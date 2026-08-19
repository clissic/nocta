import { Router } from "express";
import { z } from "zod";
import { DAILY_LIKE_LIMIT, VENUE_REQUEST_STATUSES } from "@nocta/shared";
import { requireAuth, requireAdmin, type AuthedRequest } from "../middleware/auth.js";
import { User } from "../models/User.js";
import { Venue } from "../models/Venue.js";
import { Presence } from "../models/Presence.js";
import { Match } from "../models/Match.js";
import { Promotion } from "../models/Promotion.js";
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
import { sendVenueRequestApprovedEmail, sendVenueRequestRejectedEmail } from "../mail/mailer.js";
import { createNotification } from "../utils/notify.js";
import {
  parsePromoValidityRange,
  resolveUserTimeZone,
} from "../utils/promoValidity.js";

const router = Router();

router.use(requireAuth, requireAdmin);

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

const photoUrlSchema = z
  .string()
  .min(1)
  .refine(
    (v) => v.startsWith("/uploads/") || /^https?:\/\//i.test(v),
    "URL de foto inválida"
  );

router.get("/stats", async (_req: AuthedRequest, res) => {
  await expireStalePresences();
  const [users, venues, activePresences, matches, pendingRequests] =
    await Promise.all([
      User.countDocuments({ role: "user" }),
      Venue.countDocuments({ active: true }),
      Presence.countDocuments({ status: "active" }),
      Match.countDocuments(),
      VenueRequest.countDocuments({ status: "pending" }),
    ]);

  return res.json({
    stats: {
      users,
      venues,
      activePresences,
      matches,
      pendingVenueRequests: pendingRequests,
    },
  });
});

router.get("/users", async (_req: AuthedRequest, res) => {
  await User.updateMany(
    {
      premium: { $ne: true },
      remainingLikes: 0,
      likesRechargeAt: { $lte: new Date() },
    },
    { $set: { remainingLikes: DAILY_LIKE_LIMIT, likesRechargeAt: null } }
  );
  const users = await User.find({ role: "user" })
    .sort({ createdAt: -1 })
    .limit(100);
  return res.json({ users: users.map(serializeUser) });
});

router.get("/venue-requests", async (req: AuthedRequest, res) => {
  const statusParse = z
    .enum(VENUE_REQUEST_STATUSES)
    .optional()
    .safeParse(req.query.status);
  if (!statusParse.success) {
    return res.status(400).json({ error: "Estado inválido" });
  }

  const filter: Record<string, unknown> = {};
  if (statusParse.data) filter.status = statusParse.data;

  const rows = await VenueRequest.find(filter)
    .sort({ createdAt: -1 })
    .limit(100);
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
  });
});

router.post(
  "/venue-requests/:id/approve",
  async (req: AuthedRequest, res) => {
    const id = paramId(req.params.id);
    if (!isObjectId(id)) {
      return res.status(400).json({ error: "Id inválido" });
    }

    const request = await VenueRequest.findById(id);
    if (!request) {
      return res.status(404).json({ error: "Solicitud no encontrada" });
    }
    if (request.status !== "pending") {
      return res.status(400).json({ error: "La solicitud ya fue revisada" });
    }

    const owner = await User.findById(request.requesterId);
    if (!owner || !["user", "admin"].includes(owner.role)) {
      return res.status(400).json({ error: "Solicitante inválido" });
    }

    const location = await resolveVenueLocation({
      address: request.address,
      city: request.city,
      location:
        request.location &&
        typeof (request.location as { lat?: number }).lat === "number" &&
        typeof (request.location as { lng?: number }).lng === "number"
          ? {
              lat: (request.location as { lat: number }).lat,
              lng: (request.location as { lng: number }).lng,
            }
          : null,
    });

    const venue = await Venue.create({
      name: request.name,
      type: request.type,
      address: request.address,
      city: request.city,
      description: request.description,
      photos: request.photos ?? [],
      location,
      ownerId: owner._id,
      followersCount: 0,
      active: true,
    });

    request.status = "approved";
    request.venueId = venue._id;
    request.reviewedBy = req.user!._id;
    if (typeof req.body?.adminNote === "string") {
      request.adminNote = req.body.adminNote.slice(0, 500);
    }
    await request.save();

    try {
      await sendVenueRequestApprovedEmail({
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
      title: "Solicitud de Espacio aprobada",
      body: `${venue.name} ya está disponible para gestionar`,
      href: `/venues/${venue._id.toString()}/manage`,
      data: {
        requestId: request._id.toString(),
        venueId: venue._id.toString(),
        status: "approved",
      },
    });

    return res.json({
      request: serializeVenueRequest(request),
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

    const request = await VenueRequest.findById(id);
    if (!request) {
      return res.status(404).json({ error: "Solicitud no encontrada" });
    }
    if (request.status !== "pending") {
      return res.status(400).json({ error: "La solicitud ya fue revisada" });
    }

    request.status = "rejected";
    request.reviewedBy = req.user!._id;
    if (typeof req.body?.adminNote === "string") {
      request.adminNote = req.body.adminNote.slice(0, 500);
    }
    await request.save();

    try {
      const requester = await User.findById(request.requesterId);
      if (requester?.email) {
        await sendVenueRequestRejectedEmail({
          to: requester.email,
          requesterName: requester.profile?.name ?? undefined,
          venueName: request.name,
          venueType: request.type,
          city: request.city,
          adminNote: request.adminNote ?? undefined,
        });
      }
    } catch (err) {
      console.error("[mail] venue request rejected notify failed", err);
    }

    void createNotification({
      userId: request.requesterId.toString(),
      type: "venue_request_resolved",
      title: "Solicitud de Espacio rechazada",
      body: request.adminNote?.trim()
        ? request.adminNote.trim()
        : `No pudimos aprobar ${request.name} por ahora`,
      href: "/profile/venue-request",
      data: {
        requestId: request._id.toString(),
        status: "rejected",
      },
    });

    return res.json({ request: serializeVenueRequest(request) });
  }
);

router.get("/reports", async (_req: AuthedRequest, res) => {
  const reports = await Report.find()
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

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
      };
    }),
  });
});

router.patch("/reports/:id", async (req: AuthedRequest, res) => {
  const id = paramId(req.params.id);
  if (!isObjectId(id)) {
    return res.status(400).json({ error: "Id inválido" });
  }
  const parsed = z
    .object({ status: z.enum(["open", "reviewed", "dismissed"]) })
    .safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Estado inválido" });
  }
  const report = await Report.findByIdAndUpdate(
    id,
    { status: parsed.data.status },
    { new: true }
  );
  if (!report) return res.status(404).json({ error: "Denuncia no encontrada" });

  if (parsed.data.status === "reviewed" || parsed.data.status === "dismissed") {
    void createNotification({
      userId: report.reporterId.toString(),
      type: "report_resolved",
      title: "Tu denuncia fue revisada",
      body:
        parsed.data.status === "reviewed"
          ? "Un administrador revisó tu denuncia"
          : "Un administrador descartó tu denuncia",
      href: "/matches",
      data: {
        reportId: report._id.toString(),
        status: parsed.data.status,
      },
      dedupeKey: `report_resolved:${report._id.toString()}`,
    });
  }

  return res.json({
    report: {
      id: report._id.toString(),
      status: report.status,
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

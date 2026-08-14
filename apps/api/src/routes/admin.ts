import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireAdmin, type AuthedRequest } from "../middleware/auth.js";
import { User } from "../models/User.js";
import { Venue } from "../models/Venue.js";
import { Presence } from "../models/Presence.js";
import { Match } from "../models/Match.js";
import { Promotion } from "../models/Promotion.js";
import { Report } from "../models/Report.js";
import { serializeUser, serializePromotion } from "../utils/serialize.js";
import { isObjectId, paramId } from "../utils/ids.js";
import { expireStalePresences } from "../utils/presence.js";

const router = Router();

router.use(requireAuth, requireAdmin);

const promoSchema = z.object({
  title: z.string().min(2).max(120),
  description: z.string().min(2).max(500),
  validUntil: z.string().optional(),
  active: z.boolean().optional(),
});

router.get("/stats", async (_req: AuthedRequest, res) => {
  await expireStalePresences();
  const [users, venues, activePresences, matches] = await Promise.all([
    User.countDocuments({ role: "user" }),
    Venue.countDocuments({ active: true }),
    Presence.countDocuments({ status: "active" }),
    Match.countDocuments(),
  ]);

  return res.json({
    stats: { users, venues, activePresences, matches },
  });
});

router.get("/users", async (_req: AuthedRequest, res) => {
  const users = await User.find({ role: "user" })
    .sort({ createdAt: -1 })
    .limit(100);
  return res.json({ users: users.map(serializeUser) });
});

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
  const update: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.validUntil !== undefined) {
    update.validUntil = parsed.data.validUntil
      ? new Date(parsed.data.validUntil)
      : null;
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

export default router;

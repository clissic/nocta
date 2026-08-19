import { Router } from "express";
import { z } from "zod";
import { NOTIFICATIONS_PAGE_SIZE } from "@nocta/shared";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { requireVerified } from "../middleware/gates.js";
import { Notification } from "../models/Notification.js";
import { isObjectId } from "../utils/ids.js";
import { serializeNotification } from "../utils/notify.js";
import {
  notificationExpiresAt,
  purgeExpiredReadNotifications,
} from "../utils/notificationTtl.js";

const router = Router();

router.use(requireAuth, requireVerified);

router.get("/unread-count", async (req: AuthedRequest, res) => {
  await purgeExpiredReadNotifications(req.user!._id.toString());
  const count = await Notification.countDocuments({
    userId: req.user!._id,
    readAt: null,
  });
  return res.json({ count });
});

router.get("/", async (req: AuthedRequest, res) => {
  await purgeExpiredReadNotifications(req.user!._id.toString());

  const limitRaw = Number(req.query.limit ?? NOTIFICATIONS_PAGE_SIZE);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(50, Math.max(1, Math.floor(limitRaw)))
    : NOTIFICATIONS_PAGE_SIZE;
  const pageRaw = Number(req.query.page ?? 1);
  const page = Number.isFinite(pageRaw)
    ? Math.max(1, Math.floor(pageRaw))
    : 1;
  const cursor =
    typeof req.query.cursor === "string" && isObjectId(req.query.cursor)
      ? req.query.cursor
      : null;

  const baseFilter: Record<string, unknown> = { userId: req.user!._id };

  if (cursor) {
    const filter = { ...baseFilter, _id: { $lt: cursor } };
    const rows = await Notification.find(filter)
      .sort({ _id: -1 })
      .limit(limit + 1);
    const hasMore = rows.length > limit;
    const slice = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? slice[slice.length - 1]!._id.toString() : null;
    const total = await Notification.countDocuments(baseFilter);
    return res.json({
      notifications: slice.map(serializeNotification),
      nextCursor,
      page: 1,
      pageSize: limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  }

  const total = await Notification.countDocuments(baseFilter);
  const totalPages = Math.max(1, Math.ceil(total / limit) || 1);
  const safePage = Math.min(page, totalPages);
  const skip = (safePage - 1) * limit;

  const rows = await Notification.find(baseFilter)
    .sort({ _id: -1 })
    .skip(skip)
    .limit(limit);

  const nextCursor =
    rows.length === limit && safePage < totalPages
      ? rows[rows.length - 1]!._id.toString()
      : null;

  return res.json({
    notifications: rows.map(serializeNotification),
    nextCursor,
    page: safePage,
    pageSize: limit,
    total,
    totalPages: total === 0 ? 1 : totalPages,
  });
});

const readSchema = z
  .object({
    ids: z.array(z.string().min(1)).max(100).optional(),
    all: z.boolean().optional(),
  })
  .refine((body) => body.all === true || (body.ids && body.ids.length > 0), {
    message: "Indicá ids o all",
  });

router.post("/read", async (req: AuthedRequest, res) => {
  const parsed = readSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos" });
  }

  const now = new Date();
  const expiresAt = notificationExpiresAt(now);
  if (parsed.data.all) {
    await Notification.updateMany(
      { userId: req.user!._id, readAt: null },
      { $set: { readAt: now, expiresAt } }
    );
  } else {
    const ids = (parsed.data.ids ?? []).filter(isObjectId);
    if (ids.length) {
      await Notification.updateMany(
        { userId: req.user!._id, _id: { $in: ids }, readAt: null },
        { $set: { readAt: now, expiresAt } }
      );
    }
  }

  const count = await Notification.countDocuments({
    userId: req.user!._id,
    readAt: null,
  });
  return res.json({ ok: true, count });
});

export default router;

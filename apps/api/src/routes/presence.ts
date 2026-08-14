import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { requireVerified } from "../middleware/gates.js";
import { Presence } from "../models/Presence.js";
import { Venue } from "../models/Venue.js";
import { expireStalePresences } from "../utils/presence.js";
import { serializePresence } from "../utils/serialize.js";
import { isObjectId } from "../utils/ids.js";

const router = Router();

const publishSchema = z.object({
  venueId: z.string().min(1),
  /** null = permanente; number = horas desde ahora */
  hours: z.number().positive().nullable(),
});

router.get("/me", requireAuth, requireVerified, async (req: AuthedRequest, res) => {
  await expireStalePresences({ userId: req.user!._id.toString() });
  const presence = await Presence.findOne({
    userId: req.user!._id,
    status: "active",
  }).populate("venueId");

  if (!presence) {
    return res.json({ presence: null });
  }

  const venue =
    presence.venueId &&
    typeof presence.venueId === "object" &&
    "name" in (presence.venueId as object)
      ? (presence.venueId as unknown as InstanceType<typeof Venue>)
      : await Venue.findById(presence.venueId);

  return res.json({
    presence: serializePresence(presence, venue),
  });
});

router.post("/", requireAuth, requireVerified, async (req: AuthedRequest, res) => {
  const user = req.user!;
  if (!user.profileComplete || !user.profile) {
    return res
      .status(400)
      .json({ error: "Completá tu perfil antes de publicarte" });
  }

  const parsed = publishSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos" });
  }

  if (!isObjectId(parsed.data.venueId)) {
    return res.status(400).json({ error: "venueId inválido" });
  }

  const venue = await Venue.findOne({ _id: parsed.data.venueId, active: true });
  if (!venue) {
    return res.status(404).json({ error: "Local no encontrado" });
  }

  await expireStalePresences({ userId: user._id.toString() });

  // MVP: una sola presencia activa a la vez
  await Presence.updateMany(
    { userId: user._id, status: "active" },
    { $set: { status: "revoked" } }
  );

  const startsAt = new Date();
  const endsAt =
    parsed.data.hours === null
      ? null
      : new Date(startsAt.getTime() + parsed.data.hours * 60 * 60 * 1000);

  const presence = await Presence.create({
    userId: user._id,
    venueId: venue._id,
    startsAt,
    endsAt,
    status: "active",
  });

  return res.status(201).json({
    presence: serializePresence(presence, venue),
  });
});

router.delete("/me", requireAuth, requireVerified, async (req: AuthedRequest, res) => {
  await Presence.updateMany(
    { userId: req.user!._id, status: "active" },
    { $set: { status: "revoked" } }
  );
  return res.json({ ok: true });
});

export default router;

import { Router } from "express";
import { z } from "zod";
import { maxActivePresencesForPlan } from "@nocta/shared";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { requireVerified } from "../middleware/gates.js";
import { Presence } from "../models/Presence.js";
import { Venue } from "../models/Venue.js";
import {
  clearLikesForVenues,
  endActivePresences,
  expireStalePresences,
} from "../utils/presence.js";
import { serializePresence } from "../utils/serialize.js";
import { isObjectId } from "../utils/ids.js";
import { notifyUserFollowers } from "../utils/notifyFollowers.js";
import { resolveShowActivityToFollowers } from "../utils/activityVisibility.js";
import { isPremiumActive } from "../utils/premium.js";

const router = Router();

const publishSchema = z.object({
  venueId: z.string().min(1),
  /** null = permanente; number = horas desde ahora */
  hours: z.number().positive().nullable(),
});

async function serializePresenceWithVenue(
  presence: InstanceType<typeof Presence>
) {
  const venue =
    presence.venueId &&
    typeof presence.venueId === "object" &&
    "name" in (presence.venueId as object)
      ? (presence.venueId as unknown as InstanceType<typeof Venue>)
      : await Venue.findById(presence.venueId);
  return await serializePresence(presence, venue);
}

router.get("/me", requireAuth, requireVerified, async (req: AuthedRequest, res) => {
  await expireStalePresences({ userId: req.user!._id.toString() });
  const rows = await Presence.find({
    userId: req.user!._id,
    status: "active",
  })
    .sort({ startsAt: -1, _id: -1 })
    .populate("venueId");

  const planId = isPremiumActive(req.user!)
    ? String(req.user!.premiumPlanId ?? "")
    : null;
  const maxPresences = maxActivePresencesForPlan(planId);

  const presences = await Promise.all(
    rows.map((presence) => serializePresenceWithVenue(presence))
  );

  return res.json({
    presence: presences[0] ?? null,
    presences,
    maxPresences,
  });
});

router.post("/", requireAuth, requireVerified, async (req: AuthedRequest, res) => {
  const user = req.user!;
  if (!user.profileComplete || !user.profile) {
    return res
      .status(400)
      .json({ error: "Completá tu perfil antes de publicarte" });
  }

  if (user.discoverDisabled) {
    return res.status(403).json({
      error: "Tenés Discover desactivado. Activalo en Configuración para publicarte.",
      code: "DISCOVER_DISABLED",
    });
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
    return res.status(404).json({ error: "Espacio no encontrado" });
  }

  await expireStalePresences({ userId: user._id.toString() });

  const planId = isPremiumActive(user) ? String(user.premiumPlanId ?? "") : null;
  const maxPresences = maxActivePresencesForPlan(planId);

  const existingHere = await Presence.findOne({
    userId: user._id,
    venueId: venue._id,
    status: "active",
  });

  const startsAt = new Date();
  const endsAt =
    parsed.data.hours === null
      ? null
      : new Date(startsAt.getTime() + parsed.data.hours * 60 * 60 * 1000);

  if (existingHere) {
    existingHere.startsAt = startsAt;
    existingHere.endsAt = endsAt;
    await existingHere.save();
    return res.status(200).json({
      presence: await serializePresence(existingHere, venue),
      slot: null,
      maxPresences,
    });
  }

  const activeCount = await Presence.countDocuments({
    userId: user._id,
    status: "active",
  });

  if (maxPresences <= 1) {
    // Una sola presencia activa (limpia likes del Espacio anterior)
    await endActivePresences(user._id.toString(), "revoked");
  } else if (activeCount >= maxPresences) {
    return res.status(409).json({
      error: `Ya estás publicado en ${maxPresences} Espacios. Sacá uno para publicar en otro.`,
      code: "PRESENCE_LIMIT",
      maxPresences,
      activeCount,
    });
  }

  const slot = maxPresences > 1 ? activeCount + 1 : 1;

  const presence = await Presence.create({
    userId: user._id,
    venueId: venue._id,
    startsAt,
    endsAt,
    status: "active",
  });

  if (resolveShowActivityToFollowers(user)) {
    const actorName = user.profile?.name ?? "Alguien";
    void notifyUserFollowers({
      actorId: user._id.toString(),
      requireShowActivity: true,
      premiumOnly: true,
      notification: {
        type: "followed_presence",
        title: `${actorName} se publicó`,
        body: `Está en ${venue.name}`,
        href: `/venues/${venue._id.toString()}`,
        data: {
          venueId: venue._id.toString(),
          presenceId: presence._id.toString(),
        },
        dedupePrefix: `followed_presence:${presence._id.toString()}`,
      },
    }).catch(() => undefined);
  }

  return res.status(201).json({
    presence: await serializePresence(presence, venue),
    slot,
    maxPresences,
  });
});

router.delete("/me", requireAuth, requireVerified, async (req: AuthedRequest, res) => {
  const venueId =
    typeof req.query.venueId === "string" ? req.query.venueId : null;
  if (venueId) {
    if (!isObjectId(venueId)) {
      return res.status(400).json({ error: "venueId inválido" });
    }
    const active = await Presence.findOne({
      userId: req.user!._id,
      venueId,
      status: "active",
    }).select("_id venueId");
    if (active) {
      await Presence.updateOne(
        { _id: active._id },
        { $set: { status: "revoked" } }
      );
      await clearLikesForVenues(req.user!._id.toString(), [
        active.venueId,
      ]);
    }
    return res.json({ ok: true });
  }
  await endActivePresences(req.user!._id.toString(), "revoked");
  return res.json({ ok: true });
});

export default router;

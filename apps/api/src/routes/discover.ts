import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { Presence } from "../models/Presence.js";
import { Swipe } from "../models/Swipe.js";
import { Match } from "../models/Match.js";
import { User } from "../models/User.js";
import { expireStalePresences } from "../utils/presence.js";
import { calcAge } from "../utils/serialize.js";
import { isObjectId, sortedUserPair } from "../utils/ids.js";

const router = Router();

const swipeSchema = z.object({
  toUserId: z.string().min(1),
  direction: z.enum(["like", "pass"]),
});

function serializeCard(
  u: InstanceType<typeof User>,
  presenceId: string
) {
  return {
    userId: u._id.toString(),
    profile: {
      name: u.profile!.name,
      birthDate: u.profile!.birthDate.toISOString(),
      heightCm: u.profile!.heightCm ?? undefined,
      lookingFor: u.profile!.lookingFor,
      photos: u.profile!.photos,
      bio: u.profile!.bio ?? undefined,
      interests: u.profile!.interests ?? [],
      workStatus: u.profile!.workStatus ?? undefined,
      gender: u.profile!.gender ?? undefined,
      interestedIn: u.profile!.interestedIn ?? [],
    },
    presenceId,
    age: calcAge(u.profile!.birthDate),
  };
}

router.get("/feed", requireAuth, async (req: AuthedRequest, res) => {
  const user = req.user!;
  if (!user.profileComplete || !user.profile) {
    return res.status(400).json({ error: "Completá tu perfil" });
  }

  await expireStalePresences({ userId: user._id.toString() });

  const myPresence = await Presence.findOne({
    userId: user._id,
    status: "active",
  });
  if (!myPresence) {
    return res.status(400).json({
      error: "Publicá tu presencia en un local para ver el deck",
      code: "NO_PRESENCE",
    });
  }

  // Expira candidatos vencidos del mismo local antes de armar el deck
  await expireStalePresences({ venueId: myPresence.venueId.toString() });

  const alreadySwiped = await Swipe.find({
    fromUserId: user._id,
    venueId: myPresence.venueId,
  }).select("toUserId");

  const excludedIds = [user._id, ...alreadySwiped.map((s) => s.toUserId)];

  const candidates = await Presence.find({
    venueId: myPresence.venueId,
    status: "active",
    userId: { $nin: excludedIds },
  })
    .limit(40)
    .lean();

  const userIds = candidates.map((c) => c.userId);
  const users = await User.find({
    _id: { $in: userIds },
    profileComplete: true,
  });

  const myInterestedIn = (user.profile.interestedIn ?? [])
    .map((g) => g.toLowerCase())
    .filter(Boolean);
  const myGender = user.profile.gender?.toLowerCase();

  const cards = users
    .filter((u) => u.profile)
    .filter((u) => {
      // Filtro blando: si ambos definieron preferencias de género, respetarlas
      if (myInterestedIn.length > 0) {
        const theirGender = u.profile!.gender?.toLowerCase();
        if (theirGender && !myInterestedIn.includes(theirGender)) {
          return false;
        }
      }
      if (myGender) {
        const theirInterestedIn = (u.profile!.interestedIn ?? []).map((g) =>
          g.toLowerCase()
        );
        if (
          theirInterestedIn.length > 0 &&
          !theirInterestedIn.includes(myGender)
        ) {
          return false;
        }
      }
      return true;
    })
    .map((u) => {
      const presence = candidates.find(
        (c) => c.userId.toString() === u._id.toString()
      )!;
      return serializeCard(u, presence._id.toString());
    });

  return res.json({
    venueId: myPresence.venueId.toString(),
    cards,
  });
});

router.post("/swipe", requireAuth, async (req: AuthedRequest, res) => {
  const user = req.user!;
  const parsed = swipeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos" });
  }

  if (!isObjectId(parsed.data.toUserId)) {
    return res.status(400).json({ error: "toUserId inválido" });
  }

  await expireStalePresences({ userId: user._id.toString() });
  const myPresence = await Presence.findOne({
    userId: user._id,
    status: "active",
  });
  if (!myPresence) {
    return res
      .status(400)
      .json({ error: "Sin presencia activa", code: "NO_PRESENCE" });
  }

  if (parsed.data.toUserId === user._id.toString()) {
    return res.status(400).json({ error: "No podés swiparte a vos mismo" });
  }

  await expireStalePresences({ venueId: myPresence.venueId.toString() });

  const theirPresence = await Presence.findOne({
    userId: parsed.data.toUserId,
    venueId: myPresence.venueId,
    status: "active",
  });
  if (!theirPresence) {
    return res
      .status(400)
      .json({ error: "Esa persona ya no está publicada en este local" });
  }

  try {
    await Swipe.create({
      fromUserId: user._id,
      toUserId: parsed.data.toUserId,
      venueId: myPresence.venueId,
      direction: parsed.data.direction,
    });
  } catch {
    return res.status(409).json({ error: "Ya swipaste a esta persona aquí" });
  }

  let match: { id: string } | null = null;
  if (parsed.data.direction === "like") {
    const reciprocal = await Swipe.findOne({
      fromUserId: parsed.data.toUserId,
      toUserId: user._id,
      venueId: myPresence.venueId,
      direction: "like",
    });

    if (reciprocal) {
      const users = sortedUserPair(user._id, parsed.data.toUserId);
      try {
        const created = await Match.create({
          users,
          venueId: myPresence.venueId,
        });
        match = { id: created._id.toString() };
      } catch {
        const existing = await Match.findOne({
          venueId: myPresence.venueId,
          users,
        });
        if (existing) match = { id: existing._id.toString() };
      }
    }
  }

  return res.json({ ok: true, match });
});

export default router;

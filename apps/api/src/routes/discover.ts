import { Router } from "express";
import { z } from "zod";
import type { DiscoverCard } from "@nocta/shared";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { requireVerified } from "../middleware/gates.js";
import { Presence } from "../models/Presence.js";
import { Swipe } from "../models/Swipe.js";
import { Match } from "../models/Match.js";
import { Message } from "../models/Message.js";
import { User } from "../models/User.js";
import { expireStalePresences } from "../utils/presence.js";
import { calcAge, serializeSocials } from "../utils/serialize.js";
import { isObjectId, sortedUserPair } from "../utils/ids.js";
import { blockedPeerIds } from "../models/Block.js";
import { Follow } from "../models/Follow.js";
import { FollowRequest } from "../models/FollowRequest.js";
import {
  consumeLike,
  getLikeAllowance,
  refundLike,
} from "../utils/likeAllowance.js";
import { isDemoUserEmail } from "../seedData.js";

const router = Router();

router.use(requireAuth, requireVerified);

const swipeSchema = z.object({
  toUserId: z.string().min(1),
  direction: z.enum(["like", "pass"]),
});

function serializeCard(
  u: InstanceType<typeof User>,
  presenceId: string
): DiscoverCard {
  const profile = u.profile!;
  const birthDate = profile.birthDate;
  if (!birthDate) {
    throw new Error("Perfil incompleto en discover");
  }
  return {
    userId: u._id.toString(),
    profile: {
      name: profile.name ?? "Usuario",
      birthDate: birthDate.toISOString(),
      heightCm: profile.heightCm ?? undefined,
      lookingFor: (profile.lookingFor ?? []).slice(0, 1),
      photos: profile.photos ?? [],
      bio: profile.bio ?? undefined,
      interests: profile.interests ?? [],
      workStatus: profile.workStatus ?? undefined,
      gender: profile.gender ?? undefined,
      interestedIn: profile.interestedIn ?? [],
      livesIn:
        profile.livesIn?.country && profile.livesIn?.city
          ? {
              country: profile.livesIn.country,
              city: profile.livesIn.city,
            }
          : undefined,
      sexualOrientation: profile.sexualOrientation ?? undefined,
      languages: profile.languages ?? [],
      zodiac: profile.zodiac ?? undefined,
      educationLevel: profile.educationLevel ?? undefined,
      pets: profile.pets ?? undefined,
      drinking: profile.drinking ?? undefined,
      fitness: profile.fitness ?? undefined,
      socials: serializeSocials(profile.socials),
      jobTitle: profile.jobTitle ?? undefined,
      company: profile.company ?? undefined,
      studiedAt: profile.studiedAt ?? undefined,
    },
    presenceId,
    age: calcAge(birthDate),
  };
}

function shuffleInPlace<T>(items: T[]) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
  return items;
}

router.get("/feed", async (req: AuthedRequest, res) => {
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
      error: "Publicá tu presencia en un espacio para ver el deck",
      code: "NO_PRESENCE",
    });
  }

  // Expira candidatos vencidos del mismo espacio antes de armar el deck
  await expireStalePresences({ venueId: myPresence.venueId.toString() });

  const alreadySwiped = await Swipe.find({
    fromUserId: user._id,
    venueId: myPresence.venueId,
  }).select("toUserId");

  const blocked = await blockedPeerIds(user._id);
  const excludedIds = [
    user._id,
    ...alreadySwiped.map((s) => s.toUserId),
    ...blocked,
  ];

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

  const viewerIsDemo = isDemoUserEmail(user.email);

  const cards = users
    .filter((u) => u.profile)
    .filter((u) => {
      // Cuentas demo saltan el filtro mutuo para poder probar Discover
      if (viewerIsDemo || isDemoUserEmail(u.email)) {
        return true;
      }
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

  shuffleInPlace(cards);

  const cardUserIds = cards.map((c) => c.userId);
  const [followingRows, pendingRows] = await Promise.all([
    Follow.find({
      followerId: user._id,
      targetType: "user",
      targetId: { $in: cardUserIds },
    }).select("targetId"),
    FollowRequest.find({
      fromUserId: user._id,
      toUserId: { $in: cardUserIds },
      status: "pending",
    }).select("toUserId"),
  ]);
  const followingSet = new Set(followingRows.map((r) => r.targetId.toString()));
  const pendingSet = new Set(pendingRows.map((r) => r.toUserId.toString()));
  for (const card of cards) {
    card.isFollowing = followingSet.has(card.userId);
    card.isFollowRequested =
      !card.isFollowing && pendingSet.has(card.userId);
  }

  const likeAllowance = await getLikeAllowance(user._id.toString());
  return res.json({
    venueId: myPresence.venueId.toString(),
    cards,
    likeAllowance,
  });
});

router.post("/swipe", async (req: AuthedRequest, res) => {
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
      .json({ error: "Esa persona ya no está publicada en este espacio" });
  }

  const likeResult =
    parsed.data.direction === "like"
      ? await consumeLike(user._id.toString())
      : null;
  if (likeResult && !likeResult.allowed) {
    return res.status(429).json({
      error: "Tus likes se están recargando",
      code: "LIKES_EXHAUSTED",
      likeAllowance: likeResult.allowance,
    });
  }

  try {
    await Swipe.create({
      fromUserId: user._id,
      toUserId: parsed.data.toUserId,
      venueId: myPresence.venueId,
      direction: parsed.data.direction,
    });
  } catch {
    if (likeResult?.consumed) {
      await refundLike(user._id.toString());
    }
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

  const likeAllowance =
    likeResult?.allowance ?? (await getLikeAllowance(user._id.toString()));
  return res.json({ ok: true, match, likeAllowance });
});

/** Deshace el último swipe del usuario en el espacio con presencia activa. */
router.post("/rewind", async (req: AuthedRequest, res) => {
  const user = req.user!;

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

  const lastSwipe = await Swipe.findOne({
    fromUserId: user._id,
    venueId: myPresence.venueId,
  }).sort({ createdAt: -1 });

  if (!lastSwipe) {
    return res.status(404).json({ error: "No hay tarjeta para deshacer" });
  }

  const toUserId = lastSwipe.toUserId.toString();
  const wasLike = lastSwipe.direction === "like";

  await Swipe.deleteOne({ _id: lastSwipe._id });

  if (wasLike) {
    const users = sortedUserPair(user._id, toUserId);
    const match = await Match.findOne({
      venueId: myPresence.venueId,
      users,
    });
    if (match) {
      await Message.deleteMany({ matchId: match._id });
      await Match.deleteOne({ _id: match._id });
    }
    await refundLike(user._id.toString());
  }

  const targetUser = await User.findById(toUserId);
  const theirPresence = await Presence.findOne({
    userId: toUserId,
    venueId: myPresence.venueId,
    status: "active",
  });

  let card = null;
  if (
    targetUser?.profileComplete &&
    targetUser.profile &&
    theirPresence
  ) {
    try {
      card = serializeCard(targetUser, theirPresence._id.toString());
    } catch {
      card = null;
    }
  }

  const likeAllowance = await getLikeAllowance(user._id.toString());
  return res.json({ ok: true, card, likeAllowance });
});

export default router;


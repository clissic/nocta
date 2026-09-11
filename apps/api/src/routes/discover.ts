import { Router } from "express";
import { z } from "zod";
import type { DiscoverCard } from "@nocta/shared";
import { planHasFeature } from "@nocta/shared";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { requireVerified } from "../middleware/gates.js";
import { Presence } from "../models/Presence.js";
import { Swipe } from "../models/Swipe.js";
import { Match } from "../models/Match.js";
import { Message } from "../models/Message.js";
import { User } from "../models/User.js";
import { Venue } from "../models/Venue.js";
import { expireStalePresences } from "../utils/presence.js";
import {
  calcAge,
  serializeSocials,
  resolvePublicAssetUrl,
  resolvePublicAssetUrls,
} from "../utils/serialize.js";
import { canonicalizePhotoRef } from "../image-service/uploadBridge.js";
import { isObjectId, sortedUserPair } from "../utils/ids.js";
import { blockedPeerIds } from "../models/Block.js";
import { Follow } from "../models/Follow.js";
import { FollowRequest } from "../models/FollowRequest.js";
import {
  consumeLike,
  getLikeAllowance,
  refundLike,
} from "../utils/likeAllowance.js";
import { createNotification } from "../utils/notify.js";
import { areBlocked } from "../utils/follows.js";
import { moderationVisibleUserFilter } from "../utils/moderation.js";
import { isPremiumActive, isBoostActive, consumeHeartshot, refundHeartshot } from "../utils/premium.js";

const router = Router();

router.use(requireAuth, requireVerified);

const swipeSchema = z.object({
  toUserId: z.string().min(1),
  direction: z.enum(["like", "pass"]),
  isHeartshot: z.boolean().optional(),
  venueId: z.string().min(1).optional(),
});

const rewindSchema = z.object({
  venueId: z.string().min(1).optional(),
});

async function resolveMyActivePresence(
  userId: string,
  venueId?: string | null
) {
  const filter: Record<string, unknown> = {
    userId,
    status: "active",
  };
  if (venueId && isObjectId(venueId)) {
    filter.venueId = venueId;
  }
  return Presence.findOne(filter).sort({ startsAt: -1, _id: -1 });
}

/**
 * Discover: firma/CDN solo la 1.ª foto (carga inmediata).
 * El resto quedan como refs estables `/api/media/{id}` o `/uploads/...`
 * (sin firmar las 10 en el feed → menos JSON y menos trabajo en API).
 * Usá `preResolvedPrimary` cuando el feed ya resolvió en batch.
 */
async function resolveDiscoverCardPhotos(
  photos: string[] | undefined | null,
  preResolvedPrimary?: string | null
): Promise<string[]> {
  const list = (photos ?? []).filter((p): p is string => Boolean(p?.trim()));
  if (!list.length) return [];
  const primary =
    preResolvedPrimary ??
    (await resolvePublicAssetUrl(list[0])) ??
    canonicalizePhotoRef(list[0]!);
  const rest = list.slice(1).map((p) => canonicalizePhotoRef(p));
  return [primary, ...rest];
}

/** Campos mínimos para armar la card (lean OK). */
type DiscoverCardUser = {
  _id: { toString(): string };
  profile?: InstanceType<typeof User>["profile"];
  identityVerification?: { status?: string } | null;
};

const DISCOVER_USER_SELECT =
  "profile identityVerification boostExpiresAt premium premiumExpiresAt profileComplete rogueMode";

async function serializeCard(
  u: DiscoverCardUser,
  presenceId: string,
  preResolvedPrimaryPhoto?: string | null
): Promise<DiscoverCard> {
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
      photos: await resolveDiscoverCardPhotos(
        profile.photos,
        preResolvedPrimaryPhoto
      ),
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
    identityVerified:
      (u.identityVerification as { status?: string } | null | undefined)
        ?.status === "approved",
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
  const focusedUserId =
    isPremiumActive(user) &&
    typeof req.query.userId === "string" &&
    isObjectId(req.query.userId)
      ? req.query.userId
      : null;
  if (!user.profileComplete || !user.profile) {
    return res.status(400).json({ error: "Completá tu perfil" });
  }

  await expireStalePresences({ userId: user._id.toString() });

  const myPresences = await Presence.find({
    userId: user._id,
    status: "active",
  })
    .select("venueId startsAt")
    .sort({ startsAt: -1, _id: -1 })
    .lean();
  if (!myPresences.length) {
    return res.status(400).json({
      error: "Publicá tu presencia en un espacio para ver el deck",
      code: "NO_PRESENCE",
    });
  }

  const requestedVenueId =
    typeof req.query.venueId === "string" && isObjectId(req.query.venueId)
      ? req.query.venueId
      : null;

  let myPresence = requestedVenueId
    ? myPresences.find((p) => p.venueId.toString() === requestedVenueId)
    : myPresences.length === 1
      ? myPresences[0]
      : null;

  if (!myPresence && myPresences.length > 1 && !requestedVenueId) {
    return res.status(400).json({
      error: "Elegí un Espacio para ver su Discover",
      code: "SELECT_VENUE",
      venueIds: myPresences.map((p) => p.venueId.toString()),
    });
  }

  if (!myPresence) {
    return res.status(400).json({
      error: "No estás publicado en ese Espacio",
      code: "NO_PRESENCE",
    });
  }

  // Expira candidatos vencidos del mismo espacio antes de armar el deck
  await expireStalePresences({ venueId: myPresence.venueId.toString() });

  const alreadySwiped = await Swipe.find({
    fromUserId: user._id,
    venueId: myPresence.venueId,
  })
    .select("toUserId")
    .lean();

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
    .select("userId")
    .limit(40)
    .lean();

  const userIds = candidates.map((c) => c.userId);
  const users = await User.find({
    _id: { $in: userIds },
    profileComplete: true,
    ...moderationVisibleUserFilter(),
  })
    .select(DISCOVER_USER_SELECT)
    .lean();

  const rogueCandidates = users.filter(
    (u) => Boolean(u.rogueMode) && isPremiumActive(u)
  );
  let visibleDespiteRogue = new Set<string>();
  if (rogueCandidates.length > 0) {
    const likesTowardMe = await Swipe.find({
      fromUserId: { $in: rogueCandidates.map((u) => u._id) },
      toUserId: user._id,
      venueId: myPresence.venueId,
      direction: "like",
    })
      .select("fromUserId")
      .lean();
    visibleDespiteRogue = new Set(
      likesTowardMe.map((s) => s.fromUserId.toString())
    );
  }

  const myInterestedIn = (user.profile.interestedIn ?? [])
    .map((g) => g.toLowerCase())
    .filter(Boolean);
  const myGender = user.profile.gender?.toLowerCase();

  const filteredUsers = users
    .filter((u) => u.profile)
    .filter((u) => {
      if (focusedUserId === u._id.toString()) return true;
      if (Boolean(u.rogueMode) && isPremiumActive(u)) {
        return visibleDespiteRogue.has(u._id.toString());
      }
      return true;
    })
    .filter((u) => {
      if (focusedUserId === u._id.toString()) return true;
      // Preferencias de género: respetar interestedIn del viewer y del candidato
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
    });

  const primaryPhotoRefs = filteredUsers.map(
    (u) => u.profile?.photos?.find((p) => Boolean(p?.trim())) ?? null
  );
  const resolvedPrimaries = await resolvePublicAssetUrls(
    primaryPhotoRefs.filter((p): p is string => Boolean(p))
  );
  let primaryResolveIdx = 0;
  const primaryByUserId = new Map<string, string | null>();
  for (let i = 0; i < filteredUsers.length; i += 1) {
    const ref = primaryPhotoRefs[i];
    const uid = filteredUsers[i]!._id.toString();
    if (!ref) {
      primaryByUserId.set(uid, null);
      continue;
    }
    primaryByUserId.set(
      uid,
      resolvedPrimaries[primaryResolveIdx++] || canonicalizePhotoRef(ref)
    );
  }

  const cardRows = await Promise.all(
    filteredUsers.map(async (u) => {
      const presence = candidates.find(
        (c) => c.userId.toString() === u._id.toString()
      )!;
      return {
        card: await serializeCard(
          u,
          presence._id.toString(),
          primaryByUserId.get(u._id.toString())
        ),
        boosted: isBoostActive(u),
      };
    })
  );

  const boosted = cardRows.filter((c) => c.boosted).map((c) => c.card);
  const regular = cardRows.filter((c) => !c.boosted).map((c) => c.card);
  shuffleInPlace(boosted);
  shuffleInPlace(regular);
  const ordered = [...boosted, ...regular];
  if (focusedUserId) {
    ordered.sort((a, b) => {
      if (a.userId === focusedUserId) return -1;
      if (b.userId === focusedUserId) return 1;
      return 0;
    });
  }

  const cardUserIds = ordered.map((c) => c.userId);
  const [followingRows, pendingRows] = await Promise.all([
    Follow.find({
      followerId: user._id,
      targetType: "user",
      targetId: { $in: cardUserIds },
    })
      .select("targetId")
      .lean(),
    FollowRequest.find({
      fromUserId: user._id,
      toUserId: { $in: cardUserIds },
      status: "pending",
    })
      .select("toUserId")
      .lean(),
  ]);
  const followingSet = new Set(followingRows.map((r) => r.targetId.toString()));
  const pendingSet = new Set(pendingRows.map((r) => r.toUserId.toString()));
  for (const card of ordered) {
    card.isFollowing = followingSet.has(card.userId);
    card.isFollowRequested =
      !card.isFollowing && pendingSet.has(card.userId);
  }

  const likeAllowance = await getLikeAllowance(user._id.toString());
  return res.json({
    venueId: myPresence.venueId.toString(),
    cards: ordered,
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
  const myPresence = await resolveMyActivePresence(
    user._id.toString(),
    parsed.data.venueId
  );
  if (!myPresence) {
    return res
      .status(400)
      .json({ error: "Sin presencia activa", code: "NO_PRESENCE" });
  }

  if (parsed.data.toUserId === user._id.toString()) {
    return res.status(400).json({ error: "No podés swiparte a vos mismo" });
  }
  if (await areBlocked(user._id.toString(), parsed.data.toUserId)) {
    return res.status(404).json({ error: "Usuario no encontrado" });
  }

  await expireStalePresences({ venueId: myPresence.venueId.toString() });

  const theirPresence = await Presence.findOne({
    userId: parsed.data.toUserId,
    venueId: myPresence.venueId,
    status: "active",
  })
    .select("_id")
    .lean();
  if (!theirPresence) {
    return res
      .status(400)
      .json({ error: "Esa persona ya no está publicada en este espacio" });
  }

  const wantHeartshot =
    parsed.data.direction === "like" && Boolean(parsed.data.isHeartshot);

  let heartshotConsumed = false;
  if (wantHeartshot) {
    const hs = await consumeHeartshot(user._id.toString());
    if (!hs.ok) {
      return res.status(hs.status).json({
        error: hs.error,
        code: hs.code,
      });
    }
    heartshotConsumed = true;
  }

  const likeResult =
    parsed.data.direction === "like" && !wantHeartshot
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
      isHeartshot: wantHeartshot,
    });
  } catch {
    if (likeResult?.consumed) {
      await refundLike(user._id.toString());
    }
    if (heartshotConsumed) {
      await refundHeartshot(user._id.toString());
    }
    return res.status(409).json({ error: "Ya swipaste a esta persona aquí" });
  }

  let match: { id: string } | null = null;
  if (parsed.data.direction === "like") {
    const actorName = user.profile?.name ?? "Alguien";
    void createNotification({
      userId: parsed.data.toUserId,
      type: "like_received",
      title: wantHeartshot ? "¡Heartshot!" : "Tenés un like nuevo",
      body: wantHeartshot
        ? `${actorName} te mandó un Heartshot. Abrí Likes para responder.`
        : "Alguien te dio like. Abrí Likes para ver más.",
      href: "/likes",
      data: {
        venueId: myPresence.venueId.toString(),
        isHeartshot: wantHeartshot,
      },
    });

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

      if (match) {
        const otherId = parsed.data.toUserId;
        const matchHref = `/matches/${match.id}`;
        void createNotification({
          userId: otherId,
          type: "match_created",
          title: "¡Nuevo match!",
          body: `Matcheaste con ${actorName}`,
          href: matchHref,
          data: {
            matchId: match.id,
            actorId: user._id.toString(),
            venueId: myPresence.venueId.toString(),
          },
          dedupeKey: `match_created:${match.id}:${otherId}`,
        });
        const otherUser = await User.findById(otherId).select("profile.name");
        const otherName = otherUser?.profile?.name ?? "Alguien";
        void createNotification({
          userId: user._id.toString(),
          type: "match_created",
          title: "¡Nuevo match!",
          body: `Matcheaste con ${otherName}`,
          href: matchHref,
          data: {
            matchId: match.id,
            actorId: otherId,
            venueId: myPresence.venueId.toString(),
          },
          dedupeKey: `match_created:${match.id}:${user._id.toString()}`,
        });
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
  if (!isPremiumActive(user)) {
    return res.status(403).json({
      error: "El retroceso es exclusivo de Nocta Premium",
      code: "PREMIUM_REQUIRED",
    });
  }

  const parsed = rewindSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos" });
  }

  await expireStalePresences({ userId: user._id.toString() });
  const myPresence = await resolveMyActivePresence(
    user._id.toString(),
    parsed.data.venueId
  );
  if (!myPresence) {
    return res
      .status(400)
      .json({ error: "Sin presencia activa", code: "NO_PRESENCE" });
  }

  const lastSwipe = await Swipe.findOne({
    fromUserId: user._id,
    venueId: myPresence.venueId,
  })
    .sort({ createdAt: -1 })
    .lean();

  if (!lastSwipe) {
    return res.status(404).json({ error: "No hay tarjeta para deshacer" });
  }

  const toUserId = lastSwipe.toUserId.toString();
  const wasLike = lastSwipe.direction === "like";
  const wasHeartshot = Boolean(lastSwipe.isHeartshot);
  const blocked = await areBlocked(user._id.toString(), toUserId);

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
    if (wasHeartshot) {
      await refundHeartshot(user._id.toString());
    } else {
      await refundLike(user._id.toString());
    }
  }

  const targetUser = await User.findById(toUserId)
    .select(DISCOVER_USER_SELECT)
    .lean();
  const theirPresence = await Presence.findOne({
    userId: toUserId,
    venueId: myPresence.venueId,
    status: "active",
  })
    .select("_id")
    .lean();

  let card = null;
  if (
    targetUser?.profileComplete &&
    targetUser.profile &&
    theirPresence &&
    !blocked
  ) {
    try {
      card = await serializeCard(targetUser, theirPresence._id.toString());
    } catch {
      card = null;
    }
  }

  const likeAllowance = await getLikeAllowance(user._id.toString());
  return res.json({ ok: true, card, likeAllowance });
});

/** Likes recibidos pendientes de respuesta (no swipeados de vuelta, no bloqueados). */
router.get("/likes", async (req: AuthedRequest, res) => {
  const me = req.user!._id;
  await expireStalePresences({ userId: me.toString() });

  const [incoming, mySwipes, blocked, myPresences] = await Promise.all([
    Swipe.find({
      toUserId: me,
      direction: "like",
    })
      .select("fromUserId venueId isHeartshot createdAt")
      .sort({ createdAt: -1 })
      .limit(80)
      .lean(),
    Swipe.find({ fromUserId: me }).select("toUserId venueId").lean(),
    blockedPeerIds(me),
    Presence.find({ userId: me, status: "active" }).select("venueId").lean(),
  ]);

  const blockedSet = new Set(blocked.map(String));
  const respondedKeys = new Set(
    mySwipes.map((s) => `${s.toUserId.toString()}:${s.venueId.toString()}`)
  );
  const myVenueIds = new Set(
    myPresences.map((p) => p.venueId.toString())
  );

  const pending = incoming.filter((s) => {
    const fromId = s.fromUserId.toString();
    if (blockedSet.has(fromId)) return false;
    const key = `${fromId}:${s.venueId.toString()}`;
    return !respondedKeys.has(key);
  });

  const userIds = [...new Set(pending.map((s) => s.fromUserId.toString()))];
  const venueIds = [...new Set(pending.map((s) => s.venueId.toString()))];

  const [users, venues] = await Promise.all([
    userIds.length
      ? User.find({
          _id: { $in: userIds },
          profileComplete: true,
          ...moderationVisibleUserFilter(),
        })
          .select("profile")
          .lean()
      : Promise.resolve([]),
    venueIds.length
      ? Venue.find({ _id: { $in: venueIds }, active: true })
          .select("name")
          .lean()
      : Promise.resolve([]),
  ]);

  const userMap = new Map(users.map((u) => [u._id.toString(), u]));
  const venueMap = new Map(
    venues.map((v) => [v._id.toString(), v.name as string])
  );
  const viewerPremium = isPremiumActive(req.user!);
  const canSeeLikes =
    viewerPremium &&
    planHasFeature(String(req.user!.premiumPlanId), "see_likes");

  const photoRefsForReveal: string[] = [];
  const pendingMeta = pending.map((s) => {
    const fromId = s.fromUserId.toString();
    const venueId = s.venueId.toString();
    const u = userMap.get(fromId);
    const birthDate = u?.profile?.birthDate;
    const venueName = venueMap.get(venueId);
    const isHeartshot = Boolean(s.isHeartshot);
    const reveal = canSeeLikes || isHeartshot;
    const photoRef =
      reveal && u?.profile?.photos?.[0]
        ? u.profile.photos[0]
        : null;
    if (photoRef) photoRefsForReveal.push(photoRef);
    return {
      s,
      fromId,
      venueId,
      u,
      birthDate,
      venueName,
      isHeartshot,
      reveal,
      photoRef,
    };
  });

  const resolvedPhotos = await resolvePublicAssetUrls(photoRefsForReveal);
  let photoIdx = 0;

  const likes = pendingMeta
    .map((row) => {
      if (!row.u?.profile || !row.birthDate || !row.venueName) return null;
      let photo: string | undefined;
      if (row.photoRef) {
        photo =
          resolvedPhotos[photoIdx++] ||
          canonicalizePhotoRef(row.photoRef) ||
          undefined;
      }
      return {
        id: row.s._id.toString(),
        createdAt: row.s.createdAt.toISOString(),
        venueId: row.venueId,
        venueName: row.venueName,
        isHeartshot: row.isHeartshot,
        user: {
          ...(row.reveal
            ? {
                id: row.fromId,
                name: row.u.profile.name ?? "Usuario",
                photo,
              }
            : {}),
          age: calcAge(row.birthDate),
        },
        canRespond: myVenueIds.has(row.venueId),
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return res.json({ likes, viewerPremium, canSeeLikes });
});

export default router;


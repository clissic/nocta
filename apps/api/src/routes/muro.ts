import { Router } from "express";
import { z } from "zod";
import {
  MAX_POST_BODY_LENGTH,
  MAX_POST_PHOTOS,
} from "@nocta/shared";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import {
  requireProfileComplete,
  requireVerified,
} from "../middleware/gates.js";
import { Follow } from "../models/Follow.js";
import { Venue } from "../models/Venue.js";
import { VenueNews } from "../models/VenueNews.js";
import { Promotion } from "../models/Promotion.js";
import { ActivityEvent } from "../models/ActivityEvent.js";
import { User } from "../models/User.js";
import { VenueReview } from "../models/VenueReview.js";
import { UserPost } from "../models/UserPost.js";
import { blockedPeerIds } from "../models/Block.js";
import {
  serializeVenueNews,
  serializePromotion,
  serializeActivityItem,
  serializeUserPost,
} from "../utils/serialize.js";
import { currentlyValidPromoFilter } from "../utils/promoValidity.js";
import { recordActivity } from "../utils/activity.js";
import { isObjectId } from "../utils/ids.js";
import {
  assertUploadsAreImages,
  collectUploadedFiles,
  deleteLocalUploads,
  handleMulterError,
  uploadPhotosFlexible,
} from "../uploads/index.js";

const router = Router();

const ACTIVITY_LIMIT = 30;
const FOLLOWING_USERS_AVATAR_LIMIT = 24;

const photoUrlSchema = z
  .string()
  .min(1)
  .refine(
    (v) => v.startsWith("/uploads/") || /^https?:\/\//i.test(v),
    "URL de foto inválida"
  );

const createPostSchema = z.object({
  venueId: z.string().min(1),
  body: z.string().trim().min(1).max(MAX_POST_BODY_LENGTH),
  photos: z.array(photoUrlSchema).max(MAX_POST_PHOTOS).default([]),
});

function parsePostBody(raw: Record<string, unknown>) {
  const photosRaw = raw.photos;
  let photos: unknown = photosRaw;
  if (typeof photosRaw === "string") {
    try {
      photos = JSON.parse(photosRaw);
    } catch {
      photos = [];
    }
  }
  return createPostSchema.safeParse({
    venueId: raw.venueId,
    body: raw.body,
    photos,
  });
}

router.get("/feed", requireAuth, async (req: AuthedRequest, res) => {
  const me = req.user!._id;
  const meId = me.toString();

  const [venueFollows, userFollows, blocked] = await Promise.all([
    Follow.find({ followerId: me, targetType: "venue" }).select("targetId"),
    Follow.find({ followerId: me, targetType: "user" }).select("targetId"),
    blockedPeerIds(me),
  ]);

  const blockedSet = new Set(blocked.map(String));
  const followedUserIds = userFollows
    .map((f) => f.targetId.toString())
    .filter((id) => id !== meId && !blockedSet.has(id));

  const venueIds = venueFollows.map((f) => f.targetId);

  let news: ReturnType<typeof serializeVenueNews>[] = [];
  let promotions: ReturnType<typeof serializePromotion>[] = [];

  if (venueIds.length > 0) {
    const venues = await Venue.find({
      _id: { $in: venueIds },
      active: true,
    }).select("name photos");
    const venueMap = new Map(
      venues.map((v) => [
        v._id.toString(),
        { name: v.name, photo: v.photos?.[0] },
      ])
    );
    const activeVenueIds = venues.map((v) => v._id);
    const now = new Date();

    const [newsRows, promoRows] = await Promise.all([
      VenueNews.find({
        venueId: { $in: activeVenueIds },
        active: true,
      })
        .sort({ publishedAt: -1 })
        .limit(40),
      Promotion.find({
        venueId: { $in: activeVenueIds },
        active: true,
        ...currentlyValidPromoFilter(now),
      })
        .sort({ createdAt: -1 })
        .limit(40),
    ]);

    news = newsRows.map((n) => {
      const meta = venueMap.get(n.venueId.toString());
      return serializeVenueNews(n, {
        venueName: meta?.name,
        venuePhoto: meta?.photo,
      });
    });
    promotions = promoRows.map((p) => {
      const meta = venueMap.get(p.venueId.toString());
      return serializePromotion(p, {
        venueName: meta?.name,
        venuePhoto: meta?.photo,
      });
    });
  }

  let activity: ReturnType<typeof serializeActivityItem>[] = [];
  let followingUsers: Array<{ id: string; name: string; photo?: string }> = [];

  const actorUsers = await User.find({
    _id: { $in: [...followedUserIds, me] },
    profileComplete: true,
  }).select("profile hideActivityFromFollowers");

  const actorMap = new Map(
    actorUsers.map((u) => [
      u._id.toString(),
      {
        id: u._id.toString(),
        name: u.profile?.name ?? "Usuario",
        photo: u.profile?.photos?.[0],
        hideActivityFromFollowers: Boolean(u.hideActivityFromFollowers),
      },
    ])
  );

  followingUsers = followedUserIds
    .filter((id) => actorMap.has(id))
    .slice(0, FOLLOWING_USERS_AVATAR_LIMIT)
    .map((id) => {
      const actor = actorMap.get(id)!;
      return {
        id: actor.id,
        name: actor.name,
        photo: actor.photo,
      };
    });

  // Incluye al viewer siempre; hideActivityFromFollowers solo aplica a terceros
  const activityActorIds = [
    meId,
    ...followedUserIds.filter((id) => {
      const actor = actorMap.get(id);
      return Boolean(actor) && !actor?.hideActivityFromFollowers;
    }),
  ].filter((id) => actorMap.has(id));

  if (activityActorIds.length > 0) {
    const events = await ActivityEvent.find({
      actorId: { $in: activityActorIds },
      active: true,
    })
      .sort({ createdAt: -1 })
      .limit(ACTIVITY_LIMIT);

    const venueIdsFromEvents = [
      ...new Set(
        events
          .map((e) => (e.venueId ? e.venueId.toString() : null))
          .filter((id): id is string => Boolean(id))
      ),
    ];
    const reviewIdsFromEvents = [
      ...new Set(
        events
          .map((e) => (e.reviewId ? e.reviewId.toString() : null))
          .filter((id): id is string => Boolean(id))
      ),
    ];
    const postIdsFromEvents = [
      ...new Set(
        events
          .map((e) => (e.postId ? e.postId.toString() : null))
          .filter((id): id is string => Boolean(id))
      ),
    ];

    const [eventVenues, eventReviews, eventPosts] = await Promise.all([
      venueIdsFromEvents.length
        ? Venue.find({ _id: { $in: venueIdsFromEvents }, active: true }).select(
            "name photos"
          )
        : Promise.resolve([]),
      reviewIdsFromEvents.length
        ? VenueReview.find({
            _id: { $in: reviewIdsFromEvents },
            active: true,
          }).select("rating body photos")
        : Promise.resolve([]),
      postIdsFromEvents.length
        ? UserPost.find({
            _id: { $in: postIdsFromEvents },
            active: true,
          }).select("body photos")
        : Promise.resolve([]),
    ]);

    const eventVenueMap = new Map(
      eventVenues.map((v) => [
        v._id.toString(),
        {
          id: v._id.toString(),
          name: v.name,
          photo: v.photos?.[0],
        },
      ])
    );
    const eventReviewMap = new Map(
      eventReviews.map((r) => [
        r._id.toString(),
        {
          id: r._id.toString(),
          rating: r.rating,
          body:
            typeof r.body === "string" && r.body.trim()
              ? r.body.trim()
              : undefined,
          photos: r.photos ?? [],
        },
      ])
    );
    const eventPostMap = new Map(
      eventPosts.map((p) => [
        p._id.toString(),
        {
          id: p._id.toString(),
          body: p.body.trim(),
          photos: p.photos ?? [],
        },
      ])
    );

    activity = events
      .map((event) => {
        const actor = actorMap.get(event.actorId.toString());
        if (!actor) return null;
        const venueId = event.venueId?.toString();
        const reviewId = event.reviewId?.toString();
        const postId = event.postId?.toString();
        const venue = venueId ? eventVenueMap.get(venueId) : undefined;
        if (venueId && !venue) return null;
        const review = reviewId ? eventReviewMap.get(reviewId) : undefined;
        if (reviewId && !review) return null;
        const post = postId ? eventPostMap.get(postId) : undefined;
        if (postId && !post) return null;

        const payload = (event.payload ?? {}) as Record<string, unknown>;
        const venueFromPayload =
          !venue && typeof payload.venueName === "string"
            ? {
                id: venueId ?? "",
                name: payload.venueName,
                photo: undefined as string | undefined,
              }
            : venue;

        // Solo rellenar post desde payload en publicaciones; las reseñas
        // también guardan `body`/`photos` y no deben aparecer como post.
        const postFromPayload =
          !post &&
          event.type === "user_post_created" &&
          typeof payload.body === "string"
            ? {
                id: postId ?? "",
                body: payload.body,
                photos: Array.isArray(payload.photos)
                  ? (payload.photos as string[]).filter(
                      (p) => typeof p === "string"
                    )
                  : [],
              }
            : post;

        return serializeActivityItem(event, {
          actor: {
            id: actor.id,
            name: actor.name,
            photo: actor.photo,
          },
          venue: venueFromPayload,
          review,
          post: postFromPayload,
        });
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
  }

  return res.json({
    news,
    promotions,
    activity,
    followingUsers,
  });
});

router.post(
  "/posts",
  requireAuth,
  requireVerified,
  requireProfileComplete,
  (req: AuthedRequest, res, next) => {
    uploadPhotosFlexible(req, res, (err) => {
      if (err) return handleMulterError(err, req, res, next);
      next();
    });
  },
  async (req: AuthedRequest, res) => {
    const uploaded = collectUploadedFiles(req);
    if (uploaded.length > 0) {
      const checked = assertUploadsAreImages(uploaded);
      if (!checked.ok) {
        deleteLocalUploads(uploaded.map((u) => u.url));
        return res
          .status(400)
          .json({ error: checked.error, code: "UPLOAD_INVALID" });
      }
    }

    const body = { ...(req.body as Record<string, unknown>) };
    if (uploaded.length > 0) {
      body.photos = uploaded.map((u) => u.url).slice(0, MAX_POST_PHOTOS);
    }

    const parsed = parsePostBody(body);
    if (!parsed.success) {
      deleteLocalUploads(uploaded.map((u) => u.url));
      return res.status(400).json({
        error: "Datos inválidos",
        details: parsed.error.flatten(),
      });
    }

    const venueId = parsed.data.venueId;
    if (!isObjectId(venueId)) {
      deleteLocalUploads(uploaded.map((u) => u.url));
      return res.status(400).json({ error: "Espacio inválido" });
    }

    const venue = await Venue.findOne({ _id: venueId, active: true });
    if (!venue) {
      deleteLocalUploads(uploaded.map((u) => u.url));
      return res.status(404).json({ error: "Espacio no encontrado" });
    }

    const authorId = req.user!._id;
    const post = await UserPost.create({
      authorId,
      venueId,
      body: parsed.data.body,
      photos: parsed.data.photos,
      active: true,
    });

    void recordActivity({
      actorId: authorId.toString(),
      type: "user_post_created",
      venueId,
      postId: post._id.toString(),
      payload: {
        body: post.body,
        photos: post.photos ?? [],
        venueName: venue.name,
      },
    }).catch(() => undefined);

    return res.status(201).json({
      post: serializeUserPost(post, {
        venueName: venue.name,
        venuePhoto: venue.photos?.[0],
      }),
    });
  }
);

export default router;

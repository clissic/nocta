import type { UserDocument } from "../models/User.js";
import type { VenueDocument } from "../models/Venue.js";
import type { PresenceDocument } from "../models/Presence.js";
import type { PromotionDocument } from "../models/Promotion.js";
import type { PromoPurchaseDocument } from "../models/PromoPurchase.js";
import type { VenueNewsDocument } from "../models/VenueNews.js";
import type { VenueRequestDocument } from "../models/VenueRequest.js";
import type { VenueReviewDocument } from "../models/VenueReview.js";
import type { UserPostDocument } from "../models/UserPost.js";
import type { ActivityEventDocument } from "../models/ActivityEvent.js";
import {
  DAILY_LIKE_LIMIT,
  SOCIAL_NETWORKS,
  planHasFeature,
  type ActivityType,
  type PromoPurchaseStatus,
} from "@nocta/shared";
import { refId } from "./ids.js";
import { resolveShowActivityToFollowers } from "./activityVisibility.js";
import { getActiveSuspension } from "./moderation.js";
import { isPremiumActive } from "./premium.js";
import { config } from "../config.js";
import {
  resolveDeliveryUrl,
  resolveDeliveryUrls,
} from "../image-service/resolveDelivery.js";

/**
 * Absolutiza legacy `/uploads` de forma síncrona.
 * Para managed `/api/media/...` preferí `resolvePublicAssetUrl` (Object Storage directo).
 */
export function publicAssetUrl(url?: string | null) {
  if (!url) return url ?? undefined;
  if (url.startsWith("/api/media/") || url.includes("/api/media/")) {
    // No devolver proxy Express: el caller async debe expandir.
    // Fallback sync solo para no romper call sites olvidados: dejar ref relativa
    // (el browser no la cargará hasta expandir). Mejor expandir siempre.
    return url.startsWith("/") ? url : url;
  }
  if (!url.startsWith("/uploads/")) return url;
  const base = config.apiPublicUrl.replace(/\/$/, "");
  return base ? `${base}${url}` : url;
}

export function publicAssetUrls(urls?: string[] | null) {
  return (urls ?? []).map((url) => publicAssetUrl(url) ?? url);
}

/** Browser → Object Storage (CDN/firmada) o legacy `/uploads` vía API. */
export async function resolvePublicAssetUrl(url?: string | null) {
  return resolveDeliveryUrl(url);
}

/**
 * Batch 1:1 con `urls` vía `resolveDeliveryUrls` (cache de firmas compartido).
 * Preferí esto en listas/hot paths; evitá N× `resolvePublicAssetUrl`.
 */
export async function resolvePublicAssetUrls(urls?: string[] | null) {
  const list = urls ?? [];
  if (!list.length) return [];
  const resolved = await resolveDeliveryUrls(list);
  // Mantener longitud: huecos vacíos → ref original (o "") para no desalinear índices.
  return resolved.map((u, i) => u || list[i] || "");
}

function calcAge(birthDate: Date): number {
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const m = now.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) age -= 1;
  return age;
}

function asPlainRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  if (
    "toObject" in value &&
    typeof (value as { toObject?: unknown }).toObject === "function"
  ) {
    return (value as { toObject: () => Record<string, unknown> }).toObject();
  }
  return value as Record<string, unknown>;
}

export function serializeSocials(
  socials: unknown
): Partial<Record<(typeof SOCIAL_NETWORKS)[number], string>> | undefined {
  const plain = asPlainRecord(socials);
  if (!plain) return undefined;
  const next: Partial<Record<(typeof SOCIAL_NETWORKS)[number], string>> = {};
  for (const key of SOCIAL_NETWORKS) {
    const value = plain[key];
    if (typeof value === "string" && value.trim()) {
      next[key] = value.trim().replace(/^@/, "");
    }
  }
  return Object.keys(next).length ? next : undefined;
}

export async function serializeUser(user: UserDocument) {
  const suspension = getActiveSuspension(user);
  const socials = serializeSocials(user.profile?.socials);
  const livesIn = user.profile?.livesIn as
    | {
        country?: string | null;
        city?: string | null;
      }
    | null
    | undefined;
  const hasLivesIn =
    Boolean(livesIn?.country?.trim()) && Boolean(livesIn?.city?.trim());

  const photos = user.profile?.photos
    ? await resolvePublicAssetUrls(user.profile.photos)
    : [];

  const profile = user.profile
    ? {
        name: user.profile.name ?? "",
        birthDate: user.profile.birthDate
          ? user.profile.birthDate.toISOString()
          : undefined,
        heightCm: user.profile.heightCm ?? undefined,
        lookingFor: user.profile.lookingFor?.slice(0, 1) ?? [],
        photos,
        bio: user.profile.bio ?? undefined,
        interests: user.profile.interests ?? [],
        workStatus: user.profile.workStatus ?? undefined,
        gender: user.profile.gender ?? undefined,
        interestedIn: user.profile.interestedIn ?? [],
        livesIn: hasLivesIn
          ? {
              country: (livesIn!.country as string).trim(),
              city: (livesIn!.city as string).trim(),
            }
          : undefined,
        sexualOrientation: user.profile.sexualOrientation ?? undefined,
        languages: user.profile.languages ?? [],
        zodiac: user.profile.zodiac ?? undefined,
        educationLevel: user.profile.educationLevel ?? undefined,
        pets: user.profile.pets ?? undefined,
        drinking: user.profile.drinking ?? undefined,
        fitness: user.profile.fitness ?? undefined,
        socials,
        jobTitle: user.profile.jobTitle ?? undefined,
        company: user.profile.company ?? undefined,
        studiedAt: user.profile.studiedAt ?? undefined,
      }
    : null;

  const premiumActive = isPremiumActive(user);
  const verification = user.identityVerification as
    | {
        status?: string;
        rejectionReason?: string | null;
        submittedAt?: Date | null;
      }
    | null
    | undefined;
  const verificationStatus =
    verification?.status === "pending" ||
    verification?.status === "approved" ||
    verification?.status === "rejected"
      ? verification.status
      : "none";
  const identityVerified = verificationStatus === "approved";

  return {
    id: user._id.toString(),
    email: user.email,
    role: user.role,
    profile,
    profileComplete: Boolean(user.profileComplete),
    premium: premiumActive,
    premiumPlanId: premiumActive
      ? (user.premiumPlanId as string | undefined)
      : undefined,
    premiumExpiresAt:
      premiumActive && user.premiumExpiresAt
        ? user.premiumExpiresAt.toISOString()
        : premiumActive
          ? null
          : undefined,
    premiumPeriodMonths: premiumActive
      ? (user.premiumPeriodMonths as number | undefined)
      : undefined,
    premiumSubscriptionStatus:
      (user.premiumSubscriptionStatus as string | undefined) || "none",
    premiumCancelAtPeriodEnd: Boolean(
      premiumActive && user.premiumCancelAtPeriodEnd
    ),
    premiumNextPaymentAt:
      premiumActive && user.premiumNextPaymentAt
        ? user.premiumNextPaymentAt.toISOString()
        : null,
    rogueMode: Boolean(premiumActive && user.rogueMode),
    teleportMode: Boolean(premiumActive && user.teleportMode),
    spyMode: Boolean(
      premiumActive && planHasFeature(String(user.premiumPlanId), "spy_mode")
    ),
    discoverDisabled: Boolean(user.discoverDisabled),
    teleportCity:
      premiumActive &&
      user.teleportCity &&
      typeof (user.teleportCity as { lat?: number }).lat === "number" &&
      typeof (user.teleportCity as { lng?: number }).lng === "number"
        ? {
            country: String((user.teleportCity as { country: string }).country),
            city: String((user.teleportCity as { city: string }).city),
            lat: (user.teleportCity as { lat: number }).lat,
            lng: (user.teleportCity as { lng: number }).lng,
          }
        : undefined,
    remainingLikes: premiumActive
      ? null
      : (user.remainingLikes ?? DAILY_LIKE_LIMIT),
    likesRechargeAt:
      !premiumActive && user.likesRechargeAt
        ? user.likesRechargeAt.toISOString()
        : null,
    boostsRemaining: premiumActive ? user.boostsRemaining ?? 0 : 0,
    heartshotsRemaining: premiumActive ? user.heartshotsRemaining ?? 0 : 0,
    boostExpiresAt:
      premiumActive &&
      user.boostExpiresAt &&
      user.boostExpiresAt.getTime() > Date.now()
        ? user.boostExpiresAt.toISOString()
        : null,
    emailVerified: Boolean(user.emailVerified),
    followersCount: user.followersCount ?? 0,
    followingUsersCount: user.followingUsersCount ?? 0,
    followingVenuesCount: user.followingVenuesCount ?? 0,
    autoAcceptFollowRequests: Boolean(user.autoAcceptFollowRequests),
    showActivityToFollowers: resolveShowActivityToFollowers(user),
    marketingEmailsOptIn: Boolean(user.marketingEmailsOptIn),
    identityVerified,
    identityVerification: {
      status: verificationStatus,
      rejectionReason:
        verificationStatus === "rejected" && verification?.rejectionReason
          ? String(verification.rejectionReason)
          : undefined,
      submittedAt: verification?.submittedAt
        ? verification.submittedAt.toISOString()
        : undefined,
    },
    moderationStatus: suspension ? "suspended" : "active",
    suspension: suspension
      ? {
          suspendedAt: suspension.suspendedAt.toISOString(),
          suspendedUntil: suspension.suspendedUntil?.toISOString(),
          duration: suspension.duration,
        }
      : undefined,
    deletionRequestedAt: user.deletionRequestedAt
      ? user.deletionRequestedAt.toISOString()
      : null,
  };
}

export async function serializePublicUser(
  user: UserDocument,
  opts?: {
    isFollowing?: boolean;
    isFollower?: boolean;
    isFollowRequested?: boolean;
  }
) {
  if (!user.profile?.birthDate) {
    throw new Error("Usuario sin perfil público");
  }
  const photos = await resolvePublicAssetUrls(user.profile.photos);
  const livesIn = user.profile.livesIn as
    | { country?: string | null; city?: string | null }
    | null
    | undefined;
  const hasLivesIn =
    Boolean(livesIn?.country?.trim()) && Boolean(livesIn?.city?.trim());
  return {
    id: user._id.toString(),
    name: user.profile.name ?? "Usuario",
    age: calcAge(user.profile.birthDate),
    heightCm: user.profile.heightCm ?? undefined,
    bio: user.profile.bio ?? undefined,
    lookingFor: user.profile.lookingFor?.slice(0, 1) ?? [],
    interests: user.profile.interests ?? [],
    workStatus: user.profile.workStatus ?? undefined,
    gender: user.profile.gender ?? undefined,
    livesIn: hasLivesIn
      ? {
          country: (livesIn!.country as string).trim(),
          city: (livesIn!.city as string).trim(),
        }
      : undefined,
    socials: serializeSocials(user.profile.socials),
    photo: photos[0],
    photos,
    followersCount: user.followersCount ?? 0,
    followingUsersCount: user.followingUsersCount ?? 0,
    followingVenuesCount: user.followingVenuesCount ?? 0,
    isFollowing: opts?.isFollowing,
    isFollower: opts?.isFollower,
    isFollowRequested: opts?.isFollowRequested,
    identityVerified:
      (user.identityVerification as { status?: string } | null | undefined)
        ?.status === "approved",
  };
}

/** Vista mínima: foto, nombre, edad, altura, ubicación y redes. */
export async function serializeReducedProfile(user: UserDocument) {
  const publicUser = await serializePublicUser(user);
  return {
    id: publicUser.id,
    name: publicUser.name,
    age: publicUser.age,
    photo: publicUser.photo,
    heightCm: publicUser.heightCm,
    livesIn: publicUser.livesIn,
    socials: publicUser.socials,
  };
}

export async function serializeVenue(
  venue: VenueDocument,
  opts?: {
    followersCount?: number;
    isFollowing?: boolean;
    owner?: { id: string; name: string; photo?: string };
    myReview?: Awaited<ReturnType<typeof serializeVenueReview>>;
    livePublishedCount?: number;
  }
) {
  const loc = venue.location;
  const ownerId = venue.ownerId ? refId(venue.ownerId) : undefined;
  const ratingCount =
    typeof venue.ratingCount === "number" ? venue.ratingCount : 0;
  const ratingAvg =
    typeof venue.ratingAvg === "number" && ratingCount > 0
      ? venue.ratingAvg
      : undefined;
  const photos = await resolvePublicAssetUrls(venue.photos);
  const ownerPhoto = opts?.owner?.photo
    ? await resolvePublicAssetUrl(opts.owner.photo)
    : undefined;
  return {
    id: venue._id.toString(),
    name: venue.name,
    type: venue.type,
    address: venue.address,
    country: venue.country ?? "Uruguay",
    city: venue.city,
    description: venue.description ?? undefined,
    photos,
    location:
      loc && typeof loc.lat === "number" && typeof loc.lng === "number"
        ? { lat: loc.lat, lng: loc.lng }
        : undefined,
    active: venue.active,
    ownerId,
    owner: opts?.owner
      ? { ...opts.owner, photo: ownerPhoto }
      : undefined,
    followersCount:
      opts?.followersCount ??
      (typeof venue.followersCount === "number" ? venue.followersCount : 0),
    isFollowing: opts?.isFollowing,
    ratingAvg,
    ratingCount,
    myReview: opts?.myReview,
    livePublishedCount: opts?.livePublishedCount,
    createdAt: venue.createdAt.toISOString(),
    updatedAt: venue.updatedAt.toISOString(),
  };
}

export async function serializeVenueReview(
  review: VenueReviewDocument,
  opts?: {
    author?: { id: string; name: string; photo?: string };
    venueName?: string;
    venuePhoto?: string;
  }
) {
  const body =
    typeof review.body === "string" && review.body.trim()
      ? review.body.trim()
      : undefined;
  const photos = await resolvePublicAssetUrls(review.photos);
  const authorPhoto = opts?.author?.photo
    ? await resolvePublicAssetUrl(opts.author.photo)
    : undefined;
  const venuePhoto = opts?.venuePhoto
    ? await resolvePublicAssetUrl(opts.venuePhoto)
    : undefined;
  return {
    id: review._id.toString(),
    venueId: review.venueId.toString(),
    userId: review.userId.toString(),
    rating: review.rating,
    body,
    photos,
    active: review.active !== false,
    author: opts?.author
      ? { ...opts.author, photo: authorPhoto }
      : undefined,
    venueName: opts?.venueName,
    venuePhoto,
    createdAt: review.createdAt.toISOString(),
    updatedAt: review.updatedAt.toISOString(),
  };
}

export async function serializeUserPost(
  post: UserPostDocument,
  opts?: {
    venueName?: string;
    venuePhoto?: string;
  }
) {
  const photos = await resolvePublicAssetUrls(post.photos);
  const venuePhoto = opts?.venuePhoto
    ? await resolvePublicAssetUrl(opts.venuePhoto)
    : undefined;
  return {
    id: post._id.toString(),
    authorId: post.authorId.toString(),
    venueId: post.venueId.toString(),
    body: post.body.trim(),
    photos,
    active: post.active !== false,
    venueName: opts?.venueName,
    venuePhoto,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
  };
}

export async function serializeActivityItem(
  event: ActivityEventDocument,
  opts: {
    actor: { id: string; name: string; photo?: string };
    venue?: { id: string; name: string; photo?: string };
    review?: {
      id: string;
      rating: number;
      body?: string;
      photos: string[];
    };
    post?: {
      id: string;
      body: string;
      photos: string[];
    };
  }
) {
  const actorPhoto = opts.actor.photo
    ? await resolvePublicAssetUrl(opts.actor.photo)
    : undefined;
  const venuePhoto = opts.venue?.photo
    ? await resolvePublicAssetUrl(opts.venue.photo)
    : undefined;
  const reviewPhotos = opts.review
    ? await resolvePublicAssetUrls(opts.review.photos)
    : undefined;
  const postPhotos = opts.post
    ? await resolvePublicAssetUrls(opts.post.photos)
    : undefined;
  return {
    id: event._id.toString(),
    type: event.type as ActivityType,
    createdAt: event.createdAt.toISOString(),
    actor: {
      ...opts.actor,
      photo: actorPhoto,
    },
    venue: opts.venue
      ? { ...opts.venue, photo: venuePhoto }
      : undefined,
    review: opts.review
      ? { ...opts.review, photos: reviewPhotos ?? [] }
      : undefined,
    post: opts.post
      ? { ...opts.post, photos: postPhotos ?? [] }
      : undefined,
  };
}

export async function serializePromotion(
  promo: PromotionDocument,
  opts?: { venueName?: string; venuePhoto?: string }
) {
  const price =
    typeof promo.priceUyu === "number" && Number.isFinite(promo.priceUyu)
      ? promo.priceUyu
      : undefined;
  const venuePhoto = opts?.venuePhoto
    ? await resolvePublicAssetUrl(opts.venuePhoto)
    : undefined;
  return {
    id: promo._id.toString(),
    venueId: promo.venueId.toString(),
    title: promo.title,
    description: promo.description,
    priceUyu: price,
    validFrom: promo.validFrom?.toISOString(),
    validUntil: promo.validUntil?.toISOString(),
    active: promo.active,
    venueName: opts?.venueName,
    venuePhoto,
  };
}

function resolvePurchaseStatus(
  purchase: PromoPurchaseDocument
): PromoPurchaseStatus {
  const stored = purchase.status as PromoPurchaseStatus;
  if (stored === "redeemed" || stored === "refunded" || stored === "expired") {
    return stored;
  }
  if (purchase.validUntil && purchase.validUntil.getTime() < Date.now()) {
    return "expired";
  }
  return "valid";
}

export async function serializePromoPurchase(
  purchase: PromoPurchaseDocument,
  opts?: { venueName?: string; venuePhoto?: string }
) {
  const id = purchase._id.toString();
  const price =
    typeof purchase.priceUyu === "number" && Number.isFinite(purchase.priceUyu)
      ? purchase.priceUyu
      : undefined;
  const venuePhoto = opts?.venuePhoto
    ? await resolvePublicAssetUrl(opts.venuePhoto)
    : undefined;
  return {
    id,
    venueId: purchase.venueId.toString(),
    promotionId: purchase.promotionId.toString(),
    title: purchase.title,
    priceUyu: price,
    qrPayload: `nocta:promo:${id}:${purchase.code}`,
    status: resolvePurchaseStatus(purchase),
    purchasedAt: purchase.purchasedAt.toISOString(),
    validUntil: purchase.validUntil?.toISOString(),
    redeemedAt: purchase.redeemedAt?.toISOString(),
    venueName: opts?.venueName,
    venuePhoto,
  };
}

export async function serializeVenueNews(
  news: VenueNewsDocument,
  opts?: { venueName?: string; venuePhoto?: string }
) {
  const photos = await resolvePublicAssetUrls(news.photos);
  const venuePhoto = opts?.venuePhoto
    ? await resolvePublicAssetUrl(opts.venuePhoto)
    : undefined;
  return {
    id: news._id.toString(),
    venueId: news.venueId.toString(),
    title: news.title,
    body: news.body,
    photos,
    publishedAt: news.publishedAt.toISOString(),
    active: news.active,
    venueName: opts?.venueName,
    venuePhoto,
    createdAt: news.createdAt.toISOString(),
    updatedAt: news.updatedAt.toISOString(),
  };
}

export async function serializeVenueRequest(
  request: VenueRequestDocument,
  opts?: { requester?: { id: string; email: string; name?: string } }
) {
  const loc = request.location as
    | { lat?: number | null; lng?: number | null }
    | null
    | undefined;
  const hasLocation =
    loc &&
    typeof loc.lat === "number" &&
    typeof loc.lng === "number" &&
    Number.isFinite(loc.lat) &&
    Number.isFinite(loc.lng);

  const photos = await resolvePublicAssetUrls(request.photos);

  return {
    id: request._id.toString(),
    requesterId: request.requesterId.toString(),
    requestType: request.requestType ?? "create",
    targetVenueId: request.targetVenueId
      ? request.targetVenueId.toString()
      : undefined,
    wantsToManage: request.wantsToManage !== false,
    managementMessage: request.managementMessage ?? undefined,
    name: request.name,
    type: request.type,
    address: request.address,
    country: request.country ?? "Uruguay",
    city: request.city,
    description: request.description ?? undefined,
    photos,
    evidenceFiles: (request.evidenceFiles ?? []).map((file) => ({
      id: file.id,
      originalName: file.originalName,
      mimeType: file.mimeType,
      size: file.size,
    })),
    contactEmail: request.contactEmail ?? undefined,
    contactPhone: request.contactPhone ?? undefined,
    location: hasLocation
      ? { lat: loc.lat as number, lng: loc.lng as number }
      : undefined,
    geocodedAddress: request.geocodedAddress ?? undefined,
    status: request.status,
    rejectionReason: request.rejectionReason ?? undefined,
    adminNote: request.adminNote ?? undefined,
    reviewedBy: request.reviewedBy
      ? request.reviewedBy.toString()
      : undefined,
    venueId: request.venueId ? request.venueId.toString() : undefined,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
    requester: opts?.requester,
  };
}

export async function serializePresence(
  presence: PresenceDocument,
  venue?: VenueDocument | null
) {
  return {
    id: presence._id.toString(),
    userId: refId(presence.userId),
    venueId: refId(presence.venueId),
    venue: venue ? await serializeVenue(venue) : undefined,
    startsAt: presence.startsAt.toISOString(),
    endsAt: presence.endsAt ? presence.endsAt.toISOString() : null,
    status: presence.status,
  };
}

export { calcAge };

import type { UserDocument } from "../models/User.js";
import type { VenueDocument } from "../models/Venue.js";
import type { PresenceDocument } from "../models/Presence.js";
import type { PromotionDocument } from "../models/Promotion.js";
import { refId } from "./ids.js";

function calcAge(birthDate: Date): number {
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const m = now.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) age -= 1;
  return age;
}

export function serializeUser(user: UserDocument) {
  const profile = user.profile
    ? {
        name: user.profile.name ?? "",
        birthDate: user.profile.birthDate
          ? user.profile.birthDate.toISOString()
          : undefined,
        heightCm: user.profile.heightCm ?? undefined,
        lookingFor: user.profile.lookingFor ?? [],
        photos: user.profile.photos ?? [],
        bio: user.profile.bio ?? undefined,
        interests: user.profile.interests ?? [],
        workStatus: user.profile.workStatus ?? undefined,
        gender: user.profile.gender ?? undefined,
        interestedIn: user.profile.interestedIn ?? [],
      }
    : null;

  return {
    id: user._id.toString(),
    email: user.email,
    role: user.role,
    profile,
    profileComplete: Boolean(user.profileComplete),
    emailVerified: Boolean(user.emailVerified),
    followersCount: user.followersCount ?? 0,
    followingUsersCount: user.followingUsersCount ?? 0,
    followingVenuesCount: user.followingVenuesCount ?? 0,
  };
}

export function serializePublicUser(
  user: UserDocument,
  opts?: { isFollowing?: boolean; isFollower?: boolean }
) {
  if (!user.profile?.birthDate) {
    throw new Error("Usuario sin perfil público");
  }
  const photos = user.profile.photos ?? [];
  return {
    id: user._id.toString(),
    name: user.profile.name ?? "Usuario",
    age: calcAge(user.profile.birthDate),
    heightCm: user.profile.heightCm ?? undefined,
    bio: user.profile.bio ?? undefined,
    lookingFor: user.profile.lookingFor,
    interests: user.profile.interests ?? [],
    workStatus: user.profile.workStatus ?? undefined,
    gender: user.profile.gender ?? undefined,
    photo: photos[0],
    photos,
    followersCount: user.followersCount ?? 0,
    followingUsersCount: user.followingUsersCount ?? 0,
    followingVenuesCount: user.followingVenuesCount ?? 0,
    isFollowing: opts?.isFollowing,
    isFollower: opts?.isFollower,
  };
}

export function serializeVenue(
  venue: VenueDocument,
  opts?: { followersCount?: number; isFollowing?: boolean }
) {
  const loc = venue.location;
  return {
    id: venue._id.toString(),
    name: venue.name,
    type: venue.type,
    address: venue.address,
    city: venue.city,
    description: venue.description ?? undefined,
    photos: venue.photos ?? [],
    location:
      loc && typeof loc.lat === "number" && typeof loc.lng === "number"
        ? { lat: loc.lat, lng: loc.lng }
        : undefined,
    active: venue.active,
    followersCount: opts?.followersCount,
    isFollowing: opts?.isFollowing,
    createdAt: venue.createdAt.toISOString(),
    updatedAt: venue.updatedAt.toISOString(),
  };
}

export function serializePromotion(promo: PromotionDocument) {
  return {
    id: promo._id.toString(),
    venueId: promo.venueId.toString(),
    title: promo.title,
    description: promo.description,
    validUntil: promo.validUntil?.toISOString(),
    active: promo.active,
  };
}

export function serializePresence(
  presence: PresenceDocument,
  venue?: VenueDocument | null
) {
  return {
    id: presence._id.toString(),
    userId: refId(presence.userId),
    venueId: refId(presence.venueId),
    venue: venue ? serializeVenue(venue) : undefined,
    startsAt: presence.startsAt.toISOString(),
    endsAt: presence.endsAt ? presence.endsAt.toISOString() : null,
    status: presence.status,
  };
}

export { calcAge };

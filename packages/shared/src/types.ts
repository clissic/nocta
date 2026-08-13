import type {
  GENDERS,
  INTERESTS,
  LOOKING_FOR,
  OAUTH_PROVIDERS,
  VENUE_TYPES,
  WORK_STATUS,
} from "./constants.js";

export type LookingFor = (typeof LOOKING_FOR)[number];
export type Interest = (typeof INTERESTS)[number];
export type WorkStatus = (typeof WORK_STATUS)[number];
export type VenueType = (typeof VENUE_TYPES)[number];
export type Gender = (typeof GENDERS)[number];
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];
export type UserRole = "user" | "admin";
export type PresenceStatus = "active" | "expired" | "revoked";
export type SwipeDirection = "like" | "pass";

export interface UserProfile {
  name: string;
  birthDate: string;
  heightCm?: number;
  lookingFor: LookingFor[];
  photos: string[];
  bio?: string;
  interests: Interest[];
  workStatus?: WorkStatus;
  gender?: string;
  interestedIn?: string[];
}

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  profile: UserProfile | null;
  profileComplete: boolean;
}

export interface Venue {
  id: string;
  name: string;
  type: VenueType;
  address: string;
  city: string;
  description?: string;
  photos: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface PaginatedVenuesResponse {
  venues: Venue[];
  pagination: PaginationMeta;
}

export interface Promotion {
  id: string;
  venueId: string;
  title: string;
  description: string;
  validUntil?: string;
  active: boolean;
}

export interface Presence {
  id: string;
  userId: string;
  venueId: string;
  venue?: Venue;
  startsAt: string;
  endsAt: string | null;
  status: PresenceStatus;
}

export interface DiscoverCard {
  userId: string;
  profile: UserProfile;
  presenceId: string;
  age: number;
}

export interface MatchSummary {
  id: string;
  venueId: string;
  venueName?: string;
  otherUser: {
    id: string;
    name: string;
    photo?: string;
  };
  createdAt: string;
  lastMessage?: string;
}

export interface ChatMessage {
  id: string;
  matchId: string;
  senderId: string;
  body: string;
  createdAt: string;
}

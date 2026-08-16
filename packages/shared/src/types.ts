import type {
  FOLLOW_TARGET_TYPES,
  GENDERS,
  INTEREST_CATEGORIES,
  INTERESTS,
  LOOKING_FOR,
  OAUTH_PROVIDERS,
  REPORT_REASONS,
  SEXUAL_ORIENTATIONS,
  LANGUAGES,
  ZODIAC_SIGNS,
  EDUCATION_LEVELS,
  PETS,
  DRINKING,
  FITNESS,
  SOCIAL_NETWORKS,
  VENUE_REQUEST_STATUSES,
  PROMO_PURCHASE_STATUSES,
  ACTIVITY_TYPES,
  FOLLOW_REQUEST_STATUSES,
  VENUE_TYPES,
  WORK_STATUS,
} from "./constants.js";

export type LookingFor = (typeof LOOKING_FOR)[number];
export type Interest = (typeof INTERESTS)[number];
export type InterestCategoryId = (typeof INTEREST_CATEGORIES)[number]["id"];
export type WorkStatus = (typeof WORK_STATUS)[number];
export type SexualOrientation = (typeof SEXUAL_ORIENTATIONS)[number];
export type Language = (typeof LANGUAGES)[number];
export type ZodiacSign = (typeof ZODIAC_SIGNS)[number];
export type EducationLevel = (typeof EDUCATION_LEVELS)[number];
export type Pets = (typeof PETS)[number];
export type Drinking = (typeof DRINKING)[number];
export type Fitness = (typeof FITNESS)[number];
export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number];
export type VenueType = (typeof VENUE_TYPES)[number];
export type Gender = (typeof GENDERS)[number];
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];
export type FollowTargetType = (typeof FOLLOW_TARGET_TYPES)[number];
export type FollowRequestStatus = (typeof FOLLOW_REQUEST_STATUSES)[number];
export type VenueRequestStatus = (typeof VENUE_REQUEST_STATUSES)[number];
export type PromoPurchaseStatus = (typeof PROMO_PURCHASE_STATUSES)[number];
export type ActivityType = (typeof ACTIVITY_TYPES)[number];
export type ReportReason = (typeof REPORT_REASONS)[number];
export type ReportStatus = "open" | "reviewed" | "dismissed";
export type UserRole = "user" | "admin";
export type PresenceStatus = "active" | "expired" | "revoked";
export type SwipeDirection = "like" | "pass";

export interface ProfileLocation {
  /** País (ej. Uruguay). */
  country: string;
  /** Ciudad (ej. Montevideo). */
  city: string;
}

export type ProfileSocials = Partial<Record<SocialNetwork, string>>;

export interface UserProfile {
  name: string;
  birthDate?: string;
  heightCm?: number;
  lookingFor: LookingFor[]; // 0–1 ítems (una sola opción de búsqueda)
  photos: string[];
  bio?: string;
  interests: Interest[];
  workStatus?: WorkStatus;
  gender?: string;
  interestedIn?: string[];
  /** Dónde vive (pin geolocalizado). */
  livesIn?: ProfileLocation;
  sexualOrientation?: SexualOrientation;
  languages?: Language[];
  zodiac?: ZodiacSign;
  educationLevel?: EducationLevel;
  pets?: Pets;
  drinking?: Drinking;
  fitness?: Fitness;
  socials?: ProfileSocials;
  jobTitle?: string;
  company?: string;
  studiedAt?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  emailVerified: boolean;
  profile: UserProfile | null;
  profileComplete: boolean;
  /** Suscripción premium (MVP: flag; sin pagos aún). */
  premium: boolean;
  remainingLikes: number | null;
  likesRechargeAt: string | null;
  followersCount?: number;
  followingUsersCount?: number;
  followingVenuesCount?: number;
  /** Aceptar solicitudes de follow al instante (solo “me”). */
  autoAcceptFollowRequests: boolean;
  /** Ocultar mi actividad en el Muro a quienes me siguen (solo “me”). */
  hideActivityFromFollowers: boolean;
}

export interface VenueOwnerSummary {
  id: string;
  name: string;
  photo?: string;
}

export interface Venue {
  id: string;
  name: string;
  type: VenueType;
  address: string;
  city: string;
  description?: string;
  photos: string[];
  location?: {
    lat: number;
    lng: number;
  };
  active: boolean;
  ownerId?: string;
  owner?: VenueOwnerSummary;
  followersCount?: number;
  isFollowing?: boolean;
  /** Promedio de reseñas (1–5). */
  ratingAvg?: number;
  /** Cantidad de reseñas activas. */
  ratingCount?: number;
  /** Reseña del viewer autenticado (si existe). */
  myReview?: VenueReview;
  createdAt: string;
  updatedAt: string;
}

export interface VenueReviewAuthor {
  id: string;
  name: string;
  photo?: string;
}

/** Reseña de un usuario sobre un Espacio (rating + comentario + fotos). */
export interface VenueReview {
  id: string;
  venueId: string;
  userId: string;
  rating: number;
  body?: string;
  photos: string[];
  active: boolean;
  author?: VenueReviewAuthor;
  venueName?: string;
  venuePhoto?: string;
  createdAt: string;
  updatedAt: string;
}

/** Publicación propia en el Muro (visible para seguidores y el autor). */
export interface UserPost {
  id: string;
  authorId: string;
  venueId: string;
  body: string;
  photos: string[];
  active: boolean;
  venueName?: string;
  venuePhoto?: string;
  createdAt: string;
  updatedAt: string;
}

/** Ítem del timeline de actividad (personas seguidas + propias) en el Muro. */
export interface ActivityItem {
  id: string;
  type: ActivityType;
  createdAt: string;
  actor: {
    id: string;
    name: string;
    photo?: string;
  };
  venue?: {
    id: string;
    name: string;
    photo?: string;
  };
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

export interface VenueNews {
  id: string;
  venueId: string;
  title: string;
  body: string;
  photos: string[];
  publishedAt: string;
  active: boolean;
  venueName?: string;
  venuePhoto?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VenueRequest {
  id: string;
  requesterId: string;
  name: string;
  type: VenueType;
  /** Dirección pública escrita por el solicitante (para mostrar). */
  address: string;
  city: string;
  description?: string;
  photos: string[];
  contactEmail?: string;
  contactPhone?: string;
  location?: {
    lat: number;
    lng: number;
  };
  /** Dirección detectada por el mapa (geocoding inverso). */
  geocodedAddress?: string;
  status: VenueRequestStatus;
  adminNote?: string;
  reviewedBy?: string;
  venueId?: string;
  createdAt: string;
  updatedAt: string;
  requester?: {
    id: string;
    email: string;
    name?: string;
  };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface PaginatedReviewsResponse {
  reviews: VenueReview[];
  pagination: PaginationMeta;
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
  /** Precio de la promoción en pesos uruguayos (UYU). */
  priceUyu?: number;
  /** Inicio de vigencia (ISO UTC; anclado al día civil del organizador). */
  validFrom?: string;
  /** Fin de vigencia (ISO UTC; fin del día civil del organizador). */
  validUntil?: string;
  active: boolean;
  venueName?: string;
  venuePhoto?: string;
}

/** Promo comprada por el usuario (código QR para canjear en el Espacio). */
export interface PromoPurchase {
  id: string;
  venueId: string;
  promotionId: string;
  title: string;
  priceUyu?: number;
  /** Payload del QR (`nocta:promo:<id>:<code>`). */
  qrPayload: string;
  status: PromoPurchaseStatus;
  purchasedAt: string;
  validUntil?: string;
  redeemedAt?: string;
  venueName?: string;
  venuePhoto?: string;
}

export interface MuroFeedResponse {
  news: VenueNews[];
  promotions: Promotion[];
  /** Actividad propia y de personas que seguís (reseñas, follows, posts). */
  activity: ActivityItem[];
  /** Personas que seguís (para avatars del timeline). */
  followingUsers?: Array<{
    id: string;
    name: string;
    photo?: string;
  }>;
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
  /** Viewer ya sigue a esta persona. */
  isFollowing?: boolean;
  /** Viewer tiene una solicitud pendiente hacia esta persona. */
  isFollowRequested?: boolean;
}

/** Solicitud de follow entre usuarios (pendiente de aceptar/rechazar). */
export interface FollowRequestItem {
  id: string;
  status: FollowRequestStatus;
  createdAt: string;
  fromUser: {
    id: string;
    name: string;
    photo?: string;
    age?: number;
  };
}

/** Vista mínima del perfil (solicitudes, seguidores, seguidos). */
export interface FollowRequestProfile {
  id: string;
  name: string;
  age: number;
  photo?: string;
  heightCm?: number;
  livesIn?: ProfileLocation;
  socials?: ProfileSocials;
}

/** Usuario resumido para las listas de seguidores y seguidos. */
export interface FollowListUser {
  id: string;
  name: string;
  age: number;
  photo?: string;
  isFollowing?: boolean;
  isFollower?: boolean;
}

export interface LikeAllowance {
  remainingLikes: number | null;
  limit: number | null;
  rechargeAt: string | null;
  unlimited: boolean;
}

export interface DiscoverFeedResponse {
  venueId: string;
  cards: DiscoverCard[];
  likeAllowance: LikeAllowance;
}

export interface DiscoverSwipeResponse {
  ok: true;
  match: { id: string } | null;
  likeAllowance: LikeAllowance;
}

export interface DiscoverRewindResponse {
  ok: true;
  card: DiscoverCard | null;
  likeAllowance: LikeAllowance;
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
  lastMessage?: {
    body: string;
    createdAt: string;
    fromUserId: string;
  };
}

export interface ChatMessage {
  id: string;
  matchId: string;
  senderId: string;
  body: string;
  createdAt: string;
}

export interface AdminStats {
  users: number;
  venues: number;
  activePresences: number;
  matches: number;
  pendingVenueRequests: number;
}

export interface AdminReport {
  id: string;
  reason: ReportReason;
  details?: string;
  status: ReportStatus;
  createdAt: string;
  matchId?: string;
  reporter: {
    id: string;
    name: string;
  };
  reportedUser: {
    id: string;
    name: string;
  };
}

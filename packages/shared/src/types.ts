import type {
  FOLLOW_TARGET_TYPES,
  GENDERS,
  INTEREST_CATEGORIES,
  INTERESTS,
  LOOKING_FOR,
  OAUTH_PROVIDERS,
  REPORT_REASONS,
  SUSPENSION_DURATIONS,
  SEXUAL_ORIENTATIONS,
  LANGUAGES,
  ZODIAC_SIGNS,
  EDUCATION_LEVELS,
  PETS,
  DRINKING,
  FITNESS,
  SOCIAL_NETWORKS,
  VENUE_REQUEST_STATUSES,
  VENUE_REQUEST_TYPES,
  VENUE_REQUEST_REJECT_REASONS,
  PROMO_PURCHASE_STATUSES,
  PREMIUM_PLAN_IDS,
  PREMIUM_PERIOD_MONTHS,
  PREMIUM_PURCHASE_STATUSES,
  PREMIUM_SUBSCRIPTION_STATUSES,
  ACTIVITY_TYPES,
  FOLLOW_REQUEST_STATUSES,
  VENUE_TYPES,
  WORK_STATUS,
  IDENTITY_VERIFICATION_STATUSES,
  NOTIFICATION_TYPES,
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
export type VenueRequestType = (typeof VENUE_REQUEST_TYPES)[number];
export type VenueRequestRejectReason =
  (typeof VENUE_REQUEST_REJECT_REASONS)[number];
export type PromoPurchaseStatus = (typeof PROMO_PURCHASE_STATUSES)[number];
export type PremiumPlanId = (typeof PREMIUM_PLAN_IDS)[number];
export type PremiumPeriodMonths = (typeof PREMIUM_PERIOD_MONTHS)[number];
export type PremiumPurchaseStatus = (typeof PREMIUM_PURCHASE_STATUSES)[number];
export type PremiumSubscriptionStatus =
  (typeof PREMIUM_SUBSCRIPTION_STATUSES)[number];
export type ActivityType = (typeof ACTIVITY_TYPES)[number];
export type ReportReason = (typeof REPORT_REASONS)[number];
export type ReportStatus = "open" | "reviewed" | "dismissed";
export type ReportSource = "profile" | "match";
export type ReportResolutionAction = "dismiss" | "suspend";
export type SuspensionDuration = (typeof SUSPENSION_DURATIONS)[number];
export type ModerationStatus = "active" | "suspended";
export type UserRole = "user" | "admin";
export type IdentityVerificationStatus =
  (typeof IDENTITY_VERIFICATION_STATUSES)[number];
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
  /** Suscripción premium activa (sincronizada con premiumExpiresAt). */
  premium: boolean;
  premiumPlanId?: PremiumPlanId;
  premiumExpiresAt?: string | null;
  /** Periodicidad de cobro recurrente (1/3/6/12 meses). */
  premiumPeriodMonths?: PremiumPeriodMonths;
  /** Estado de la suscripción Mercado Pago. */
  premiumSubscriptionStatus?: PremiumSubscriptionStatus;
  /** Si true, no se renueva; el acceso sigue hasta premiumExpiresAt. */
  premiumCancelAtPeriodEnd?: boolean;
  /** Próximo cobro estimado (ISO), si la suscripción está autorizada. */
  premiumNextPaymentAt?: string | null;
  /** Cupos Boost restantes (4 AM+). */
  boostsRemaining: number;
  /** Cupos Heartshot restantes (4 AM+). */
  heartshotsRemaining: number;
  /** Fin del Boost activo (ISO), si hay uno en curso. */
  boostExpiresAt?: string | null;
  /** Modo pícaro: solo te ven quienes te dieron like (requiere Premium). */
  rogueMode: boolean;
  /** Modo Teleport: explorar Espacios de otra ciudad (requiere Premium). */
  teleportMode: boolean;
  /** Modo espía: siempre activo con plan 6 AM (no se puede desactivar). */
  spyMode: boolean;
  /**
   * Si true, Discover está desactivado: no puede publicarse en Espacios.
   */
  discoverDisabled: boolean;
  /** Ciudad Teleport activa (pin + ciudad resuelta del catálogo). */
  teleportCity?: {
    country: string;
    city: string;
    lat: number;
    lng: number;
  };
  remainingLikes: number | null;
  likesRechargeAt: string | null;
  followersCount?: number;
  followingUsersCount?: number;
  followingVenuesCount?: number;
  /** Aceptar solicitudes de follow al instante (solo “me”). */
  autoAcceptFollowRequests: boolean;
  /** Si true, quienes me siguen pueden ver mi actividad (solo “me”; default false al crear). */
  showActivityToFollowers: boolean;
  /** Opt-in a emails promocionales (solo “me”; default false). */
  marketingEmailsOptIn: boolean;
  /** Cuenta con verificación de identidad aprobada. */
  identityVerified: boolean;
  /** Estado de la solicitud (solo “me”). */
  identityVerification?: {
    status: IdentityVerificationStatus;
    rejectionReason?: string;
    submittedAt?: string;
  };
  moderationStatus: ModerationStatus;
  suspension?: {
    suspendedAt: string;
    suspendedUntil?: string;
    duration: SuspensionDuration;
  };
  /** ISO si la cuenta está en período de recuperación (30 días). */
  deletionRequestedAt?: string | null;
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
  country: string;
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
  /** Personas publicadas ahora (solo con Modo espía activo). */
  livePublishedCount?: number;
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
  requestType: VenueRequestType;
  targetVenueId?: string;
  wantsToManage: boolean;
  managementMessage?: string;
  name: string;
  type: VenueType;
  /** Dirección pública escrita por el solicitante (para mostrar). */
  address: string;
  country: string;
  city: string;
  description?: string;
  photos: string[];
  evidenceFiles: Array<{
    id: string;
    originalName: string;
    mimeType: string;
    size: number;
  }>;
  contactEmail?: string;
  contactPhone?: string;
  location?: {
    lat: number;
    lng: number;
  };
  /** Dirección detectada por el mapa (geocoding inverso). */
  geocodedAddress?: string;
  status: VenueRequestStatus;
  rejectionReason?: VenueRequestRejectReason;
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
  kind?: "profile";
  userId: string;
  profile: UserProfile;
  presenceId: string;
  age: number;
  /** Cuenta con verificación de identidad aprobada. */
  identityVerified?: boolean;
  /** Viewer ya sigue a esta persona. */
  isFollowing?: boolean;
  /** Viewer tiene una solicitud pendiente hacia esta persona. */
  isFollowRequested?: boolean;
}

/** Anuncio insertado en el deck de Discover (usuarios free). */
export interface DiscoverAdCard {
  kind: "ad";
  id: string;
  title: string;
  subtitle?: string;
  body?: string;
  imageUrl: string;
  ctaLabel: string;
  /** Ruta in-app del landing (`/ads/:id`). */
  href: string;
  sponsorName?: string;
}

export type DiscoverDeckItem = DiscoverCard | DiscoverAdCard;

export function isDiscoverAdCard(
  item: DiscoverDeckItem
): item is DiscoverAdCard {
  return item.kind === "ad";
}

/** Detalle público de un anuncio (landing). */
export interface AdDetail {
  id: string;
  title: string;
  subtitle?: string;
  body?: string;
  imageUrl: string;
  ctaLabel: string;
  ctaUrl: string;
  sponsorName?: string;
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

export interface BlockedUser {
  id: string;
  name: string;
  photo?: string;
  blockedAt: string;
}

/** Resultado de una denuncia propio (solo el denunciante). */
export interface MyReportResolution {
  id: string;
  reason: ReportReason;
  details?: string;
  status: ReportStatus;
  source: ReportSource;
  createdAt: string;
  resolution?: {
    action: ReportResolutionAction;
    reason?: string;
    duration?: SuspensionDuration;
    suspendedUntil?: string;
    resolvedAt: string;
  };
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

/** Like recibido (alguien te dio like y todavía no respondiste). */
export interface ReceivedLike {
  id: string;
  createdAt: string;
  venueId: string;
  venueName?: string;
  user: {
    /** Solo si `canSeeLikes` / Heartshot; sin eso no se revela identidad técnica. */
    id?: string;
    /** Solo si `canSeeLikes` / Heartshot; sin eso el cliente muestra un placeholder. */
    name?: string;
    age: number;
    /** Solo si `canSeeLikes` / Heartshot; sin eso la API no envía URL de foto. */
    photo?: string;
  };
  /** Podés responder el like porque tenés presencia activa en ese Espacio. */
  canRespond: boolean;
  /** Heartshot: identidad revelada aunque no seas Premium. */
  isHeartshot?: boolean;
}

export interface ReceivedLikesResponse {
  likes: ReceivedLike[];
  /** Premium activo (cualquier plan). */
  viewerPremium: boolean;
  /** Puede ver identidad de likes normales (plan 4 AM+ con see_likes). */
  canSeeLikes: boolean;
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

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body?: string;
  href?: string;
  data: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationsResponse {
  notifications: NotificationItem[];
  nextCursor: string | null;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface NotificationsUnreadResponse {
  count: number;
}

export interface AdminStats {
  users: number;
  admins: number;
  venues: number;
  ownerlessVenues: number;
  activePresences: number;
  matches: number;
  pendingVenueRequests: number;
  openReports: number;
  promoPurchases: number;
  promoRevenueUyu: number;
  /** Suscriptores Premium activos (expiry futuro o sin expiry). */
  premiumActive: number;
  /** Conteos por planId entre Premium activos. */
  premiumByPlan: Partial<Record<PremiumPlanId, number>>;
  /** Cobros Premium aprobados (histórico). */
  premiumPurchasesApproved: number;
  /** Suma amount de cobros Premium aprobados (moneda del catálogo, tip. USD). */
  premiumRevenueUsd: number;
}

/** Serie mensual alineada con `AdminOverviewResponse.months` (12 valores). */
export type AdminMonthlySeries = number[];

export interface AdminOverviewNamedStat {
  id?: string;
  name: string;
  value: number;
}

export interface AdminOverviewUsersTab {
  cards: {
    users: number;
    admins: number;
    matches: number;
    openReports: number;
    premiumActive: number;
  };
  /** Cobros Premium aprobados por mes, por plan. */
  premiumByPlanMonthly: Record<PremiumPlanId, AdminMonthlySeries>;
  /** Usuarios totales acumulados al cierre de cada mes. */
  usersCumulativeMonthly: AdminMonthlySeries;
}

export interface AdminOverviewVenuesTab {
  cards: {
    venues: number;
    ownerlessVenues: number;
    activePresences: number;
    bestRated: AdminOverviewNamedStat | null;
    worstRated: AdminOverviewNamedStat | null;
  };
  presencesMonthly: AdminMonthlySeries;
  /** Promedio de rating de reseñas activas creadas ese mes (0 si no hay). */
  ratingsAvgMonthly: AdminMonthlySeries;
}

export interface AdminOverviewRequestsTab {
  cards: {
    pending: number;
    approved: number;
    rejected: number;
  };
  requestsMonthly: AdminMonthlySeries;
  manageMonthly: AdminMonthlySeries;
  suggestMonthly: AdminMonthlySeries;
}

export interface AdminOverviewTransactionsTab {
  cards: {
    promoRevenueUyu: number;
    promoPurchases: number;
    premiumRevenueUsd: number;
    premiumPurchasesApproved: number;
    /**
     * Ganancias totales en USD:
     * premiumUsd + (promoUyu / ADMIN_OVERVIEW_USD_UYU_RATE).
     */
    totalRevenueUsd: number;
  };
  revenueMonthly: {
    promoUyu: AdminMonthlySeries;
    premiumUsd: AdminMonthlySeries;
    /** Suma mensual en USD con el mismo tipo de cambio fijo. */
    totalUsd: AdminMonthlySeries;
  };
  transactionsMonthly: AdminMonthlySeries;
}

export interface AdminOverviewCitiesTab {
  cards: {
    activeCountries: number;
    activeCities: number;
    inactiveCountries: number;
    inactiveCities: number;
    topCountryByVenues: AdminOverviewNamedStat | null;
  };
  venuesByCountry: AdminOverviewNamedStat[];
}

export interface AdminOverviewResponse {
  /** Claves `YYYY-MM` de los últimos 12 meses (más antiguo → actual). */
  months: string[];
  users: AdminOverviewUsersTab;
  venues: AdminOverviewVenuesTab;
  requests: AdminOverviewRequestsTab;
  transactions: AdminOverviewTransactionsTab;
  cities: AdminOverviewCitiesTab;
}

export interface AdminPromoPurchase {
  id: string;
  title: string;
  priceUyu?: number;
  status: PromoPurchaseStatus;
  purchasedAt: string;
  redeemedAt?: string;
  validUntil?: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
  venue: {
    id: string;
    name: string;
  };
  promotion: {
    id: string;
    title: string;
  };
}

export interface AdminPromoPurchasesResponse {
  purchases: AdminPromoPurchase[];
  pagination: PaginationMeta;
}

export interface AdminPremiumPurchase {
  id: string;
  planId: PremiumPlanId;
  planName: string;
  periodMonths: PremiumPeriodMonths;
  periodLabel: string;
  amount: number;
  currency: string;
  status: PremiumPurchaseStatus;
  kind?: "subscription" | "charge";
  createdAt: string;
  startsAt?: string;
  endsAt?: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export interface AdminPremiumPurchasesResponse {
  purchases: AdminPremiumPurchase[];
  pagination: PaginationMeta;
}

export interface AdminAuditEventItem {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  meta?: Record<string, unknown>;
  createdAt: string;
  actor: {
    id: string;
    name: string;
    email: string;
  };
}

export interface AdminAuditEventsResponse {
  events: AdminAuditEventItem[];
  pagination: PaginationMeta;
}

export interface AdminReport {
  id: string;
  reason: ReportReason;
  details?: string;
  status: ReportStatus;
  source: ReportSource;
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
  resolution?: {
    action: "dismiss" | "suspend";
    reason?: string;
    duration?: SuspensionDuration;
    suspendedUntil?: string;
    resolvedAt: string;
    resolvedBy: string;
  };
}

/** Solicitud de verificación de identidad (panel admin). */
export interface AdminIdentityVerification {
  userId: string;
  email: string;
  name: string;
  photo?: string;
  status: Exclude<IdentityVerificationStatus, "none">;
  submittedAt?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  hasDocumentFront: boolean;
  hasSelfie: boolean;
}

/** Ciudad del catálogo de proximidad / Espacios. */
export interface AppCity {
  id: string;
  country: string;
  name: string;
  lat: number;
  lng: number;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

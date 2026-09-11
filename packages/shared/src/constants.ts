export const LOOKING_FOR = [
  "citas",
  "relacion",
  "encuentros_casuales",
  "amigos",
  "networking",
] as const;

/** Gustos agrupados para UI; `INTERESTS` queda plano para API/DB. */
export const INTEREST_CATEGORIES = [
  {
    id: "comunicacion",
    label: "Comunicación",
    interests: [
      "por_mensaje",
      "por_llamada",
      "cara_a_cara",
      "videollamada",
      "audios_largos",
      "memes_y_reacciones",
      "chat_nocturno",
      "cartas_digitales",
    ],
  },
  {
    id: "musica",
    label: "Música",
    interests: [
      "musica_electronica",
      "reggaeton",
      "rock",
      "indie",
      "hip_hop",
      "latina",
      "techno",
      "house",
      "pop",
      "trap",
      "jazz",
      "live_sets",
    ],
  },
  {
    id: "noche",
    label: "Noche & baile",
    interests: [
      "baile",
      "after_hours",
      "karaoke",
      "rooftop",
      "pista_cerrada",
      "sunset_sessions",
    ],
  },
  {
    id: "tragos_y_mesa",
    label: "Tragos & mesa",
    interests: [
      "cocktails",
      "cerveza_artesanal",
      "vino",
      "gastronomia",
      "cafe_de_especialidad",
      "mocktails",
      "brindis_largo",
    ],
  },
  {
    id: "planes",
    label: "Planes",
    interests: [
      "viajes",
      "cine",
      "fitness",
      "gaming",
      "escape_rooms",
      "conciertos_en_vivo",
      "amanecer",
      "caminatas_nocturnas",
    ],
  },
  {
    id: "estilo",
    label: "Estilo & cultura",
    interests: [
      "fotografia",
      "arte",
      "moda",
      "streetwear",
      "vinilos",
      "podcasts",
    ],
  },
  {
    id: "vibes",
    label: "Vibes de match",
    interests: [
      "humor_seco",
      "deep_talks",
      "plan_espontaneo",
      "citas_largas",
      "solo_buena_onda",
      "quimica_inmediata",
      "sarcasmo_fino",
      "energy_match",
    ],
  },
] as const;

export const INTERESTS = [
  "por_mensaje",
  "por_llamada",
  "cara_a_cara",
  "videollamada",
  "audios_largos",
  "memes_y_reacciones",
  "chat_nocturno",
  "cartas_digitales",
  "musica_electronica",
  "reggaeton",
  "rock",
  "indie",
  "hip_hop",
  "latina",
  "techno",
  "house",
  "pop",
  "trap",
  "jazz",
  "live_sets",
  "baile",
  "after_hours",
  "karaoke",
  "rooftop",
  "pista_cerrada",
  "sunset_sessions",
  "cocktails",
  "cerveza_artesanal",
  "vino",
  "gastronomia",
  "cafe_de_especialidad",
  "mocktails",
  "brindis_largo",
  "viajes",
  "cine",
  "fitness",
  "gaming",
  "escape_rooms",
  "conciertos_en_vivo",
  "amanecer",
  "caminatas_nocturnas",
  "fotografia",
  "arte",
  "moda",
  "streetwear",
  "vinilos",
  "podcasts",
  "humor_seco",
  "deep_talks",
  "plan_espontaneo",
  "citas_largas",
  "solo_buena_onda",
  "quimica_inmediata",
  "sarcasmo_fino",
  "energy_match",
] as const;

export const WORK_STATUS = [
  "estudiante",
  "empleado",
  "freelance",
  "emprendedor",
  "buscando",
  "otro",
] as const;

export const SEXUAL_ORIENTATIONS = [
  "heterosexual",
  "gay",
  "lesbiana",
  "bisexual",
  "pansexual",
  "asexual",
  "queer",
  "en_duda",
  "otro",
] as const;

export const LANGUAGES = [
  "espanol",
  "ingles",
  "portugues",
  "frances",
  "italiano",
  "aleman",
  "chino",
  "japones",
  "coreano",
  "otro",
] as const;

export const ZODIAC_SIGNS = [
  "aries",
  "tauro",
  "geminis",
  "cancer",
  "leo",
  "virgo",
  "libra",
  "escorpion",
  "sagitario",
  "capricornio",
  "acuario",
  "piscis",
] as const;

export const EDUCATION_LEVELS = [
  "secundaria",
  "terciario",
  "universitario",
  "posgrado",
  "autodidacta",
  "otro",
] as const;

export const PETS = [
  "perro",
  "gato",
  "perro_y_gato",
  "otras",
  "quiero_tener",
  "no_tengo",
  "alergico",
] as const;

export const DRINKING = [
  "social",
  "frecuentemente",
  "ocasiones",
  "no_tomo",
] as const;

export const FITNESS = [
  "activo",
  "gym_regular",
  "deporte",
  "a_veces",
  "poco_activo",
  "no_es_prioridad",
] as const;

export const SOCIAL_NETWORKS = [
  "instagram",
  "tiktok",
  "x",
  "facebook",
  "linkedin",
] as const;

export const VENUE_TYPES = [
  "boliche",
  "bar",
  "pub",
  "cerveceria",
  "concierto",
  "festival",
  "fiesta_privada",
] as const;

export const GENDERS = ["mujer", "hombre", "no_binario", "otro"] as const;

export const PRESENCE_PRESETS = [
  { label: "24 horas", hours: 24 },
  { label: "48 horas", hours: 48 },
  { label: "1 semana", hours: 168 },
  { label: "Permanente", hours: null },
] as const;

export const MIN_PHOTOS = 1;
export const MAX_PHOTOS = 10;
export const MIN_AGE = 16;
export const MAX_AGE = 99;
export const DAILY_LIKE_LIMIT = 50;
export const LIKE_RECHARGE_HOURS = 8;

/** Planes Premium (2 / 4 / 6 A.M. vendibles). */
export const PREMIUM_PLAN_IDS = ["nocta_2am", "nocta_4am", "nocta_6am"] as const;

/**
 * Tipo de cambio fijo UYU por 1 USD para unificar Ganancias totales del Resumen admin.
 * Promos se cotizan en UYU; Premium en USD.
 */
export const ADMIN_OVERVIEW_USD_UYU_RATE = 39;

export const PREMIUM_PERIOD_MONTHS = [1, 3, 6, 12] as const;

export const PREMIUM_PERIOD_LABELS: Record<
  (typeof PREMIUM_PERIOD_MONTHS)[number],
  string
> = {
  1: "Mensual",
  3: "Trimestral",
  6: "Semestral",
  12: "Anual",
};

/** Precios base (Nocta 2 A.M.). */
export const PREMIUM_PERIOD_PRICES_USD: Record<
  (typeof PREMIUM_PERIOD_MONTHS)[number],
  number
> = {
  1: 12,
  3: 32,
  6: 57,
  12: 100,
};

/** Precios Nocta 4 A.M. (+20% vs 2 AM, redondeado). */
export const PREMIUM_4AM_PERIOD_PRICES_USD: Record<
  (typeof PREMIUM_PERIOD_MONTHS)[number],
  number
> = {
  1: 14,
  3: 38,
  6: 68,
  12: 120,
};

/** Precios Nocta 6 A.M. (+20% vs 4 AM, redondeado). */
export const PREMIUM_6AM_PERIOD_PRICES_USD: Record<
  (typeof PREMIUM_PERIOD_MONTHS)[number],
  number
> = {
  1: 17,
  3: 46,
  6: 82,
  12: 144,
};

/** Cupos mensuales Boost / Heartshot por plan. */
export const BOOST_MONTHLY_ALLOWANCE = 1;
export const BOOST_MONTHLY_ALLOWANCE_6AM = 3;
export const HEARTSHOT_MONTHLY_ALLOWANCE = 8;
export const HEARTSHOT_MONTHLY_ALLOWANCE_6AM = 12;
export const BOOST_DURATION_MS = 30 * 60 * 1000;
/** Intervalo entre cargasargas de Boost/Heartshot (días). */
export const PREMIUM_ALLOWANCE_CYCLE_DAYS = 30;

/** Cada cuántos swipes (inclusive) aparece un anuncio en Discover (usuarios free). */
export const AD_SWIPE_INTERVAL_MIN = 7;
export const AD_SWIPE_INTERVAL_MAX = 10;

/** Presencias activas simultáneas (Clone / teleport_plus = 3). */
export const MAX_ACTIVE_PRESENCES_DEFAULT = 1;
export const MAX_ACTIVE_PRESENCES_TELEPORT_PLUS = 3;

export const PREMIUM_PURCHASE_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "refunded",
] as const;

/** Estado de la suscripción recurrente en Mercado Pago / producto. */
export const PREMIUM_SUBSCRIPTION_STATUSES = [
  "none",
  "pending",
  "authorized",
  "paused",
  "cancelled",
] as const;

export type PremiumFeatureId =
  | "unlimited_likes"
  | "rewind"
  | "see_likes"
  | "teleport"
  | "rogue_mode"
  | "no_ads"
  | "boost"
  | "heartshot"
  | "spy_mode"
  | "teleport_plus";

/** Beneficios que el dashboard siempre lista (incl. deshabilitados en planes inferiores). */
export const PREMIUM_DASHBOARD_FEATURE_IDS: PremiumFeatureId[] = [
  "unlimited_likes",
  "rewind",
  "no_ads",
  "teleport",
  "rogue_mode",
  "see_likes",
  "boost",
  "heartshot",
  "spy_mode",
  "teleport_plus",
];

export const PREMIUM_FEATURE_COPY: Record<
  PremiumFeatureId,
  { label: string; description: string }
> = {
  unlimited_likes: {
    label: "Likes ilimitados",
    description: "Demostrá gusto sin límite",
  },
  rewind: {
    label: "Retroceder cuando quieras",
    description: "Deshacé el último swipe",
  },
  see_likes: {
    label: "Ver quién te dio like",
    description: "Conocé quién ya te eligió",
  },
  teleport: {
    label: "Modo Teleport",
    description: "Explorá Espacios de otras ciudades",
  },
  rogue_mode: {
    label: "Modo pícaro",
    description: "Solo te ven si les diste like",
  },
  no_ads: {
    label: "Sin anuncios",
    description: "Noche limpia, sin interrupciones",
  },
  boost: {
    label: "Boost",
    description: "Prioridad de aparición en Discover",
  },
  heartshot: {
    label: "Heartshot",
    description: "Like que revela quién sos",
  },
  spy_mode: {
    label: "Modo espía",
    description: "Ves cuántas personas hay publicadas en cada Espacio (siempre activo en 6 A.M.)",
  },
  teleport_plus: {
    label: "Clone",
    description: "Publicate en hasta 3 Espacios a la vez",
  },
};

const PLAN_2AM_FEATURES: PremiumFeatureId[] = [
  "unlimited_likes",
  "rewind",
  "teleport",
  "rogue_mode",
  "no_ads",
];

const PLAN_4AM_FEATURES: PremiumFeatureId[] = [
  ...PLAN_2AM_FEATURES,
  "see_likes",
  "boost",
  "heartshot",
];

const PLAN_6AM_FEATURES: PremiumFeatureId[] = [
  ...PLAN_4AM_FEATURES,
  "spy_mode",
  "teleport_plus",
];

export const PREMIUM_PLANS: Array<{
  id: (typeof PREMIUM_PLAN_IDS)[number];
  name: string;
  tagline: string;
  comingSoon: boolean;
  features: PremiumFeatureId[];
  /** @deprecated Preferir features + PREMIUM_FEATURE_COPY; se mantiene para listas simples. */
  featureLabels: string[];
}> = [
  {
    id: "nocta_2am",
    name: "Nocta 2 A.M.",
    tagline: "La noche recién arranca",
    comingSoon: false,
    features: PLAN_2AM_FEATURES,
    featureLabels: PLAN_2AM_FEATURES.map((id) => PREMIUM_FEATURE_COPY[id].label),
  },
  {
    id: "nocta_4am",
    name: "Nocta 4 A.M.",
    tagline: "Cuando la noche pide más",
    comingSoon: false,
    features: PLAN_4AM_FEATURES,
    featureLabels: PLAN_4AM_FEATURES.map((id) => PREMIUM_FEATURE_COPY[id].label),
  },
  {
    id: "nocta_6am",
    name: "Nocta 6 A.M.",
    tagline: "Hasta que salga el sol",
    comingSoon: false,
    features: PLAN_6AM_FEATURES,
    featureLabels: PLAN_6AM_FEATURES.map((id) => PREMIUM_FEATURE_COPY[id].label),
  },
];

export function premiumFeatureItems(features: PremiumFeatureId[]) {
  return features.map((id) => ({
    id,
    label: PREMIUM_FEATURE_COPY[id].label,
    description: PREMIUM_FEATURE_COPY[id].description,
  }));
}

/** Lista de beneficios para dashboard: incluidos o bloqueados según el plan. */
export function premiumDashboardFeatureItems(planId?: string | null) {
  const plan = planId ? getPremiumPlan(planId) : undefined;
  const included = new Set(plan?.features ?? []);
  return PREMIUM_DASHBOARD_FEATURE_IDS.map((id) => {
    let description = PREMIUM_FEATURE_COPY[id].description;
    if (id === "boost" && included.has("boost")) {
      const n = monthlyBoostAllowance(planId);
      description = `Prioridad en Discover (${n} por mes)`;
    }
    if (id === "heartshot" && included.has("heartshot")) {
      const n = monthlyHeartshotAllowance(planId);
      description = `Like que revela quién sos (${n} por mes)`;
    }
    return {
      id,
      label: PREMIUM_FEATURE_COPY[id].label,
      description,
      included: included.has(id),
    };
  });
}

export function planHasFeature(
  planId: string | null | undefined,
  feature: PremiumFeatureId
) {
  const plan = planId ? getPremiumPlan(planId) : undefined;
  return Boolean(plan?.features.includes(feature));
}

export function monthlyBoostAllowance(planId?: string | null) {
  if (planId === "nocta_6am") return BOOST_MONTHLY_ALLOWANCE_6AM;
  return BOOST_MONTHLY_ALLOWANCE;
}

export function monthlyHeartshotAllowance(planId?: string | null) {
  if (planId === "nocta_6am") return HEARTSHOT_MONTHLY_ALLOWANCE_6AM;
  return HEARTSHOT_MONTHLY_ALLOWANCE;
}

export function maxActivePresencesForPlan(planId?: string | null) {
  if (planHasFeature(planId, "teleport_plus")) {
    return MAX_ACTIVE_PRESENCES_TELEPORT_PLUS;
  }
  return MAX_ACTIVE_PRESENCES_DEFAULT;
}

export function premiumPeriodPriceUsd(
  months: (typeof PREMIUM_PERIOD_MONTHS)[number],
  planId: string = "nocta_2am"
) {
  if (planId === "nocta_6am") {
    return PREMIUM_6AM_PERIOD_PRICES_USD[months];
  }
  if (planId === "nocta_4am") {
    return PREMIUM_4AM_PERIOD_PRICES_USD[months];
  }
  return PREMIUM_PERIOD_PRICES_USD[months];
}

export function premiumPeriodLabel(
  months: (typeof PREMIUM_PERIOD_MONTHS)[number]
) {
  return PREMIUM_PERIOD_LABELS[months];
}

/** Precio “lleno” = precio 1 mes × meses (base para % de ahorro). */
export function premiumPeriodFullPriceUsd(
  months: (typeof PREMIUM_PERIOD_MONTHS)[number],
  planId: string = "nocta_2am"
) {
  return premiumPeriodPriceUsd(1, planId) * months;
}

/** % de ahorro vs precio mes a mes; redondeado al entero más cercano (0 si 1 mes). */
export function premiumPeriodSavingsPercent(
  months: (typeof PREMIUM_PERIOD_MONTHS)[number],
  planId: string = "nocta_2am"
) {
  if (months === 1) return 0;
  const full = premiumPeriodFullPriceUsd(months, planId);
  const price = premiumPeriodPriceUsd(months, planId);
  return Math.round(((full - price) / full) * 100);
}

export function boostAllowanceForPeriod(
  periodMonths: number,
  planId?: string | null
) {
  return monthlyBoostAllowance(planId) * Math.max(1, periodMonths);
}

export function heartshotAllowanceForPeriod(
  periodMonths: number,
  planId?: string | null
) {
  return monthlyHeartshotAllowance(planId) * Math.max(1, periodMonths);
}

export function getPremiumPlan(id: string) {
  return PREMIUM_PLANS.find((plan) => plan.id === id);
}

/** Orden de planes (mayor = más alto). */
export function premiumPlanRank(planId?: string | null) {
  const idx = PREMIUM_PLAN_IDS.indexOf(
    planId as (typeof PREMIUM_PLAN_IDS)[number]
  );
  return idx >= 0 ? idx : -1;
}

/** True si `candidatePlanId` es inferior al plan actual. */
export function isPremiumPlanDowngrade(
  currentPlanId?: string | null,
  candidatePlanId?: string | null
) {
  const current = premiumPlanRank(currentPlanId);
  const candidate = premiumPlanRank(candidatePlanId);
  return current >= 0 && candidate >= 0 && candidate < current;
}

export const MAX_PHOTO_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_PHOTO_UPLOAD_FILES = 6;
export const ALLOWED_PHOTO_MIME_TYPES = [
  "image/jpeg", "image/jpg", "image/png", "image/webp",
  "image/avif", "image/heic", "image/heif",
] as const;
export const ALLOWED_PHOTO_EXTENSIONS = [
  ".jpg", ".jpeg", ".png", ".webp", ".avif", ".heic", ".heif",
] as const;

export const MIN_PASSWORD_LENGTH = 9;
export const PASSWORD_HINT =
  "Al menos 9 caracteres, 1 mayúscula y 1 carácter especial";
export const PASSWORD_RULES = [
  {
    id: "length",
    label: `Al menos ${MIN_PASSWORD_LENGTH} caracteres`,
    test: (password: string) => password.length >= MIN_PASSWORD_LENGTH,
  },
  {
    id: "upper",
    label: "Al menos 1 mayúscula",
    test: (password: string) => /[A-Z]/.test(password),
  },
  {
    id: "special",
    label: "Al menos 1 carácter especial",
    test: (password: string) => /[^A-Za-z0-9]/.test(password),
  },
] as const;

export function isStrongPassword(password: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(password));
}

export const FOLLOW_TARGET_TYPES = ["user", "venue"] as const;

export const FOLLOW_REQUEST_STATUSES = [
  "pending",
  "accepted",
  "rejected",
] as const;

export const VENUE_REQUEST_STATUSES = [
  "pending",
  "approved",
  "rejected",
] as const;

export const VENUE_REQUEST_TYPES = ["create", "claim"] as const;

/** Motivos predefinidos al rechazar una solicitud de Espacio. */
export const VENUE_REQUEST_REJECT_REASONS = [
  "incomplete_data",
  "duplicate_venue",
  "not_suitable",
  "location_unverifiable",
  "other",
] as const;

export const VENUE_REQUEST_REJECT_REASON_LABELS: Record<
  (typeof VENUE_REQUEST_REJECT_REASONS)[number],
  string
> = {
  incomplete_data: "Datos incompletos o incorrectos",
  duplicate_venue: "Espacio duplicado",
  not_suitable: "No corresponde a Nocta",
  location_unverifiable: "Ubicación no verificable",
  other: "Otro",
};

export const MAX_VENUE_CLAIM_FILES = 3;
export const MAX_VENUE_CLAIM_FILE_BYTES = 2 * 1024 * 1024;
export const VENUE_CLAIM_FILE_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export const VENUE_CLAIM_FILE_EXTENSIONS = [
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
] as const;

/** Verificación de identidad (DNI/pasaporte + selfie). */
export const IDENTITY_VERIFICATION_STATUSES = [
  "none",
  "pending",
  "approved",
  "rejected",
] as const;

export const IDENTITY_VERIFICATION_STATUS_LABELS: Record<
  (typeof IDENTITY_VERIFICATION_STATUSES)[number],
  string
> = {
  none: "Sin solicitud",
  pending: "Pendiente",
  approved: "Aprobada",
  rejected: "Rechazada",
};

export const MAX_IDENTITY_VERIFICATION_FILE_BYTES = 2 * 1024 * 1024;
export const IDENTITY_VERIFICATION_FILE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export const IDENTITY_VERIFICATION_FILE_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
] as const;

/** Estado de una promo comprada (QR). */
export const PROMO_PURCHASE_STATUSES = [
  "valid",
  "redeemed",
  "expired",
  "refunded",
] as const;

export const PROMO_PURCHASE_STATUS_LABELS: Record<
  (typeof PROMO_PURCHASE_STATUSES)[number],
  string
> = {
  valid: "Vigente",
  redeemed: "Usada",
  expired: "Vencida",
  refunded: "Reembolsada",
};

/** Rating de reseña de Espacio (1–5). */
export const MIN_VENUE_RATING = 1;
export const MAX_VENUE_RATING = 5;
export const MAX_REVIEW_BODY_LENGTH = 1000;
export const MAX_REVIEW_PHOTOS = 3;
export const REVIEWS_PAGE_SIZE = 10;
/** Reseñas propias en el perfil (acordeón). */
export const MY_REVIEWS_PAGE_SIZE = 5;

/** Publicaciones de usuario en el Muro (texto + fotos + Espacio). */
export const MAX_POST_BODY_LENGTH = 200;
export const MAX_POST_PHOTOS = 3;

/** Tipos de actividad social en el Muro (personas seguidas + propias). */
export const ACTIVITY_TYPES = [
  "venue_review_created",
  "venue_review_updated",
  "venue_followed",
  "user_post_created",
] as const;

export const ACTIVITY_TYPE_LABELS: Record<
  (typeof ACTIVITY_TYPES)[number],
  string
> = {
  venue_review_created: "reseñó",
  venue_review_updated: "actualizó su reseña de",
  venue_followed: "empezó a seguir",
  user_post_created: "publicó en",
};

/** Espacios por página en el listado público. */
export const VENUES_PAGE_SIZE = 9;

export const OAUTH_PROVIDERS = ["google", "apple", "microsoft"] as const;

export const REPORT_REASONS = [
  "spam", "acoso", "perfil_falso", "contenido_inapropiado", "otro",
] as const;

export const SUSPENSION_DURATIONS = [
  30,
  90,
  180,
  360,
  "permanent",
] as const;

export const SUSPENSION_DURATION_LABELS: Record<
  (typeof SUSPENSION_DURATIONS)[number],
  string
> = {
  30: "30 días",
  90: "90 días",
  180: "180 días",
  360: "360 días",
  permanent: "Permanente",
};

export const REPORT_REASON_LABELS: Record<(typeof REPORT_REASONS)[number], string> = {
  spam: "Spam",
  acoso: "Acoso",
  perfil_falso: "Perfil falso",
  contenido_inapropiado: "Contenido inapropiado",
  otro: "Otro",
};

export const REPORT_STATUS_LABELS = {
  open: "Abierta",
  reviewed: "Revisada",
  dismissed: "Descartada",
} as const;

/** Tipos de notificaciones in-app. */
export const NOTIFICATION_TYPES = [
  "like_received",
  "match_created",
  "message_received",
  "follow_request",
  "follow_accepted",
  "new_follower",
  "followed_user_post",
  "followed_user_review",
  "venue_new_follower",
  "venue_new_review",
  "presence_expired",
  "likes_recharged",
  "premium_activated",
  "venue_request_resolved",
  "report_created",
  "report_resolved",
  "followed_presence",
  "identity_verification_approved",
  "identity_verification_rejected",
] as const;

export const NOTIFICATION_TYPE_LABELS: Record<
  (typeof NOTIFICATION_TYPES)[number],
  string
> = {
  like_received: "Like recibido",
  match_created: "Nuevo match",
  message_received: "Nuevo mensaje",
  follow_request: "Solicitud de seguimiento",
  follow_accepted: "Solicitud aceptada",
  new_follower: "Nuevo seguidor",
  followed_user_post: "Publicación de alguien que seguís",
  followed_user_review: "Reseña de alguien que seguís",
  venue_new_follower: "Nuevo seguidor del Espacio",
  venue_new_review: "Nueva reseña del Espacio",
  presence_expired: "Presencia vencida",
  likes_recharged: "Likes recargados",
  premium_activated: "Premium activado",
  venue_request_resolved: "Solicitud de Espacio resuelta",
  report_created: "Nueva denuncia",
  report_resolved: "Denuncia revisada",
  followed_presence: "Alguien que seguís se publicó",
  identity_verification_approved: "Verificación aprobada",
  identity_verification_rejected: "Verificación rechazada",
};

/** Días que vive una notificación después de marcarse como leída. */
export const NOTIFICATION_READ_TTL_DAYS = 30;
/** Preview en el desplegable de la campana. */
export const NOTIFICATIONS_PREVIEW_LIMIT = 5;
/** Tamaño de página en /notifications. */
export const NOTIFICATIONS_PAGE_SIZE = 10;

export const EMAIL_VERIFICATION_CODE_LENGTH = 6;
export const EMAIL_VERIFICATION_TTL_MINUTES = 15;
export const PASSWORD_RESET_TTL_MINUTES = 15;

export const LOOKING_FOR_LABELS: Record<(typeof LOOKING_FOR)[number], string> = {
  citas: "Citas",
  relacion: "Relación",
  encuentros_casuales: "Encuentros casuales",
  amigos: "Amigos",
  networking: "Networking",
};

export const INTEREST_LABELS: Record<(typeof INTERESTS)[number], string> = {
  por_mensaje: "Por mensaje",
  por_llamada: "Por llamada",
  cara_a_cara: "Cara a cara",
  videollamada: "Videollamada",
  audios_largos: "Audios largos",
  memes_y_reacciones: "Memes y reacciones",
  chat_nocturno: "Chat hasta tarde",
  cartas_digitales: "Cartas digitales",
  musica_electronica: "Música electrónica",
  reggaeton: "Reggaetón",
  rock: "Rock",
  indie: "Indie",
  hip_hop: "Hip-hop",
  latina: "Latina",
  techno: "Techno",
  house: "House",
  pop: "Pop",
  trap: "Trap",
  jazz: "Jazz",
  live_sets: "Live sets",
  baile: "Baile",
  after_hours: "After hours",
  karaoke: "Karaoke",
  rooftop: "Rooftop",
  pista_cerrada: "Pista cerrada",
  sunset_sessions: "Sunset sessions",
  cocktails: "Cocktails",
  cerveza_artesanal: "Cerveza artesanal",
  vino: "Vino",
  gastronomia: "Gastronomía",
  cafe_de_especialidad: "Café de especialidad",
  mocktails: "Mocktails",
  brindis_largo: "Brindis largo",
  viajes: "Viajes",
  cine: "Cine",
  fitness: "Fitness",
  gaming: "Gaming",
  escape_rooms: "Escape rooms",
  conciertos_en_vivo: "Conciertos en vivo",
  amanecer: "Amanecer",
  caminatas_nocturnas: "Caminatas nocturnas",
  fotografia: "Fotografía",
  arte: "Arte",
  moda: "Moda",
  streetwear: "Streetwear",
  vinilos: "Vinilos",
  podcasts: "Podcasts",
  humor_seco: "Humor seco",
  deep_talks: "Deep talks",
  plan_espontaneo: "Plan espontáneo",
  citas_largas: "Citas largas",
  solo_buena_onda: "Solo buena onda",
  quimica_inmediata: "Química inmediata",
  sarcasmo_fino: "Sarcasmo fino",
  energy_match: "Energy match",
};

export const WORK_STATUS_LABELS: Record<(typeof WORK_STATUS)[number], string> = {
  estudiante: "Estudiante",
  empleado: "Empleado/a",
  freelance: "Freelance",
  emprendedor: "Emprendedor/a",
  buscando: "Buscando trabajo",
  otro: "Otro",
};

export const SEXUAL_ORIENTATION_LABELS: Record<
  (typeof SEXUAL_ORIENTATIONS)[number],
  string
> = {
  heterosexual: "Heterosexual",
  gay: "Homosexual",
  lesbiana: "Lesbiana",
  bisexual: "Bisexual",
  pansexual: "Pansexual",
  asexual: "Asexual",
  queer: "Queer",
  en_duda: "En duda",
  otro: "Otro",
};

export const LANGUAGE_LABELS: Record<(typeof LANGUAGES)[number], string> = {
  espanol: "Español",
  ingles: "Inglés",
  portugues: "Portugués",
  frances: "Francés",
  italiano: "Italiano",
  aleman: "Alemán",
  chino: "Chino",
  japones: "Japonés",
  coreano: "Coreano",
  otro: "Otro",
};

export const ZODIAC_LABELS: Record<(typeof ZODIAC_SIGNS)[number], string> = {
  aries: "Aries",
  tauro: "Tauro",
  geminis: "Géminis",
  cancer: "Cáncer",
  leo: "Leo",
  virgo: "Virgo",
  libra: "Libra",
  escorpion: "Escorpio",
  sagitario: "Sagitario",
  capricornio: "Capricornio",
  acuario: "Acuario",
  piscis: "Piscis",
};

/**
 * Descripciones editoriales derivadas del signo elegido; no son campos
 * editables del perfil. Referencias de astrología occidental:
 * astrology.com/zodiac-signs y almanac.com/12-astrology-zodiac-signs.
 */
export const ZODIAC_INSIGHTS: Record<
  (typeof ZODIAC_SIGNS)[number],
  { traits: string; compatibleWith: readonly (typeof ZODIAC_SIGNS)[number][] }
> = {
  aries: {
    traits: "Audaz, apasionado/a y con iniciativa",
    compatibleWith: ["leo", "sagitario"],
  },
  tauro: {
    traits: "Leal, paciente y confiable",
    compatibleWith: ["virgo", "capricornio"],
  },
  geminis: {
    traits: "Curioso/a, adaptable y comunicativo/a",
    compatibleWith: ["libra", "acuario"],
  },
  cancer: {
    traits: "Empático/a, creativo/a y protector/a",
    compatibleWith: ["escorpion", "piscis"],
  },
  leo: {
    traits: "Generoso/a, carismático/a y seguro/a",
    compatibleWith: ["aries", "sagitario"],
  },
  virgo: {
    traits: "Práctico/a, analítico/a y dedicado/a",
    compatibleWith: ["tauro", "capricornio"],
  },
  libra: {
    traits: "Diplomático/a, equilibrado/a y encantador/a",
    compatibleWith: ["geminis", "acuario"],
  },
  escorpion: {
    traits: "Apasionado/a, valiente y determinado/a",
    compatibleWith: ["cancer", "piscis"],
  },
  sagitario: {
    traits: "Optimista, aventurero/a y honesto/a",
    compatibleWith: ["aries", "leo"],
  },
  capricornio: {
    traits: "Disciplinado/a, ambicioso/a y responsable",
    compatibleWith: ["tauro", "virgo"],
  },
  acuario: {
    traits: "Innovador/a, independiente y humanitario/a",
    compatibleWith: ["geminis", "libra"],
  },
  piscis: {
    traits: "Compasivo/a, intuitivo/a e imaginativo/a",
    compatibleWith: ["cancer", "escorpion"],
  },
};

export const EDUCATION_LEVEL_LABELS: Record<
  (typeof EDUCATION_LEVELS)[number],
  string
> = {
  secundaria: "Secundaria",
  terciario: "Terciario",
  universitario: "Universitario",
  posgrado: "Posgrado",
  autodidacta: "Autodidacta",
  otro: "Otro",
};

export const PETS_LABELS: Record<(typeof PETS)[number], string> = {
  perro: "Perro",
  gato: "Gato",
  perro_y_gato: "Perro y gato",
  otras: "Otras mascotas",
  quiero_tener: "Quiero tener",
  no_tengo: "No tengo",
  alergico: "Alérgico/a",
};

export const DRINKING_LABELS: Record<(typeof DRINKING)[number], string> = {
  social: "Social",
  frecuentemente: "Frecuentemente",
  ocasiones: "Solo en ocasiones",
  no_tomo: "No tomo",
};

export const FITNESS_LABELS: Record<(typeof FITNESS)[number], string> = {
  activo: "Activo/a",
  gym_regular: "Gym regular",
  deporte: "Deporte",
  a_veces: "A veces",
  poco_activo: "Poco activo/a",
  no_es_prioridad: "No es prioridad",
};

export const SOCIAL_NETWORK_LABELS: Record<
  (typeof SOCIAL_NETWORKS)[number],
  string
> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  x: "X",
  facebook: "Facebook",
  linkedin: "LinkedIn",
};

export const VENUE_TYPE_LABELS: Record<(typeof VENUE_TYPES)[number], string> = {
  boliche: "Boliche",
  bar: "Bar",
  pub: "Pub",
  cerveceria: "Cervecería",
  concierto: "Concierto",
  festival: "Festival",
  fiesta_privada: "Privada",
};

export const GENDER_LABELS: Record<(typeof GENDERS)[number], string> = {
  mujer: "Mujer",
  hombre: "Hombre",
  no_binario: "No binario",
  otro: "Otro",
};

/** Países disponibles para “dónde vivís” (formato País, Ciudad). */
export const PROFILE_COUNTRIES = [
  "Uruguay",
  "Argentina",
  "Brasil",
  "Chile",
  "Paraguay",
  "España",
  "México",
  "Colombia",
  "Otro",
] as const;

/** Países latinoamericanos disponibles para registrar Espacios. */
export const VENUE_COUNTRIES = [
  { id: "argentina", label: "Argentina", enabled: true },
  { id: "bolivia", label: "Bolivia", enabled: false },
  { id: "brasil", label: "Brasil", enabled: true },
  { id: "chile", label: "Chile", enabled: false },
  { id: "colombia", label: "Colombia", enabled: false },
  { id: "costa_rica", label: "Costa Rica", enabled: false },
  { id: "cuba", label: "Cuba", enabled: false },
  { id: "ecuador", label: "Ecuador", enabled: false },
  { id: "el_salvador", label: "El Salvador", enabled: false },
  { id: "guatemala", label: "Guatemala", enabled: false },
  { id: "haiti", label: "Haití", enabled: false },
  { id: "honduras", label: "Honduras", enabled: false },
  { id: "mexico", label: "México", enabled: false },
  { id: "nicaragua", label: "Nicaragua", enabled: false },
  { id: "panama", label: "Panamá", enabled: false },
  { id: "paraguay", label: "Paraguay", enabled: false },
  { id: "peru", label: "Perú", enabled: false },
  { id: "republica_dominicana", label: "República Dominicana", enabled: false },
  { id: "uruguay", label: "Uruguay", enabled: true },
  { id: "venezuela", label: "Venezuela", enabled: false },
] as const;

export const ENABLED_VENUE_COUNTRIES = [
  "Uruguay",
  "Argentina",
  "Brasil",
] as const;

/** Ciudades de Uruguay con centro de mapa. */
export const URUGUAY_CITIES = [
  { id: "montevideo", label: "Montevideo", lat: -34.9011, lng: -56.1645 },
  { id: "ciudad_de_la_costa", label: "Ciudad de la Costa", lat: -34.8167, lng: -55.95 },
  { id: "canelones", label: "Canelones", lat: -34.5228, lng: -56.2778 },
  { id: "maldonado", label: "Maldonado", lat: -34.9, lng: -54.95 },
  { id: "punta_del_este", label: "Punta del Este", lat: -34.9667, lng: -54.95 },
  { id: "colonia_del_sacramento", label: "Colonia del Sacramento", lat: -34.4714, lng: -57.8442 },
  { id: "salto", label: "Salto", lat: -31.3833, lng: -57.9667 },
  { id: "paysandu", label: "Paysandú", lat: -32.3214, lng: -58.0756 },
  { id: "rivera", label: "Rivera", lat: -30.9053, lng: -55.5508 },
  { id: "melo", label: "Melo", lat: -32.37, lng: -54.2 },
  { id: "mercedes", label: "Mercedes", lat: -33.2524, lng: -58.0305 },
  { id: "minas", label: "Minas", lat: -34.375, lng: -55.2333 },
  { id: "durazno", label: "Durazno", lat: -33.38, lng: -56.52 },
  { id: "florida", label: "Florida", lat: -34.1, lng: -56.21 },
  { id: "rocha", label: "Rocha", lat: -34.4833, lng: -54.3333 },
  { id: "tacuarembo", label: "Tacuarembó", lat: -31.7333, lng: -55.9833 },
  { id: "trinidad", label: "Trinidad", lat: -33.5167, lng: -56.9 },
  { id: "treinta_y_tres", label: "Treinta y Tres", lat: -33.2333, lng: -54.3833 },
  { id: "artigas", label: "Artigas", lat: -30.4, lng: -56.4667 },
  { id: "fray_bentos", label: "Fray Bentos", lat: -33.1333, lng: -58.3 },
  { id: "san_jose_de_mayo", label: "San José de Mayo", lat: -34.3375, lng: -56.7136 },
] as const;

export const ARGENTINA_CITIES = [
  { id: "buenos_aires", label: "Buenos Aires", lat: -34.6037, lng: -58.3816 },
  { id: "cordoba", label: "Córdoba", lat: -31.4201, lng: -64.1888 },
  { id: "rosario", label: "Rosario", lat: -32.9442, lng: -60.6505 },
  { id: "mendoza", label: "Mendoza", lat: -32.8895, lng: -68.8458 },
  { id: "la_plata", label: "La Plata", lat: -34.9214, lng: -57.9544 },
  { id: "mar_del_plata", label: "Mar del Plata", lat: -38.0055, lng: -57.5426 },
  { id: "salta", label: "Salta", lat: -24.7821, lng: -65.4232 },
  { id: "san_miguel_de_tucuman", label: "San Miguel de Tucumán", lat: -26.8083, lng: -65.2176 },
  { id: "santa_fe", label: "Santa Fe", lat: -31.6333, lng: -60.7 },
  { id: "neuquen", label: "Neuquén", lat: -38.9516, lng: -68.0591 },
  { id: "bariloche", label: "San Carlos de Bariloche", lat: -41.1335, lng: -71.3103 },
] as const;

export const BRAZIL_CITIES = [
  { id: "sao_paulo", label: "São Paulo", lat: -23.5505, lng: -46.6333 },
  { id: "rio_de_janeiro", label: "Rio de Janeiro", lat: -22.9068, lng: -43.1729 },
  { id: "brasilia", label: "Brasília", lat: -15.7939, lng: -47.8828 },
  { id: "belo_horizonte", label: "Belo Horizonte", lat: -19.9167, lng: -43.9345 },
  { id: "salvador", label: "Salvador", lat: -12.9777, lng: -38.5016 },
  { id: "fortaleza", label: "Fortaleza", lat: -3.7319, lng: -38.5267 },
  { id: "recife", label: "Recife", lat: -8.0476, lng: -34.877 },
  { id: "porto_alegre", label: "Porto Alegre", lat: -30.0346, lng: -51.2177 },
  { id: "curitiba", label: "Curitiba", lat: -25.4284, lng: -49.2733 },
  { id: "manaus", label: "Manaus", lat: -3.119, lng: -60.0217 },
  { id: "goiania", label: "Goiânia", lat: -16.6869, lng: -49.2648 },
  { id: "florianopolis", label: "Florianópolis", lat: -27.5949, lng: -48.5482 },
] as const;

export const VENUE_CITIES_BY_COUNTRY = {
  Uruguay: URUGUAY_CITIES,
  Argentina: ARGENTINA_CITIES,
  Brasil: BRAZIL_CITIES,
} as const;

export const ALL_VENUE_CITIES = (
  Object.entries(VENUE_CITIES_BY_COUNTRY) as Array<
    [
      keyof typeof VENUE_CITIES_BY_COUNTRY,
      (typeof VENUE_CITIES_BY_COUNTRY)[keyof typeof VENUE_CITIES_BY_COUNTRY],
    ]
  >
).flatMap(([country, cities]) =>
  cities.map((city) => ({
    country,
    id: city.id,
    label: city.label,
    lat: city.lat,
    lng: city.lng,
  }))
);

export type VenueCityCandidate = {
  country: (typeof ENABLED_VENUE_COUNTRIES)[number];
  id?: string;
  label: string;
  lat: number;
  lng: number;
};

export function isEnabledVenueCountry(
  country: string
): country is (typeof ENABLED_VENUE_COUNTRIES)[number] {
  return ENABLED_VENUE_COUNTRIES.some((candidate) => candidate === country);
}

/** Catálogo inicial para seed de AppCity (no es fuente runtime de proximidad). */
export const SEED_VENUE_CITIES: VenueCityCandidate[] = ALL_VENUE_CITIES.map(
  (city) => ({
    country: city.country,
    id: city.id,
    label: city.label,
    lat: city.lat,
    lng: city.lng,
  })
);

export type VenueCityMatch = {
  country: (typeof ENABLED_VENUE_COUNTRIES)[number];
  city: string;
  lat: number;
  lng: number;
  distanceKm: number;
};

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const r = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
}

/** Ciudad más cercana dentro de una lista (catálogo DB o seed). */
export function nearestVenueCityFrom(
  cities: Array<{
    country: string;
    label?: string;
    city?: string;
    lat: number;
    lng: number;
  }>,
  lat: number,
  lng: number
): VenueCityMatch | null {
  let best: VenueCityMatch | null = null;
  for (const candidate of cities) {
    const cityLabel = (candidate.label ?? candidate.city ?? "").trim();
    if (!cityLabel || !isEnabledVenueCountry(candidate.country)) continue;
    const distanceKm = haversineKm(lat, lng, candidate.lat, candidate.lng);
    if (!best || distanceKm < best.distanceKm) {
      best = {
        country: candidate.country,
        city: cityLabel,
        lat: candidate.lat,
        lng: candidate.lng,
        distanceKm,
      };
    }
  }
  return best;
}

/**
 * @deprecated Preferir `/api/cities/nearest` o `nearestVenueCityFrom` con ciudades activas de DB.
 * Fallback local al seed estático.
 */
export function nearestVenueCity(lat: number, lng: number): VenueCityMatch {
  return nearestVenueCityFrom(SEED_VENUE_CITIES, lat, lng)!;
}

export const DEFAULT_URUGUAY_CITY = URUGUAY_CITIES[0];
export const DEFAULT_VENUE_COUNTRY = "Uruguay" as const;

/** @deprecated Preferir GET /api/cities?country=… */
export function venueCitiesForCountry(country: string) {
  return isEnabledVenueCountry(country)
    ? VENUE_CITIES_BY_COUNTRY[country]
    : URUGUAY_CITIES;
}

/** @deprecated Preferir validación async contra AppCity en API. */
export function isVenueCity(country: string, city: string): boolean {
  return venueCitiesForCountry(country).some(
    (candidate) => candidate.label === city
  );
}

export const VENUE_COVER_WIDTH = 1600;
export const VENUE_COVER_HEIGHT = 1200;
export const VENUE_COVER_MIME = "image/webp";
export const VENUE_COVER_EXTENSION = ".webp";

export const DISPLAY_ADDRESS_HINT =
  "Usá un formato claro: calle y número, barrio o esquina. Ej: Av. 18 de Julio 1234, esquina Ejido";


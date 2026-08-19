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

export const MAX_PHOTO_UPLOAD_BYTES = 8 * 1024 * 1024;
export const MAX_PHOTO_UPLOAD_FILES = 6;
export const ALLOWED_PHOTO_MIME_TYPES = [
  "image/jpeg", "image/jpg", "image/png", "image/webp",
  "image/gif", "image/heic", "image/heif",
] as const;
export const ALLOWED_PHOTO_EXTENSIONS = [
  ".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif",
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
  "venue_request_resolved",
  "report_created",
  "report_resolved",
  "followed_presence",
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
  venue_request_resolved: "Solicitud de Espacio resuelta",
  report_created: "Nueva denuncia",
  report_resolved: "Denuncia revisada",
  followed_presence: "Alguien que seguís se publicó",
};

/** Días que vive una notificación después de marcarse como leída. */
export const NOTIFICATION_READ_TTL_DAYS = 30;
/** Preview en el desplegable de la campana. */
export const NOTIFICATIONS_PREVIEW_LIMIT = 5;
/** Tamaño de página en /notifications. */
export const NOTIFICATIONS_PAGE_SIZE = 10;

export const EMAIL_VERIFICATION_CODE_LENGTH = 6;
export const EMAIL_VERIFICATION_TTL_MINUTES = 15;

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

/** Ciudades piloto (Uruguay) con centro de mapa. */
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

export const DEFAULT_URUGUAY_CITY = URUGUAY_CITIES[0];

export const DISPLAY_ADDRESS_HINT =
  "Usá un formato claro: calle y número, barrio o esquina. Ej: Av. 18 de Julio 1234, esquina Ejido";


export const LOOKING_FOR = [
  "citas",
  "relacion",
  "encuentros_casuales",
  "amigos",
  "networking",
] as const;

export const INTERESTS = [
  "musica_electronica",
  "reggaeton",
  "rock",
  "indie",
  "hip_hop",
  "latina",
  "techno",
  "house",
  "baile",
  "cocktails",
  "cerveza_artesanal",
  "vino",
  "fotografia",
  "viajes",
  "fitness",
  "arte",
  "moda",
  "gaming",
  "cine",
  "gastronomia",
] as const;

export const WORK_STATUS = [
  "estudiante",
  "empleado",
  "freelance",
  "emprendedor",
  "buscando",
  "otro",
] as const;

export const VENUE_TYPES = [
  "boliche",
  "bar",
  "pub",
  "cerveceria",
  "fiesta_privada",
  "concierto",
  "festival",
] as const;

export const GENDERS = ["mujer", "hombre", "no_binario", "otro"] as const;

export const PRESENCE_PRESETS = [
  { label: "24 horas", hours: 24 },
  { label: "48 horas", hours: 48 },
  { label: "1 semana", hours: 168 },
  { label: "Permanente", hours: null },
] as const;

export const MIN_PHOTOS = 4;
export const MIN_AGE = 18;
export const MAX_AGE = 99;
/** Locales por página en el listado público. */
export const VENUES_PAGE_SIZE = 9;

export const OAUTH_PROVIDERS = ["google", "apple", "microsoft"] as const;

export const LOOKING_FOR_LABELS: Record<(typeof LOOKING_FOR)[number], string> = {
  citas: "Citas",
  relacion: "Relación",
  encuentros_casuales: "Encuentros casuales",
  amigos: "Amigos",
  networking: "Networking",
};

export const INTEREST_LABELS: Record<(typeof INTERESTS)[number], string> = {
  musica_electronica: "Música electrónica",
  reggaeton: "Reggaetón",
  rock: "Rock",
  indie: "Indie",
  hip_hop: "Hip-hop",
  latina: "Latina",
  techno: "Techno",
  house: "House",
  baile: "Baile",
  cocktails: "Cocktails",
  cerveza_artesanal: "Cerveza artesanal",
  vino: "Vino",
  fotografia: "Fotografía",
  viajes: "Viajes",
  fitness: "Fitness",
  arte: "Arte",
  moda: "Moda",
  gaming: "Gaming",
  cine: "Cine",
  gastronomia: "Gastronomía",
};

export const WORK_STATUS_LABELS: Record<(typeof WORK_STATUS)[number], string> = {
  estudiante: "Estudiante",
  empleado: "Empleado/a",
  freelance: "Freelance",
  emprendedor: "Emprendedor/a",
  buscando: "Buscando trabajo",
  otro: "Otro",
};

export const VENUE_TYPE_LABELS: Record<(typeof VENUE_TYPES)[number], string> = {
  boliche: "Boliche",
  bar: "Bar",
  pub: "Pub",
  cerveceria: "Cervecería",
  fiesta_privada: "Fiesta privada",
  concierto: "Concierto",
  festival: "Festival",
};

export const GENDER_LABELS: Record<(typeof GENDERS)[number], string> = {
  mujer: "Mujer",
  hombre: "Hombre",
  no_binario: "No binario",
  otro: "Otro",
};

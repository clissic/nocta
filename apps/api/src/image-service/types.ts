/**
 * Tipos de imagen de Nocta (extensibles).
 * Un solo servicio; reglas por tipo vía registry.
 */
export const IMAGE_TYPES = [
  "user_profile",
  "space",
  "space_news",
  /** Alias de producto para noticias/promos visuales de Espacio. */
  "space_promotion",
  "space_request",
  "review",
  "user_post",
  "identity_verification",
  "claim_evidence",
  "report_evidence",
] as const;

export type ImageType = (typeof IMAGE_TYPES)[number];

export type ImageVisibility = "public" | "private";

/** Perfil de procesamiento (Sharp se implementa en fases posteriores). */
export type ImageProcessingProfile =
  | "none"
  | "variants_v1"
  | "identity_raw"
  | "evidence_raw";

export type ImageRetentionPolicy =
  | { kind: "permanent" }
  | { kind: "owner_lifetime" }
  | { kind: "ttl_days"; days: number };

export type ImageAccessPolicy =
  | { kind: "public_cdn_or_signed" }
  | { kind: "signed_only" }
  | { kind: "owner_or_admin_signed" }
  /** SENSITIVE: solo admin (p. ej. identity_verification). */
  | { kind: "admin_signed" };

export type ImageTypeConfig = {
  type: ImageType;
  visibility: ImageVisibility;
  /** Prefijo de key en el bucket (`public/...` o `private/...`). */
  storageNamespace: string;
  retention: ImageRetentionPolicy;
  allowedMimeTypes: readonly string[];
  maxUploadBytes: number;
  /** Ancho máximo aceptado al validar (fase procesamiento). */
  maxWidthPx: number;
  maxHeightPx: number;
  processingProfile: ImageProcessingProfile;
  accessPolicy: ImageAccessPolicy;
  /** TTL sugerido para URLs firmadas de este tipo. */
  signedUrlTtlSeconds: number;
};

/**
 * Contexto de ownership / nesting para armar el path.
 * Solo se usan los campos relevantes al tipo.
 */
export type ImagePathContext = {
  userId?: string;
  spaceId?: string;
  reviewId?: string;
  postId?: string;
  reportId?: string;
  requestId?: string;
};

/**
 * Metadata conceptual / documento Mongo ImageAsset.
 */
export type ImageRecord = {
  imageId: string;
  type: ImageType;
  ownerId: string;
  visibility: ImageVisibility;
  keys: string[];
  originalWidth?: number;
  originalHeight?: number;
  contentType?: string;
  bytes?: number;
  createdAt: Date;
};

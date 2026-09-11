import {
  MAX_VENUE_CLAIM_FILE_BYTES,
  VENUE_CLAIM_FILE_MIME_TYPES,
} from "@nocta/shared";
import { PROCESSING, SOCIAL_SOURCE_MIMES } from "./processingConstants.js";
import type { ImageType, ImageTypeConfig } from "./types.js";

const PHOTO_MIMES = SOCIAL_SOURCE_MIMES;

const publicVariants = (
  type: ImageType,
  storageNamespace: string,
  retention: ImageTypeConfig["retention"] = { kind: "owner_lifetime" }
): ImageTypeConfig => ({
  type,
  visibility: "public",
  storageNamespace,
  retention,
  allowedMimeTypes: PHOTO_MIMES,
  maxUploadBytes: PROCESSING.socialMaxUploadBytes,
  maxWidthPx: PROCESSING.maxWidthPx,
  maxHeightPx: PROCESSING.maxHeightPx,
  processingProfile: "variants_v1",
  accessPolicy: { kind: "public_cdn_or_signed" },
  signedUrlTtlSeconds: 60 * 60 * 24,
});

/** Registry central: agregar un tipo = una entrada aquí. */
export const IMAGE_TYPE_REGISTRY: Record<ImageType, ImageTypeConfig> = {
  user_profile: publicVariants("user_profile", "public/users"),
  space: publicVariants("space", "public/spaces"),
  space_news: publicVariants("space_news", "public/spaces"),
  space_promotion: publicVariants("space_promotion", "public/spaces"),
  space_request: publicVariants("space_request", "public/space-requests", {
    kind: "ttl_days",
    days: 90,
  }),
  review: publicVariants("review", "public/reviews"),
  user_post: publicVariants("user_post", "public/posts"),
  identity_verification: {
    type: "identity_verification",
    visibility: "private",
    storageNamespace: "private/identity",
    retention: { kind: "ttl_days", days: 180 },
    allowedMimeTypes: PHOTO_MIMES,
    maxUploadBytes: PROCESSING.socialMaxUploadBytes,
    maxWidthPx: PROCESSING.maxWidthPx,
    maxHeightPx: PROCESSING.maxHeightPx,
    processingProfile: "identity_raw",
    /** SENSITIVE: más estricto que owner — solo admin en lectura. */
    accessPolicy: { kind: "admin_signed" },
    signedUrlTtlSeconds: 60 * 10,
  },
  claim_evidence: {
    type: "claim_evidence",
    visibility: "private",
    storageNamespace: "private/claims",
    retention: { kind: "ttl_days", days: 365 },
    allowedMimeTypes: VENUE_CLAIM_FILE_MIME_TYPES,
    maxUploadBytes: MAX_VENUE_CLAIM_FILE_BYTES,
    maxWidthPx: PROCESSING.maxWidthPx,
    maxHeightPx: PROCESSING.maxHeightPx,
    processingProfile: "evidence_raw",
    accessPolicy: { kind: "owner_or_admin_signed" },
    signedUrlTtlSeconds: 60 * 15,
  },
  report_evidence: {
    type: "report_evidence",
    visibility: "private",
    storageNamespace: "private/reports",
    retention: { kind: "ttl_days", days: 365 },
    allowedMimeTypes: PHOTO_MIMES,
    maxUploadBytes: PROCESSING.socialMaxUploadBytes,
    maxWidthPx: PROCESSING.maxWidthPx,
    maxHeightPx: PROCESSING.maxHeightPx,
    processingProfile: "evidence_raw",
    accessPolicy: { kind: "owner_or_admin_signed" },
    signedUrlTtlSeconds: 60 * 15,
  },
};

export function getImageTypeConfig(type: ImageType): ImageTypeConfig {
  const config = IMAGE_TYPE_REGISTRY[type];
  if (!config) {
    throw new Error(`ImageType desconocido: ${type}`);
  }
  return config;
}

export function isImageType(value: string): value is ImageType {
  return value in IMAGE_TYPE_REGISTRY;
}

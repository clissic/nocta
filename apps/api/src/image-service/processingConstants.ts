/** Constantes del pipeline Sharp (configurables vía env). */

function envInt(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw == null || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export const PROCESSING = {
  /** Tope de upload para imágenes sociales (perfil, espacio, review, news). */
  socialMaxUploadBytes: envInt(
    "IMAGE_SOCIAL_MAX_UPLOAD_BYTES",
    10 * 1024 * 1024
  ),
  maxWidthPx: envInt("IMAGE_MAX_WIDTH_PX", 8000),
  maxHeightPx: envInt("IMAGE_MAX_HEIGHT_PX", 8000),
  /** Pixels totales máx. (anti decompression bomb). */
  maxPixels: envInt("IMAGE_MAX_PIXELS", 40_000_000),
  /** Input pixels × channels rough cap while decoding. */
  maxInputBytes: envInt("IMAGE_MAX_INPUT_BYTES", 80 * 1024 * 1024),
  variants: {
    thumb: envInt("IMAGE_VARIANT_THUMB_WIDTH", 320),
    medium: envInt("IMAGE_VARIANT_MEDIUM_WIDTH", 640),
    large: envInt("IMAGE_VARIANT_LARGE_WIDTH", 1080),
  },
  quality: {
    webp: envInt("IMAGE_WEBP_QUALITY", 80),
    avif: envInt("IMAGE_AVIF_QUALITY", 60),
  },
  /** Identity: lado máximo del lado largo (privado). */
  identityMaxEdge: envInt("IMAGE_IDENTITY_MAX_EDGE", 2048),
  identityJpegQuality: envInt("IMAGE_IDENTITY_JPEG_QUALITY", 85),
} as const;

export const VARIANT_NAMES = ["thumb", "medium", "large"] as const;
export type VariantName = (typeof VARIANT_NAMES)[number];

export const VARIANT_FORMATS = ["webp", "avif"] as const;
export type VariantFormat = (typeof VARIANT_FORMATS)[number];

export const SOCIAL_SOURCE_MIMES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  /** Legacy / clientes que suben AVIF como fuente (Sharp lo re-encoda a variantes). */
  "image/avif",
] as const;

export const MEDIA_REF_PREFIX = "/api/media/";

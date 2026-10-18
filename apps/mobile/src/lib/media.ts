import { apiUrl, mediaUrl } from "./api";

export type ImageVariant = "thumb" | "medium" | "large";

const VARIANT_FILE_RE =
  /\/([a-zA-Z0-9_-]{8,128})\/(thumb|medium|large)\.(webp|avif)(?:\?|$)/i;
const MEDIA_PATH_RE = /\/api\/media\/([a-zA-Z0-9_-]{8,128})(?:\?|$)/i;

function stripQuery(url: string): string {
  const q = url.indexOf("?");
  return q >= 0 ? url.slice(0, q) : url;
}

export function looksSignedUrl(url: string): boolean {
  if (!url.includes("?")) return false;
  return /[?&](X-Amz-|Signature=|token=|Expires=|AWSAccessKeyId=)/i.test(url);
}

export function extractManagedImageId(src: string): string | null {
  const trimmed = src.trim();
  if (!trimmed) return null;

  const media = trimmed.match(MEDIA_PATH_RE);
  if (media?.[1]) return media[1];

  try {
    const path = /^https?:\/\//i.test(trimmed)
      ? new URL(trimmed).pathname
      : stripQuery(trimmed);
    const hit = path.match(VARIANT_FILE_RE);
    if (hit?.[1]) return hit[1];
  } catch {
    /* ignore */
  }

  const loose = stripQuery(trimmed).match(VARIANT_FILE_RE);
  return loose?.[1] ?? null;
}

/**
 * Resuelve una URI usable en <Image> / expo-image.
 * Managed → /api/media/{id}?v=&f=webp; legacy/CDN tal cual.
 */
export function resolveImageUri(
  src?: string | null,
  variant: ImageVariant = "medium"
): string {
  if (!src) return "";
  const trimmed = src.trim();
  if (!trimmed) return "";

  if (
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("file:") ||
    trimmed.startsWith("content:")
  ) {
    return trimmed;
  }
  // Firmadas / CDN remotas (no localhost — eso lo reescribe mediaUrl).
  if (
    looksSignedUrl(trimmed) &&
    /^https?:\/\//i.test(trimmed) &&
    !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(trimmed)
  ) {
    return trimmed;
  }

  // Teaser blur de likes (URL firmada de la API; no es /api/media).
  if (
    /\/api\/discover\/likes\/[^/]+\/teaser(?:\?|$)/i.test(trimmed) ||
    trimmed.startsWith("/api/discover/")
  ) {
    return mediaUrl(trimmed) || trimmed;
  }

  const imageId = extractManagedImageId(trimmed);
  if (imageId) {
    return apiUrl(`/api/media/${imageId}?v=${variant}&f=webp`);
  }

  return mediaUrl(trimmed) || trimmed;
}

/**
 * Clave de disco para expo-image. Ignora la firma: el mismo imageId no se vuelve a bajar.
 */
export function imageDiskCacheKey(
  src: string | null | undefined,
  variant: ImageVariant = "medium"
): string | null {
  if (!src?.trim()) return null;
  const trimmed = src.trim();
  if (/^(blob:|data:|file:|content:)/i.test(trimmed)) return null;
  const imageId = extractManagedImageId(trimmed);
  if (imageId) return `nocta:${imageId}:${variant}:webp`;
  if (trimmed.includes("/uploads/") || trimmed.includes("/images/")) {
    return `nocta:${stripQuery(trimmed)}`;
  }
  return null;
}

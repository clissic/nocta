/** Cache-Control de objetos públicos en Object Storage (variantes inmutables). */
export const PUBLIC_OBJECT_CACHE_CONTROL =
  "public, max-age=31536000, immutable";

/** Cache-Control de objetos privados (identity / evidence). */
export const PRIVATE_OBJECT_CACHE_CONTROL = "private, max-age=0, no-store";

/**
 * Cache del 302 `/api/media/:id` cuando redirige a CDN pública.
 * El asset en Storage ya es immutable; el redirect puede cachearse un día.
 */
export const MEDIA_REDIRECT_PUBLIC_CACHE_CONTROL =
  "public, max-age=86400, stale-while-revalidate=604800";

/** Redirect a URL firmada: TTL corto (la firma caduca). */
export const MEDIA_REDIRECT_SIGNED_CACHE_CONTROL = "public, max-age=60";

/**
 * Construye URL pública CDN delante del bucket.
 * - Rechaza keys `private/...` (defense in depth; identity/sensitive nunca CDN).
 * - Encodea segmentos del path.
 */
export function buildPublicObjectUrl(
  publicBaseUrl: string | null | undefined,
  key: string
): string | null {
  const base = (publicBaseUrl ?? "").replace(/\/$/, "").trim();
  if (!base) return null;
  const clean = key.replace(/^\/+/, "").trim();
  if (!clean) return null;
  if (clean.startsWith("private/") || clean.includes("/private/")) {
    return null;
  }
  if (clean.includes("..") || clean.includes("\\")) return null;
  const encoded = clean
    .split("/")
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  return `${base}/${encoded}`;
}

export function hasPublicCdnConfigured(
  publicBaseUrl: string | null | undefined
): boolean {
  return Boolean((publicBaseUrl ?? "").trim());
}

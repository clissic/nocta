/**
 * Rate limits en memoria para operaciones de imágenes (MVP / single-instance).
 * En multi-instancia conviene Redis; aquí endurece abuso local sin dependencias nuevas.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export const IMAGE_RATE_LIMITS = {
  /** Uploads públicos (perfil, espacio, review, post, news). */
  upload: { windowMs: 60_000, max: 30 },
  /** Borrado de fotos / refs. */
  delete: { windowMs: 60_000, max: 40 },
  /** Identity / claims / evidencia sensible. */
  sensitive: { windowMs: 60_000, max: 5 },
} as const;

export type ImageRateLimitKind = keyof typeof IMAGE_RATE_LIMITS;

/** true = permitido; false = limitado. */
export function consumeImageRateLimit(
  key: string,
  kind: ImageRateLimitKind,
  now = Date.now()
): boolean {
  const { windowMs, max } = IMAGE_RATE_LIMITS[kind];
  const fullKey = `${kind}:${key}`;
  const current = buckets.get(fullKey);
  if (!current || current.resetAt <= now) {
    buckets.set(fullKey, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (current.count >= max) return false;
  current.count += 1;
  return true;
}

/** Solo tests. */
export function resetImageRateLimitsForTests() {
  buckets.clear();
}

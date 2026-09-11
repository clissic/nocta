/**
 * Cache in-process de URLs firmadas (entre requests).
 * Solo para modo signed; CDN no usa esto.
 */
export type SignedUrlCacheOptions = {
  maxEntries?: number;
  /** Ms de vida; típico ~80% del TTL de firma. */
  ttlMs?: number;
};

type Entry = {
  url: string;
  expiresAt: number;
};

export function createSignedUrlCache(opts: SignedUrlCacheOptions = {}) {
  const maxEntries = Math.max(1, opts.maxEntries ?? 2000);
  const ttlMs = Math.max(1, opts.ttlMs ?? 48 * 60 * 1000);
  const map = new Map<string, Entry>();

  function touch(key: string, entry: Entry) {
    map.delete(key);
    map.set(key, entry);
  }

  function get(key: string): string | undefined {
    const entry = map.get(key);
    if (!entry) return undefined;
    if (Date.now() >= entry.expiresAt) {
      map.delete(key);
      return undefined;
    }
    touch(key, entry);
    return entry.url;
  }

  function set(key: string, url: string): void {
    if (map.has(key)) map.delete(key);
    map.set(key, { url, expiresAt: Date.now() + ttlMs });
    while (map.size > maxEntries) {
      const oldest = map.keys().next().value;
      if (oldest === undefined) break;
      map.delete(oldest);
    }
  }

  function clear(): void {
    map.clear();
  }

  function size(): number {
    return map.size;
  }

  return { get, set, clear, size, ttlMs, maxEntries };
}

/** Singleton de proceso (Discover / serialize / media). */
let singleton: ReturnType<typeof createSignedUrlCache> | null = null;

export function getSignedUrlCache(): ReturnType<typeof createSignedUrlCache> {
  if (!singleton) {
    const ttlSeconds = Math.max(
      60,
      Number(process.env.STORAGE_SIGNED_URL_TTL_SECONDS || "3600") || 3600
    );
    singleton = createSignedUrlCache({
      maxEntries: 2000,
      ttlMs: Math.floor(ttlSeconds * 0.8 * 1000),
    });
  }
  return singleton;
}

/** Solo tests. */
export function resetSignedUrlCacheForTests(): void {
  singleton = null;
}

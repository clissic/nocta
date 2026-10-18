import { extractManagedImageId } from "./optimizedImage";

const CACHE_NAME = "nocta-images-v1";
const MAX_ENTRIES = 300;

const memory = new Map<string, string>();
const order: string[] = [];
const inflight = new Map<string, Promise<string>>();

function stripQuery(url: string): string {
  const q = url.indexOf("?");
  return q >= 0 ? url.slice(0, q) : url;
}

/** Fotos de producto servidas por Nocta. Las CDN firmadas las cachea el browser por HTTP. */
export function isCacheableImageUrl(src: string): boolean {
  if (
    src.startsWith("blob:") ||
    src.startsWith("data:") ||
    src.startsWith("file:")
  ) {
    return false;
  }
  return (
    src.includes("/api/media/") ||
    src.includes("/uploads/") ||
    src.includes("/images/")
  );
}

/** Clave estable: el imageId no cambia aunque rote la firma. */
export function imageCacheKey(src: string): string {
  const id = extractManagedImageId(src);
  if (id) {
    let variant = "medium";
    let format = "webp";
    try {
      const url = new URL(src, "http://nocta.local");
      variant = url.searchParams.get("v") || variant;
      format = url.searchParams.get("f") || format;
      const file = url.pathname.match(/\/(thumb|medium|large)\.(webp|avif)$/i);
      if (file) {
        variant = file[1].toLowerCase();
        format = file[2].toLowerCase();
      }
    } catch {
      /* query opcional */
    }
    return `nocta:${id}:${variant}:${format}`;
  }
  return `nocta:${stripQuery(src)}`;
}

export function readMemoryImageCache(key: string): string | null {
  return memory.get(key) ?? null;
}

function cacheRequest(key: string) {
  return new Request(`https://nocta-image-cache.local/${encodeURIComponent(key)}`);
}

function remember(key: string, blobUrl: string) {
  if (!memory.has(key)) order.push(key);
  memory.set(key, blobUrl);
  while (order.length > MAX_ENTRIES) {
    const old = order.shift();
    if (!old) break;
    const url = memory.get(old);
    memory.delete(old);
    if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
    if (typeof caches !== "undefined") {
      void caches.open(CACHE_NAME).then((cache) => cache.delete(cacheRequest(old)));
    }
  }
}

async function readPersistent(key: string): Promise<string | null> {
  if (typeof caches === "undefined") return null;
  try {
    const cache = await caches.open(CACHE_NAME);
    const hit = await cache.match(cacheRequest(key));
    if (!hit) return null;
    const blobUrl = URL.createObjectURL(await hit.blob());
    remember(key, blobUrl);
    return blobUrl;
  } catch {
    return null;
  }
}

async function storePersistent(key: string, blob: Blob) {
  if (typeof caches === "undefined") return;
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(
      cacheRequest(key),
      new Response(blob.slice(), {
        headers: {
          "Content-Type": blob.type || "application/octet-stream",
        },
      })
    );
  } catch {
    /* cuota llena: queda solo en memoria */
  }
}

/** Una sola descarga por clave. Si falla, devuelve la URL de red. */
export function loadImageCache(src: string, key: string): Promise<string> {
  const mem = memory.get(key);
  if (mem) return Promise.resolve(mem);
  const pending = inflight.get(key);
  if (pending) return pending;

  const task = (async () => {
    const stored = await readPersistent(key);
    if (stored) return stored;
    try {
      const res = await fetch(src, { credentials: "omit" });
      if (!res.ok) return src;
      const blob = await res.blob();
      if (!blob.size) return src;
      await storePersistent(key, blob);
      const blobUrl = URL.createObjectURL(blob);
      remember(key, blobUrl);
      return blobUrl;
    } catch {
      return src;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, task);
  return task;
}

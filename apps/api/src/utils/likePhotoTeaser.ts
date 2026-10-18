import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { config } from "../config.js";
import { ImageAsset } from "../models/ImageAsset.js";
import {
  extractLegacyUploadPath,
  parseMediaImageId,
} from "../image-service/refs.js";
import { PROCESSING } from "../image-service/processingConstants.js";
import { getStorage } from "../storage/index.js";
import { UPLOADS_DIR } from "../uploads/paths.js";

/** Validez de la URL firmada del teaser (segundos). */
const TEASER_URL_TTL_SEC = 6 * 60 * 60;
const CACHE_MAX = 128;
const CACHE_TTL_MS = 30 * 60 * 1000;

const teaserCache = new Map<string, { buf: Buffer; at: number }>();

function signTeaser(likeId: string, viewerId: string, exp: number): string {
  return createHmac("sha256", config.jwtSecret)
    .update(`like-teaser:${likeId}:${viewerId}:${exp}`)
    .digest("base64url");
}

/** URL opaca firmada: no expone imageId ni foto clara. */
export function buildLikeTeaserUrl(likeId: string, viewerId: string): string {
  const exp = Math.floor(Date.now() / 1000) + TEASER_URL_TTL_SEC;
  const sig = signTeaser(likeId, viewerId, exp);
  const base = config.apiPublicUrl.replace(/\/$/, "");
  const path = `/api/discover/likes/${likeId}/teaser?exp=${exp}&vid=${encodeURIComponent(viewerId)}&sig=${sig}`;
  return base ? `${base}${path}` : path;
}

export function verifyLikeTeaserSig(
  likeId: string,
  viewerId: string,
  exp: number,
  sig: string
): boolean {
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) {
    return false;
  }
  if (!likeId || !viewerId || !sig) return false;
  const expected = signTeaser(likeId, viewerId, exp);
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(String(sig));
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

async function loadPhotoBytes(photoRef: string): Promise<Buffer | null> {
  const trimmed = photoRef.trim();
  if (!trimmed) return null;

  const imageId = parseMediaImageId(trimmed);
  if (imageId) {
    const doc = await ImageAsset.findOne({ imageId }).lean();
    if (!doc || doc.visibility !== "public" || !doc.variants) return null;
    const key =
      doc.variants.thumb?.webp?.key ||
      doc.variants.medium?.webp?.key ||
      doc.variants.large?.webp?.key;
    if (!key) return null;
    try {
      const obj = await getStorage().getObject(key);
      return obj.body;
    } catch {
      return null;
    }
  }

  const legacy = extractLegacyUploadPath(trimmed);
  if (legacy) {
    const name = legacy.slice("/uploads/".length);
    try {
      return await readFile(join(UPLOADS_DIR, name));
    } catch {
      return null;
    }
  }

  // Seed / externos (p. ej. Unsplash): bajar bytes en el servidor para blurrear.
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const res = await fetch(trimmed, {
        redirect: "follow",
        signal: AbortSignal.timeout(10_000),
        headers: { Accept: "image/*" },
      });
      if (!res.ok) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      if (!buf.length || buf.length > PROCESSING.socialMaxUploadBytes) {
        return null;
      }
      return buf;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Genera WebP blurreado a partir de la foto de perfil.
 * El cliente nunca recibe la imagen nítida en likes bloqueados.
 */
export async function buildBlurredTeaserFromPhotoRef(
  photoRef: string
): Promise<Buffer | null> {
  const cacheKey = createHash("sha256").update(photoRef.trim()).digest("hex");
  const hit = teaserCache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return hit.buf;
  }

  const source = await loadPhotoBytes(photoRef);
  if (!source?.length) return null;

  try {
    const buf = await sharp(source, {
      failOn: "error",
      limitInputPixels: PROCESSING.maxPixels,
    })
      .rotate()
      .resize({
        width: 320,
        withoutEnlargement: true,
        fit: "inside",
      })
      .blur(28)
      .webp({ quality: 55, effort: 4 })
      .toBuffer();

    if (teaserCache.size >= CACHE_MAX) {
      const oldest = teaserCache.keys().next().value;
      if (oldest) teaserCache.delete(oldest);
    }
    teaserCache.set(cacheKey, { buf, at: Date.now() });
    return buf;
  } catch {
    return null;
  }
}

/** Solo tests. */
export function resetLikeTeaserCacheForTests() {
  teaserCache.clear();
}

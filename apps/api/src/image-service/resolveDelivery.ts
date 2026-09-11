import { ImageAsset } from "../models/ImageAsset.js";
import { createImageService } from "./imageService.js";
import { getStorage } from "../storage/index.js";
import type { ImageType } from "./types.js";
import { parseMediaImageId } from "./refs.js";
import { config } from "../config.js";

export type DeliveryVariant = "thumb" | "medium" | "large";
export type DeliveryFormat = "webp" | "avif";

type ExpandOpts = {
  variant?: DeliveryVariant;
  format?: DeliveryFormat;
};

function absolutizeLegacyUpload(url: string): string {
  if (!url.startsWith("/uploads/")) return url;
  const base = config.apiPublicUrl.replace(/\/$/, "");
  return base ? `${base}${url}` : url;
}

async function resolveManagedDelivery(
  imageId: string,
  opts: ExpandOpts
): Promise<string | undefined> {
  const variant = opts.variant ?? "medium";
  const format = opts.format ?? "webp";

  const doc = await ImageAsset.findOne({ imageId }).lean();
  if (!doc) return undefined;

  if (doc.visibility !== "public") {
    return undefined;
  }

  const slot = doc.variants?.[variant];
  const file = slot?.[format];
  if (!file?.key) return undefined;

  const images = createImageService(getStorage());
  try {
    const resolved = await images.resolveReadUrl(
      doc.imageType as ImageType,
      file.key,
      { preferPublicUrl: true }
    );
    return resolved.url;
  } catch {
    return undefined;
  }
}

/**
 * Resuelve una ref de producto a URL de entrega directa.
 * - Legacy `/uploads/...` → API (compat read-only Fase 11).
 * - Managed públicas → CDN o URL firmada (Browser → Object Storage).
 * - Private → undefined (no exponer).
 */
export async function resolveDeliveryUrl(
  ref: string | null | undefined,
  opts: ExpandOpts = {}
): Promise<string | undefined> {
  if (!ref) return undefined;
  const trimmed = ref.trim();
  if (!trimmed) return undefined;

  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("blob:")) {
    const mediaId = parseMediaImageId(trimmed);
    if (!mediaId) return trimmed;
    return (await resolveManagedDelivery(mediaId, opts)) ?? undefined;
  }

  if (trimmed.startsWith("/uploads/")) {
    return absolutizeLegacyUpload(trimmed);
  }

  const imageId = parseMediaImageId(trimmed);
  if (!imageId) return trimmed;

  return resolveManagedDelivery(imageId, opts);
}

/** Batch 1:1 con `refs` (mismo length; huecos → ""). */
export async function resolveDeliveryUrls(
  refs: Array<string | null | undefined>,
  opts: ExpandOpts = {}
): Promise<string[]> {
  const variant = opts.variant ?? "medium";
  const format = opts.format ?? "webp";
  const list = refs.map((r) => (typeof r === "string" ? r.trim() : ""));

  const ids = [
    ...new Set(
      list
        .map((r) => (r ? parseMediaImageId(r) : null))
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const docs =
    ids.length > 0
      ? await ImageAsset.find({
          imageId: { $in: ids },
          visibility: "public",
        }).lean()
      : [];
  const byId = new Map(docs.map((d) => [d.imageId, d]));
  const images = createImageService(getStorage());
  const signedCache = new Map<string, string>();

  async function signKey(imageType: ImageType, key: string): Promise<string> {
    const cached = signedCache.get(key);
    if (cached) return cached;
    const resolved = await images.resolveReadUrl(imageType, key, {
      preferPublicUrl: true,
    });
    signedCache.set(key, resolved.url);
    return resolved.url;
  }

  const out: string[] = [];
  for (const ref of list) {
    if (!ref) {
      out.push("");
      continue;
    }
    if (/^https?:\/\//i.test(ref) && !parseMediaImageId(ref)) {
      out.push(ref);
      continue;
    }
    if (ref.startsWith("/uploads/")) {
      out.push(absolutizeLegacyUpload(ref));
      continue;
    }

    const imageId = parseMediaImageId(ref);
    if (!imageId) {
      out.push(ref);
      continue;
    }

    const doc = byId.get(imageId);
    const file = doc?.variants?.[variant]?.[format];
    if (!doc || !file?.key) {
      out.push("");
      continue;
    }
    try {
      out.push(await signKey(doc.imageType as ImageType, file.key));
    } catch {
      out.push("");
    }
  }
  return out;
}

/**
 * Mapea URLs de entrega (firmadas/CDN) otra vez a refs estables
 * `/api/media/{id}` o `/uploads/...` usando las refs previas del documento.
 */
export async function canonicalizeIncomingPhotoRefs(
  incoming: string[],
  previousStableRefs: string[]
): Promise<string[]> {
  const { canonicalizePhotoRef } = await import("./uploadBridge.js");
  const expanded = await resolveDeliveryUrls(previousStableRefs);
  const map = new Map<string, string>();
  for (let i = 0; i < previousStableRefs.length; i++) {
    const stable = canonicalizePhotoRef(previousStableRefs[i]!);
    const deliv = expanded[i];
    if (!deliv) continue;
    map.set(deliv, stable);
    try {
      const u = new URL(deliv);
      map.set(`${u.origin}${u.pathname}`, stable);
    } catch {
      /* ignore */
    }
  }

  return incoming.map((raw) => {
    const direct = canonicalizePhotoRef(raw);
    if (direct.startsWith("/api/media/") || direct.startsWith("/uploads/")) {
      return direct;
    }
    const hit = map.get(raw);
    if (hit) return hit;
    try {
      const u = new URL(raw);
      return map.get(`${u.origin}${u.pathname}`) ?? direct;
    } catch {
      return direct;
    }
  });
}

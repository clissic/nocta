import { existsSync } from "node:fs";
import { join } from "node:path";
import { ImageAsset } from "../models/ImageAsset.js";
import { createImageService } from "./imageService.js";
import { getStorage } from "../storage/index.js";
import type { ImageType } from "./types.js";
import { extractLegacyUploadPath, parseMediaImageId } from "./refs.js";
import { config } from "../config.js";
import { UPLOADS_DIR } from "../uploads/paths.js";

/** memory:// no es cargable por browser/RN → proxy HTTP de la API. */
function apiMediaProxyUrl(
  imageId: string,
  variant: DeliveryVariant,
  format: DeliveryFormat
): string {
  const base = config.apiPublicUrl.replace(/\/$/, "");
  const path = `/api/media/${imageId}?v=${variant}&f=${format}`;
  return base ? `${base}${path}` : path;
}

function isMemoryDeliveryUrl(url: string): boolean {
  return url.startsWith("memory://");
}

export type DeliveryVariant = "thumb" | "medium" | "large";
export type DeliveryFormat = "webp" | "avif";

type ExpandOpts = {
  variant?: DeliveryVariant;
  format?: DeliveryFormat;
};

function absolutizeLegacyUpload(url: string): string {
  const legacy = extractLegacyUploadPath(url) ?? url;
  if (!legacy.startsWith("/uploads/")) return url;
  const base = config.apiPublicUrl.replace(/\/$/, "");
  return base ? `${base}${legacy}` : legacy;
}

function legacyFileExists(legacyPath: string): boolean {
  const name = legacyPath.slice("/uploads/".length);
  if (!name || name.includes("..") || name.includes("/") || name.includes("\\")) {
    return false;
  }
  return existsSync(join(UPLOADS_DIR, name));
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

  const storage = getStorage();
  const images = createImageService(storage);
  try {
    // Driver memory: no hay CDN ni URL firmada HTTP; servir vía /api/media.
    if (storage.driver === "memory") {
      const exists = await storage.exists(file.key);
      if (!exists) return undefined;
      return apiMediaProxyUrl(imageId, variant, format);
    }
    const resolved = await images.resolveReadUrl(
      doc.imageType as ImageType,
      file.key,
      { preferPublicUrl: true }
    );
    if (isMemoryDeliveryUrl(resolved.url)) {
      return apiMediaProxyUrl(imageId, variant, format);
    }
    return resolved.url;
  } catch {
    return undefined;
  }
}

async function resolveLegacyDelivery(
  legacyPath: string,
  opts: ExpandOpts
): Promise<string | undefined> {
  const migrated = await ImageAsset.findOne({
    legacySource: legacyPath,
    visibility: "public",
  }).lean();
  if (migrated?.imageId) {
    const delivered = await resolveManagedDelivery(migrated.imageId, opts);
    if (delivered) return delivered;
  }
  if (legacyFileExists(legacyPath)) {
    return absolutizeLegacyUpload(legacyPath);
  }
  // Ref rota (archivo ausente y sin ImageAsset): no devolver URL 404.
  return undefined;
}

/**
 * Resuelve una ref de producto a URL de entrega directa.
 * - Legacy `/uploads/...` (también absolutas) → Object Storage migrado, o API si existe en disco.
 * - Managed públicas → CDN o URL firmada (Browser → Object Storage).
 * - Private / rotas → undefined (no exponer).
 */
export async function resolveDeliveryUrl(
  ref: string | null | undefined,
  opts: ExpandOpts = {}
): Promise<string | undefined> {
  if (!ref) return undefined;
  const trimmed = ref.trim();
  if (!trimmed) return undefined;

  const legacy = extractLegacyUploadPath(trimmed);
  if (legacy) {
    return resolveLegacyDelivery(legacy, opts);
  }

  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("blob:")) {
    const mediaId = parseMediaImageId(trimmed);
    if (!mediaId) return trimmed;
    return (await resolveManagedDelivery(mediaId, opts)) ?? undefined;
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

  const legacyPaths = [
    ...new Set(
      list
        .map((r) => (r ? extractLegacyUploadPath(r) : null))
        .filter((p): p is string => Boolean(p))
    ),
  ];

  const ids = [
    ...new Set(
      list
        .map((r) => {
          if (!r || extractLegacyUploadPath(r)) return null;
          return parseMediaImageId(r);
        })
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const [docs, legacyDocs] = await Promise.all([
    ids.length > 0
      ? ImageAsset.find({
          imageId: { $in: ids },
          visibility: "public",
        }).lean()
      : Promise.resolve([]),
    legacyPaths.length > 0
      ? ImageAsset.find({
          legacySource: { $in: legacyPaths },
          visibility: "public",
        }).lean()
      : Promise.resolve([]),
  ]);

  const byId = new Map(docs.map((d) => [d.imageId, d]));
  const byLegacy = new Map(
    legacyDocs
      .filter((d) => typeof d.legacySource === "string")
      .map((d) => [d.legacySource as string, d])
  );
  const storage = getStorage();
  const images = createImageService(storage);
  const signedCache = new Map<string, string>();
  const memoryDriver = storage.driver === "memory";

  async function signKey(imageType: ImageType, key: string): Promise<string> {
    const cached = signedCache.get(key);
    if (cached) return cached;
    const resolved = await images.resolveReadUrl(imageType, key, {
      preferPublicUrl: true,
    });
    signedCache.set(key, resolved.url);
    return resolved.url;
  }

  async function deliverDoc(
    doc: (typeof docs)[number] | undefined
  ): Promise<string> {
    const file = doc?.variants?.[variant]?.[format];
    if (!doc || !file?.key) return "";
    try {
      if (memoryDriver) {
        const exists = await storage.exists(file.key);
        if (!exists) return "";
        return apiMediaProxyUrl(doc.imageId, variant, format);
      }
      const url = await signKey(doc.imageType as ImageType, file.key);
      if (isMemoryDeliveryUrl(url)) {
        return apiMediaProxyUrl(doc.imageId, variant, format);
      }
      return url;
    } catch {
      return "";
    }
  }

  const out: string[] = [];
  for (const ref of list) {
    if (!ref) {
      out.push("");
      continue;
    }

    const legacy = extractLegacyUploadPath(ref);
    if (legacy) {
      const migrated = byLegacy.get(legacy);
      if (migrated) {
        out.push(await deliverDoc(migrated));
        continue;
      }
      out.push(legacyFileExists(legacy) ? absolutizeLegacyUpload(legacy) : "");
      continue;
    }

    if (/^https?:\/\//i.test(ref) && !parseMediaImageId(ref)) {
      out.push(ref);
      continue;
    }

    const imageId = parseMediaImageId(ref);
    if (!imageId) {
      out.push(ref);
      continue;
    }

    out.push(await deliverDoc(byId.get(imageId)));
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

import {
  StorageError,
  type ObjectStorage,
  type StorageBody,
} from "../storage/index.js";
import {
  PRIVATE_OBJECT_CACHE_CONTROL,
  PUBLIC_OBJECT_CACHE_CONTROL,
} from "../storage/publicUrl.js";
import {
  imageMetric,
  imageMetricFromError,
  redactImageId,
  redactStorageKey,
  withTiming,
} from "./observability.js";
import { getSignedUrlCache } from "./signedUrlCache.js";
import { getImageTypeConfig } from "./registry.js";
import {
  buildImagePrefix,
  buildObjectKey,
  createImageId,
} from "./paths.js";
import type {
  ImagePathContext,
  ImageRecord,
  ImageType,
  ImageTypeConfig,
} from "./types.js";

export type UploadImageObjectInput = {
  type: ImageType;
  context: ImagePathContext;
  body: StorageBody;
  contentType: string;
  /** Nombre lógico del objeto (p. ej. `original.tmp`, luego `medium.webp`). */
  filename: string;
  /** Si no se pasa, se genera uno nuevo. */
  imageId?: string;
  ownerId: string;
  cacheControl?: string;
  bytes?: number;
};

export type UploadImageObjectResult = {
  imageId: string;
  key: string;
  type: ImageType;
  visibility: ImageTypeConfig["visibility"];
  record: ImageRecord;
};

export type ResolveReadUrlOptions = {
  /** Override TTL; default según tipo. */
  expiresInSeconds?: number;
  /**
   * Si true y el tipo es public + hay CDN base, usa URL pública permanente.
   * Private SIEMPRE ignora esto y firma.
   */
  preferPublicUrl?: boolean;
};

/**
 * Servicio genérico de imágenes (todos los tipos).
 * No duplicar por dominio (profile/space/review…).
 */
export function createImageService(storage: ObjectStorage) {
  function getConfig(type: ImageType): ImageTypeConfig {
    return getImageTypeConfig(type);
  }

  function assertMimeAllowed(type: ImageType, contentType: string) {
    const config = getConfig(type);
    const mime = contentType.toLowerCase().trim();
    /** Fuentes de upload + salidas Sharp (webp/avif/jpeg) y PDF de evidencia. */
    const allowed = new Set([
      ...config.allowedMimeTypes.map((m) => m.toLowerCase()),
      "image/webp",
      "image/avif",
      "image/jpeg",
      "application/pdf",
    ]);
    if (!allowed.has(mime)) {
      throw new StorageError(
        "IMAGE_MIME_NOT_ALLOWED",
        `MIME no permitido para ${type}: ${contentType}`
      );
    }
  }

  function assertSizeAllowed(type: ImageType, bytes: number) {
    const config = getConfig(type);
    if (bytes > config.maxUploadBytes) {
      throw new StorageError(
        "IMAGE_TOO_LARGE",
        `Archivo supera el máximo de ${config.maxUploadBytes} bytes para ${type}`
      );
    }
  }

  async function uploadObject(
    input: UploadImageObjectInput
  ): Promise<UploadImageObjectResult> {
    const config = getConfig(input.type);
    assertMimeAllowed(input.type, input.contentType);

    const size =
      input.bytes ??
      (typeof input.body === "string"
        ? Buffer.byteLength(input.body)
        : input.body.byteLength);
    assertSizeAllowed(input.type, size);

    const imageId = input.imageId ?? createImageId();
    const key = buildObjectKey({
      type: input.type,
      imageId,
      context: input.context,
      filename: input.filename,
    });

    const cacheControl =
      input.cacheControl ??
      (config.visibility === "public"
        ? PUBLIC_OBJECT_CACHE_CONTROL
        : PRIVATE_OBJECT_CACHE_CONTROL);

    try {
      const { ms } = await withTiming(() =>
        storage.putObject({
          key,
          body: input.body,
          contentType: input.contentType,
          cacheControl,
          metadata: {
            imageType: input.type,
            imageId,
            ownerId: input.ownerId,
            visibility: config.visibility,
          },
        })
      );
      imageMetric("upload", {
        imageType: input.type,
        visibility: config.visibility,
        ms,
        keyHint: redactStorageKey(key),
        imageIdHint: redactImageId(imageId),
      });
    } catch (err) {
      imageMetricFromError("storage_error", err, {
        op: "putObject",
        imageType: input.type,
        visibility: config.visibility,
        keyHint: redactStorageKey(key),
      });
      throw err;
    }

    const record: ImageRecord = {
      imageId,
      type: input.type,
      ownerId: input.ownerId,
      visibility: config.visibility,
      keys: [key],
      contentType: input.contentType,
      bytes: size,
      createdAt: new Date(),
    };

    return {
      imageId,
      key,
      type: input.type,
      visibility: config.visibility,
      record,
    };
  }

  async function deleteObject(key: string): Promise<void> {
    await storage.deleteObject(key);
  }

  async function deleteObjects(keys: string[]): Promise<void> {
    await storage.deleteObjects(keys);
  }

  async function deleteImageFolder(opts: {
    type: ImageType;
    imageId: string;
    context: ImagePathContext;
    keys: string[];
  }): Promise<void> {
    const known = [...new Set(opts.keys.filter(Boolean))];
    if (known.length) {
      await storage.deleteObjects(known);
      return;
    }
    // Fallback housekeeping: list + delete por prefix (Fase 14).
    const prefix = buildImagePrefix(opts);
    await storage.deleteByPrefix(prefix);
  }

  async function exists(key: string): Promise<boolean> {
    return storage.exists(key);
  }

  async function head(key: string) {
    return storage.headObject(key);
  }

  /**
   * Resuelve URL de lectura.
   * - private / sensitive → solo firmada (nunca CDN pública).
   * - public → CDN (`STORAGE_PUBLIC_BASE_URL`) si está configurada; si no, firmada.
   * Mongo sigue guardando storageKey / `/api/media/{id}`, nunca URLs absolutas.
   */
  async function resolveReadUrl(
    type: ImageType,
    key: string,
    opts: ResolveReadUrlOptions = {}
  ): Promise<{ url: string; mode: "public" | "signed" }> {
    if (!key || key.includes("..") || key.startsWith("/") || key.includes("\\")) {
      throw new StorageError("IMAGE_KEY_INVALID", "Key de objeto inválida");
    }
    const config = getConfig(type);
    const preferPublic = opts.preferPublicUrl !== false;

    // Defense in depth: keys private/ nunca salen por CDN aunque el tipo diga public.
    const looksPrivateKey =
      key.startsWith("private/") || key.includes("/private/");

    if (config.visibility === "private" || looksPrivateKey) {
      const cache = getSignedUrlCache();
      const cacheKey = `priv:${key}:${opts.expiresInSeconds ?? config.signedUrlTtlSeconds}`;
      const hit = cache.get(cacheKey);
      if (hit) return { url: hit, mode: "signed" as const };
      try {
        const { result: url, ms } = await withTiming(() =>
          storage.getSignedReadUrl(key, {
            expiresInSeconds:
              opts.expiresInSeconds ?? config.signedUrlTtlSeconds,
          })
        );
        cache.set(cacheKey, url);
        imageMetric("signing", {
          imageType: type,
          visibility: "private",
          mode: "signed",
          ms,
          keyHint: redactStorageKey(key),
        });
        return { url, mode: "signed" as const };
      } catch (err) {
        imageMetricFromError("storage_error", err, {
          op: "getSignedReadUrl",
          imageType: type,
          visibility: "private",
          keyHint: redactStorageKey(key),
        });
        throw err;
      }
    }

    if (preferPublic) {
      const publicUrl = storage.getPublicUrl(key);
      if (publicUrl) return { url: publicUrl, mode: "public" };
    }

    const cache = getSignedUrlCache();
    const cacheKey = `pub:${key}:${opts.expiresInSeconds ?? config.signedUrlTtlSeconds}`;
    const hit = cache.get(cacheKey);
    if (hit) return { url: hit, mode: "signed" as const };

    try {
      const { result: url, ms } = await withTiming(() =>
        storage.getSignedReadUrl(key, {
          expiresInSeconds:
            opts.expiresInSeconds ?? config.signedUrlTtlSeconds,
        })
      );
      cache.set(cacheKey, url);
      imageMetric("signing", {
        imageType: type,
        visibility: "public",
        mode: "signed",
        ms,
        keyHint: redactStorageKey(key),
      });
      return { url, mode: "signed" as const };
    } catch (err) {
      imageMetricFromError("storage_error", err, {
        op: "getSignedReadUrl",
        imageType: type,
        visibility: "public",
        keyHint: redactStorageKey(key),
      });
      throw err;
    }
  }

  /** Intento explícito de URL pública: falla en private / keys private/. */
  function getPublicUrlOrNull(type: ImageType, key: string): string | null {
    const config = getConfig(type);
    if (config.visibility === "private") return null;
    if (key.startsWith("private/") || key.includes("/private/")) return null;
    return storage.getPublicUrl(key);
  }

  return {
    storage,
    getConfig,
    createImageId,
    buildObjectKey: (opts: {
      type: ImageType;
      imageId: string;
      context: ImagePathContext;
      filename: string;
    }) => buildObjectKey(opts),
    uploadObject,
    deleteObject,
    deleteObjects,
    deleteImageFolder,
    exists,
    head,
    resolveReadUrl,
    getPublicUrlOrNull,
  };
}

export type ImageService = ReturnType<typeof createImageService>;

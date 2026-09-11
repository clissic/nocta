import { unlink } from "node:fs/promises";
import { ImageAsset } from "../models/ImageAsset.js";
import { StorageError, getStorage, type ObjectStorage } from "../storage/index.js";
import { createImageService } from "./imageService.js";
import {
  imageMetricFromError,
  redactImageId,
} from "./observability.js";
import { buildIdentityProcessed, buildEvidenceProcessed, buildPublicVariants } from "./processVariants.js";
import { PROCESSING } from "./processingConstants.js";
import { mediaRefForImageId, parseMediaImageId } from "./refs.js";
import { getImageTypeConfig } from "./registry.js";
import type { ImagePathContext, ImageType } from "./types.js";
import {
  isHeicSupported,
  validateImageSource,
} from "./validateSource.js";

export type IngestPublicInput = {
  type: ImageType;
  ownerId: string;
  entityType: string;
  entityId?: string;
  context: ImagePathContext;
  buffer: Buffer;
  declaredMime?: string;
  /** Path temporal a borrar al final (multer disk). */
  tempPath?: string;
  storage?: ObjectStorage;
};

export type IngestPublicResult = {
  imageId: string;
  /** Ref estable para guardar en Mongo de producto (`/api/media/{id}`). */
  mediaRef: string;
  width: number;
  height: number;
  keys: string[];
};

export type IngestIdentityInput = {
  ownerId: string;
  context: ImagePathContext;
  buffer: Buffer;
  declaredMime?: string;
  tempPath?: string;
  storage?: ObjectStorage;
  /** Si true, conserva también el buffer original (EXIF stripped via re-encode only). Default false: solo processed. */
  keepProcessedOnly?: boolean;
};

async function cleanupTemp(tempPath?: string) {
  if (!tempPath) return;
  try {
    await unlink(tempPath);
  } catch {
    /* ignore */
  }
}

function assertPublicVariantsProfile(type: ImageType) {
  const config = getImageTypeConfig(type);
  if (config.visibility !== "public") {
    throw new StorageError(
      "IMAGE_NOT_PUBLIC",
      `El tipo ${type} no es público; usá el flujo identity/private`
    );
  }
  if (config.processingProfile !== "variants_v1") {
    throw new StorageError(
      "IMAGE_PROFILE",
      `El tipo ${type} no usa variants_v1`
    );
  }
}

/**
 * Pipeline público: validate → Sharp variants → storage → metadata → delete temp.
 * NO persiste el original.
 */
export async function ingestPublicImage(
  input: IngestPublicInput
): Promise<IngestPublicResult> {
  assertPublicVariantsProfile(input.type);
  const config = getImageTypeConfig(input.type);
  const maxBytes = Math.min(
    config.maxUploadBytes,
    PROCESSING.socialMaxUploadBytes
  );

  try {
    const allowHeic = await isHeicSupported();
    const validated = await validateImageSource({
      buffer: input.buffer,
      declaredMime: input.declaredMime,
      maxBytes,
      allowHeic,
    });
    if (!validated.ok) {
      throw new StorageError(validated.code, validated.error);
    }

    const built = await buildPublicVariants(validated.buffer);
    const storage = input.storage ?? getStorage();
    const images = createImageService(storage);
    const imageId = images.createImageId();

    const keys: string[] = [];
    const variantDocs: Record<
      string,
      {
        webp: { key: string; width: number; height: number; bytes: number };
        avif: { key: string; width: number; height: number; bytes: number };
      }
    > = {};

    for (const file of built.variants) {
      const uploaded = await images.uploadObject({
        type: input.type,
        context: input.context,
        ownerId: input.ownerId,
        imageId,
        body: file.buffer,
        contentType: file.contentType,
        filename: file.filename,
        bytes: file.bytes,
      });
      keys.push(uploaded.key);
      const slot = variantDocs[file.name] ?? {
        webp: { key: "", width: 0, height: 0, bytes: 0 },
        avif: { key: "", width: 0, height: 0, bytes: 0 },
      };
      slot[file.format] = {
        key: uploaded.key,
        width: file.width,
        height: file.height,
        bytes: file.bytes,
      };
      variantDocs[file.name] = slot;
    }

    await ImageAsset.create({
      imageId,
      ownerId: input.ownerId,
      entityType: input.entityType,
      entityId: input.entityId,
      imageType: input.type,
      visibility: "public",
      width: built.width,
      height: built.height,
      variants: {
        thumb: variantDocs.thumb,
        medium: variantDocs.medium,
        large: variantDocs.large,
      },
      keys,
    });

    return {
      imageId,
      mediaRef: mediaRefForImageId(imageId),
      width: built.width,
      height: built.height,
      keys,
    };
  } catch (err) {
    imageMetricFromError("processing_error", err, {
      imageType: input.type,
      visibility: "public",
      op: "ingestPublicImage",
    });
    throw err;
  } finally {
    await cleanupTemp(input.tempPath);
  }
}

/**
 * Identity PRIVATE: validate → strip EXIF/orient → JPEG privado → metadata.
 * Sin URL pública. No genera thumb/medium/large públicos.
 */
export async function ingestIdentityImage(
  input: IngestIdentityInput
): Promise<IngestPublicResult & { storageKey: string }> {
  const config = getImageTypeConfig("identity_verification");
  try {
    const allowHeic = await isHeicSupported();
    const validated = await validateImageSource({
      buffer: input.buffer,
      declaredMime: input.declaredMime,
      maxBytes: config.maxUploadBytes,
      allowHeic,
    });
    if (!validated.ok) {
      throw new StorageError(validated.code, validated.error);
    }

    const processed = await buildIdentityProcessed(validated.buffer);
    const storage = input.storage ?? getStorage();
    const images = createImageService(storage);
    const imageId = images.createImageId();

    const uploaded = await images.uploadObject({
      type: "identity_verification",
      context: input.context,
      ownerId: input.ownerId,
      imageId,
      body: processed.buffer,
      contentType: processed.contentType,
      filename: processed.filename,
      bytes: processed.bytes,
    });

    await ImageAsset.create({
      imageId,
      ownerId: input.ownerId,
      entityType: "identity",
      entityId: input.ownerId,
      imageType: "identity_verification",
      visibility: "private",
      width: processed.width,
      height: processed.height,
      storageKey: uploaded.key,
      contentType: processed.contentType,
      bytes: processed.bytes,
      keys: [uploaded.key],
    });

    return {
      imageId,
      mediaRef: mediaRefForImageId(imageId),
      width: processed.width,
      height: processed.height,
      keys: [uploaded.key],
      storageKey: uploaded.key,
    };
  } catch (err) {
    imageMetricFromError("processing_error", err, {
      imageType: "identity_verification",
      visibility: "private",
      op: "ingestIdentityImage",
    });
    throw err;
  } finally {
    await cleanupTemp(input.tempPath);
  }
}

export type IngestPrivateEvidenceInput = {
  type: Extract<ImageType, "claim_evidence" | "report_evidence">;
  ownerId: string;
  entityType: string;
  entityId?: string;
  context: ImagePathContext;
  buffer: Buffer;
  declaredMime: string;
  tempPath?: string;
  storage?: ObjectStorage;
};

/**
 * Evidencia PRIVATE (claims / reports): PDF o imagen sin EXIF.
 * Sin URL pública; acceso solo vía rutas autorizadas (signed).
 */
export async function ingestPrivateEvidence(
  input: IngestPrivateEvidenceInput
): Promise<IngestPublicResult & { storageKey: string; contentType: string }> {
  const config = getImageTypeConfig(input.type);
  if (config.visibility !== "private") {
    throw new StorageError(
      "IMAGE_NOT_PRIVATE",
      `El tipo ${input.type} no es privado`
    );
  }
  const mime = input.declaredMime.toLowerCase().trim();
  if (!config.allowedMimeTypes.map((m) => m.toLowerCase()).includes(mime)) {
    throw new StorageError(
      "IMAGE_MIME_NOT_ALLOWED",
      `MIME no permitido para ${input.type}: ${input.declaredMime}`
    );
  }
  if (input.buffer.byteLength > config.maxUploadBytes) {
    throw new StorageError(
      "IMAGE_TOO_LARGE",
      `Archivo supera el máximo de ${config.maxUploadBytes} bytes`
    );
  }

  try {
    let body = input.buffer;
    let declaredMime = mime;
    if (mime.startsWith("image/")) {
      const allowHeic = await isHeicSupported();
      const validated = await validateImageSource({
        buffer: input.buffer,
        declaredMime: mime,
        maxBytes: config.maxUploadBytes,
        allowHeic,
      });
      if (!validated.ok) {
        throw new StorageError(validated.code, validated.error);
      }
      body = validated.buffer;
      declaredMime = validated.mime;
    }

    const processed = await buildEvidenceProcessed(body, declaredMime);
    const storage = input.storage ?? getStorage();
    const images = createImageService(storage);
    const imageId = images.createImageId();

    const uploaded = await images.uploadObject({
      type: input.type,
      context: input.context,
      ownerId: input.ownerId,
      imageId,
      body: processed.buffer,
      contentType: processed.contentType,
      filename: processed.filename,
      bytes: processed.bytes,
    });

    await ImageAsset.create({
      imageId,
      ownerId: input.ownerId,
      entityType: input.entityType,
      entityId: input.entityId,
      imageType: input.type,
      visibility: "private",
      width: processed.width,
      height: processed.height,
      storageKey: uploaded.key,
      contentType: processed.contentType,
      bytes: processed.bytes,
      keys: [uploaded.key],
    });

    return {
      imageId,
      mediaRef: mediaRefForImageId(imageId),
      width: processed.width,
      height: processed.height,
      keys: [uploaded.key],
      storageKey: uploaded.key,
      contentType: processed.contentType,
    };
  } catch (err) {
    imageMetricFromError("processing_error", err, {
      imageType: input.type,
      visibility: "private",
      op: "ingestPrivateEvidence",
    });
    throw err;
  } finally {
    await cleanupTemp(input.tempPath);
  }
}

/** Borra metadata + objetos de storage. Idempotente. */
export async function deleteManagedImage(refOrId: string): Promise<void> {
  const imageId = parseMediaImageId(refOrId) ?? refOrId;
  const doc = await ImageAsset.findOne({ imageId });
  if (!doc) return;

  const keys = [
    ...(doc.keys ?? []),
    doc.storageKey,
    doc.variants?.thumb?.webp?.key,
    doc.variants?.thumb?.avif?.key,
    doc.variants?.medium?.webp?.key,
    doc.variants?.medium?.avif?.key,
    doc.variants?.large?.webp?.key,
    doc.variants?.large?.avif?.key,
  ].filter((k): k is string => Boolean(k));

  try {
    await getStorage().deleteObjects(keys);
  } catch (err) {
    imageMetricFromError("cleanup_error", err, {
      op: "deleteManagedImage",
      imageIdHint: redactImageId(imageId),
    });
  }
  await ImageAsset.deleteOne({ imageId });
}

export async function deleteManagedImages(refs: string[]): Promise<void> {
  for (const ref of refs) {
    if (parseMediaImageId(ref)) await deleteManagedImage(ref);
  }
}

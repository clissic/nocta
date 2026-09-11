import { readFileSync } from "node:fs";
import { unlink } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import type { CollectedUpload } from "../uploads/middleware.js";
import { deleteLocalUpload, deleteTempUploadPath } from "../uploads/validate.js";
import type { ClaimEvidenceFile } from "../uploads/claimEvidence.js";
import {
  deleteManagedImage,
  ingestIdentityImage,
  ingestPrivateEvidence,
  ingestPublicImage,
  isLegacyUploadRef,
  isManagedMediaRef,
  parseMediaImageId,
  type IngestPublicResult,
} from "./index.js";
import type { ImagePathContext, ImageType } from "./types.js";
import { StorageError } from "../storage/index.js";
import { looksLikeManagedImageId } from "./privateAccess.js";

export function isAllowedPhotoRef(value: string): boolean {
  return (
    value.startsWith("/uploads/") ||
    value.startsWith("/api/media/") ||
    isManagedMediaRef(value) ||
    /^https?:\/\//i.test(value)
  );
}

/**
 * Fase 11: no aceptar refs `/uploads/...` nuevas.
 * Solo se permiten si ya estaban en el documento (compat lectura).
 */
export function findForbiddenNewLegacyUploadRefs(
  incoming: string[],
  previousStableRefs: string[]
): string[] {
  const prev = new Set(
    previousStableRefs.map((r) => canonicalizePhotoRef(r)).filter(isLegacyUploadRef)
  );
  const forbidden: string[] = [];
  for (const raw of incoming) {
    const ref = canonicalizePhotoRef(raw);
    if (isLegacyUploadRef(ref) && !prev.has(ref)) {
      forbidden.push(ref);
    }
  }
  return forbidden;
}

/** Normaliza refs absolutas de /api/media a path relativo estable. */
export function canonicalizePhotoRef(value: string): string {
  const id = parseMediaImageId(value);
  if (id) return `/api/media/${id}`;
  if (value.startsWith("/uploads/")) return value;
  return value;
}

export async function removePhotoRef(ref: string): Promise<void> {
  if (isManagedMediaRef(ref) || ref.startsWith("/api/media/")) {
    await deleteManagedImage(ref);
    return;
  }
  if (isLegacyUploadRef(ref)) {
    deleteLocalUpload(
      ref.includes("/uploads/") ? ref.slice(ref.indexOf("/uploads/")) : ref
    );
  }
}

/** Borra identity path: managed imageId o archivo legacy en disco. */
export async function removeIdentityStoredRef(
  stored: string | null | undefined
): Promise<void> {
  if (!stored) return;
  if (looksLikeManagedImageId(stored)) {
    await deleteManagedImage(stored);
    return;
  }
  const { deleteIdentityVerificationFiles } = await import(
    "../uploads/identityVerification.js"
  );
  deleteIdentityVerificationFiles([stored]);
}

export async function ingestCollectedPublicUpload(opts: {
  upload: CollectedUpload;
  type: ImageType;
  ownerId: string;
  entityType: string;
  entityId?: string;
  context: ImagePathContext;
}): Promise<IngestPublicResult> {
  const buffer = readFileSync(opts.upload.path);
  try {
    return await ingestPublicImage({
      type: opts.type,
      ownerId: opts.ownerId,
      entityType: opts.entityType,
      entityId: opts.entityId,
      context: opts.context,
      buffer,
      declaredMime: opts.upload.mimetype,
      tempPath: opts.upload.path,
    });
  } catch (err) {
    deleteTempUploadPath(opts.upload.path);
    throw err;
  }
}

export async function ingestCollectedIdentityUpload(opts: {
  path: string;
  mimetype: string;
  ownerId: string;
}): Promise<IngestPublicResult & { storageKey: string }> {
  const buffer = readFileSync(opts.path);
  return ingestIdentityImage({
    ownerId: opts.ownerId,
    context: { userId: opts.ownerId },
    buffer,
    declaredMime: opts.mimetype,
    tempPath: opts.path,
  });
}

export async function ingestMulterClaimEvidence(opts: {
  files: Express.Multer.File[];
  ownerId: string;
  requestId?: string;
}): Promise<ClaimEvidenceFile[]> {
  const out: ClaimEvidenceFile[] = [];
  for (const file of opts.files) {
    try {
      const buffer = readFileSync(file.path);
      const ingested = await ingestPrivateEvidence({
        type: "claim_evidence",
        ownerId: opts.ownerId,
        entityType: "claim",
        entityId: opts.requestId,
        context: {
          userId: opts.ownerId,
          requestId: opts.requestId,
        },
        buffer,
        declaredMime: file.mimetype,
        tempPath: file.path,
      });
      out.push({
        id: randomBytes(12).toString("hex"),
        filename: ingested.imageId,
        originalName:
          file.originalname.replace(/[\r\n"]/g, "_").slice(0, 255) ||
          "comprobante",
        mimeType: ingested.contentType,
        size: buffer.byteLength,
      });
    } catch (err) {
      try {
        await unlink(file.path);
      } catch {
        /* ignore */
      }
      for (const prev of out) {
        await deleteManagedImage(prev.filename);
      }
      throw err;
    }
  }
  return out;
}

export function ingestErrorResponse(err: unknown): {
  status: number;
  body: { error: string; code: string };
} {
  if (err instanceof StorageError) {
    const status =
      err.code === "IMAGE_TOO_LARGE" ||
      err.code === "IMAGE_FORMAT" ||
      err.code === "IMAGE_MIME_MISMATCH" ||
      err.code === "IMAGE_DIMENSIONS" ||
      err.code === "IMAGE_CORRUPT" ||
      err.code === "IMAGE_EMPTY" ||
      err.code === "IMAGE_ANIMATED" ||
      err.code === "IMAGE_BOMB" ||
      err.code === "IMAGE_MIME_NOT_ALLOWED"
        ? 400
        : 500;
    return { status, body: { error: err.message, code: err.code } };
  }
  return {
    status: 500,
    body: {
      error: "No se pudo procesar la imagen",
      code: "IMAGE_PROCESS_FAILED",
    },
  };
}

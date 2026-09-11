import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * Corpus legacy de solo lectura (Fase 11).
 * No escribir uploads nuevos aquí — staging va a TEMP_UPLOAD_DIR.
 */
export const UPLOADS_DIR = resolve(apiRoot, "uploads");

/** Staging multipart → Image Service (nunca servido por express.static). */
export const TEMP_UPLOAD_DIR = resolve(apiRoot, "tmp/upload-staging");

/**
 * Corpus privado legacy (identity/claims en disco).
 * Solo lectura residual; nuevos archivos staging → TEMP_UPLOAD_DIR.
 */
export const CLAIM_EVIDENCE_DIR = resolve(apiRoot, "private/venue-claims");

export const IDENTITY_VERIFICATION_DIR = resolve(
  apiRoot,
  "private/identity-verifications"
);

export function ensureUploadsDir() {
  if (!existsSync(UPLOADS_DIR)) {
    mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  return UPLOADS_DIR;
}

export function ensureTempUploadDir() {
  if (!existsSync(TEMP_UPLOAD_DIR)) {
    mkdirSync(TEMP_UPLOAD_DIR, { recursive: true });
  }
  return TEMP_UPLOAD_DIR;
}

export function ensureClaimEvidenceDir() {
  if (!existsSync(CLAIM_EVIDENCE_DIR)) {
    mkdirSync(CLAIM_EVIDENCE_DIR, { recursive: true });
  }
  return CLAIM_EVIDENCE_DIR;
}

export function ensureIdentityVerificationDir() {
  if (!existsSync(IDENTITY_VERIFICATION_DIR)) {
    mkdirSync(IDENTITY_VERIFICATION_DIR, { recursive: true });
  }
  return IDENTITY_VERIFICATION_DIR;
}

/** @deprecated No usar como ref permanente en Mongo. Solo helper de nombres legacy. */
export function publicUploadUrl(filename: string): string {
  return `/uploads/${filename}`;
}

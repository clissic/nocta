import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const UPLOADS_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../uploads"
);

export const CLAIM_EVIDENCE_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../private/venue-claims"
);

export const IDENTITY_VERIFICATION_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../private/identity-verifications"
);

export function ensureUploadsDir() {
  if (!existsSync(UPLOADS_DIR)) {
    mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  return UPLOADS_DIR;
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

export function publicUploadUrl(filename: string): string {
  return `/uploads/${filename}`;
}

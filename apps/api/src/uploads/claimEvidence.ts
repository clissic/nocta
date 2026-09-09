import multer from "multer";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { extname, join } from "node:path";
import {
  MAX_VENUE_CLAIM_FILE_BYTES,
  MAX_VENUE_CLAIM_FILES,
  VENUE_CLAIM_FILE_EXTENSIONS,
  VENUE_CLAIM_FILE_MIME_TYPES,
} from "@nocta/shared";
import type { AuthedRequest } from "../middleware/auth.js";
import {
  CLAIM_EVIDENCE_DIR,
  ensureClaimEvidenceDir,
} from "./paths.js";

const MIME_SET = new Set<string>(VENUE_CLAIM_FILE_MIME_TYPES);
const EXT_SET = new Set<string>(VENUE_CLAIM_FILE_EXTENSIONS);

ensureClaimEvidenceDir();

function safeOriginalName(name: string) {
  return name.replace(/[\r\n"]/g, "_").slice(0, 255) || "comprobante";
}

function extensionFor(file: Express.Multer.File) {
  const ext = extname(file.originalname).toLowerCase();
  if (EXT_SET.has(ext)) {
    return ext === ".jpeg" ? ".jpg" : ext;
  }
  if (file.mimetype === "application/pdf") return ".pdf";
  if (file.mimetype === "image/png") return ".png";
  if (file.mimetype === "image/webp") return ".webp";
  return ".jpg";
}

const claimEvidenceStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    try {
      cb(null, ensureClaimEvidenceDir());
    } catch (err) {
      cb(err as Error, CLAIM_EVIDENCE_DIR);
    }
  },
  filename: (req, file, cb) => {
    const userId = (req as AuthedRequest).user?._id?.toString() ?? "anon";
    cb(
      null,
      `${userId}-${Date.now()}-${randomBytes(12).toString("hex")}${extensionFor(file)}`
    );
  },
});

export const claimEvidenceUpload = multer({
  storage: claimEvidenceStorage,
  limits: {
    fileSize: MAX_VENUE_CLAIM_FILE_BYTES,
    files: MAX_VENUE_CLAIM_FILES,
  },
  fileFilter: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    if (!MIME_SET.has(file.mimetype.toLowerCase()) || !EXT_SET.has(ext)) {
      cb(new Error("Formato no permitido. Usá PDF, JPG, PNG o WebP"));
      return;
    }
    cb(null, true);
  },
});

export const uploadClaimEvidence = claimEvidenceUpload.array(
  "evidenceFiles",
  MAX_VENUE_CLAIM_FILES
);

function matchesEvidenceSignature(file: Express.Multer.File) {
  const buf = readFileSync(file.path);
  const mime = file.mimetype.toLowerCase();
  if (mime === "application/pdf") {
    return buf.length >= 5 && buf.subarray(0, 5).toString("ascii") === "%PDF-";
  }
  if (mime === "image/jpeg") {
    return buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  }
  if (mime === "image/png") {
    return (
      buf.length >= 8 &&
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47
    );
  }
  return (
    mime === "image/webp" &&
    buf.length >= 12 &&
    buf.subarray(0, 4).toString("ascii") === "RIFF" &&
    buf.subarray(8, 12).toString("ascii") === "WEBP"
  );
}

export type ClaimEvidenceFile = {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
};

export function claimEvidenceRequestFiles(req: AuthedRequest) {
  if (Array.isArray(req.files)) return req.files;
  if (req.files && typeof req.files === "object") {
    return (
      req.files as Record<string, Express.Multer.File[]>
    ).evidenceFiles ?? [];
  }
  return [];
}

export function collectClaimEvidence(req: AuthedRequest):
  | { ok: true; files: ClaimEvidenceFile[] }
  | { ok: false; error: string } {
  const files = claimEvidenceRequestFiles(req);
  if (
    files.length > MAX_VENUE_CLAIM_FILES ||
    files.some((file) => file.size > MAX_VENUE_CLAIM_FILE_BYTES)
  ) {
    return {
      ok: false,
      error: `Cada comprobante puede pesar hasta ${Math.round(
        MAX_VENUE_CLAIM_FILE_BYTES / (1024 * 1024)
      )} MB`,
    };
  }
  try {
    if (files.some((file) => !matchesEvidenceSignature(file))) {
      return { ok: false, error: "Uno de los comprobantes no es un archivo válido" };
    }
  } catch {
    return { ok: false, error: "No se pudieron validar los comprobantes" };
  }
  return {
    ok: true,
    files: files.map((file) => ({
      id: randomBytes(12).toString("hex"),
      filename: file.filename,
      originalName: safeOriginalName(file.originalname),
      mimeType: file.mimetype.toLowerCase(),
      size: file.size,
    })),
  };
}

export function safeClaimEvidencePath(filename: string) {
  if (!filename || filename.includes("..") || /[\\/]/.test(filename)) return null;
  return join(CLAIM_EVIDENCE_DIR, filename);
}

export function deleteClaimEvidence(files: Array<{ filename: string }>) {
  for (const file of files) {
    const path = safeClaimEvidencePath(file.filename);
    if (!path) continue;
    try {
      if (existsSync(path)) unlinkSync(path);
    } catch {
      /* ignore cleanup errors */
    }
  }
}

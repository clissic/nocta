import multer from "multer";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { extname, join } from "node:path";
import {
  IDENTITY_VERIFICATION_FILE_EXTENSIONS,
  IDENTITY_VERIFICATION_FILE_MIME_TYPES,
  MAX_IDENTITY_VERIFICATION_FILE_BYTES,
} from "@nocta/shared";
import type { AuthedRequest } from "../middleware/auth.js";
import {
  IDENTITY_VERIFICATION_DIR,
  ensureIdentityVerificationDir,
  ensureTempUploadDir,
} from "./paths.js";
import { deleteTempUploadPath } from "./validate.js";

const MIME_SET = new Set<string>(IDENTITY_VERIFICATION_FILE_MIME_TYPES);
const EXT_SET = new Set<string>(IDENTITY_VERIFICATION_FILE_EXTENSIONS);

ensureTempUploadDir();
ensureIdentityVerificationDir();

function extensionFor(file: Express.Multer.File) {
  const ext = extname(file.originalname).toLowerCase();
  if (EXT_SET.has(ext)) {
    return ext === ".jpeg" ? ".jpg" : ext;
  }
  if (file.mimetype === "image/png") return ".png";
  if (file.mimetype === "image/webp") return ".webp";
  return ".jpg";
}

function matchesImageSignature(file: Express.Multer.File) {
  const buf = readFileSync(file.path);
  const mime = file.mimetype.toLowerCase();
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

const identityStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    try {
      cb(null, ensureTempUploadDir());
    } catch (err) {
      cb(err as Error, ensureTempUploadDir());
    }
  },
  filename: (req, file, cb) => {
    const userId = (req as AuthedRequest).user?._id?.toString() ?? "anon";
    const kind =
      file.fieldname === "selfieWithDocument" ? "selfie" : "document";
    cb(
      null,
      `${userId}-${kind}-${Date.now()}-${randomBytes(10).toString("hex")}${extensionFor(file)}`
    );
  },
});

export const identityVerificationUpload = multer({
  storage: identityStorage,
  limits: {
    fileSize: MAX_IDENTITY_VERIFICATION_FILE_BYTES,
    files: 2,
  },
  fileFilter: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    if (!MIME_SET.has(file.mimetype.toLowerCase()) || !EXT_SET.has(ext)) {
      cb(new Error("Formato no permitido. Usá JPG, PNG o WebP"));
      return;
    }
    cb(null, true);
  },
});

export const uploadIdentityVerificationFiles = identityVerificationUpload.fields([
  { name: "documentFront", maxCount: 1 },
  { name: "selfieWithDocument", maxCount: 1 },
]);

function fieldFile(
  req: AuthedRequest,
  field: "documentFront" | "selfieWithDocument"
) {
  if (!req.files || Array.isArray(req.files)) return undefined;
  const files = (req.files as Record<string, Express.Multer.File[]>)[field];
  return files?.[0];
}

export function identityVerificationRequestFiles(req: AuthedRequest) {
  return {
    documentFront: fieldFile(req, "documentFront"),
    selfieWithDocument: fieldFile(req, "selfieWithDocument"),
  };
}

export function collectIdentityVerificationFiles(req: AuthedRequest):
  | {
      ok: true;
      documentFront: string;
      selfieWithDocument: string;
    }
  | { ok: false; error: string } {
  const { documentFront, selfieWithDocument } =
    identityVerificationRequestFiles(req);
  if (!documentFront || !selfieWithDocument) {
    return {
      ok: false,
      error: "Subí la foto del documento y la selfie con el documento",
    };
  }
  const files = [documentFront, selfieWithDocument];
  if (files.some((file) => file.size > MAX_IDENTITY_VERIFICATION_FILE_BYTES)) {
    return {
      ok: false,
      error: `Cada archivo puede pesar hasta ${Math.round(
        MAX_IDENTITY_VERIFICATION_FILE_BYTES / (1024 * 1024)
      )} MB`,
    };
  }
  try {
    if (files.some((file) => !matchesImageSignature(file))) {
      return { ok: false, error: "Uno de los archivos no es una imagen válida" };
    }
  } catch {
    return { ok: false, error: "No se pudieron validar los archivos" };
  }
  return {
    ok: true,
    documentFront: documentFront.filename,
    selfieWithDocument: selfieWithDocument.filename,
  };
}

/** Path legacy en corpus privado (solo lectura residual). */
export function safeIdentityVerificationPath(filename: string) {
  if (!filename || filename.includes("..") || /[\\/]/.test(filename)) return null;
  return join(IDENTITY_VERIFICATION_DIR, filename);
}

export function deleteIdentityVerificationFiles(
  filenames: Array<string | null | undefined>
) {
  for (const filename of filenames) {
    if (!filename) continue;
    // Preferí path absoluto de staging; fallback a corpus legacy.
    if (filename.includes("/") || filename.includes("\\")) {
      deleteTempUploadPath(filename);
      continue;
    }
    const legacy = safeIdentityVerificationPath(filename);
    if (legacy) deleteTempUploadPath(legacy);
  }
}

/** Limpia archivos multer de identity (staging TEMP). */
export function deleteIdentityVerificationMulterFiles(
  files: Array<Express.Multer.File | null | undefined>
) {
  for (const file of files) {
    if (file?.path) deleteTempUploadPath(file.path);
  }
}

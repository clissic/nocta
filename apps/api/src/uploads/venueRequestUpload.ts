import multer from "multer";
import { randomBytes } from "node:crypto";
import { extname } from "node:path";
import {
  MAX_PHOTO_UPLOAD_BYTES,
  MAX_VENUE_CLAIM_FILES,
  VENUE_CLAIM_FILE_EXTENSIONS,
  VENUE_CLAIM_FILE_MIME_TYPES,
} from "@nocta/shared";
import type { AuthedRequest } from "../middleware/auth.js";
import {
  ensureClaimEvidenceDir,
  ensureUploadsDir,
} from "./paths.js";
import {
  isAllowedPhotoMime,
  normalizePhotoExtension,
} from "./validate.js";

const evidenceMimes = new Set<string>(VENUE_CLAIM_FILE_MIME_TYPES);
const evidenceExtensions = new Set<string>(VENUE_CLAIM_FILE_EXTENSIONS);

const storage = multer.diskStorage({
  destination: (_req, file, cb) => {
    try {
      cb(
        null,
        file.fieldname === "evidenceFiles"
          ? ensureClaimEvidenceDir()
          : ensureUploadsDir()
      );
    } catch (err) {
      cb(err as Error, ensureUploadsDir());
    }
  },
  filename: (req, file, cb) => {
    const userId = (req as AuthedRequest).user?._id?.toString() ?? "anon";
    const random = randomBytes(12).toString("hex");
    if (file.fieldname === "evidenceFiles") {
      const rawExtension = extname(file.originalname).toLowerCase();
      const extension = rawExtension === ".jpeg" ? ".jpg" : rawExtension;
      cb(null, `${userId}-${Date.now()}-${random}${extension}`);
      return;
    }
    cb(
      null,
      `${userId}-${Date.now()}-${random}${normalizePhotoExtension(
        file.originalname,
        file.mimetype
      )}`
    );
  },
});

const venueRequestUpload = multer({
  storage,
  limits: {
    fileSize: MAX_PHOTO_UPLOAD_BYTES,
    files: MAX_VENUE_CLAIM_FILES + 1,
  },
  fileFilter: (_req, file, cb) => {
    if (file.fieldname === "photo") {
      if (!isAllowedPhotoMime(file.mimetype)) {
        cb(new Error("La portada debe ser una imagen válida"));
        return;
      }
      cb(null, true);
      return;
    }
    if (file.fieldname === "evidenceFiles") {
      const extension = extname(file.originalname).toLowerCase();
      if (
        !evidenceMimes.has(file.mimetype.toLowerCase()) ||
        !evidenceExtensions.has(extension)
      ) {
        cb(new Error("Formato no permitido. Usá PDF, JPG, PNG o WebP"));
        return;
      }
      cb(null, true);
      return;
    }
    cb(new Error("Campo de archivo inesperado"));
  },
});

export const uploadVenueRequestFiles = venueRequestUpload.fields([
  { name: "photo", maxCount: 1 },
  { name: "evidenceFiles", maxCount: MAX_VENUE_CLAIM_FILES },
]);

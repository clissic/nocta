import multer from "multer";
import { randomBytes } from "node:crypto";
import {
  MAX_PHOTO_UPLOAD_BYTES,
  MAX_PHOTO_UPLOAD_FILES,
} from "@nocta/shared";
import type { AuthedRequest } from "../middleware/auth.js";
import { ensureTempUploadDir } from "./paths.js";
import {
  isAllowedPhotoMime,
  normalizePhotoExtension,
} from "./validate.js";

ensureTempUploadDir();

function buildFilename(req: AuthedRequest, file: Express.Multer.File): string {
  const userId = req.user?._id?.toString() ?? "anon";
  const ext = normalizePhotoExtension(file.originalname, file.mimetype);
  const rand = randomBytes(4).toString("hex");
  return `${userId}-${Date.now()}-${rand}${ext}`;
}

/** Staging temporal — nunca UPLOADS_DIR (legacy read-only). */
const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    try {
      cb(null, ensureTempUploadDir());
    } catch (err) {
      cb(err as Error, ensureTempUploadDir());
    }
  },
  filename: (req, file, cb) => {
    try {
      cb(null, buildFilename(req as AuthedRequest, file));
    } catch (err) {
      cb(err as Error, "upload.bin");
    }
  },
});

function imageFileFilter(
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) {
  if (!isAllowedPhotoMime(file.mimetype)) {
    cb(
      new Error(
        "Formato de imagen no soportado (JPEG, PNG, WebP, AVIF o HEIC)"
      )
    );
    return;
  }
  cb(null, true);
}

export const photoUpload = multer({
  storage: diskStorage,
  limits: {
    fileSize: MAX_PHOTO_UPLOAD_BYTES,
    files: MAX_PHOTO_UPLOAD_FILES,
  },
  fileFilter: imageFileFilter,
});

export const uploadSinglePhoto = photoUpload.single("photo");
export const uploadPhotoBatch = photoUpload.array(
  "photos",
  MAX_PHOTO_UPLOAD_FILES
);

export const uploadPhotosFlexible = photoUpload.fields([
  { name: "photo", maxCount: 1 },
  { name: "photos", maxCount: MAX_PHOTO_UPLOAD_FILES },
]);

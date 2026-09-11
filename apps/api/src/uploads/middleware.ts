import type { NextFunction, Response } from "express";
import multer from "multer";
import { readFileSync } from "node:fs";
import {
  MAX_PHOTO_UPLOAD_BYTES,
  MAX_PHOTO_UPLOAD_FILES,
  VENUE_COVER_HEIGHT,
  VENUE_COVER_MIME,
  VENUE_COVER_WIDTH,
} from "@nocta/shared";
import sharp from "sharp";
import type { AuthedRequest } from "../middleware/auth.js";
import {
  deleteTempUploadPath,
  matchesImageMagicBytes,
} from "./validate.js";

export function multerErrorMessage(err: unknown): string {
  if (err instanceof multer.MulterError) {
    switch (err.code) {
      case "LIMIT_FILE_SIZE":
        return `La foto supera el máximo de ${Math.round(MAX_PHOTO_UPLOAD_BYTES / (1024 * 1024))} MB`;
      case "LIMIT_FILE_COUNT":
        return `Máximo ${MAX_PHOTO_UPLOAD_FILES} archivos por request`;
      case "LIMIT_UNEXPECTED_FILE":
        return "Campo de archivo inesperado (usá `photo` o `photos`)";
      default:
        return err.message || "Upload inválido";
    }
  }
  if (err instanceof Error) return err.message;
  return "Upload inválido";
}

export function handleMulterError(
  err: unknown,
  _req: AuthedRequest,
  res: Response,
  next: NextFunction
) {
  if (!err) return next();
  return res.status(400).json({
    error: multerErrorMessage(err),
    code: "UPLOAD_INVALID",
  });
}

export type CollectedUpload = {
  filename: string;
  path: string;
  url: string;
  mimetype: string;
  size: number;
  originalName: string;
};

export function collectUploadedFiles(req: AuthedRequest): CollectedUpload[] {
  const out: CollectedUpload[] = [];
  const seen = new Set<string>();

  const push = (f: Express.Multer.File) => {
    if (seen.has(f.filename)) return;
    seen.add(f.filename);
    out.push({
      filename: f.filename,
      path: f.path,
      /** No es URL pública: staging temp. Solo para cleanup legacy helpers. */
      url: f.path,
      mimetype: f.mimetype,
      size: f.size,
      originalName: f.originalname,
    });
  };

  if (req.file) push(req.file);

  const files = req.files;
  if (Array.isArray(files)) {
    for (const f of files) push(f);
  } else if (files && typeof files === "object") {
    const map = files as Record<string, Express.Multer.File[]>;
    for (const f of map.photo ?? []) push(f);
    for (const f of map.photos ?? []) push(f);
  }

  return out;
}

export function assertUploadsAreImages(
  uploads: CollectedUpload[]
):
  | { ok: true; uploads: CollectedUpload[] }
  | { ok: false; error: string } {
  const kept: CollectedUpload[] = [];

  for (const u of uploads) {
    let buf: Buffer;
    try {
      buf = readFileSync(u.path);
    } catch {
      deleteTempUploadPath(u.path);
      continue;
    }
    if (!matchesImageMagicBytes(buf)) {
      deleteTempUploadPath(u.path);
      continue;
    }
    kept.push(u);
  }

  if (kept.length === 0) {
    return { ok: false, error: "El archivo no es una imagen válida" };
  }
  return { ok: true, uploads: kept };
}

export async function assertVenueCoverUpload(
  upload: CollectedUpload
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (
    upload.mimetype.toLowerCase() !== VENUE_COVER_MIME ||
    !upload.originalName.toLowerCase().endsWith(".webp")
  ) {
    return { ok: false, error: "La portada debe estar en formato WebP" };
  }

  try {
    const metadata = await sharp(upload.path).metadata();
    if (metadata.format !== "webp") {
      return { ok: false, error: "La portada debe estar en formato WebP" };
    }
    if (
      metadata.width !== VENUE_COVER_WIDTH ||
      metadata.height !== VENUE_COVER_HEIGHT
    ) {
      return {
        ok: false,
        error: `La portada debe medir exactamente ${VENUE_COVER_WIDTH}×${VENUE_COVER_HEIGHT} píxeles`,
      };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo validar la portada" };
  }
}

import { unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  ALLOWED_PHOTO_EXTENSIONS,
  ALLOWED_PHOTO_MIME_TYPES,
} from "@nocta/shared";
import { UPLOADS_DIR, publicUploadUrl } from "./paths.js";

const MIME_SET = new Set<string>(ALLOWED_PHOTO_MIME_TYPES);
const EXT_SET = new Set<string>(ALLOWED_PHOTO_EXTENSIONS);

export function isAllowedPhotoMime(mime: string): boolean {
  return MIME_SET.has(mime.toLowerCase());
}

export function normalizePhotoExtension(originalName: string, mime: string): string {
  const raw = originalName.includes(".")
    ? `.${originalName.split(".").pop()!.toLowerCase()}`
    : "";
  if (EXT_SET.has(raw)) return raw;

  switch (mime.toLowerCase()) {
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/gif":
      return ".gif";
    case "image/heic":
      return ".heic";
    case "image/heif":
      return ".heif";
    default:
      return ".jpg";
  }
}

export function matchesImageMagicBytes(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return true;
  }
  if (buf.subarray(0, 6).toString("ascii") === "GIF87a") return true;
  if (buf.subarray(0, 6).toString("ascii") === "GIF89a") return true;
  if (
    buf.subarray(0, 4).toString("ascii") === "RIFF" &&
    buf.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return true;
  }
  if (buf.subarray(4, 8).toString("ascii") === "ftyp") {
    const brand = buf.subarray(8, 12).toString("ascii");
    if (["heic", "heif", "mif1", "msf1", "heim", "heis"].includes(brand)) {
      return true;
    }
  }
  return false;
}

export function safeUploadBasename(urlOrName: string): string | null {
  const name = urlOrName.startsWith("/uploads/")
    ? urlOrName.slice("/uploads/".length)
    : urlOrName;
  if (!name || name.includes("..") || name.includes("/") || name.includes("\\")) {
    return null;
  }
  return name;
}

export function deleteLocalUpload(url: string): void {
  const name = safeUploadBasename(url);
  if (!name) return;
  const full = join(UPLOADS_DIR, name);
  try {
    if (existsSync(full)) unlinkSync(full);
  } catch {
    /* ignore */
  }
}

export function deleteLocalUploads(urls: string[]): void {
  for (const url of urls) deleteLocalUpload(url);
}

export function uploadedFileToPublicUrl(file: { filename: string }): string {
  return publicUploadUrl(file.filename);
}

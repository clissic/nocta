import { MEDIA_REF_PREFIX } from "./processingConstants.js";

const MEDIA_REF_RE = /^\/api\/media\/([a-zA-Z0-9_-]{8,128})\/?$/i;
const NOCTA_IMG_RE = /^nocta:img:([a-zA-Z0-9_-]{8,128})$/i;

export function mediaRefForImageId(imageId: string): string {
  return `${MEDIA_REF_PREFIX}${imageId}`;
}

export function parseMediaImageId(ref: string): string | null {
  const trimmed = ref.trim();
  const media = trimmed.match(MEDIA_REF_RE);
  if (media?.[1]) return media[1];
  const nocta = trimmed.match(NOCTA_IMG_RE);
  if (nocta?.[1]) return nocta[1];

  // Absolutizada: https://api.../api/media/{id}
  try {
    if (/^https?:\/\//i.test(trimmed)) {
      const url = new URL(trimmed);
      const match = url.pathname.match(/\/api\/media\/([a-zA-Z0-9_-]{8,128})\/?$/i);
      if (match?.[1]) return match[1];
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function isManagedMediaRef(ref: string): boolean {
  return parseMediaImageId(ref) != null;
}

/**
 * Extrae path estable `/uploads/{filename}` desde refs relativas o absolutas
 * (`http://localhost:4000/uploads/...`). Evita persistir URLs de entrega.
 */
export function extractLegacyUploadPath(ref: string): string | null {
  const trimmed = ref.trim();
  if (!trimmed) return null;

  let path = trimmed;
  try {
    if (/^https?:\/\//i.test(trimmed)) {
      path = new URL(trimmed).pathname;
    }
  } catch {
    const idx = trimmed.indexOf("/uploads/");
    if (idx < 0) return null;
    path = trimmed.slice(idx);
  }

  const q = path.indexOf("?");
  if (q >= 0) path = path.slice(0, q);

  if (!path.startsWith("/uploads/")) return null;
  const name = path.slice("/uploads/".length);
  if (!name || name.includes("..") || name.includes("/") || name.includes("\\")) {
    return null;
  }
  return `/uploads/${name}`;
}

export function isLegacyUploadRef(ref: string): boolean {
  return extractLegacyUploadPath(ref) != null;
}

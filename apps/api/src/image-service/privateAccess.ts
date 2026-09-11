import { ImageAsset } from "../models/ImageAsset.js";
import { createImageService } from "./imageService.js";
import { getStorage } from "../storage/index.js";
import type { ImageType } from "./types.js";
import { parseMediaImageId } from "./refs.js";

export type PrivateViewer = {
  id: string;
  role: string;
};

/**
 * Resuelve URL firmada de lectura para un ImageAsset PRIVATE.
 * - identity_verification: solo admin
 * - claim_evidence / report_evidence: admin u owner
 * Nunca URL pública permanente.
 */
export async function resolveAuthorizedPrivateRead(opts: {
  imageIdOrRef: string;
  viewer: PrivateViewer;
}): Promise<
  | { ok: true; url: string; contentType?: string; imageType: ImageType }
  | { ok: false; status: number; error: string }
> {
  const imageId =
    parseMediaImageId(opts.imageIdOrRef) ?? opts.imageIdOrRef.trim();
  if (!/^[a-zA-Z0-9_-]{8,128}$/.test(imageId)) {
    return { ok: false, status: 400, error: "Id inválido" };
  }

  const doc = await ImageAsset.findOne({ imageId }).lean();
  if (!doc || doc.visibility !== "private" || !doc.storageKey) {
    return { ok: false, status: 404, error: "Archivo no encontrado" };
  }

  const imageType = doc.imageType as ImageType;
  const isAdmin = opts.viewer.role === "admin";
  const isOwner = doc.ownerId === opts.viewer.id;

  if (imageType === "identity_verification") {
    // SENSITIVE: conocer el imageId no alcanza; solo admin.
    if (!isAdmin) {
      return { ok: false, status: 403, error: "Sin permiso" };
    }
  } else if (imageType === "claim_evidence" || imageType === "report_evidence") {
    if (!isAdmin && !isOwner) {
      return { ok: false, status: 403, error: "Sin permiso" };
    }
  } else {
    return { ok: false, status: 404, error: "Archivo no encontrado" };
  }

  try {
    const images = createImageService(getStorage());
    const resolved = await images.resolveReadUrl(imageType, doc.storageKey, {
      preferPublicUrl: false,
    });
    return {
      ok: true,
      url: resolved.url,
      contentType: doc.contentType ?? undefined,
      imageType,
    };
  } catch {
    return { ok: false, status: 502, error: "No se pudo resolver el archivo" };
  }
}

/** True si el string parece un imageId managed (no filename de disco legacy). */
export function looksLikeManagedImageId(value: string | null | undefined): boolean {
  if (!value) return false;
  if (parseMediaImageId(value)) return true;
  // createImageId = 32 hex
  return /^[a-f0-9]{32}$/i.test(value.trim());
}

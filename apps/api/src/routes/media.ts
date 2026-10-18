import { Router, type Request, type Response } from "express";
import { ImageAsset } from "../models/ImageAsset.js";
import { createImageService } from "../image-service/index.js";
import {
  imageMetric,
  redactImageId,
  redactStorageKey,
} from "../image-service/observability.js";
import {
  VARIANT_FORMATS,
  VARIANT_NAMES,
  type VariantFormat,
  type VariantName,
} from "../image-service/processingConstants.js";
import { getStorage } from "../storage/index.js";
import {
  MEDIA_REDIRECT_PUBLIC_CACHE_CONTROL,
  PUBLIC_OBJECT_CACHE_CONTROL,
} from "../storage/publicUrl.js";

const router = Router();

function parseVariant(raw: unknown): VariantName {
  const v = typeof raw === "string" ? raw.toLowerCase() : "medium";
  return (VARIANT_NAMES as readonly string[]).includes(v)
    ? (v as VariantName)
    : "medium";
}

function parseFormat(raw: unknown): VariantFormat {
  const f = typeof raw === "string" ? raw.toLowerCase() : "webp";
  return (VARIANT_FORMATS as readonly string[]).includes(f)
    ? (f as VariantFormat)
    : "webp";
}

function publicImageEtag(
  imageId: string,
  variant: VariantName,
  format: VariantFormat
) {
  return `"${imageId}-${variant}-${format}"`;
}

/** Bytes en la URL estable `/api/media/:id`. El cliente puede cachearla un año. */
function sendImmutableImage(
  req: Request,
  res: Response,
  body: Buffer,
  contentType: string,
  etag: string
) {
  res.setHeader("Content-Type", contentType || "image/webp");
  res.setHeader("Cache-Control", PUBLIC_OBJECT_CACHE_CONTROL);
  res.setHeader("ETag", etag);
  if (req.headers["if-none-match"] === etag) {
    return res.status(304).end();
  }
  res.setHeader("Content-Length", String(body.length));
  return res.status(200).send(body);
}

/**
 * Entrega de media pública.
 * - CDN estable: 302 (el objeto ya es immutable).
 * - Firma o memory: 200 con los bytes y Cache-Control immutable en esta URL.
 * Private → 404 (no enumerar).
 */
router.get("/:imageId", async (req, res) => {
  const imageId = String(req.params.imageId || "").trim();
  if (!/^[a-zA-Z0-9_-]{8,128}$/.test(imageId)) {
    return res.status(400).json({ error: "Id inválido" });
  }

  const doc = await ImageAsset.findOne({ imageId }).lean();
  if (!doc || doc.visibility !== "public" || !doc.variants) {
    return res.status(404).json({ error: "Imagen no encontrada" });
  }

  const variant = parseVariant(req.query.v);
  const format = parseFormat(req.query.f);
  const slot = doc.variants[variant as keyof typeof doc.variants];
  const file = slot?.[format as keyof typeof slot];
  if (!file?.key) {
    return res.status(404).json({ error: "Variante no encontrada" });
  }

  const storage = getStorage();
  const images = createImageService(storage);
  try {
    const exists = await images.exists(file.key);
    if (!exists) {
      imageMetric("missing_object", {
        imageType: String(doc.imageType),
        visibility: "public",
        keyHint: redactStorageKey(file.key),
        imageIdHint: redactImageId(imageId),
      });
      return res.status(404).json({ error: "Imagen no encontrada" });
    }

    // Dev local con STORAGE_DRIVER=memory: servir bytes (no redirigir a memory://).
    const etag = publicImageEtag(imageId, variant, format);

    if (storage.driver === "memory") {
      const obj = await storage.getObject(file.key);
      return sendImmutableImage(
        req,
        res,
        obj.body,
        obj.contentType || "image/webp",
        etag
      );
    }

    const resolved = await images.resolveReadUrl(
      doc.imageType as "user_profile",
      file.key,
      { preferPublicUrl: true }
    );

    if (resolved.url.startsWith("memory://") || resolved.mode === "signed") {
      const obj = await storage.getObject(file.key);
      return sendImmutableImage(
        req,
        res,
        obj.body,
        obj.contentType || "image/webp",
        etag
      );
    }

    res.setHeader("Cache-Control", MEDIA_REDIRECT_PUBLIC_CACHE_CONTROL);
    return res.redirect(302, resolved.url);
  } catch {
    return res.status(502).json({ error: "No se pudo resolver la imagen" });
  }
});

export default router;

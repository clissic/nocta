import sharp from "sharp";
import {
  PROCESSING,
  VARIANT_FORMATS,
  VARIANT_NAMES,
  type VariantFormat,
  type VariantName,
} from "./processingConstants.js";
import { imageMetricFromError } from "./observability.js";

export type VariantFile = {
  name: VariantName;
  format: VariantFormat;
  filename: `${VariantName}.${VariantFormat}`;
  buffer: Buffer;
  width: number;
  height: number;
  bytes: number;
  contentType: "image/webp" | "image/avif";
};

export type VariantsResult = {
  width: number;
  height: number;
  variants: VariantFile[];
};

function targetWidth(name: VariantName, sourceWidth: number): number {
  const wanted = PROCESSING.variants[name];
  return Math.min(wanted, sourceWidth);
}

/**
 * Genera thumb/medium/large × webp/avif.
 * - rotate() aplica EXIF orientation; al re-encode se elimina EXIF/GPS.
 * - sin upscale
 * - no incluye el original
 */
export async function buildPublicVariants(
  source: Buffer
): Promise<VariantsResult> {
  try {
    return await buildPublicVariantsInner(source);
  } catch (err) {
    imageMetricFromError("sharp_error", err, { op: "buildPublicVariants" });
    throw err;
  }
}

async function buildPublicVariantsInner(
  source: Buffer
): Promise<VariantsResult> {
  const orientedMeta = await sharp(source, {
    failOn: "error",
    limitInputPixels: PROCESSING.maxPixels,
  })
    .rotate()
    .metadata();

  const srcW = orientedMeta.width ?? 0;
  const srcH = orientedMeta.height ?? 0;
  if (srcW < 1 || srcH < 1) {
    throw new Error("No se pudieron leer dimensiones tras orientar");
  }

  const masterWidth = Math.min(srcW, PROCESSING.variants.large);
  const masterBuf = await sharp(source, {
    failOn: "error",
    limitInputPixels: PROCESSING.maxPixels,
  })
    .rotate()
    .resize({
      width: masterWidth,
      withoutEnlargement: true,
      fit: "inside",
    })
    .toColourspace("srgb")
    .png()
    .toBuffer({ resolveWithObject: true });

  const master = masterBuf.data;
  const masterMeta = masterBuf.info;
  const variants: VariantFile[] = [];

  for (const name of VARIANT_NAMES) {
    const width = targetWidth(name, masterMeta.width);
    for (const format of VARIANT_FORMATS) {
      let pipeline = sharp(master, { failOn: "error" }).resize({
        width,
        withoutEnlargement: true,
        fit: "inside",
      });

      if (format === "webp") {
        pipeline = pipeline.webp({
          quality: PROCESSING.quality.webp,
          effort: 4,
        });
      } else {
        pipeline = pipeline.avif({
          quality: PROCESSING.quality.avif,
          effort: 4,
        });
      }

      const out = await pipeline.toBuffer({ resolveWithObject: true });
      variants.push({
        name,
        format,
        filename: `${name}.${format}`,
        buffer: out.data,
        width: out.info.width,
        height: out.info.height,
        bytes: out.data.length,
        contentType: format === "webp" ? "image/webp" : "image/avif",
      });
    }
  }

  return {
    width: masterMeta.width,
    height: masterMeta.height,
    variants,
  };
}

/**
 * Identity / sensitive: una sola variante privada JPEG, EXIF/GPS stripped.
 */
export async function buildIdentityProcessed(
  source: Buffer
): Promise<{
  buffer: Buffer;
  width: number;
  height: number;
  contentType: "image/jpeg";
  filename: "document.jpg";
  bytes: number;
}> {
  try {
    return await buildIdentityProcessedInner(source);
  } catch (err) {
    imageMetricFromError("sharp_error", err, { op: "buildIdentityProcessed" });
    throw err;
  }
}

async function buildIdentityProcessedInner(
  source: Buffer
): Promise<{
  buffer: Buffer;
  width: number;
  height: number;
  contentType: "image/jpeg";
  filename: "document.jpg";
  bytes: number;
}> {
  const out = await sharp(source, {
    failOn: "error",
    limitInputPixels: PROCESSING.maxPixels,
  })
    .rotate()
    .resize({
      width: PROCESSING.identityMaxEdge,
      height: PROCESSING.identityMaxEdge,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({
      quality: PROCESSING.identityJpegQuality,
      mozjpeg: true,
    })
    .toBuffer({ resolveWithObject: true });

  return {
    buffer: out.data,
    width: out.info.width,
    height: out.info.height,
    contentType: "image/jpeg",
    filename: "document.jpg",
    bytes: out.data.length,
  };
}

/**
 * Evidencia privada (claim/report): PDF tal cual; imágenes → JPEG sin EXIF.
 */
export async function buildEvidenceProcessed(
  source: Buffer,
  mime: string
): Promise<{
  buffer: Buffer;
  width: number;
  height: number;
  contentType: string;
  filename: string;
  bytes: number;
}> {
  try {
    return await buildEvidenceProcessedInner(source, mime);
  } catch (err) {
    imageMetricFromError("sharp_error", err, { op: "buildEvidenceProcessed" });
    throw err;
  }
}

async function buildEvidenceProcessedInner(
  source: Buffer,
  mime: string
): Promise<{
  buffer: Buffer;
  width: number;
  height: number;
  contentType: string;
  filename: string;
  bytes: number;
}> {
  const normalized = mime.toLowerCase().trim();
  if (normalized === "application/pdf") {
    if (source.length < 5 || source.subarray(0, 5).toString("ascii") !== "%PDF-") {
      throw new Error("PDF inválido");
    }
    return {
      buffer: source,
      width: 1,
      height: 1,
      contentType: "application/pdf",
      filename: "evidence.pdf",
      bytes: source.length,
    };
  }
  const processed = await buildIdentityProcessed(source);
  return {
    buffer: processed.buffer,
    width: processed.width,
    height: processed.height,
    contentType: processed.contentType,
    filename: "evidence.jpg",
    bytes: processed.bytes,
  };
}

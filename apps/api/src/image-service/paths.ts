import { randomBytes } from "node:crypto";
import { getImageTypeConfig } from "./registry.js";
import type { ImagePathContext, ImageType } from "./types.js";

const SAFE_SEGMENT = /^[a-zA-Z0-9_-]{1,128}$/;

function assertSegment(label: string, value: string): string {
  const trimmed = value.trim();
  if (!SAFE_SEGMENT.test(trimmed)) {
    throw new Error(`Segmento inválido para ${label}`);
  }
  return trimmed;
}

function safeFilename(name: string): string {
  const leaf =
    name
      .replace(/\\/g, "/")
      .split("/")
      .filter(Boolean)
      .pop() ?? "file.bin";
  const cleaned = leaf
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/\.{2,}/g, "_")
    .replace(/^\.+/, "_")
    .slice(0, 80);
  return cleaned || "file.bin";
}

/** Genera un imageId opaco (no usar el nombre original del archivo). */
export function createImageId(): string {
  return randomBytes(16).toString("hex");
}

/**
 * Key de objeto en el bucket.
 *
 * Ejemplos:
 *   public/users/{userId}/{imageId}/{filename}
 *   public/spaces/{spaceId}/{imageId}/{filename}
 *   public/reviews/{reviewId}/{imageId}/{filename}
 *   private/identity/{userId}/{imageId}/{filename}
 *   private/reports/{reportId}/{imageId}/{filename}
 */
export function buildObjectKey(opts: {
  type: ImageType;
  imageId: string;
  context: ImagePathContext;
  filename: string;
}): string {
  const config = getImageTypeConfig(opts.type);
  const imageId = assertSegment("imageId", opts.imageId);
  const filename = safeFilename(opts.filename);
  const ns = config.storageNamespace;

  switch (opts.type) {
    case "user_profile":
    case "user_post":
    case "identity_verification": {
      const userId = assertSegment("userId", opts.context.userId ?? "");
      if (opts.type === "user_post" && opts.context.postId) {
        const postId = assertSegment("postId", opts.context.postId);
        return `${ns}/${userId}/posts/${postId}/${imageId}/${filename}`;
      }
      return `${ns}/${userId}/${imageId}/${filename}`;
    }
    case "space":
    case "space_news":
    case "space_promotion": {
      const spaceId = assertSegment("spaceId", opts.context.spaceId ?? "");
      if (opts.type === "space_news" || opts.type === "space_promotion") {
        return `${ns}/${spaceId}/news/${imageId}/${filename}`;
      }
      return `${ns}/${spaceId}/${imageId}/${filename}`;
    }
    case "space_request": {
      const requestId = assertSegment(
        "requestId",
        opts.context.requestId ?? opts.context.userId ?? ""
      );
      return `${ns}/${requestId}/${imageId}/${filename}`;
    }
    case "review": {
      const reviewId = assertSegment(
        "reviewId",
        opts.context.reviewId ?? opts.context.userId ?? ""
      );
      return `${ns}/${reviewId}/${imageId}/${filename}`;
    }
    case "claim_evidence": {
      const userId = assertSegment("userId", opts.context.userId ?? "");
      const requestId = opts.context.requestId
        ? assertSegment("requestId", opts.context.requestId)
        : null;
      return requestId
        ? `${ns}/${userId}/${requestId}/${imageId}/${filename}`
        : `${ns}/${userId}/${imageId}/${filename}`;
    }
    case "report_evidence": {
      const reportId = assertSegment("reportId", opts.context.reportId ?? "");
      return `${ns}/${reportId}/${imageId}/${filename}`;
    }
    default: {
      const _exhaustive: never = opts.type;
      throw new Error(`Tipo sin path: ${_exhaustive}`);
    }
  }
}

/** Prefijo de carpeta de una imagen (para deleteMany por listado futuro). */
export function buildImagePrefix(opts: {
  type: ImageType;
  imageId: string;
  context: ImagePathContext;
}): string {
  const key = buildObjectKey({
    ...opts,
    filename: "placeholder.bin",
  });
  return key.slice(0, key.lastIndexOf("/") + 1);
}

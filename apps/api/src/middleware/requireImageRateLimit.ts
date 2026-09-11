import type { Response, NextFunction } from "express";
import type { AuthedRequest } from "./auth.js";
import {
  consumeImageRateLimit,
  type ImageRateLimitKind,
} from "./imageRateLimit.js";

function clientKey(req: AuthedRequest): string {
  const userId = req.user?._id?.toString();
  if (userId) return `user:${userId}`;
  const ip =
    (typeof req.headers["x-forwarded-for"] === "string"
      ? req.headers["x-forwarded-for"].split(",")[0]?.trim()
      : null) ||
    req.ip ||
    "anon";
  return `ip:${ip}`;
}

export function requireImageRateLimit(kind: ImageRateLimitKind) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    const key = clientKey(req);
    if (!consumeImageRateLimit(key, kind)) {
      return res.status(429).json({
        error: "Demasiadas solicitudes de imagen. Probá en un minuto.",
        code: "IMAGE_RATE_LIMIT",
        kind,
      });
    }
    return next();
  };
}

export const requireImageUploadRateLimit = requireImageRateLimit("upload");
export const requireImageDeleteRateLimit = requireImageRateLimit("delete");
export const requireSensitiveImageRateLimit = requireImageRateLimit("sensitive");

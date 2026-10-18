import type { Request, RequestHandler } from "express";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import { config } from "../config.js";

const TOO_MANY = "Demasiadas solicitudes. Probá de nuevo en un momento.";

function limitsOff() {
  return (
    process.env.NOCTA_E2E === "1" || process.env.RATE_LIMIT_DISABLED === "1"
  );
}

function userIdFromAuth(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  try {
    const payload = jwt.verify(header.slice(7), config.jwtSecret) as {
      sub?: unknown;
    };
    return typeof payload.sub === "string" && payload.sub ? payload.sub : null;
  } catch {
    return null;
  }
}

function isPremiumWebhook(req: Request) {
  const path = (req.originalUrl || req.url || "").split("?")[0];
  return req.method === "POST" && path.endsWith("/premium/webhook");
}

function createLimiter(options: {
  windowMs: number;
  limit: number;
  skip?: (req: Request) => boolean;
  keyGenerator?: (req: Request) => string;
}): RequestHandler {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({ error: TOO_MANY });
    },
    skip: (req) => limitsOff() || Boolean(options.skip?.(req)),
    ...(options.keyGenerator ? { keyGenerator: options.keyGenerator } : {}),
  });
}

const MIN = 60_000;

/** POST /api/auth/login — 10 cada 15 min, por IP. */
export const loginIpLimiter = createLimiter({
  windowMs: 15 * MIN,
  limit: 10,
});

/** POST /api/auth/register — 5 por hora, por IP. */
export const registerIpLimiter = createLimiter({
  windowMs: 60 * MIN,
  limit: 5,
});

/** Reenvío de código y “olvidé mi contraseña” — 5 cada 15 min, por IP. */
export const authEmailIpLimiter = createLimiter({
  windowMs: 15 * MIN,
  limit: 5,
});

/** Arranque de OAuth — 20 cada 15 min, por IP. */
export const oauthStartIpLimiter = createLimiter({
  windowMs: 15 * MIN,
  limit: 20,
});

/** Lecturas públicas de Espacios, ciudades y anuncios — 300/min, por IP. */
export const publicReadLimiter = createLimiter({
  windowMs: MIN,
  limit: 300,
  skip: (req) => req.method !== "GET" && req.method !== "HEAD",
});

/** API con sesión — 120/min, por usuario. Sin JWT no cuenta. */
export const authedUserLimiter = createLimiter({
  windowMs: MIN,
  limit: 120,
  skip: (req) => isPremiumWebhook(req) || !userIdFromAuth(req),
  keyGenerator: (req) => `user:${userIdFromAuth(req)}`,
});

/** POST /api/discover/swipe — 40/min, por usuario. */
export const swipeLimiter = createLimiter({
  windowMs: MIN,
  limit: 40,
  keyGenerator: (req) => `user:${userIdFromAuth(req) ?? "anon"}`,
});

/** POST /api/matches/:id/messages — 30/min, por usuario. */
export const messageLimiter = createLimiter({
  windowMs: MIN,
  limit: 30,
  keyGenerator: (req) => `user:${userIdFromAuth(req) ?? "anon"}`,
});

/** POST /api/premium/checkout — 5 cada 10 min, por usuario. */
export const checkoutLimiter = createLimiter({
  windowMs: 10 * MIN,
  limit: 5,
  keyGenerator: (req) => `user:${userIdFromAuth(req) ?? "anon"}`,
});

/** POST /api/me/push-token — 10/min, por usuario. */
export const pushTokenLimiter = createLimiter({
  windowMs: MIN,
  limit: 10,
  keyGenerator: (req) => `user:${userIdFromAuth(req) ?? "anon"}`,
});

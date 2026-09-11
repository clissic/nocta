import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { User, type UserDocument } from "../models/User.js";
import {
  refreshExpiredSuspension,
  suspensionError,
} from "../utils/moderation.js";
import { syncExpiredPremium } from "../utils/premium.js";

export interface AuthPayload {
  sub: string;
  role: "user" | "admin";
  ver: number;
}

export interface AuthedRequest extends Request {
  user?: UserDocument;
  auth?: AuthPayload;
}

export function signToken(user: UserDocument): string {
  const payload: AuthPayload = {
    sub: user._id.toString(),
    role: user.role as "user" | "admin",
    ver: user.authVersion ?? 0,
  };
  return jwt.sign(payload, config.jwtSecret, { expiresIn: "7d" });
}

export async function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No autenticado" });
    }
    const token = header.slice(7);
    const payload = jwt.verify(token, config.jwtSecret) as AuthPayload;
    const user = await User.findById(payload.sub);
    if (!user) {
      return res.status(401).json({ error: "Usuario no encontrado" });
    }
    const suspension = await refreshExpiredSuspension(user);
    if (suspension) {
      return res.status(403).json(suspensionError(suspension));
    }
    const synced = await syncExpiredPremium(user._id.toString());
    if (!synced) {
      return res.status(401).json({ error: "Usuario no encontrado" });
    }
    if ((payload.ver ?? 0) !== (synced.authVersion ?? 0)) {
      return res.status(401).json({
        error: "La sesión venció. Iniciá sesión nuevamente.",
        code: "TOKEN_REVOKED",
      });
    }
    req.user = synced;
    req.auth = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido" });
  }
}

export function requireAdmin(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Se requiere rol admin" });
  }
  next();
}

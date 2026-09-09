import type { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { User } from "../models/User.js";
import type { AuthPayload, AuthedRequest } from "./auth.js";
import {
  refreshExpiredSuspension,
  suspensionError,
} from "../utils/moderation.js";

/** Si hay Bearer válido, carga req.user; si no, continúa anónimo. */
export async function optionalAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return next();
    }
    const token = header.slice(7);
    const payload = jwt.verify(token, config.jwtSecret) as AuthPayload;
    const user = await User.findById(payload.sub);
    if (user) {
      const suspension = await refreshExpiredSuspension(user);
      if (suspension) {
        return res.status(403).json(suspensionError(suspension));
      }
      if ((payload.ver ?? 0) !== (user.authVersion ?? 0)) {
        return res.status(401).json({
          error: "La sesión venció. Iniciá sesión nuevamente.",
          code: "TOKEN_REVOKED",
        });
      }
      req.user = user;
      req.auth = payload;
    }
  } catch {
    /* ignore invalid token */
  }
  next();
}

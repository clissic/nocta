import type { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { User } from "../models/User.js";
import type { AuthPayload, AuthedRequest } from "./auth.js";

/** Si hay Bearer válido, carga req.user; si no, continúa anónimo. */
export async function optionalAuth(
  req: AuthedRequest,
  _res: Response,
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
      req.user = user;
      req.auth = payload;
    }
  } catch {
    /* ignore invalid token */
  }
  next();
}

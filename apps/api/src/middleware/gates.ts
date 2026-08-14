import type { Response, NextFunction } from "express";
import type { AuthedRequest } from "./auth.js";

/** Requiere email verificado (después de requireAuth). */
export function requireVerified(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.user?.emailVerified) {
    return res.status(403).json({
      error: "Confirmá tu email para continuar",
      code: "EMAIL_NOT_VERIFIED",
    });
  }
  next();
}

/** Requiere perfil completo. */
export function requireProfileComplete(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.user?.profileComplete) {
    return res.status(403).json({
      error: "Completá tu perfil para continuar",
      code: "PROFILE_INCOMPLETE",
    });
  }
  next();
}

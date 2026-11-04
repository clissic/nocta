import type { Request, Response, NextFunction } from "express";

/**
 * Defensa contra CVE-2026-111497 (Node2Shell): rechaza requests con Content-Encoding: br.
 * Express 4.x con body-parser / express.json() NO decodifica br por defecto,
 * pero esta capa extra previene cualquier código futuro que lo habilite.
 */
export function rejectBrotli(req: Request, res: Response, next: NextFunction) {
  const encoding = req.get("content-encoding")?.toLowerCase() || "";
  if (encoding.includes("br")) {
    return res.status(415).json({
      error: "Brotli encoding no soportado",
      code: "UNSUPPORTED_ENCODING",
    });
  }
  next();
}

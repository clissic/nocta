import { randomBytes, randomInt, createHash } from "node:crypto";

export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

/** Código numérico de N dígitos (default 6), con ceros a la izquierda. */
export function generateEmailCode(length = 6): string {
  const max = 10 ** length;
  const n = randomInt(0, max);
  return String(n).padStart(length, "0");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Rate limit en memoria por clave (email). */
const lastHit = new Map<string, number>();

export function rateLimit(key: string, windowMs = 60_000): boolean {
  const now = Date.now();
  const prev = lastHit.get(key) ?? 0;
  if (now - prev < windowMs) return false;
  lastHit.set(key, now);
  return true;
}

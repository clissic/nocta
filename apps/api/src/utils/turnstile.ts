import type { Request, Response } from "express";
import { config } from "../config.js";

const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

function turnstileRequired() {
  return Boolean(config.turnstile.secretKey) && process.env.NOCTA_E2E !== "1";
}

async function siteverify(token: string, remoteIp: string | undefined) {
  const body = new URLSearchParams({
    secret: config.turnstile.secretKey,
    response: token,
  });
  if (remoteIp) body.set("remoteip", remoteIp);
  const response = await fetch(SITEVERIFY_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) return false;
  const data = (await response.json()) as { success?: boolean };
  return data.success === true;
}

/** Exige Turnstile en registro, login y recupero de contraseña (web y app). */
export async function requireTurnstile(req: Request, res: Response) {
  if (!turnstileRequired()) return true;
  const body = req.body as { turnstileToken?: unknown };

  const token =
    typeof body?.turnstileToken === "string" ? body.turnstileToken.trim() : "";
  if (!token) {
    res.status(400).json({
      error: "Confirmá que no sos un robot",
      code: "TURNSTILE_REQUIRED",
    });
    return false;
  }

  const ip = req.ip?.replace(/^::ffff:/, "");
  let ok = false;
  try {
    ok = await siteverify(token, ip);
  } catch (err) {
    console.error("[turnstile] siteverify failed", err);
  }
  if (!ok) {
    res.status(400).json({
      error: "No pudimos verificar que seas una persona. Probá de nuevo.",
      code: "TURNSTILE_FAILED",
    });
    return false;
  }
  return true;
}

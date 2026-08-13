import { Router } from "express";
import { randomBytes } from "node:crypto";
import { OAUTH_PROVIDERS, type OAuthProvider } from "@nocta/shared";
import { config } from "../config.js";
import { signToken } from "../middleware/auth.js";
import {
  buildAuthorizeUrl,
  isOAuthConfigured,
  oauthConfigError,
  resolveOAuthProfile,
} from "../oauth/providers.js";
import { upsertOAuthUser } from "../oauth/upsert.js";

const router = Router();

const pendingStates = new Map<string, { provider: OAuthProvider; exp: number }>();

function isProvider(value: string): value is OAuthProvider {
  return (OAUTH_PROVIDERS as readonly string[]).includes(value);
}

function paramProvider(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function rememberState(provider: OAuthProvider): string {
  const state = randomBytes(24).toString("hex");
  pendingStates.set(state, {
    provider,
    exp: Date.now() + 10 * 60 * 1000,
  });
  return state;
}

function consumeState(state: string, provider: OAuthProvider): boolean {
  const entry = pendingStates.get(state);
  pendingStates.delete(state);
  if (!entry) return false;
  if (entry.exp < Date.now()) return false;
  return entry.provider === provider;
}

function frontendErrorRedirect(message: string) {
  const url = new URL("/login", config.clientOrigin);
  url.searchParams.set("error", message);
  return url.toString();
}

function frontendSuccessRedirect(token: string) {
  const url = new URL("/auth/callback", config.clientOrigin);
  url.searchParams.set("token", token);
  return url.toString();
}

/** Inicia el flujo OAuth: redirige al proveedor. */
router.get("/:provider", (req, res) => {
  const providerParam = paramProvider(req.params.provider);
  if (!isProvider(providerParam)) {
    return res.status(404).json({ error: "Proveedor OAuth desconocido" });
  }

  if (!isOAuthConfigured(providerParam)) {
    return res.status(503).json({
      error: oauthConfigError(providerParam),
      code: "OAUTH_NOT_CONFIGURED",
      provider: providerParam,
    });
  }

  const state = rememberState(providerParam);
  const url = buildAuthorizeUrl(providerParam, state);
  return res.redirect(url);
});

async function handleCallback(
  provider: OAuthProvider,
  code: string | undefined,
  state: string | undefined,
  oauthError: string | undefined,
  res: import("express").Response
) {
  if (oauthError) {
    return res.redirect(
      frontendErrorRedirect(`El proveedor rechazó el login: ${oauthError}`)
    );
  }
  if (!code || !state) {
    return res.redirect(
      frontendErrorRedirect("Respuesta OAuth incompleta (falta code/state)")
    );
  }
  if (!consumeState(state, provider)) {
    return res.redirect(frontendErrorRedirect("State OAuth inválido o expirado"));
  }

  try {
    const profile = await resolveOAuthProfile(provider, code);
    // Persistencia: falla si Mongo/Atlas no está disponible o mal configurado.
    const user = await upsertOAuthUser(profile);
    const token = signToken(user);
    return res.redirect(frontendSuccessRedirect(token));
  } catch (err) {
    console.error(`[oauth/${provider}]`, err);
    const message =
      err instanceof Error ? err.message : "Error en autenticación OAuth";
    return res.redirect(frontendErrorRedirect(message));
  }
}

/** Callback GET (Google / Microsoft). */
router.get("/:provider/callback", async (req, res) => {
  const providerParam = paramProvider(req.params.provider);
  if (!isProvider(providerParam)) {
    return res.status(404).json({ error: "Proveedor OAuth desconocido" });
  }
  await handleCallback(
    providerParam,
    typeof req.query.code === "string" ? req.query.code : undefined,
    typeof req.query.state === "string" ? req.query.state : undefined,
    typeof req.query.error === "string" ? req.query.error : undefined,
    res
  );
});

/** Callback POST (Apple usa form_post). */
router.post("/:provider/callback", async (req, res) => {
  const providerParam = paramProvider(req.params.provider);
  if (!isProvider(providerParam)) {
    return res.status(404).json({ error: "Proveedor OAuth desconocido" });
  }
  const body = req.body as {
    code?: string;
    state?: string;
    error?: string;
  };
  await handleCallback(
    providerParam,
    body.code,
    body.state,
    body.error,
    res
  );
});

export default router;

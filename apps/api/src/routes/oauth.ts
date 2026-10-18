import { Router } from "express";
import { randomBytes } from "node:crypto";
import { OAUTH_PROVIDERS, type OAuthProvider } from "@nocta/shared";
import { signToken } from "../middleware/auth.js";
import {
  buildAuthorizeUrl,
  isOAuthConfigured,
  oauthConfigError,
  resolveOAuthProfile,
} from "../oauth/providers.js";
import { upsertOAuthUser } from "../oauth/upsert.js";
import {
  parseAppClient,
  clientPathUrl,
  type AppClient,
} from "../utils/clientOrigin.js";
import {
  appendQueryParams,
  parseOAuthReturnUrl,
} from "../utils/oauthReturnUrl.js";
import { oauthStartIpLimiter } from "../middleware/rateLimits.js";
import { OAuthState } from "../models/OAuthState.js";
import {
  refreshExpiredSuspension,
  suspensionError,
} from "../utils/moderation.js";

const router = Router();

function isProvider(value: string): value is OAuthProvider {
  return (OAUTH_PROVIDERS as readonly string[]).includes(value);
}

function paramProvider(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

async function rememberState(
  provider: OAuthProvider,
  client: AppClient,
  returnUrl?: string
): Promise<string> {
  const state = randomBytes(24).toString("hex");
  await OAuthState.create({
    state,
    provider,
    client,
    returnUrl,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });
  return state;
}

async function consumeState(
  state: string,
  provider: OAuthProvider
): Promise<
  | { ok: true; client: AppClient; returnUrl?: string }
  | { ok: false }
> {
  const entry = await OAuthState.findOneAndDelete({ state }).lean();
  if (!entry) return { ok: false };
  if (entry.expiresAt.getTime() < Date.now()) return { ok: false };
  if (entry.provider !== provider) return { ok: false };
  const client: AppClient = entry.client === "mobile" ? "mobile" : "web";
  return {
    ok: true,
    client,
    returnUrl: entry.returnUrl ?? undefined,
  };
}

function frontendErrorRedirect(
  message: string,
  client: AppClient = "web",
  returnUrl?: string
) {
  if (returnUrl) {
    return appendQueryParams(returnUrl, { error: message });
  }
  const url = new URL(clientPathUrl("login", client));
  url.searchParams.set("error", message);
  return url.toString();
}

function frontendSuccessRedirect(
  token: string,
  client: AppClient = "web",
  returnUrl?: string
) {
  if (returnUrl) {
    return appendQueryParams(returnUrl, { token });
  }
  const url = new URL(clientPathUrl("auth/callback", client));
  url.searchParams.set("token", token);
  return url.toString();
}

function frontendSuspensionRedirect(
  suspension: NonNullable<
    Awaited<ReturnType<typeof refreshExpiredSuspension>>
  >,
  client: AppClient = "web",
  returnUrl?: string
) {
  const data = suspensionError(suspension);
  const params = {
    code: data.code,
    suspendedAt: data.suspendedAt,
    duration: String(data.duration),
    suspendedUntil: data.suspendedUntil,
  };
  if (returnUrl) {
    return appendQueryParams(returnUrl, params);
  }
  const url = new URL(clientPathUrl("login", client));
  url.searchParams.set("code", data.code);
  url.searchParams.set("suspendedAt", data.suspendedAt);
  url.searchParams.set("duration", String(data.duration));
  if (data.suspendedUntil) {
    url.searchParams.set("suspendedUntil", data.suspendedUntil);
  }
  return url.toString();
}

/**
 * Inicia OAuth. `?client=mobile` + opcional `?returnUrl=` (Expo `exp://…` o `nocta://…`)
 * para que el AuthSession del emulador cierre al volver.
 */
router.get("/:provider", oauthStartIpLimiter, async (req, res) => {
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

  const client = parseAppClient(req.query.client);
  const returnUrl =
    client === "mobile" ? parseOAuthReturnUrl(req.query.returnUrl) : undefined;
  const state = await rememberState(providerParam, client, returnUrl);
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
  const consumed = state
    ? await consumeState(state, provider)
    : { ok: false as const };
  const client = consumed.ok ? consumed.client : "web";
  const returnUrl = consumed.ok ? consumed.returnUrl : undefined;

  if (oauthError) {
    return res.redirect(
      frontendErrorRedirect(
        `El proveedor rechazó el login: ${oauthError}`,
        client,
        returnUrl
      )
    );
  }
  if (!code || !state) {
    return res.redirect(
      frontendErrorRedirect(
        "Respuesta OAuth incompleta (falta code/state)",
        client,
        returnUrl
      )
    );
  }
  if (!consumed.ok) {
    return res.redirect(
      frontendErrorRedirect("State OAuth inválido o expirado", client, returnUrl)
    );
  }

  try {
    const profile = await resolveOAuthProfile(provider, code);
    const user = await upsertOAuthUser(profile);
    const suspension = await refreshExpiredSuspension(user);
    if (suspension) {
      return res.redirect(
        frontendSuspensionRedirect(suspension, client, returnUrl)
      );
    }
    const token = signToken(user);
    return res.redirect(frontendSuccessRedirect(token, client, returnUrl));
  } catch (err) {
    console.error(`[oauth/${provider}]`, err);
    const message =
      err instanceof Error ? err.message : "Error en autenticación OAuth";
    return res.redirect(frontendErrorRedirect(message, client, returnUrl));
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
  await handleCallback(providerParam, body.code, body.state, body.error, res);
});

export default router;

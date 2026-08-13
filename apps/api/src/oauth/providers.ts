import { SignJWT, createRemoteJWKSet, importPKCS8, jwtVerify } from "jose";
import type { OAuthProvider } from "@nocta/shared";
import { config } from "../config.js";

export type OAuthProfile = {
  provider: OAuthProvider;
  providerUserId: string;
  email: string;
  name?: string;
};

function redirectUri(provider: OAuthProvider): string {
  return `${config.apiPublicUrl}/api/auth/oauth/${provider}/callback`;
}

export function isOAuthConfigured(provider: OAuthProvider): boolean {
  if (provider === "google") {
    return Boolean(
      config.oauth.google.clientId && config.oauth.google.clientSecret
    );
  }
  if (provider === "microsoft") {
    return Boolean(
      config.oauth.microsoft.clientId && config.oauth.microsoft.clientSecret
    );
  }
  return Boolean(
    config.oauth.apple.clientId &&
      config.oauth.apple.teamId &&
      config.oauth.apple.keyId &&
      config.oauth.apple.privateKey
  );
}

export function oauthConfigError(provider: OAuthProvider): string {
  const map: Record<OAuthProvider, string> = {
    google:
      "OAuth Google no configurado. Definí GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET.",
    apple:
      "OAuth Apple no configurado. Definí APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID y APPLE_PRIVATE_KEY.",
    microsoft:
      "OAuth Microsoft no configurado. Definí MICROSOFT_CLIENT_ID y MICROSOFT_CLIENT_SECRET.",
  };
  return map[provider];
}

async function appleClientSecret(): Promise<string> {
  const { clientId, teamId, keyId, privateKey } = config.oauth.apple;
  const key = await importPKCS8(privateKey, "ES256");
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId })
    .setIssuer(teamId)
    .setIssuedAt()
    .setExpirationTime("180d")
    .setAudience("https://appleid.apple.com")
    .setSubject(clientId)
    .sign(key);
}

export function buildAuthorizeUrl(
  provider: OAuthProvider,
  state: string
): string {
  const redirect = redirectUri(provider);

  if (provider === "google") {
    const params = new URLSearchParams({
      client_id: config.oauth.google.clientId,
      redirect_uri: redirect,
      response_type: "code",
      scope: "openid email profile",
      access_type: "online",
      prompt: "select_account",
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  if (provider === "microsoft") {
    const tenant = config.oauth.microsoft.tenant;
    const params = new URLSearchParams({
      client_id: config.oauth.microsoft.clientId,
      redirect_uri: redirect,
      response_type: "code",
      response_mode: "query",
      scope: "openid email profile User.Read",
      state,
    });
    return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params}`;
  }

  const params = new URLSearchParams({
    client_id: config.oauth.apple.clientId,
    redirect_uri: redirect,
    response_type: "code",
    response_mode: "form_post",
    scope: "name email",
    state,
  });
  return `https://appleid.apple.com/auth/authorize?${params}`;
}

async function exchangeCode(
  provider: OAuthProvider,
  code: string
): Promise<{ idToken?: string; accessToken?: string }> {
  const redirect = redirectUri(provider);

  if (provider === "google") {
    const body = new URLSearchParams({
      code,
      client_id: config.oauth.google.clientId,
      client_secret: config.oauth.google.clientSecret,
      redirect_uri: redirect,
      grant_type: "authorization_code",
    });
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Google token exchange falló: ${text}`);
    }
    const data = (await res.json()) as {
      id_token?: string;
      access_token?: string;
    };
    return { idToken: data.id_token, accessToken: data.access_token };
  }

  if (provider === "microsoft") {
    const tenant = config.oauth.microsoft.tenant;
    const body = new URLSearchParams({
      code,
      client_id: config.oauth.microsoft.clientId,
      client_secret: config.oauth.microsoft.clientSecret,
      redirect_uri: redirect,
      grant_type: "authorization_code",
    });
    const res = await fetch(
      `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      }
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Microsoft token exchange falló: ${text}`);
    }
    const data = (await res.json()) as {
      id_token?: string;
      access_token?: string;
    };
    return { idToken: data.id_token, accessToken: data.access_token };
  }

  const clientSecret = await appleClientSecret();
  const body = new URLSearchParams({
    code,
    client_id: config.oauth.apple.clientId,
    client_secret: clientSecret,
    redirect_uri: redirect,
    grant_type: "authorization_code",
  });
  const res = await fetch("https://appleid.apple.com/auth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Apple token exchange falló: ${text}`);
  }
  const data = (await res.json()) as { id_token?: string };
  return { idToken: data.id_token };
}

const googleJwks = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs")
);
const appleJwks = createRemoteJWKSet(
  new URL("https://appleid.apple.com/auth/keys")
);
const microsoftJwks = createRemoteJWKSet(
  new URL(
    `https://login.microsoftonline.com/${config.oauth.microsoft.tenant}/discovery/v2.0/keys`
  )
);

async function profileFromIdToken(
  provider: OAuthProvider,
  idToken: string
): Promise<OAuthProfile> {
  if (provider === "google") {
    const { payload } = await jwtVerify(idToken, googleJwks, {
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience: config.oauth.google.clientId,
    });
    const email = String(payload.email ?? "").toLowerCase();
    if (!email) throw new Error("Google no devolvió email");
    return {
      provider,
      providerUserId: String(payload.sub),
      email,
      name: typeof payload.name === "string" ? payload.name : undefined,
    };
  }

  if (provider === "apple") {
    const { payload } = await jwtVerify(idToken, appleJwks, {
      issuer: "https://appleid.apple.com",
      audience: config.oauth.apple.clientId,
    });
    const email = String(payload.email ?? "").toLowerCase();
    if (!email) throw new Error("Apple no devolvió email");
    return {
      provider,
      providerUserId: String(payload.sub),
      email,
    };
  }

  const { payload } = await jwtVerify(idToken, microsoftJwks, {
    audience: config.oauth.microsoft.clientId,
  });
  const email = String(
    payload.email ?? payload.preferred_username ?? ""
  ).toLowerCase();
  if (!email) throw new Error("Microsoft no devolvió email");
  return {
    provider,
    providerUserId: String(payload.sub ?? payload.oid),
    email,
    name: typeof payload.name === "string" ? payload.name : undefined,
  };
}

async function profileFromMicrosoftGraph(
  accessToken: string
): Promise<Partial<OAuthProfile>> {
  const res = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return {};
  const data = (await res.json()) as {
    id?: string;
    mail?: string;
    userPrincipalName?: string;
    displayName?: string;
  };
  return {
    providerUserId: data.id,
    email: (data.mail ?? data.userPrincipalName ?? "").toLowerCase() || undefined,
    name: data.displayName,
  };
}

/**
 * Intercambia el authorization code y obtiene el perfil del proveedor.
 */
export async function resolveOAuthProfile(
  provider: OAuthProvider,
  code: string
): Promise<OAuthProfile> {
  const tokens = await exchangeCode(provider, code);

  if (tokens.idToken) {
    const profile = await profileFromIdToken(provider, tokens.idToken);
    if (provider === "microsoft" && tokens.accessToken && !profile.name) {
      const graph = await profileFromMicrosoftGraph(tokens.accessToken);
      return {
        ...profile,
        name: graph.name ?? profile.name,
        email: profile.email || graph.email || "",
      };
    }
    return profile;
  }

  if (provider === "microsoft" && tokens.accessToken) {
    const graph = await profileFromMicrosoftGraph(tokens.accessToken);
    if (!graph.email || !graph.providerUserId) {
      throw new Error("No se pudo obtener el perfil de Microsoft");
    }
    return {
      provider,
      providerUserId: graph.providerUserId,
      email: graph.email,
      name: graph.name,
    };
  }

  throw new Error(`No se obtuvo id_token de ${provider}`);
}

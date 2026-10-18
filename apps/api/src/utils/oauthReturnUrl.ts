import { config } from "../config.js";

const scheme = () => (config.mobileAppScheme || "nocta").toLowerCase();

/**
 * Valida returnUrl del cliente mobile (Expo Go `exp://`, scheme `nocta://`, etc.).
 * Evita open redirects hacia hosts arbitrarios.
 */
export function parseOAuthReturnUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const raw = value.trim();
  if (!raw || raw.length > 512) return undefined;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return undefined;
  }

  const proto = url.protocol.replace(":", "").toLowerCase();
  const appScheme = scheme();

  if (proto === appScheme) {
    return stripUrlNoise(url);
  }

  // Expo Go / dev client
  if (proto === "exp" || proto === "exps") {
    return stripUrlNoise(url);
  }

  // Solo loopback http(s) para tests locales
  if (
    (proto === "http" || proto === "https") &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1")
  ) {
    return stripUrlNoise(url);
  }

  return undefined;
}

function stripUrlNoise(url: URL): string {
  url.search = "";
  url.hash = "";
  return url.toString();
}

export function appendQueryParams(
  base: string,
  params: Record<string, string | undefined>
): string {
  const url = new URL(base);
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== "") url.searchParams.set(key, value);
  }
  return url.toString();
}

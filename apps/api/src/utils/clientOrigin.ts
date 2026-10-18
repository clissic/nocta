import { config } from "../config.js";

export type AppClient = "web" | "mobile";

export function parseAppClient(value: unknown): AppClient {
  return value === "mobile" ? "mobile" : "web";
}

/** Base para redirects al cliente (web URL o scheme nativo). */
export function clientBaseUrl(client: AppClient = "web"): string {
  if (client === "mobile") {
    const scheme = config.mobileAppScheme || "nocta";
    return `${scheme}://`;
  }
  return config.clientOrigin.replace(/\/$/, "");
}

export function clientPathUrl(path: string, client: AppClient = "web"): string {
  const base = clientBaseUrl(client);
  const normalized = path.startsWith("/") ? path.slice(1) : path;
  if (client === "mobile") {
    return `${base}${normalized}`;
  }
  return `${base}/${normalized}`;
}

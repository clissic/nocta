const TOKEN_KEY = "nocta_token";
const SUSPENSION_KEY = "nocta_suspension";
export const AUTH_SESSION_INVALIDATED_EVENT = "nocta:auth-invalidated";

/** Base de la API en producción (Railway). Vacío en local → proxy Vite. */
export function apiBaseUrl() {
  const env = import.meta.env as { VITE_API_URL?: string } | undefined;
  const raw = env?.VITE_API_URL;
  return typeof raw === "string" ? raw.replace(/\/$/, "") : "";
}

/** Prefija rutas `/api/...` o `/uploads/...` con la base remota si existe. */
export function apiUrl(path: string) {
  if (!path) return apiBaseUrl() || path;
  if (/^https?:\/\//i.test(path) || path.startsWith("blob:") || path.startsWith("data:")) {
    return path;
  }
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${apiBaseUrl()}${normalized}`;
}

/**
 * URLs de media para <img>.
 * https/CDN/firmada tal cual; `/uploads/` y `/api/media/` (fallback) vía API.
 */
export function mediaUrl(src?: string | null) {
  if (!src) return "";
  if (/^https?:\/\//i.test(src) || src.startsWith("blob:") || src.startsWith("data:")) {
    return src;
  }
  if (src.startsWith("/uploads/") || src.startsWith("/api/media/")) return apiUrl(src);
  return src;
}

export type SuspensionNotice = {
  code:
    | "ACCOUNT_TEMPORARILY_SUSPENDED"
    | "ACCOUNT_PERMANENTLY_SUSPENDED";
  suspendedAt: string;
  suspendedUntil?: string;
  duration: number | "permanent";
};

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getSuspensionNotice(): SuspensionNotice | null {
  try {
    const raw = sessionStorage.getItem(SUSPENSION_KEY);
    return raw ? (JSON.parse(raw) as SuspensionNotice) : null;
  } catch {
    return null;
  }
}

export function clearSuspensionNotice() {
  sessionStorage.removeItem(SUSPENSION_KEY);
}

function storeSuspensionNotice(data: Record<string, unknown>) {
  const code =
    data.code === "ACCOUNT_TEMPORARILY_SUSPENDED" ||
    data.code === "ACCOUNT_PERMANENTLY_SUSPENDED"
      ? data.code
      : null;
  if (!code || typeof data.suspendedAt !== "string") return;
  const duration =
    data.duration === "permanent" || typeof data.duration === "number"
      ? data.duration
      : code === "ACCOUNT_PERMANENTLY_SUSPENDED"
        ? "permanent"
        : null;
  if (duration == null) return;
  const notice: SuspensionNotice = {
    code,
    suspendedAt: data.suspendedAt,
    suspendedUntil:
      typeof data.suspendedUntil === "string"
        ? data.suspendedUntil
        : undefined,
    duration,
  };
  sessionStorage.setItem(SUSPENSION_KEY, JSON.stringify(notice));
  setToken(null);
  window.dispatchEvent(new CustomEvent(AUTH_SESSION_INVALIDATED_EVENT));
}

export class ApiError extends Error {
  status: number;
  code?: string;
  data: Record<string, unknown>;

  constructor(
    message: string,
    status: number,
    code?: string,
    data: Record<string, unknown> = {}
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers);
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;
  if (!headers.has("Content-Type") && options.body && !isFormData) {
    headers.set("Content-Type", "application/json");
  }
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(apiUrl(path), { ...options, headers });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok) {
    storeSuspensionNotice(data);
    if (data.code === "TOKEN_REVOKED") {
      setToken(null);
      window.dispatchEvent(new CustomEvent(AUTH_SESSION_INVALIDATED_EVENT));
    }
    throw new ApiError(
      typeof data.error === "string" ? data.error : "Error de red",
      res.status,
      typeof data.code === "string" ? data.code : undefined,
      data
    );
  }

  return data as T;
}

export async function downloadApiFile(path: string) {
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(apiUrl(path), { headers });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    throw new ApiError(
      typeof data.error === "string" ? data.error : "No se pudo descargar",
      res.status,
      typeof data.code === "string" ? data.code : undefined,
      data
    );
  }
  return res.blob();
}

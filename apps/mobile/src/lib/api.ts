import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import * as FileSystem from "expo-file-system/legacy";
import { prepareUploadUri } from "./localFile";

const TOKEN_KEY = "nocta_token";
const SUSPENSION_KEY = "nocta_suspension";

type AuthListener = () => void;
const authListeners = new Set<AuthListener>();

export function onAuthInvalidated(listener: AuthListener) {
  authListeners.add(listener);
  return () => {
    authListeners.delete(listener);
  };
}

function emitAuthInvalidated() {
  for (const listener of authListeners) listener();
}

/** Base de la API. Emulador Android: http://10.0.2.2:4000 */
export function apiBaseUrl() {
  const extra = Constants.expoConfig?.extra as { apiUrl?: string } | undefined;
  const fromExtra = extra?.apiUrl;
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  const raw = fromEnv || fromExtra || "http://10.0.2.2:4000";
  return String(raw).replace(/\/$/, "");
}

export function apiUrl(path: string) {
  if (!path) return apiBaseUrl() || path;
  if (/^https?:\/\//i.test(path) || path.startsWith("blob:") || path.startsWith("data:")) {
    return path;
  }
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${apiBaseUrl()}${normalized}`;
}

/**
 * URLs de media para <Image>.
 * - https/CDN/firmada (no localhost) tal cual
 * - `/uploads/`, `/api/media/`, `/images/` (catálogo Vite) vía API
 * - `http://localhost:4000/...` → reescribe al host del emulador/dispositivo
 */
export function mediaUrl(src?: string | null) {
  if (!src) return "";
  const trimmed = src.trim();
  if (!trimmed) return "";

  if (
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("file:") ||
    trimmed.startsWith("content:")
  ) {
    return trimmed;
  }

  // API_PUBLIC_URL suele ser localhost; el emulador/dispositivo no lo alcanza.
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(trimmed)) {
    try {
      const u = new URL(trimmed);
      return apiUrl(`${u.pathname}${u.search}${u.hash}`);
    } catch {
      return trimmed;
    }
  }

  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  if (
    trimmed.startsWith("/uploads/") ||
    trimmed.startsWith("/api/media/") ||
    trimmed.startsWith("/api/discover/") ||
    trimmed.startsWith("/images/")
  ) {
    return apiUrl(trimmed);
  }

  return trimmed;
}

export type SuspensionNotice = {
  code: "ACCOUNT_TEMPORARILY_SUSPENDED" | "ACCOUNT_PERMANENTLY_SUSPENDED";
  suspendedAt: string;
  suspendedUntil?: string;
  duration: number | "permanent";
};

let memoryToken: string | null = null;
let memorySuspension: SuspensionNotice | null = null;
let tokenReady: Promise<void> | null = null;

export async function initTokenStore() {
  if (!tokenReady) {
    tokenReady = (async () => {
      try {
        memoryToken = await SecureStore.getItemAsync(TOKEN_KEY);
      } catch {
        memoryToken = null;
      }
    })();
  }
  await tokenReady;
}

export function getToken() {
  return memoryToken;
}

export async function setToken(token: string | null) {
  memoryToken = token;
  try {
    if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    /* SecureStore puede fallar en algunos entornos de test */
  }
}

export function getSuspensionNotice(): SuspensionNotice | null {
  return memorySuspension;
}

export function clearSuspensionNotice() {
  memorySuspension = null;
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
  memorySuspension = {
    code,
    suspendedAt: data.suspendedAt,
    suspendedUntil:
      typeof data.suspendedUntil === "string" ? data.suspendedUntil : undefined,
    duration,
  };
  void setToken(null);
  emitAuthInvalidated();
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

/** RN/Hermes: `instanceof FormData` falla entre realms; no forzar JSON. */
function isFormDataBody(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  if (typeof FormData !== "undefined" && body instanceof FormData) return true;
  if (Object.prototype.toString.call(body) === "[object FormData]") return true;
  const candidate = body as { append?: unknown; getParts?: unknown };
  return (
    typeof candidate.append === "function" &&
    // FormData de React Native expone getParts()
    (typeof candidate.getParts === "function" ||
      (body as { constructor?: { name?: string } }).constructor?.name ===
        "FormData")
  );
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  await initTokenStore();
  const headers = new Headers(options.headers);
  const formData = isFormDataBody(options.body);
  if (formData) {
    // El boundary lo pone fetch; un Content-Type manual rompe multipart.
    headers.delete("Content-Type");
  } else if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(apiUrl(path), { ...options, headers });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok) {
    storeSuspensionNotice(data);
    if (data.code === "TOKEN_REVOKED") {
      await setToken(null);
      emitAuthInvalidated();
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

/**
 * Sube una foto de perfil por multipart.
 * Evita `fetch`+FormData en Android (Network request failed antes de llegar a la API).
 */
export async function uploadProfilePhoto(opts: {
  uri: string;
  mimeType?: string;
  fileName?: string;
}): Promise<{ user: import("@nocta/shared").AuthUser }> {
  await initTokenStore();
  const token = getToken();
  if (!token) {
    throw new ApiError("Sesión expirada", 401, "UNAUTHORIZED");
  }

  const mime =
    opts.mimeType && opts.mimeType.startsWith("image/")
      ? opts.mimeType
      : "image/jpeg";
  const ext =
    mime === "image/png"
      ? "png"
      : mime === "image/webp"
        ? "webp"
        : mime.includes("heic") || mime.includes("heif")
          ? "heic"
          : "jpg";

  const fileUri = await prepareUploadUri(opts.uri, ext);

  const result = await FileSystem.uploadAsync(
    apiUrl("/api/profile/photos"),
    fileUri,
    {
      httpMethod: "POST",
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: "photo",
      mimeType: mime,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(result.body || "{}") as Record<string, unknown>;
  } catch {
    data = {};
  }

  if (result.status < 200 || result.status >= 300) {
    storeSuspensionNotice(data);
    if (data.code === "TOKEN_REVOKED") {
      await setToken(null);
      emitAuthInvalidated();
    }
    throw new ApiError(
      typeof data.error === "string" ? data.error : "No se pudo subir la foto",
      result.status,
      typeof data.code === "string" ? data.code : undefined,
      data
    );
  }

  return data as { user: import("@nocta/shared").AuthUser };
}

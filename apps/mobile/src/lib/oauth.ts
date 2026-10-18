import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import type { OAuthProvider } from "@nocta/shared";
import { apiUrl } from "./api";

WebBrowser.maybeCompleteAuthSession();

export type OAuthStartResult =
  | { type: "success"; token: string }
  | { type: "cancel" }
  | { type: "error"; message: string };

function queryParam(
  params: Linking.QueryParams | null | undefined,
  key: string
): string | undefined {
  const raw = params?.[key];
  if (typeof raw === "string" && raw.trim()) return raw;
  if (Array.isArray(raw) && typeof raw[0] === "string" && raw[0].trim()) {
    return raw[0];
  }
  return undefined;
}

/**
 * OAuth vía API (`?client=mobile&returnUrl=`) → Google → callback API → deep link.
 * `returnUrl` = `Linking.createURL("auth/callback")` para que Expo Go / AuthSession
 * cierre el browser (con solo `nocta://` el emulador suele quedar en “cargando”).
 *
 * Local: `API_PUBLIC_URL=http://localhost:4000` + `adb reverse tcp:4000 tcp:4000`.
 */
export async function startOAuth(
  provider: OAuthProvider
): Promise<OAuthStartResult> {
  const returnUrl = Linking.createURL("auth/callback");
  const authUrl = apiUrl(
    `/api/auth/oauth/${provider}?client=mobile&returnUrl=${encodeURIComponent(returnUrl)}`
  );

  let result: WebBrowser.WebBrowserAuthSessionResult;
  try {
    result = await WebBrowser.openAuthSessionAsync(authUrl, returnUrl);
  } catch (err) {
    return {
      type: "error",
      message:
        err instanceof Error ? err.message : "No se pudo abrir el login",
    };
  }

  if (result.type !== "success" || !("url" in result) || !result.url) {
    return { type: "cancel" };
  }

  const parsed = Linking.parse(result.url);
  const token = queryParam(parsed.queryParams, "token");
  if (token) return { type: "success", token };

  const error =
    queryParam(parsed.queryParams, "error") ||
    queryParam(parsed.queryParams, "code");
  if (error) {
    if (
      error === "ACCOUNT_TEMPORARILY_SUSPENDED" ||
      error === "ACCOUNT_PERMANENTLY_SUSPENDED"
    ) {
      return {
        type: "error",
        message:
          error === "ACCOUNT_PERMANENTLY_SUSPENDED"
            ? "Cuenta suspendida permanentemente"
            : "Cuenta suspendida temporalmente",
      };
    }
    return { type: "error", message: error };
  }

  return { type: "error", message: "Login incompleto" };
}

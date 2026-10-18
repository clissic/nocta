import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AuthUser, PremiumPlanId } from "@nocta/shared";
import {
  api,
  clearSuspensionNotice,
  getToken,
  initTokenStore,
  onAuthInvalidated,
  setToken,
} from "../lib/api";
import { unregisterAndroidPush } from "../lib/push";

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  /** Tras guardar el perfil, mantener el wizard en Planazos aunque ya esté complete. */
  planazosOffer: boolean;
  setPlanazosOffer: (value: boolean) => void;
  /** Plan elegido en Planazos; al entrar a Main se abre Premium con ese plan. */
  pendingOpenPremium: PremiumPlanId | null;
  setPendingOpenPremium: (value: PremiumPlanId | null) => void;
  login: (
    email: string,
    password: string,
    turnstileToken?: string
  ) => Promise<AuthUser>;
  register: (
    email: string,
    password: string,
    extra?: {
      name?: string;
      marketingEmailsOptIn?: boolean;
      turnstileToken?: string;
    }
  ) => Promise<AuthUser>;
  verifyEmail: (code: string, email?: string) => Promise<AuthUser>;
  resendVerification: (email: string) => Promise<{ expiresInMinutes?: number }>;
  logout: () => void;
  refresh: () => Promise<void>;
  setUser: (user: AuthUser | null) => void;
  applyToken: (token: string) => Promise<AuthUser>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [planazosOffer, setPlanazosOffer] = useState(false);
  const [pendingOpenPremium, setPendingOpenPremium] =
    useState<PremiumPlanId | null>(null);

  const refresh = useCallback(async () => {
    await initTokenStore();
    const token = getToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const data = await api<{ user: AuthUser }>("/api/auth/me");
      setUser(data.user);
    } catch {
      await setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    return onAuthInvalidated(() => setUser(null));
  }, []);

  const applyToken = useCallback(async (token: string) => {
    clearSuspensionNotice();
    await setToken(token);
    const data = await api<{ user: AuthUser }>("/api/auth/me");
    setUser(data.user);
    return data.user;
  }, []);

  const login = useCallback(async (email: string, password: string, turnstileToken?: string) => {
    const data = await api<{ token: string; user: AuthUser }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
        client: "mobile",
        ...(turnstileToken ? { turnstileToken } : {}),
      }),
    });
    clearSuspensionNotice();
    await setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(
    async (
      email: string,
      password: string,
      extra?: {
        name?: string;
        marketingEmailsOptIn?: boolean;
        turnstileToken?: string;
      }
    ) => {
      const data = await api<{ token: string; user: AuthUser }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          client: "mobile",
          ...(extra?.name ? { name: extra.name.trim() } : {}),
          marketingEmailsOptIn: Boolean(extra?.marketingEmailsOptIn),
          ...(extra?.turnstileToken
            ? { turnstileToken: extra.turnstileToken }
            : {}),
        }),
      });
      clearSuspensionNotice();
      await setToken(data.token);
      setUser(data.user);
      return data.user;
    },
    []
  );

  const verifyEmail = useCallback(async (code: string, email?: string) => {
    const data = await api<{ token: string; user: AuthUser }>("/api/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ code, ...(email ? { email } : {}) }),
    });
    clearSuspensionNotice();
    await setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const resendVerification = useCallback((email: string) => {
    return api<{ ok: boolean; expiresInMinutes?: number }>(
      "/api/auth/resend-verification",
      { method: "POST", body: JSON.stringify({ email }) }
    );
  }, []);

  const logout = useCallback(() => {
    void (async () => {
      await unregisterAndroidPush();
      await setToken(null);
      setUser(null);
      setPlanazosOffer(false);
      setPendingOpenPremium(null);
    })();
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      planazosOffer,
      setPlanazosOffer,
      pendingOpenPremium,
      setPendingOpenPremium,
      login,
      register,
      verifyEmail,
      resendVerification,
      logout,
      refresh,
      setUser,
      applyToken,
    }),
    [
      user,
      loading,
      planazosOffer,
      pendingOpenPremium,
      login,
      register,
      verifyEmail,
      resendVerification,
      logout,
      refresh,
      applyToken,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth fuera de AuthProvider");
  return context;
}

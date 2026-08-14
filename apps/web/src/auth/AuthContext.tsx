import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AuthUser } from "@nocta/shared";
import { api, getToken, setToken } from "../lib/api";

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (
    email: string,
    password: string,
    extra?: { name?: string }
  ) => Promise<AuthUser>;
  verifyEmail: (code: string, email?: string) => Promise<AuthUser>;
  resendVerification: (email: string) => Promise<{ expiresInMinutes?: number }>;
  logout: () => void;
  refresh: () => Promise<void>;
  setUser: (user: AuthUser | null) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
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
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api<{ token: string; user: AuthUser }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(
    async (email: string, password: string, extra?: { name?: string }) => {
      const data = await api<{ token: string; user: AuthUser }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          ...(extra?.name ? { name: extra.name.trim() } : {}),
        }),
      });
      setToken(data.token);
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
    setToken(data.token);
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
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      verifyEmail,
      resendVerification,
      logout,
      refresh,
      setUser,
    }),
    [user, loading, login, register, verifyEmail, resendVerification, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth fuera de AuthProvider");
  return context;
}

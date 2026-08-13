import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import type { AuthUser } from "@nocta/shared";
import { useAuth } from "../auth/AuthContext";
import { api, ApiError, setToken } from "../lib/api";

export function AuthCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [error, setError] = useState("");

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setError("No se recibió token OAuth");
      return;
    }

    let alive = true;
    (async () => {
      try {
        setToken(token);
        const data = await api<{ user: AuthUser }>("/api/auth/me");
        if (!alive) return;
        setUser(data.user);
        navigate(
          data.user.role === "admin"
            ? "/admin"
            : data.user.profileComplete
              ? "/"
              : "/onboarding",
          { replace: true }
        );
      } catch (err) {
        setToken(null);
        if (!alive) return;
        setError(
          err instanceof ApiError
            ? err.message
            : "No se pudo completar el login social"
        );
      }
    })();

    return () => {
      alive = false;
    };
  }, [params, navigate, setUser]);

  if (error) {
    return (
      <div className="auth-hero">
        <div>
          <h1 className="h3 mb-2">Login social</h1>
          <p className="text-danger">{error}</p>
          <Link to="/login">Volver al login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-hero">
      <div className="text-secondary">Completando inicio de sesión…</div>
    </div>
  );
}

import { FormEvent, useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import type { OAuthProvider } from "@nocta/shared";
import { useAuth } from "../auth/AuthContext";
import { ApiError } from "../lib/api";

const DEMO_ACCOUNTS = [
  { email: "sofia@nocta.app", password: "demo1234", label: "Sofía" },
  { email: "mateo@nocta.app", password: "demo1234", label: "Mateo" },
  { email: "valentina@nocta.app", password: "demo1234", label: "Valentina" },
  { email: "admin@nocta.app", password: "admin123456", label: "Admin" },
] as const;

function startOAuth(provider: OAuthProvider) {
  window.location.assign(`/api/auth/oauth/${provider}`);
}

export function LoginPage() {
  const { login, user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const oauthError = searchParams.get("error");
    if (oauthError) setError(oauthError);
  }, [searchParams]);

  if (!loading && user) {
    return <Navigate to={user.role === "admin" ? "/admin" : "/"} replace />;
  }

  async function doLogin(nextEmail: string, nextPassword: string) {
    setError("");
    setBusy(true);
    try {
      const u = await login(nextEmail, nextPassword);
      navigate(u.role === "admin" ? "/admin" : u.profileComplete ? "/" : "/onboarding");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo iniciar sesión");
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await doLogin(email, password);
  }

  async function onSocial(provider: OAuthProvider) {
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/auth/oauth/${provider}`, {
        method: "GET",
        redirect: "manual",
      });
      if (res.status === 503 || (res.status >= 400 && res.type !== "opaqueredirect")) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? `No se pudo iniciar OAuth con ${provider}`);
        return;
      }
      startOAuth(provider);
    } catch {
      startOAuth(provider);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-hero">
      <div>
        <h1 className="display-4 mb-1">
          Noc<span className="text-primary">ta</span>
        </h1>
        <p className="text-secondary mb-3">
          Publicate donde vas. Matcheá con quien está en el mismo lugar.
        </p>

        <form className="d-grid gap-2 mb-3" onSubmit={onSubmit}>
          <input
            className="form-control form-control-lg bg-transparent border-secondary"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <input
            className="form-control form-control-lg bg-transparent border-secondary"
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="current-password"
          />
          {error && <p className="text-danger small mb-0">{error}</p>}
          <button className="btn btn-primary btn-lg" type="submit" disabled={busy}>
            {busy ? "Entrando…" : "Entrar"}
          </button>
        </form>

        <div className="auth-social d-flex justify-content-center gap-3 my-3">
          <button
            type="button"
            className="btn btn-outline-light auth-social-btn"
            aria-label="Continuar con Google"
            disabled={busy}
            onClick={() => void onSocial("google")}
          >
            <i className="bi bi-google fs-5" aria-hidden="true"></i>
          </button>
          <button
            type="button"
            className="btn btn-outline-light auth-social-btn"
            aria-label="Continuar con Apple"
            disabled={busy}
            onClick={() => void onSocial("apple")}
          >
            <i className="bi bi-apple fs-5" aria-hidden="true"></i>
          </button>
          <button
            type="button"
            className="btn btn-outline-light auth-social-btn"
            aria-label="Continuar con Microsoft"
            disabled={busy}
            onClick={() => void onSocial("microsoft")}
          >
            <i className="bi bi-microsoft fs-5" aria-hidden="true"></i>
          </button>
        </div>

        <p className="small mb-3">
          ¿No tenés cuenta? <Link to="/register">Registrate</Link>
        </p>

        <p className="small text-secondary mb-2">Demo</p>
        <div className="d-flex flex-wrap gap-2">
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.email}
              type="button"
              className="btn btn-sm btn-outline-light"
              disabled={busy}
              onClick={() => void doLogin(account.email, account.password)}
            >
              {account.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

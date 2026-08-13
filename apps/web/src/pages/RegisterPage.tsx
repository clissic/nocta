import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ApiError } from "../lib/api";

export function RegisterPage() {
  const { register, user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!loading && user) {
    return <Navigate to={user.profileComplete ? "/" : "/onboarding"} replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await register(email, password);
      navigate("/onboarding");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo registrar");
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
          Creá tu cuenta. El perfil queda oculto hasta que te publiques.
        </p>
        <form className="d-grid gap-2" onSubmit={onSubmit}>
          <input
            className="form-control form-control-lg bg-transparent border-secondary"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="form-control form-control-lg bg-transparent border-secondary"
            type="password"
            placeholder="Contraseña (mín. 6)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          {error && <p className="text-danger small mb-0">{error}</p>}
          <button className="btn btn-primary btn-lg" type="submit" disabled={busy}>
            {busy ? "Creando…" : "Crear cuenta"}
          </button>
        </form>
        <p className="small mt-3 mb-0">
          ¿Ya tenés cuenta? <Link to="/login">Iniciá sesión</Link>
        </p>
      </div>
    </div>
  );
}

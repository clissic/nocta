import { FormEvent, useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  isStrongPassword,
  MIN_PASSWORD_LENGTH,
  PASSWORD_HINT,
  PASSWORD_RULES,
} from "@nocta/shared";
import { useAuth } from "../auth/AuthContext";
import { AuthAtmosphere } from "../components/AuthAtmosphere";
import { NoctaWordmark } from "../components/NoctaWordmark";
import { ApiError } from "../lib/api";

export function RegisterPage() {
  const { register, user, loading } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const ruleStatus = useMemo(
    () =>
      PASSWORD_RULES.map((rule) => ({
        id: rule.id,
        label: rule.label,
        met: rule.test(password),
      })),
    [password]
  );

  const passwordsMatch =
    confirmPassword.length > 0 && password === confirmPassword;

  if (!loading && user) {
    if (!user.emailVerified) return <Navigate to="/verify-email" replace />;
    return <Navigate to={user.profileComplete ? "/" : "/onboarding"} replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Ingresá tu nombre");
      return;
    }
    if (!isStrongPassword(password)) {
      setError(PASSWORD_HINT);
      return;
    }
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }
    if (!acceptTerms) {
      setError("Tenés que aceptar los términos para crear la cuenta");
      return;
    }

    setBusy(true);
    try {
      await register(email.trim(), password, { name: name.trim() });
      navigate("/verify-email");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo registrar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-hero auth-hero-register">
      <AuthAtmosphere variant="register" />
      <div className="auth-panel">
        <h1 className="display-4 mb-1 auth-wordmark">
          <NoctaWordmark />
        </h1>
        <p className="text-secondary mb-3">
          Creá tu cuenta. El perfil queda oculto hasta que te publiques.
        </p>
        <form className="d-grid gap-2" onSubmit={onSubmit}>
          <input
            className="form-control form-control-lg bg-transparent border-secondary"
            type="text"
            name="name"
            placeholder="Nombre"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
            maxLength={80}
          />
          <input
            className="form-control form-control-lg bg-transparent border-secondary"
            type="email"
            name="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <input
            className="form-control form-control-lg bg-transparent border-secondary"
            type="password"
            name="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
          />
          <ul className="password-rules" aria-live="polite">
            {ruleStatus.map((rule) => (
              <li
                key={rule.id}
                className={`password-rule${rule.met ? " is-met" : ""}`}
              >
                <i
                  className={`bi ${rule.met ? "bi-check-circle-fill" : "bi-circle"}`}
                  aria-hidden="true"
                />
                <span>{rule.label}</span>
              </li>
            ))}
          </ul>
          <input
            className={`form-control form-control-lg bg-transparent border-secondary${
              confirmPassword && !passwordsMatch ? " is-invalid" : ""
            }${passwordsMatch ? " is-valid" : ""}`}
            type="password"
            name="confirmPassword"
            placeholder="Confirmar contraseña"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
          />
          {confirmPassword.length > 0 && !passwordsMatch && (
            <p className="small text-danger mb-0">Las contraseñas no coinciden</p>
          )}
          <label className="auth-terms form-check">
            <input
              className="form-check-input"
              type="checkbox"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
              required
            />
            <span className="form-check-label small text-secondary">
              Acepto los términos de uso y la política de privacidad de Nocta
            </span>
          </label>
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

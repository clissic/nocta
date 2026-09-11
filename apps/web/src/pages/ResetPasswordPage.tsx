import { FormEvent, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  isStrongPassword,
  MIN_PASSWORD_LENGTH,
  PASSWORD_HINT,
  PASSWORD_RULES,
} from "@nocta/shared";
import { AuthAtmosphere } from "../components/AuthAtmosphere";
import { NoctaWordmark } from "../components/NoctaWordmark";
import { PasswordInput } from "../components/PasswordInput";
import { useToast } from "../components/ToastProvider";
import { api, ApiError } from "../lib/api";

export function ResetPasswordPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("Link inválido. Pedí uno nuevo.");
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

    setBusy(true);
    try {
      await api<{ ok: boolean }>("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      toast.success("Contraseña actualizada. Ingresá con la nueva.");
      navigate("/login", { replace: true });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "No se pudo restablecer la contraseña";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-hero auth-hero-login">
      <AuthAtmosphere variant="reset" />
      <div className="auth-panel">
        <h1 className="display-4 mb-1 auth-wordmark">
          <NoctaWordmark />
        </h1>
        <p className="text-secondary mb-3">
          Elegí una nueva contraseña para tu cuenta.
        </p>

        {!token ? (
          <div className="d-grid gap-3">
            <p className="text-danger mb-0">
              Este link no es válido. Pedí uno nuevo desde el login.
            </p>
            <Link className="btn btn-primary btn-lg" to="/forgot-password">
              Solicitar link
            </Link>
            <p className="small mb-0">
              <Link to="/login">Volver al login</Link>
            </p>
          </div>
        ) : (
          <>
            <form className="d-grid gap-2" onSubmit={onSubmit}>
              <PasswordInput
                name="password"
                placeholder="Nueva contraseña"
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
                      className={`bi ${
                        rule.met ? "bi-check-circle-fill" : "bi-circle"
                      }`}
                      aria-hidden="true"
                    />
                    <span>{rule.label}</span>
                  </li>
                ))}
              </ul>
              <PasswordInput
                inputClassName={`form-control form-control-lg bg-transparent border-secondary${
                  confirmPassword && !passwordsMatch ? " is-invalid" : ""
                }${passwordsMatch ? " is-valid" : ""}`}
                name="confirmPassword"
                placeholder="Confirmar contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={MIN_PASSWORD_LENGTH}
                autoComplete="new-password"
              />
              {confirmPassword.length > 0 && !passwordsMatch && (
                <p className="small text-danger mb-0">
                  Las contraseñas no coinciden
                </p>
              )}
              {error && <p className="text-danger small mb-0">{error}</p>}
              <button
                className="btn btn-primary btn-lg"
                type="submit"
                disabled={busy}
              >
                {busy ? "Guardando…" : "Restablecer contraseña"}
              </button>
            </form>
            <p className="small mt-3 mb-0">
              ¿Link vencido?{" "}
              <Link to="/forgot-password">Pedí uno nuevo</Link>
              {" · "}
              <Link to="/login">Login</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

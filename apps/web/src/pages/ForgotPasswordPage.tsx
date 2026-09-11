import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { AuthAtmosphere } from "../components/AuthAtmosphere";
import { NoctaWordmark } from "../components/NoctaWordmark";
import { useToast } from "../components/ToastProvider";
import { api, ApiError } from "../lib/api";

export function ForgotPasswordPage() {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api<{ ok: boolean; message?: string }>("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
      });
      setSent(true);
      toast.success("Si la cuenta existe, te enviamos un email");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "No se pudo enviar el email";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-hero auth-hero-login">
      <AuthAtmosphere variant="forgot" />
      <div className="auth-panel">
        <h1 className="display-4 mb-1 auth-wordmark">
          <NoctaWordmark />
        </h1>
        <p className="text-secondary mb-3">
          Ingresá el email de tu cuenta y te mandamos un link para restablecer
          la contraseña. El link vale 15 minutos.
        </p>

        {sent ? (
          <div className="d-grid gap-3">
            <p className="mb-0">
              Si existe una cuenta con <strong>{email.trim()}</strong>, vas a
              recibir un email con el link. Revisá también spam.
            </p>
            <Link className="btn btn-primary btn-lg" to="/login">
              Volver al login
            </Link>
            <button
              type="button"
              className="btn btn-outline-light"
              disabled={busy}
              onClick={() => {
                setSent(false);
                setError("");
              }}
            >
              Usar otro email
            </button>
          </div>
        ) : (
          <form className="d-grid gap-2" onSubmit={onSubmit}>
            <input
              className="form-control form-control-lg bg-transparent border-secondary"
              type="email"
              name="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
            />
            {error && <p className="text-danger small mb-0">{error}</p>}
            <button
              className="btn btn-primary btn-lg"
              type="submit"
              disabled={busy}
            >
              {busy ? "Enviando…" : "Enviar link"}
            </button>
          </form>
        )}

        <p className="small mt-3 mb-0">
          <Link to="/login">Volver al login</Link>
        </p>
      </div>
    </div>
  );
}

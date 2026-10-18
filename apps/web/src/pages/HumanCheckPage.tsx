import { useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { isHumanCheckRequest } from "../auth/humanCheck";
import { AuthAtmosphere } from "../components/AuthAtmosphere";
import { NoctaWordmark } from "../components/NoctaWordmark";
import { TurnstileField } from "../components/TurnstileField";
import { useToast } from "../components/ToastProvider";
import { ApiError, api } from "../lib/api";

const HINT = {
  login: "Para entrar a tu cuenta.",
  register: "Para crear tu cuenta.",
  forgot: "Para enviarte el link de recupero.",
} as const;

export function HumanCheckPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const toast = useToast();
  const request = isHumanCheckRequest(location.state) ? location.state : null;
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [turnstileKey, setTurnstileKey] = useState(0);
  const started = useRef(false);

  function fail(message: string) {
    started.current = false;
    setBusy(false);
    setError(message);
    setTurnstileKey((current) => current + 1);
  }

  async function onToken(token: string) {
    if (!request || !token || started.current) return;
    started.current = true;
    setError("");
    setBusy(true);
    try {
      if (request.kind === "login") {
        const user = await login(request.email, request.password, token);
        const next = request.next;
        navigate(
          !user.emailVerified
            ? "/verify-email"
            : next && (user.role === "admin" || !next.startsWith("/admin"))
              ? next
              : user.profileComplete
                ? "/"
                : "/onboarding",
          { replace: true }
        );
        return;
      }
      if (request.kind === "register") {
        await register(request.email, request.password, {
          name: request.name,
          marketingEmailsOptIn: request.marketingEmailsOptIn,
          turnstileToken: token,
        });
        navigate("/verify-email", { replace: true });
        return;
      }
      await api("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: request.email, turnstileToken: token }),
      });
      setSent(true);
      toast.success("Si la cuenta existe, te enviamos un email");
    } catch (err) {
      if (err instanceof ApiError && err.code === "EMAIL_NOT_VERIFIED") {
        const pendingEmail =
          typeof err.data.email === "string" ? err.data.email : request.email;
        navigate(`/verify-email?email=${encodeURIComponent(pendingEmail)}`, {
          replace: true,
        });
        return;
      }
      if (
        err instanceof ApiError &&
        (err.code === "ACCOUNT_TEMPORARILY_SUSPENDED" ||
          err.code === "ACCOUNT_PERMANENTLY_SUSPENDED")
      ) {
        navigate("/login", { replace: true });
        return;
      }
      fail(err instanceof ApiError ? err.message : "No se pudo continuar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-hero auth-hero-check">
      <AuthAtmosphere variant="login" />
      <div className="auth-panel human-check-panel">
        <h1 className="display-4 mb-2 auth-wordmark">
          <NoctaWordmark />
        </h1>
        {!request ? (
          <>
            <p className="text-secondary">Volvé al formulario para continuar.</p>
            <Link className="btn btn-primary btn-lg" to="/login">
              Ir al login
            </Link>
          </>
        ) : sent && request.kind === "forgot" ? (
          <>
            <p className="mb-0">
              Si existe una cuenta con <strong>{request.email}</strong>, vas a
              recibir un email con el link. Revisá también spam.
            </p>
            <Link className="btn btn-primary btn-lg mt-3" to="/login">
              Volver al login
            </Link>
          </>
        ) : (
          <>
            <p className="mb-1">Confirmá que sos una persona</p>
            <p className="text-secondary small mb-0">{HINT[request.kind]}</p>
            <TurnstileField
              resetKey={turnstileKey}
              onToken={(token) => void onToken(token)}
              onError={() => fail("No pudimos verificar que seas una persona. Probá de nuevo.")}
            />
            {busy ? <p className="small text-secondary mb-0">Un momento…</p> : null}
            {error ? <p className="text-danger small mb-0">{error}</p> : null}
            <button
              type="button"
              className="btn btn-link text-secondary"
              onClick={() => navigate(-1)}
              disabled={busy}
            >
              Volver
            </button>
          </>
        )}
      </div>
    </div>
  );
}

import {
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import {
  EMAIL_VERIFICATION_CODE_LENGTH,
  EMAIL_VERIFICATION_TTL_MINUTES,
} from "@nocta/shared";
import { useAuth } from "../auth/AuthContext";
import { AuthAtmosphere } from "../components/AuthAtmosphere";
import { NoctaWordmark } from "../components/NoctaWordmark";
import { ApiError } from "../lib/api";

const emptyCode = () =>
  Array.from({ length: EMAIL_VERIFICATION_CODE_LENGTH }, () => "");

export function VerifyEmailPage() {
  const { user, loading, verifyEmail, resendVerification, logout } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const queryEmail = params.get("email") ?? "";
  const [email, setEmail] = useState(user?.email ?? queryEmail);
  const [digits, setDigits] = useState(emptyCode);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const code = useMemo(() => digits.join(""), [digits]);

  useEffect(() => {
    if (user?.email) setEmail(user.email);
  }, [user?.email]);

  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setInterval(
      () => setCooldown((value) => Math.max(0, value - 1)),
      1000
    );
    return () => window.clearInterval(timer);
  }, [cooldown]);

  if (!loading && user?.emailVerified) {
    return <Navigate to={user.profileComplete ? "/" : "/onboarding"} replace />;
  }
  if (!loading && !user && !email) return <Navigate to="/login" replace />;

  function focus(index: number) {
    inputs.current[index]?.focus();
    inputs.current[index]?.select();
  }

  function setDigit(index: number, raw: string) {
    const value = raw.replace(/\D/g, "").slice(-1);
    setDigits((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });
    if (value && index < EMAIL_VERIFICATION_CODE_LENGTH - 1) focus(index + 1);
  }

  function onKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      event.preventDefault();
      setDigit(index - 1, "");
      focus(index - 1);
    }
  }

  function onPaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const value = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, EMAIL_VERIFICATION_CODE_LENGTH);
    if (!value) return;
    const next = emptyCode();
    value.split("").forEach((digit, index) => {
      next[index] = digit;
    });
    setDigits(next);
    focus(Math.min(value.length, EMAIL_VERIFICATION_CODE_LENGTH - 1));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!email) return setError("Indicá tu email");
    if (code.length !== EMAIL_VERIFICATION_CODE_LENGTH) {
      return setError(`Ingresá el código de ${EMAIL_VERIFICATION_CODE_LENGTH} dígitos`);
    }
    setBusy(true);
    try {
      const nextUser = await verifyEmail(code, email);
      navigate(nextUser.profileComplete ? "/" : "/onboarding", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo verificar");
      setDigits(emptyCode());
      focus(0);
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (!email || cooldown) return;
    setBusy(true);
    setError("");
    try {
      const result = await resendVerification(email);
      setCooldown(60);
      setNotice(
        `Te enviamos un nuevo código. Válido ${
          result.expiresInMinutes ?? EMAIL_VERIFICATION_TTL_MINUTES
        } minutos.`
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo reenviar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-hero auth-hero-verify">
      <AuthAtmosphere variant="verify" />
      <div className="auth-panel">
        <h1 className="display-4 mb-1 auth-wordmark">
          <NoctaWordmark />
        </h1>
        <p className="text-secondary mb-1">Confirmá tu email</p>
        <p className="small text-secondary mb-3">
          Ingresá el código que enviamos a <span className="text-body">{email}</span>.
          Válido {EMAIL_VERIFICATION_TTL_MINUTES} minutos.
        </p>
        <form className="d-grid gap-3" onSubmit={submit}>
          {!user && (
            <input
              className="form-control form-control-lg bg-transparent border-secondary"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email"
              autoComplete="email"
              required
            />
          )}
          <div className="verify-otp" role="group" aria-label="Código de verificación">
            {digits.map((digit, index) => (
              <input
                key={index}
                ref={(element) => {
                  inputs.current[index] = element;
                }}
                className="verify-otp-cell form-control"
                inputMode="numeric"
                autoComplete={index === 0 ? "one-time-code" : "off"}
                maxLength={1}
                value={digit}
                onChange={(event) => setDigit(index, event.target.value)}
                onKeyDown={(event) => onKeyDown(index, event)}
                onPaste={onPaste}
                aria-label={`Dígito ${index + 1}`}
              />
            ))}
          </div>
          {error && <p className="text-danger small mb-0">{error}</p>}
          {notice && <p className="text-primary small mb-0">{notice}</p>}
          <button className="btn btn-primary btn-lg" disabled={busy}>
            {busy ? "Verificando…" : "Verificar y continuar"}
          </button>
        </form>
        <button
          type="button"
          className="btn btn-link link-secondary px-0 mt-3"
          disabled={busy || cooldown > 0}
          onClick={() => void resend()}
        >
          {cooldown ? `Reenviar en ${cooldown}s` : "Reenviar código"}
        </button>
        <p className="small mb-0">
          {user ? (
            <button
              className="btn btn-link link-secondary px-0"
              onClick={() => {
                logout();
                navigate("/login");
              }}
            >
              Usar otra cuenta
            </button>
          ) : (
            <Link to="/login">Volver al login</Link>
          )}
        </p>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";

export function formatBoostCountdown(remainingMs: number) {
  const totalSec = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** Cohete + cuenta regresiva en la topbar mientras el Boost está activo. */
export function BoostTopbarIndicator() {
  const { user } = useAuth();
  const [now, setNow] = useState(() => Date.now());
  const expiresAt = user?.boostExpiresAt
    ? new Date(user.boostExpiresAt).getTime()
    : 0;
  const remainingMs = expiresAt - now;
  const active = remainingMs > 0;

  useEffect(() => {
    if (!expiresAt || expiresAt <= Date.now()) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [expiresAt]);

  if (!active) return null;

  const label = formatBoostCountdown(remainingMs);

  return (
    <div
      className="boost-topbar-indicator"
      role="status"
      aria-live="polite"
      aria-label={`Boost activo · ${label} restantes`}
      title={`Boost activo · ${label}`}
    >
      <i className="bi bi-rocket-takeoff" aria-hidden="true" />
      <span className="boost-topbar-countdown">{label}</span>
    </div>
  );
}

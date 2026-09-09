import { useEffect, useState } from "react";
import type { AuthUser } from "@nocta/shared";
import { Link } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { OverflowFade } from "./OverflowFade";
import { useToast } from "./ToastProvider";

type Props = {
  user: AuthUser;
  onClose: () => void;
  onUserUpdated: (user: AuthUser) => void;
};

export function ProfileSettingsModal({
  user,
  onClose,
  onUserUpdated,
}: Props) {
  const toast = useToast();
  const [autoAccept, setAutoAccept] = useState(user.autoAcceptFollowRequests);
  const [showActivity, setShowActivity] = useState(
    user.showActivityToFollowers
  );
  const [busyKey, setBusyKey] = useState<
    "autoAcceptFollowRequests" | "showActivityToFollowers" | null
  >(null);

  useEffect(() => {
    setAutoAccept(user.autoAcceptFollowRequests);
    setShowActivity(user.showActivityToFollowers);
  }, [user.autoAcceptFollowRequests, user.showActivityToFollowers]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  async function patchSetting(
    key: "autoAcceptFollowRequests" | "showActivityToFollowers",
    value: boolean
  ) {
    setBusyKey(key);
    try {
      const response = await api<{ user: AuthUser }>("/api/me/settings", {
        method: "PATCH",
        body: JSON.stringify({ [key]: value }),
      });
      onUserUpdated(response.user);
      toast.success("Configuración guardada");
    } catch (err) {
      if (key === "autoAcceptFollowRequests") setAutoAccept(!value);
      else setShowActivity(!value);
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo guardar"
      );
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div
      className="profile-connections-modal profile-settings-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-settings-title"
    >
      <button
        type="button"
        className="profile-connections-backdrop"
        aria-label="Cerrar"
        onClick={onClose}
      />
      <div className="profile-connections-dialog">
        <header className="profile-connections-head">
          <h2 id="profile-settings-title">Configuración</h2>
          <button
            type="button"
            className="profile-connections-close"
            aria-label="Cerrar"
            onClick={onClose}
          >
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>
        </header>

        <OverflowFade className="profile-connections-body profile-settings-body">
          <div className="form-check form-switch profile-settings-switch">
            <input
              className="form-check-input"
              type="checkbox"
              role="switch"
              id="settings-auto-accept"
              checked={autoAccept}
              disabled={busyKey === "autoAcceptFollowRequests"}
              onChange={(event) => {
                const next = event.target.checked;
                setAutoAccept(next);
                void patchSetting("autoAcceptFollowRequests", next);
              }}
            />
            <label className="form-check-label" htmlFor="settings-auto-accept">
              Aceptar automáticamente las solicitudes de seguimiento
            </label>
          </div>

          <div className="form-check form-switch profile-settings-switch">
            <input
              className="form-check-input"
              type="checkbox"
              role="switch"
              id="settings-show-activity"
              checked={showActivity}
              disabled={busyKey === "showActivityToFollowers"}
              onChange={(event) => {
                const next = event.target.checked;
                setShowActivity(next);
                void patchSetting("showActivityToFollowers", next);
              }}
            />
            <label
              className="form-check-label"
              htmlFor="settings-show-activity"
            >
              Que quienes me siguen vean mi actividad
            </label>
          </div>

          <section className="profile-settings-privacy">
            <h3>Privacidad y seguridad</h3>
            <Link
              className="profile-settings-link"
              to="/profile/blocked"
            >
              <i className="bi bi-slash-circle" aria-hidden="true" />
              <span>
                <strong>Usuarios bloqueados</strong>
                <small>Consultá y administrá tus bloqueos</small>
              </span>
              <i className="bi bi-chevron-right" aria-hidden="true" />
            </Link>
          </section>

        </OverflowFade>
      </div>
    </div>
  );
}

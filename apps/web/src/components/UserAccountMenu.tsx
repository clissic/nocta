import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { AuthUser, PremiumPlanId } from "@nocta/shared";
import { planHasFeature } from "@nocta/shared";
import { api, ApiError } from "../lib/api";
import { AppFooter } from "./AppFooter";
import { formatBoostCountdown } from "./BoostTopbarIndicator";
import { OverflowFade } from "./OverflowFade";
import { PremiumPackagesModal } from "./PremiumPackagesModal";
import { ProfileSettingsModal } from "./ProfileSettingsModal";
import { useToast } from "./ToastProvider";
import { OptimizedImage } from "./OptimizedImage";

type Props = {
  user: AuthUser;
  open: boolean;
  onClose: () => void;
  onUserUpdated: (user: AuthUser) => void;
  onRequestLogout: () => void;
};

const PLAN_PILL_CLASS: Record<PremiumPlanId, string> = {
  nocta_2am: "is-2am",
  nocta_4am: "is-4am",
  nocta_6am: "is-6am",
};

const PLAN_PILL_LABEL: Record<PremiumPlanId, string> = {
  nocta_2am: "2 AM",
  nocta_4am: "4 AM",
  nocta_6am: "6 AM",
};

function planPill(user: AuthUser) {
  if (user.premium && user.premiumPlanId) {
    return {
      className: `profile-settings-plan-pill ${PLAN_PILL_CLASS[user.premiumPlanId]}`,
      label: PLAN_PILL_LABEL[user.premiumPlanId],
    };
  }
  return {
    className: "profile-settings-plan-pill is-free",
    label: "Gratis",
  };
}

function teleportLabel(user: AuthUser) {
  if (!user.premium || !user.teleportMode) {
    return "Teleport: desactivado";
  }
  if (user.teleportCity?.city) {
    return `Teleport: ${user.teleportCity.city}`;
  }
  return "Teleport: sin ciudad";
}

export function UserAccountMenu({
  user,
  open,
  onClose,
  onUserUpdated,
  onRequestLogout,
}: Props) {
  const toast = useToast();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [premiumOpen, setPremiumOpen] = useState(false);
  const [boostBusy, setBoostBusy] = useState(false);
  const [avatarBroken, setAvatarBroken] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const avatar = user.profile?.photos?.[0];
  const name = user.profile?.name?.trim() || user.email;
  const pill = planPill(user);
  const showAvatar = Boolean(avatar) && !avatarBroken;

  useEffect(() => {
    setAvatarBroken(false);
  }, [avatar]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !settingsOpen) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose, settingsOpen]);

  const boostExpiresAt = user.boostExpiresAt
    ? new Date(user.boostExpiresAt).getTime()
    : 0;
  const boostRemainingMs = boostExpiresAt - now;
  const boostActive = boostRemainingMs > 0;
  const canBoost = planHasFeature(user.premiumPlanId, "boost");
  const boostCountdown = boostActive
    ? formatBoostCountdown(boostRemainingMs)
    : null;

  useEffect(() => {
    if (!boostExpiresAt || boostExpiresAt <= Date.now()) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [boostExpiresAt]);

  function openSettings() {
    onClose();
    setSettingsOpen(true);
  }
  async function activateBoost() {
    if (boostBusy) return;
    if (!canBoost) {
      onClose();
      setPremiumOpen(true);
      return;
    }
    if (boostActive) {
      toast.info("Ya tenés un Boost activo");
      return;
    }
    if ((user.boostsRemaining ?? 0) <= 0) {
      toast.error("No te quedan Boosts este periodo");
      return;
    }
    setBoostBusy(true);
    try {
      const res = await api<{ user: AuthUser }>("/api/premium/boost", {
        method: "POST",
        body: JSON.stringify({}),
      });
      onUserUpdated(res.user);
      toast.success("Boost activado · prioridad 30 min");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo activar el Boost"
      );
    } finally {
      setBoostBusy(false);
    }
  }

  return (
    <>
      <button
        className={`account-drawer-backdrop${open ? " is-open" : ""}`}
        type="button"
        aria-label="Cerrar menú de cuenta"
        tabIndex={open ? 0 : -1}
        onClick={onClose}
      />
      <aside
        id="account-drawer"
        className={`account-drawer${open ? " is-open" : ""}`}
        aria-label="Menú de cuenta"
        aria-hidden={!open}
      >
        <div className="account-drawer-head">
          <span>Cuenta</span>
          <button
            type="button"
            aria-label="Cerrar menú de cuenta"
            tabIndex={open ? 0 : -1}
            onClick={onClose}
          >
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>
        </div>

        <OverflowFade className="account-drawer-body">
          <div className="account-drawer-profile">
            <div className="account-drawer-avatar" aria-hidden="true">
              {showAvatar ? (
                <OptimizedImage
                  src={avatar}
                  alt=""
                  variant="thumb"
                  sizes="56px"
                  onError={() => setAvatarBroken(true)}
                />
              ) : (
                <i className="bi bi-person-fill" />
              )}
            </div>
            <div className="account-drawer-identity min-w-0">
              <p className="account-drawer-name mb-1">
                <span className="text-truncate">{name}</span>
                {user.identityVerified ? (
                  <span
                    className="profile-verified-badge"
                    title="Cuenta verificada"
                  >
                    <i
                      className="bi bi-patch-check-fill"
                      aria-hidden="true"
                    />
                    <span className="visually-hidden">Verificado</span>
                  </span>
                ) : null}
              </p>
              <p className="account-drawer-plan mb-0">
                <span className="account-drawer-plan-label">Plan</span>
                <span className={pill.className}>{pill.label}</span>
              </p>
            </div>
          </div>

          <div className="account-drawer-actions">
            <Link
              className="btn btn-outline-light account-drawer-btn"
              to="/onboarding?edit=1"
              tabIndex={open ? 0 : -1}
              onClick={onClose}
            >
              <i className="bi bi-pencil" aria-hidden="true" />
              Editar perfil
            </Link>
            <button
              type="button"
              className="btn btn-outline-light account-drawer-btn"
              tabIndex={open ? 0 : -1}
              onClick={openSettings}
            >
              <i className="bi bi-gear" aria-hidden="true" />
              Configuración
            </button>
          </div>

          <p className="account-drawer-teleport mb-0">
            <i className="bi bi-geo-alt" aria-hidden="true" />
            <span>{teleportLabel(user)}</span>
          </p>

          <button
            type="button"
            className={`account-drawer-boost${boostActive ? " is-active" : ""}`}
            tabIndex={open ? 0 : -1}
            disabled={boostBusy}
            onClick={() => void activateBoost()}
          >
            <i className="bi bi-rocket-takeoff" aria-hidden="true" />
            <span className="account-drawer-boost-copy">
              <strong>Boost</strong>
              <small>
                {!canBoost
                  ? "Desde Nocta 4 A.M."
                  : boostActive
                    ? "Activo ahora"
                    : `${user.boostsRemaining ?? 0} restantes`}
              </small>
            </span>
            <span className="account-drawer-boost-action">
              {!canBoost
                ? "Ver planes"
                : boostCountdown
                  ? boostCountdown
                  : "Usar"}
            </span>
          </button>

          <nav className="account-drawer-links" aria-label="Accesos de cuenta">
            <Link
              to="/profile"
              tabIndex={open ? 0 : -1}
              onClick={onClose}
            >
              <i className="bi bi-person" aria-hidden="true" />
              <span>Mi perfil</span>
              <i className="bi bi-chevron-right" aria-hidden="true" />
            </Link>
            <Link
              to={user.premium ? "/premium" : "/premium?buy=1"}
              tabIndex={open ? 0 : -1}
              onClick={onClose}
            >
              <i className="bi bi-gem" aria-hidden="true" />
              <span>Premium</span>
              <i className="bi bi-chevron-right" aria-hidden="true" />
            </Link>
            <Link
              to="/profile/promos"
              tabIndex={open ? 0 : -1}
              onClick={onClose}
            >
              <i className="bi bi-qr-code" aria-hidden="true" />
              <span>Mis promos</span>
              <i className="bi bi-chevron-right" aria-hidden="true" />
            </Link>
            {user.role === "admin" ? (
              <Link
                to="/admin/overview"
                tabIndex={open ? 0 : -1}
                onClick={onClose}
              >
                <i className="bi bi-speedometer2" aria-hidden="true" />
                <span>Panel</span>
                <i className="bi bi-chevron-right" aria-hidden="true" />
              </Link>
            ) : null}
          </nav>
        </OverflowFade>

        <button
          className="account-drawer-logout"
          type="button"
          tabIndex={open ? 0 : -1}
          onClick={() => {
            onClose();
            onRequestLogout();
          }}
        >
          <i className="bi bi-box-arrow-right" aria-hidden="true" />
          <span>Cerrar sesión</span>
        </button>

        <AppFooter
          className="account-drawer-footer"
          onNavigate={onClose}
        />
      </aside>

      {settingsOpen ? (
        <ProfileSettingsModal
          user={user}
          onClose={() => setSettingsOpen(false)}
          onUserUpdated={onUserUpdated}
        />
      ) : null}
      {premiumOpen ? (
        <PremiumPackagesModal onClose={() => setPremiumOpen(false)} />
      ) : null}
    </>
  );
}

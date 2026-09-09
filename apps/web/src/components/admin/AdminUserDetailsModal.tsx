import { useEffect, useMemo, useState } from "react";
import {
  GENDER_LABELS,
  INTEREST_LABELS,
  LOOKING_FOR_LABELS,
  WORK_STATUS_LABELS,
  type AuthUser,
  type Gender,
  type Interest,
  type LookingFor,
  type WorkStatus,
} from "@nocta/shared";
import { ApiError, api } from "../../lib/api";
import { NoctaLoading } from "../NoctaLoading";
import { OverflowFade } from "../OverflowFade";

type Props = {
  userId: string;
  onClose: () => void;
};

function formatDate(value?: string) {
  if (!value) return "Sin especificar";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Sin especificar"
    : date.toLocaleDateString("es-UY");
}

export function AdminUserDetailsModal({ userId, onClose }: Props) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    setUser(null);
    setError("");
    void api<{ user: AuthUser }>(`/api/admin/users/${userId}`)
      .then((response) => setUser(response.user))
      .catch((err) =>
        setError(
          err instanceof ApiError
            ? err.message
            : "No se pudo cargar el usuario"
        )
      );
  }, [userId]);

  const profile = user?.profile;
  const location = useMemo(() => {
    const city = profile?.livesIn?.city?.trim();
    const country = profile?.livesIn?.country?.trim();
    return city && country ? `${city}, ${country}` : "Sin especificar";
  }, [profile?.livesIn?.city, profile?.livesIn?.country]);

  return (
    <div className="admin-modal" role="presentation">
      <button
        type="button"
        className="admin-modal-backdrop"
        aria-label="Cerrar ficha de usuario"
        onClick={onClose}
      />
      <section
        className="admin-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-report-user-title"
      >
        <header className="admin-modal-head">
          <div className="admin-modal-title-row">
            {profile?.photos?.[0] ? (
              <img
                className="admin-list-thumb"
                src={profile.photos[0]}
                alt=""
              />
            ) : (
              <span className="admin-list-thumb is-avatar" aria-hidden="true">
                {(profile?.name?.[0] ?? user?.email?.[0] ?? "?").toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <h2 id="admin-report-user-title" className="app-title h4 mb-1">
                {profile?.name ?? (user ? "Sin nombre" : "Cargando usuario")}
              </h2>
              {user && (
                <p className="text-secondary small mb-0 text-truncate">
                  {user.email}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            className="admin-modal-close"
            aria-label="Cerrar"
            onClick={onClose}
          >
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>
        </header>

        <OverflowFade className="admin-modal-body">
          {error ? (
            <p className="text-danger small mb-0">{error}</p>
          ) : !user ? (
            <NoctaLoading variant="block" />
          ) : (
            <>
              <section className="admin-modal-section">
                <h3 className="admin-review-label">Cuenta</h3>
                <div className="admin-modal-grid">
                  <div className="admin-modal-field">
                    <span>ID</span>
                    <code>{user.id}</code>
                  </div>
                  <div className="admin-modal-field">
                    <span>Rol</span>
                    <strong>
                      {user.role === "admin" ? "Administrador" : "Usuario"}
                    </strong>
                  </div>
                  <div className="admin-modal-field">
                    <span>Email verificado</span>
                    <strong>{user.emailVerified ? "Sí" : "No"}</strong>
                  </div>
                  <div className="admin-modal-field">
                    <span>Premium</span>
                    <strong>{user.premium ? "Sí" : "No"}</strong>
                  </div>
                  <div className="admin-modal-field">
                    <span>Perfil completo</span>
                    <strong>{user.profileComplete ? "Sí" : "No"}</strong>
                  </div>
                  <div className="admin-modal-field">
                    <span>Moderación</span>
                    <strong
                      className={
                        user.moderationStatus === "suspended"
                          ? "admin-user-suspended"
                          : undefined
                      }
                    >
                      {user.moderationStatus === "suspended"
                        ? "Cuenta suspendida"
                        : "Activa"}
                    </strong>
                  </div>
                  {user.suspension && (
                    <>
                      <div className="admin-modal-field">
                        <span>Suspendida desde</span>
                        <strong>
                          {new Date(
                            user.suspension.suspendedAt
                          ).toLocaleString("es-UY")}
                        </strong>
                      </div>
                      <div className="admin-modal-field">
                        <span>Duración</span>
                        <strong>
                          {user.suspension.duration === "permanent"
                            ? "Permanente"
                            : `${user.suspension.duration} días`}
                        </strong>
                      </div>
                      {user.suspension.suspendedUntil && (
                        <div className="admin-modal-field">
                          <span>Finaliza</span>
                          <strong>
                            {new Date(
                              user.suspension.suspendedUntil
                            ).toLocaleString("es-UY")}
                          </strong>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </section>

              <section className="admin-modal-section">
                <h3 className="admin-review-label">Perfil</h3>
                <div className="admin-modal-grid">
                  <div className="admin-modal-field">
                    <span>Nacimiento</span>
                    <strong>{formatDate(profile?.birthDate)}</strong>
                  </div>
                  <div className="admin-modal-field">
                    <span>Altura</span>
                    <strong>
                      {profile?.heightCm
                        ? `${profile.heightCm} cm`
                        : "Sin especificar"}
                    </strong>
                  </div>
                  <div className="admin-modal-field">
                    <span>Ubicación</span>
                    <strong>{location}</strong>
                  </div>
                  <div className="admin-modal-field">
                    <span>Género</span>
                    <strong>
                      {profile?.gender
                        ? GENDER_LABELS[profile.gender as Gender] ??
                          profile.gender
                        : "Sin especificar"}
                    </strong>
                  </div>
                  <div className="admin-modal-field">
                    <span>Situación laboral</span>
                    <strong>
                      {profile?.workStatus
                        ? WORK_STATUS_LABELS[
                            profile.workStatus as WorkStatus
                          ] ?? profile.workStatus
                        : "Sin especificar"}
                    </strong>
                  </div>
                  <div className="admin-modal-field">
                    <span>Trabajo</span>
                    <strong>
                      {[profile?.jobTitle, profile?.company]
                        .filter(Boolean)
                        .join(" · ") || "Sin especificar"}
                    </strong>
                  </div>
                </div>
                {profile?.bio && (
                  <p className="admin-modal-bio mb-0">{profile.bio}</p>
                )}
              </section>

              {!!profile?.lookingFor?.length && (
                <section className="admin-modal-section">
                  <h3 className="admin-review-label">Busca</h3>
                  <div className="admin-modal-chips">
                    {profile.lookingFor.map((value) => (
                      <span key={value} className="admin-modal-chip">
                        {LOOKING_FOR_LABELS[value as LookingFor] ?? value}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {!!profile?.interests?.length && (
                <section className="admin-modal-section">
                  <h3 className="admin-review-label">Gustos</h3>
                  <div className="admin-modal-chips">
                    {profile.interests.map((value) => (
                      <span key={value} className="admin-modal-chip">
                        {INTEREST_LABELS[value as Interest] ?? value}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {!!profile?.photos?.length && (
                <section className="admin-modal-section">
                  <h3 className="admin-review-label">Fotos</h3>
                  <div className="admin-modal-photos">
                    {profile.photos.map((photo, index) => (
                      <img key={photo} src={photo} alt={`Foto ${index + 1}`} />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </OverflowFade>
      </section>
    </div>
  );
}

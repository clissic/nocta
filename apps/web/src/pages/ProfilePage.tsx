import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  GENDER_LABELS,
  INTEREST_CATEGORIES,
  INTEREST_LABELS,
  LOOKING_FOR_LABELS,
  MAX_PHOTOS,
  VENUE_TYPE_LABELS,
  type FollowRequestItem,
  type Gender,
  type Interest,
  type LookingFor,
  type Presence,
  type PromoPurchase,
  type Venue,
} from "@nocta/shared";
import { useAuth } from "../auth/AuthContext";
import { api, ApiError } from "../lib/api";
import { LOOKING_FOR_ICONS } from "../lib/lookingForIcons";
import { ProfileExtraSections, ProfileLanguagesSection } from "../components/ProfileExtraSections";
import { ProfileSocialIcons } from "../components/ProfileSocialIcons";
import { useToast } from "../components/ToastProvider";
import {
  ProfileConnectionsModal,
  type ProfileConnectionsMode,
} from "../components/ProfileConnectionsModal";
import { ProfileMyReviewsAccordion } from "../components/ProfileMyReviewsAccordion";
import { ProfileSettingsModal } from "../components/ProfileSettingsModal";

function calcAge(birthDate?: string) {
  if (!birthDate) return null;
  const born = new Date(birthDate);
  if (Number.isNaN(born.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  const m = now.getMonth() - born.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < born.getDate())) age -= 1;
  return age;
}

export function ProfilePage() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [presence, setPresence] = useState<Presence | null>(null);
  const [ownedVenues, setOwnedVenues] = useState<Venue[]>([]);
  const [promoPurchases, setPromoPurchases] = useState<PromoPurchase[]>([]);
  const [followRequests, setFollowRequests] = useState<FollowRequestItem[]>(
    []
  );
  const [requestBusyId, setRequestBusyId] = useState<string | null>(null);
  const [connectionsMode, setConnectionsMode] =
    useState<ProfileConnectionsMode | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const profile = user?.profile;
  const closeConnections = useCallback(() => setConnectionsMode(null), []);

  useEffect(() => {
    void api<{ presence: Presence | null }>("/api/presence/me")
      .then((r) => setPresence(r.presence))
      .catch(() => setPresence(null));
    void api<{ venues: Venue[] }>("/api/me/venues/owned")
      .then((r) => setOwnedVenues(r.venues))
      .catch(() => setOwnedVenues([]));
    void api<{ purchases: PromoPurchase[] }>("/api/me/promo-purchases")
      .then((r) => setPromoPurchases(r.purchases))
      .catch(() => setPromoPurchases([]));
    void api<{ requests: FollowRequestItem[] }>("/api/me/follow-requests")
      .then((r) => setFollowRequests(r.requests ?? []))
      .catch(() => setFollowRequests([]));
  }, []);

  async function respondFollowRequest(
    requestId: string,
    action: "accept" | "reject"
  ) {
    setRequestBusyId(requestId);
    try {
      await api(`/api/me/follow-requests/${requestId}/${action}`, {
        method: "POST",
      });
      setFollowRequests((prev) => prev.filter((r) => r.id !== requestId));
      if (action === "accept" && user) {
        setUser({
          ...user,
          followersCount: (user.followersCount ?? 0) + 1,
        });
      }
      toast.success(
        action === "accept" ? "Solicitud aceptada" : "Solicitud rechazada"
      );
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo responder"
      );
    } finally {
      setRequestBusyId(null);
    }
  }

  function handleConnectionRemoved(mode: ProfileConnectionsMode) {
    if (!user) return;
    setUser({
      ...user,
      followersCount:
        mode === "followers"
          ? Math.max(0, (user.followersCount ?? 0) - 1)
          : user.followersCount,
      followingUsersCount:
        mode === "following"
          ? Math.max(0, (user.followingUsersCount ?? 0) - 1)
          : user.followingUsersCount,
      followingVenuesCount:
        mode === "venues"
          ? Math.max(0, (user.followingVenuesCount ?? 0) - 1)
          : user.followingVenuesCount,
    });
  }

  const age = useMemo(
    () => (profile?.birthDate ? calcAge(profile.birthDate) : null),
    [profile?.birthDate]
  );

  const lookingFor = useMemo(
    () =>
      (profile?.lookingFor ?? []).filter((value): value is LookingFor =>
        value in LOOKING_FOR_LABELS
      ),
    [profile?.lookingFor]
  );

  const interestGroups = useMemo(() => {
    const selected = new Set(profile?.interests ?? []);
    return INTEREST_CATEGORIES.map((category) => ({
      id: category.id,
      label: category.label,
      interests: category.interests.filter((interest) => selected.has(interest)),
    })).filter((category) => category.interests.length > 0);
  }, [profile?.interests]);

  if (!profile) {
    return <div className="app-screen text-secondary fade-in">Sin perfil.</div>;
  }

  const photos = profile.photos.filter(Boolean);
  const photoSlots = Array.from(
    { length: MAX_PHOTOS },
    (_, index) => photos[index] ?? null
  );
  const hero = photoSlots[0];
  const gallerySlots = photoSlots.slice(1);
  const galleryFilled = gallerySlots.filter(Boolean).length;
  const photosEditHref = "/onboarding?edit=1&step=5";
  const [galleryOpen, setGalleryOpen] = useState(false);
  const validPromoCount = promoPurchases.filter((p) => p.status === "valid").length;

  return (
    <div className="app-screen flush profile-page fade-in">
      <div className="profile-layout">
        <div className="profile-media">
          <div className="profile-hero">
            {hero ? (
              <img src={hero} alt={profile.name} />
            ) : (
              <Link
                to={photosEditHref}
                className="profile-hero-empty profile-photo-placeholder"
                aria-label="Subir foto de perfil"
              >
                <span className="profile-photo-placeholder-idle">
                  <i className="bi bi-person" aria-hidden="true" />
                  <span>Foto de perfil</span>
                </span>
                <span className="profile-photo-placeholder-hover">
                  <i className="bi bi-cloud-arrow-up" aria-hidden="true" />
                  <span>Subir imagen</span>
                </span>
              </Link>
            )}
            <div className="profile-hero-fade" />
            <div className="profile-hero-caption d-md-none">
              <div className="profile-name-row">
                <div className="min-w-0">
                  <h1 className="app-title h3 mb-0 text-white">{profile.name}</h1>
                  {(age != null || profile.heightCm) && (
                    <p className="profile-meta mb-0 text-white-50">
                      {[age, profile.heightCm ? `${profile.heightCm} cm` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                </div>
                <div className="profile-name-actions">
                  <button
                    type="button"
                    className="btn btn-outline-light profile-edit-btn profile-settings-trigger"
                    aria-label="Configuración"
                    onClick={() => setSettingsOpen(true)}
                  >
                    <i className="bi bi-person-plus" aria-hidden="true" />
                    {followRequests.length > 0 && (
                      <span
                        className="profile-settings-alert"
                        aria-label={`${followRequests.length} solicitudes pendientes`}
                      >
                        {followRequests.length}
                      </span>
                    )}
                  </button>
                  <Link
                    className="btn btn-outline-light profile-edit-btn"
                    to="/onboarding?edit=1"
                  >
                    <i className="bi bi-pencil me-1" aria-hidden="true" />
                    Editar
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div className="profile-gallery-accordion">
            <button
              type="button"
              className={`profile-gallery-toggle${galleryOpen ? " is-open" : ""}`}
              aria-expanded={galleryOpen}
              aria-controls="profile-gallery-panel"
              onClick={() => setGalleryOpen((open) => !open)}
            >
              <span className="profile-gallery-toggle-copy">
                <i className="bi bi-images" aria-hidden="true" />
                <span>Más fotos</span>
                <span className="text-secondary">
                  {galleryFilled}/{gallerySlots.length}
                </span>
              </span>
              <i
                className={`bi ${galleryOpen ? "bi-chevron-up" : "bi-chevron-down"}`}
                aria-hidden="true"
              />
            </button>

            <div
              id="profile-gallery-panel"
              className={`profile-gallery-panel${galleryOpen ? " is-open" : ""}`}
              hidden={!galleryOpen}
            >
              <div className="profile-gallery" aria-label="Fotos del perfil">
                {gallerySlots.map((src, index) => {
                  const photoNumber = index + 2;
                  if (src) {
                    return (
                      <img
                        key={src}
                        src={src}
                        alt={`Foto ${photoNumber}`}
                      />
                    );
                  }
                  return (
                    <Link
                      key={`placeholder-${photoNumber}`}
                      to={photosEditHref}
                      className="profile-gallery-placeholder profile-photo-placeholder"
                      aria-label={`Subir foto ${photoNumber}`}
                    >
                      <span className="profile-photo-placeholder-idle">
                        <i className="bi bi-image" aria-hidden="true" />
                        <span>Foto {photoNumber}</span>
                      </span>
                      <span className="profile-photo-placeholder-hover">
                        <i className="bi bi-cloud-arrow-up" aria-hidden="true" />
                        <span>Subir imagen</span>
                      </span>
                    </Link>
                  );
                })}
              </div>
              <p className="profile-gallery-note text-secondary mb-0">
                Podés subir hasta 10 imágenes; cada una mostrará información
                diferente relativa a tu perfil.
              </p>
            </div>
          </div>

          <ProfileMyReviewsAccordion />
        </div>

        <div className="profile-info">
          <div className="profile-info-top">
            <div className="profile-name-row d-none d-md-flex">
              <div className="min-w-0">
                <h1 className="app-title h3 mb-0">{profile.name}</h1>
                {(age != null || profile.heightCm) && (
                  <p className="profile-meta mb-0 text-secondary">
                    {[age, profile.heightCm ? `${profile.heightCm} cm` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
              </div>
              <div className="profile-name-actions">
                <button
                  type="button"
                  className="btn btn-outline-light profile-edit-btn profile-settings-trigger"
                  aria-label="Configuración"
                  onClick={() => setSettingsOpen(true)}
                >
                  <i className="bi bi-person-plus" aria-hidden="true" />
                  {followRequests.length > 0 && (
                    <span
                      className="profile-settings-alert"
                      aria-label={`${followRequests.length} solicitudes pendientes`}
                    >
                      {followRequests.length}
                    </span>
                  )}
                </button>
                <Link
                  className="btn btn-outline-light profile-edit-btn"
                  to="/onboarding?edit=1"
                >
                  <i className="bi bi-pencil me-1" aria-hidden="true" />
                  Editar
                </Link>
              </div>
            </div>

            <div className="profile-status">
              {presence?.venue ? (
                <>
                  <span className="live-dot" aria-hidden="true" />
                  <span>
                    Visible en <strong>{presence.venue.name}</strong>
                  </span>
                </>
              ) : (
                <span className="text-secondary">
                  Perfil oculto — no publicado
                </span>
              )}
            </div>

            <div className="row align-items-stretch profile-connections-counts g-2">
              <div className="col-4">
                <button
                  type="button"
                  className="profile-connections-count"
                  onClick={() => setConnectionsMode("followers")}
                >
                  <strong>{user?.followersCount ?? 0}</strong>
                  <span>
                    {(user?.followersCount ?? 0) === 1
                      ? "seguidor"
                      : "seguidores"}
                  </span>
                </button>
              </div>
              <div className="col-4">
                <button
                  type="button"
                  className="profile-connections-count"
                  onClick={() => setConnectionsMode("following")}
                >
                  <strong>{user?.followingUsersCount ?? 0}</strong>
                  <span>seguidos</span>
                </button>
              </div>
              <div className="col-4">
                <button
                  type="button"
                  className="profile-connections-count"
                  onClick={() => setConnectionsMode("venues")}
                >
                  <strong>{user?.followingVenuesCount ?? 0}</strong>
                  <span>
                    {(user?.followingVenuesCount ?? 0) === 1
                      ? "espacio"
                      : "espacios"}
                  </span>
                </button>
              </div>
            </div>
          </div>

          <ProfileSocialIcons profile={profile} />

          <section className="profile-section">
            <h2 className="profile-label">Busca</h2>
            {lookingFor.length ? (
              <div
                className="profile-looking-grid"
                style={{
                  gridTemplateColumns: `repeat(${lookingFor.length}, minmax(0, 1fr))`,
                }}
              >
                {lookingFor.map((value) => (
                  <div key={value} className="profile-looking-item">
                    <i
                      className={`bi ${LOOKING_FOR_ICONS[value]}`}
                      aria-hidden="true"
                    />
                    <span>{LOOKING_FOR_LABELS[value]}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mb-0 text-secondary">—</p>
            )}
          </section>

          {(profile.gender || profile.interestedIn?.length) && (
            <section className="profile-section">
              <h2 className="profile-label">Identidad</h2>
              <p className="profile-value mb-0">
                {profile.gender
                  ? GENDER_LABELS[profile.gender as Gender] ?? profile.gender
                  : "—"}
                {profile.interestedIn?.length
                  ? ` · Interesa: ${profile.interestedIn
                      .map((g) => GENDER_LABELS[g as Gender] ?? g)
                      .join(", ")}`
                  : ""}
              </p>
            </section>
          )}

          {profile.bio && (
            <section className="profile-section">
              <h2 className="profile-label">Sobre mí</h2>
              <p className="profile-bio mb-0">{profile.bio}</p>
            </section>
          )}

          <ProfileExtraSections profile={profile} />

          <section className="profile-space-cta d-none d-md-block">
            <h2 className="profile-space-cta-title">¿Eres administrador de un espacio?</h2>
            <Link className="btn btn-primary btn-sm profile-space-cta-btn" to="/profile/venue-request">
              Registrar espacio
            </Link>
          </section>
        </div>

        <div className="profile-below-media">
          {!!interestGroups.length && (
            <section className="profile-section">
              <h2 className="profile-label">Gustos</h2>
              <div className="profile-interest-categories">
                {interestGroups.map((category) => (
                  <div key={category.id} className="profile-interest-category">
                    <h3 className="profile-interest-category-title">
                      {category.label}
                    </h3>
                    <div className="profile-interests">
                      {category.interests.map((interest) => (
                        <span key={interest} className="profile-chip">
                          {INTEREST_LABELS[interest as Interest] ?? interest}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <ProfileLanguagesSection profile={profile} />

          <section className="profile-section">
            <h2 className="profile-label">Mis promos</h2>
            <Link className="profile-promos-entry" to="/profile/promos">
              <span className="profile-promos-entry-icon" aria-hidden="true">
                <i className="bi bi-qr-code" />
              </span>
              <span className="min-w-0">
                <strong>Ver códigos QR</strong>
                <small>
                  {promoPurchases.length === 0
                    ? "Todavía no compraste ninguna"
                    : validPromoCount === 1
                      ? "1 promo vigente"
                      : validPromoCount > 1
                        ? `${validPromoCount} promos vigentes`
                        : `${promoPurchases.length} ${
                            promoPurchases.length === 1 ? "promo" : "promos"
                          } en tu historial`}
                </small>
              </span>
              <i className="bi bi-chevron-right" aria-hidden="true" />
            </Link>
          </section>

          {ownedVenues.length > 0 && (
            <section className="profile-section">
              <h2 className="profile-label">Mis espacios</h2>
              <div className="profile-owned-venues">
                {ownedVenues.map((v) => (
                  <Link key={v.id} className="profile-owned-card" to={`/venues/${v.id}/manage`}>
                    {v.photos[0] ? (
                      <img src={v.photos[0]} alt="" />
                    ) : (
                      <span className="profile-owned-fallback" />
                    )}
                    <span>
                      <strong>{v.name}</strong>
                      <small>{VENUE_TYPE_LABELS[v.type]}</small>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section className="profile-space-cta d-md-none">
            <h2 className="profile-space-cta-title">¿Eres administrador de un espacio?</h2>
            <Link className="btn btn-primary btn-sm profile-space-cta-btn" to="/profile/venue-request">
              Registrar espacio
            </Link>
          </section>

          <p className="profile-email text-secondary small mb-0">{user?.email}</p>
        </div>
      </div>
      {connectionsMode && (
        <ProfileConnectionsModal
          mode={connectionsMode}
          onClose={closeConnections}
          onRemoved={handleConnectionRemoved}
        />
      )}
      {settingsOpen && user && (
        <ProfileSettingsModal
          user={user}
          followRequests={followRequests}
          requestBusyId={requestBusyId}
          onClose={() => setSettingsOpen(false)}
          onUserUpdated={setUser}
          onRespondRequest={respondFollowRequest}
        />
      )}
    </div>
  );
}

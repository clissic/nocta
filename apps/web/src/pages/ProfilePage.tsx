import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  GENDER_LABELS,
  INTEREST_LABELS,
  LOOKING_FOR_LABELS,
  type Gender,
  type Interest,
  type LookingFor,
  type Presence,
} from "@nocta/shared";
import { useAuth } from "../auth/AuthContext";
import { api } from "../lib/api";

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
  const { user } = useAuth();
  const [presence, setPresence] = useState<Presence | null>(null);
  const profile = user?.profile;

  useEffect(() => {
    void api<{ presence: Presence | null }>("/api/presence/me")
      .then((r) => setPresence(r.presence))
      .catch(() => setPresence(null));
  }, []);

  const age = useMemo(
    () => (profile?.birthDate ? calcAge(profile.birthDate) : null),
    [profile?.birthDate]
  );

  if (!profile) {
    return <div className="app-screen text-secondary fade-in">Sin perfil.</div>;
  }

  const photos = profile.photos.filter(Boolean);
  const hero = photos[0];
  const rest = photos.slice(1);

  return (
    <div className="app-screen flush profile-page fade-in">
      <div className="profile-layout">
        <div className="profile-media">
          <div className="profile-hero">
            {hero ? <img src={hero} alt={profile.name} /> : <div className="profile-hero-empty" />}
            <div className="profile-hero-fade" />
            <div className="profile-hero-caption d-md-none">
              <h1 className="app-title h3 mb-0 text-white">
                {profile.name}
                {age != null ? (
                  <span className="fs-5 fw-normal opacity-80">, {age}</span>
                ) : null}
                {profile.heightCm ? (
                  <span className="fs-6 fw-normal opacity-70"> · {profile.heightCm} cm</span>
                ) : null}
              </h1>
            </div>
          </div>

          {!!rest.length && (
            <div className="profile-gallery" aria-label="Más fotos">
              {rest.map((src) => (
                <img key={src} src={src} alt="" />
              ))}
            </div>
          )}
        </div>

        <div className="profile-info">
          <div className="profile-info-top">
            <div className="min-w-0">
              <h1 className="app-title h3 mb-1 d-none d-md-block">
                {profile.name}
                {age != null ? (
                  <span className="fs-5 fw-normal text-secondary">, {age}</span>
                ) : null}
                {profile.heightCm ? (
                  <span className="fs-6 fw-normal text-secondary"> · {profile.heightCm} cm</span>
                ) : null}
              </h1>

              <div className="profile-status">
                {presence?.venue ? (
                  <>
                    <span className="live-dot" aria-hidden="true" />
                    <span>
                      Visible en <strong>{presence.venue.name}</strong>
                    </span>
                  </>
                ) : (
                  <span className="text-secondary">Perfil oculto — no publicado</span>
                )}
              </div>
            </div>

            <Link className="btn btn-outline-light profile-edit-btn" to="/onboarding?edit=1">
              <i className="bi bi-pencil me-1" aria-hidden="true" />
              Editar
            </Link>
          </div>

          <section className="profile-section">
            <h2 className="profile-label">Busca</h2>
            <p className="mb-0">
              {profile.lookingFor
                .map((l) => LOOKING_FOR_LABELS[l as LookingFor] ?? l)
                .join(" · ") || "—"}
            </p>
          </section>

          {(profile.gender || profile.interestedIn?.length) && (
            <section className="profile-section">
              <h2 className="profile-label">Identidad</h2>
              <p className="mb-0 text-secondary">
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

          {!!profile.interests.length && (
            <section className="profile-section">
              <h2 className="profile-label">Intereses</h2>
              <div className="profile-interests">
                {profile.interests.map((i) => (
                  <span key={i} className="profile-chip">
                    {INTEREST_LABELS[i as Interest] ?? i}
                  </span>
                ))}
              </div>
            </section>
          )}

          <p className="profile-email text-secondary small mb-0">{user?.email}</p>
        </div>
      </div>
    </div>
  );
}

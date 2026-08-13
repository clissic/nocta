import { useEffect, useState } from "react";
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

export function ProfilePage() {
  const { user } = useAuth();
  const [presence, setPresence] = useState<Presence | null>(null);
  const profile = user?.profile;

  useEffect(() => {
    void api<{ presence: Presence | null }>("/api/presence/me").then((r) =>
      setPresence(r.presence)
    );
  }, []);

  if (!profile) {
    return <div className="app-screen text-secondary">Sin perfil.</div>;
  }

  return (
    <div className="app-screen flush fade-in">
      <div className="position-relative">
        <img className="bleed-cover" src={profile.photos[0]} alt="" />
        <div
          className="position-absolute bottom-0 start-0 end-0 p-3"
          style={{
            background: "linear-gradient(transparent, rgba(0,0,0,.85))",
          }}
        >
          <h1 className="app-title h3 mb-0 text-white">
            {profile.name}
            {profile.heightCm ? (
              <span className="fs-6 fw-normal opacity-75"> · {profile.heightCm} cm</span>
            ) : null}
          </h1>
        </div>
      </div>

      <div className="px-3 px-md-0 py-3" style={{ maxWidth: 720 }}>
        <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
          <p className="text-secondary small mb-0">
            {presence?.venue
              ? `Visible en ${presence.venue.name}`
              : "Perfil oculto — no publicado"}
          </p>
          <Link className="btn btn-sm btn-outline-light" to="/onboarding?edit=1">
            <i className="bi bi-pencil" aria-hidden="true"></i>
          </Link>
        </div>

        <p className="mb-1">
          {profile.lookingFor
            .map((l) => LOOKING_FOR_LABELS[l as LookingFor] ?? l)
            .join(" · ")}
        </p>
        {(profile.gender || profile.interestedIn?.length) && (
          <p className="text-secondary small">
            {profile.gender
              ? GENDER_LABELS[profile.gender as Gender] ?? profile.gender
              : "—"}
            {profile.interestedIn?.length
              ? ` · Interesa: ${profile.interestedIn
                  .map((g) => GENDER_LABELS[g as Gender] ?? g)
                  .join(", ")}`
              : ""}
          </p>
        )}
        {profile.bio && <p className="mb-2">{profile.bio}</p>}
        <p className="text-secondary small mb-3">
          {profile.interests
            .map((i) => INTEREST_LABELS[i as Interest] ?? i)
            .join(" · ")}
        </p>

        <div className="row g-1 mb-3">
          {profile.photos.slice(1).map((src) => (
            <div className="col-4" key={src}>
              <img className="photo-thumb" src={src} alt="" />
            </div>
          ))}
        </div>

        <p className="text-secondary small mb-0">{user?.email}</p>
      </div>
    </div>
  );
}

import { useEffect } from "react";
import { createPortal } from "react-dom";
import {
  SOCIAL_NETWORKS,
  SOCIAL_NETWORK_LABELS,
  type FollowRequestProfile,
  type SocialNetwork,
} from "@nocta/shared";

const SOCIAL_ICONS: Record<SocialNetwork, string> = {
  instagram: "bi-instagram",
  tiktok: "bi-tiktok",
  x: "bi-twitter-x",
  facebook: "bi-facebook",
  linkedin: "bi-linkedin",
};

function socialUrl(network: SocialNetwork, handle: string) {
  const clean = handle.replace(/^@/, "").trim();
  if (!clean) return null;
  switch (network) {
    case "instagram":
      return `https://instagram.com/${clean}`;
    case "tiktok":
      return `https://www.tiktok.com/@${clean}`;
    case "x":
      return `https://x.com/${clean}`;
    case "facebook":
      return `https://facebook.com/${clean}`;
    case "linkedin":
      return `https://www.linkedin.com/in/${clean}`;
  }
}

type Props = {
  profile: FollowRequestProfile | null;
  loading: boolean;
  onClose: () => void;
};

export function FollowRequestProfileModal({
  profile,
  loading,
  onClose,
}: Props) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="profile-connections-modal follow-request-profile-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="follow-request-profile-title"
    >
      <button
        type="button"
        className="profile-connections-backdrop"
        aria-label="Cerrar perfil"
        onClick={onClose}
      />
      <div className="profile-connections-dialog follow-request-profile-dialog">
        <header className="profile-connections-head">
          <h2 id="follow-request-profile-title">Perfil</h2>
          <button
            type="button"
            className="profile-connections-close"
            aria-label="Cerrar perfil"
            onClick={onClose}
          >
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>
        </header>

        <div className="follow-request-profile-body">
          {loading || !profile ? (
            <p className="text-secondary small mb-0">Cargando…</p>
          ) : (
            <>
              {profile.photo ? (
                <img
                  className="follow-request-profile-photo"
                  src={profile.photo}
                  alt={`Foto de ${profile.name}`}
                />
              ) : (
                <div
                  className="follow-request-profile-photo is-placeholder"
                  aria-hidden="true"
                >
                  {profile.name.slice(0, 1).toUpperCase()}
                </div>
              )}

              <div className="follow-request-profile-copy">
                <h3>
                  {profile.name}
                  <span> · {profile.age}</span>
                </h3>
                {profile.heightCm && <p>{profile.heightCm} cm</p>}
                {profile.livesIn && (
                  <p>
                    {profile.livesIn.country}, {profile.livesIn.city}
                  </p>
                )}
              </div>

              {SOCIAL_NETWORKS.some((network) =>
                Boolean(profile.socials?.[network]?.trim())
              ) && (
                <div
                  className="follow-request-profile-socials"
                  role="list"
                  aria-label="Redes sociales"
                >
                  {SOCIAL_NETWORKS.map((network) => {
                    const handle = profile.socials?.[network]?.trim();
                    const href = handle ? socialUrl(network, handle) : null;
                    if (!href || !handle) return null;
                    const label = SOCIAL_NETWORK_LABELS[network];
                    return (
                      <a
                        key={network}
                        role="listitem"
                        className="profile-social-icon is-active"
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${label}: @${handle.replace(/^@/, "")}`}
                        title={`@${handle.replace(/^@/, "")}`}
                      >
                        <i
                          className={`bi ${SOCIAL_ICONS[network]}`}
                          aria-hidden="true"
                        />
                      </a>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

import { useMemo } from "react";
import {
  GENDER_LABELS,
  INTEREST_CATEGORIES,
  INTEREST_LABELS,
  LOOKING_FOR_LABELS,
  type DiscoverCard,
  type Gender,
  type Interest,
  type LookingFor,
} from "@nocta/shared";
import { LOOKING_FOR_ICONS } from "../lib/lookingForIcons";
import { ProfileExtraSections, ProfileLanguagesSection } from "./ProfileExtraSections";

type DiscoverProfileDetailProps = {
  card: DiscoverCard;
  photoIndex: number;
  onCollapse?: () => void;
};

export function DiscoverProfileDetail({
  card,
  photoIndex,
  onCollapse,
}: DiscoverProfileDetailProps) {
  const { profile, age } = card;
  const photos = profile.photos.filter(Boolean);
  const activePhoto = photos[photoIndex] ?? photos[0];

  const lookingFor = useMemo(
    () =>
      (profile.lookingFor ?? []).filter((value): value is LookingFor =>
        value in LOOKING_FOR_LABELS
      ),
    [profile.lookingFor]
  );

  const interestGroups = useMemo(() => {
    const selected = new Set(profile.interests ?? []);
    return INTEREST_CATEGORIES.map((category) => ({
      id: category.id,
      label: category.label,
      interests: category.interests.filter((interest) => selected.has(interest)),
    })).filter((category) => category.interests.length > 0);
  }, [profile.interests]);

  return (
    <div className="discover-detail">
      <div className="discover-detail-media">
        <div className="discover-detail-hero swipe-card-photo-hit">
          {activePhoto ? (
            <img src={activePhoto} alt={profile.name} draggable={false} />
          ) : (
            <div className="discover-detail-hero-empty" aria-hidden="true" />
          )}
          {photos.length > 1 && (
            <div className="photo-segments" aria-hidden="true">
              {photos.map((_, index) => (
                <span
                  key={index}
                  className={index === photoIndex ? "on" : undefined}
                />
              ))}
            </div>
          )}
          <div className="discover-detail-hero-fade" />
          <div className="discover-detail-hero-caption">
            <h2 className="h3 mb-0 text-white">
              {profile.name}, {age}
            </h2>
            {onCollapse && (
              <button
                type="button"
                className="swipe-expand-btn"
                aria-label="Cerrar perfil ampliado"
                aria-expanded="true"
                onClick={onCollapse}
              >
                <i className="bi bi-chevron-down" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="discover-detail-info">
        {lookingFor.length > 0 && (
          <section className="profile-section">
            <h3 className="profile-label">Busca</h3>
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
          </section>
        )}

        {(profile.gender || profile.interestedIn?.length) && (
          <section className="profile-section">
            <h3 className="profile-label">Identidad</h3>
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
            <h3 className="profile-label">Sobre mí</h3>
            <p className="profile-bio mb-0">{profile.bio}</p>
          </section>
        )}

        <ProfileExtraSections profile={profile} />

        {!!interestGroups.length && (
          <section className="profile-section">
            <h3 className="profile-label">Gustos</h3>
            <div className="profile-interest-categories">
              {interestGroups.map((category) => (
                <div key={category.id} className="profile-interest-category">
                  <h4 className="profile-interest-category-title">
                    {category.label}
                  </h4>
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

        {profile.heightCm != null && (
          <section className="profile-section">
            <h3 className="profile-label">Altura</h3>
            <p className="profile-value mb-0">{profile.heightCm} cm</p>
          </section>
        )}
      </div>
    </div>
  );
}

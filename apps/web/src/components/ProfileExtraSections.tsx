import {
  DRINKING_LABELS,
  EDUCATION_LEVEL_LABELS,
  FITNESS_LABELS,
  LANGUAGE_LABELS,
  PETS_LABELS,
  SEXUAL_ORIENTATION_LABELS,
  WORK_STATUS_LABELS,
  ZODIAC_INSIGHTS,
  ZODIAC_LABELS,
  type Drinking,
  type EducationLevel,
  type Fitness,
  type Language,
  type Pets,
  type SexualOrientation,
  type UserProfile,
  type WorkStatus,
  type ZodiacSign,
} from "@nocta/shared";

type ProfileExtraSectionsProps = {
  profile: UserProfile;
};

function TextLine({ value }: { value?: string | null }) {
  if (!value) return null;
  return <p className="profile-value mb-0">{value}</p>;
}

function formatLivesIn(profile: UserProfile) {
  const country = profile.livesIn?.country?.trim();
  const city = profile.livesIn?.city?.trim();
  if (!country || !city) return undefined;
  return `${country}, ${city}`;
}

function profileLanguages(profile: UserProfile): Language[] {
  return (profile.languages ?? []).filter(
    (value): value is Language => value in LANGUAGE_LABELS
  );
}

/** Idiomas — va debajo de Gustos en perfil / discover. */
export function ProfileLanguagesSection({ profile }: ProfileExtraSectionsProps) {
  const languages = profileLanguages(profile);
  if (!languages.length) return null;

  return (
    <section className="profile-section">
      <h2 className="profile-label">Idiomas</h2>
      <div className="profile-interests">
        {languages.map((language) => (
          <span key={language} className="profile-chip">
            {LANGUAGE_LABELS[language]}
          </span>
        ))}
      </div>
    </section>
  );
}

export function ProfileExtraSections({ profile }: ProfileExtraSectionsProps) {
  const locationLabel = formatLivesIn(profile);

  const hasWork =
    profile.workStatus ||
    profile.jobTitle ||
    profile.company ||
    profile.studiedAt;

  return (
    <>
      {locationLabel && (
        <section className="profile-section">
          <h3 className="profile-label">Vive en</h3>
          <TextLine value={locationLabel} />
        </section>
      )}

      {profile.sexualOrientation && (
        <section className="profile-section">
          <h3 className="profile-label">Orientación sexual</h3>
          <TextLine
            value={
              SEXUAL_ORIENTATION_LABELS[
                profile.sexualOrientation as SexualOrientation
              ] ?? profile.sexualOrientation
            }
          />
        </section>
      )}

      {profile.zodiac &&
        (() => {
          const zodiac = profile.zodiac as ZodiacSign;
          const insight = ZODIAC_INSIGHTS[zodiac];
          const compatible = insight.compatibleWith
            .map((sign) => ZODIAC_LABELS[sign])
            .join(" y ");
          return (
            <section className="profile-section profile-zodiac-section">
              <h3 className="profile-label">Zodíaco</h3>
              <p className="profile-zodiac-sign mb-1">
                {ZODIAC_LABELS[zodiac]}
              </p>
              <p className="profile-zodiac-traits text-secondary mb-1">
                {insight.traits}
              </p>
              <p className="profile-zodiac-match text-secondary mb-0">
                Especialmente compatible con <strong>{compatible}</strong>
              </p>
            </section>
          );
        })()}

      {profile.educationLevel && (
        <section className="profile-section">
          <h3 className="profile-label">Nivel educativo</h3>
          <TextLine
            value={
              EDUCATION_LEVEL_LABELS[
                profile.educationLevel as EducationLevel
              ] ?? profile.educationLevel
            }
          />
        </section>
      )}

      {profile.pets && (
        <section className="profile-section">
          <h3 className="profile-label">Mascotas</h3>
          <TextLine
            value={PETS_LABELS[profile.pets as Pets] ?? profile.pets}
          />
        </section>
      )}

      {profile.drinking && (
        <section className="profile-section">
          <h3 className="profile-label">Bebidas</h3>
          <TextLine
            value={
              DRINKING_LABELS[profile.drinking as Drinking] ?? profile.drinking
            }
          />
        </section>
      )}

      {profile.fitness && (
        <section className="profile-section">
          <h3 className="profile-label">Fitness</h3>
          <TextLine
            value={
              FITNESS_LABELS[profile.fitness as Fitness] ?? profile.fitness
            }
          />
        </section>
      )}

      {hasWork && (
        <section className="profile-section">
          <h3 className="profile-label">Trabajo</h3>
          <div className="d-grid gap-1">
            {profile.workStatus && (
              <TextLine
                value={
                  WORK_STATUS_LABELS[profile.workStatus as WorkStatus] ??
                  profile.workStatus
                }
              />
            )}
            {profile.jobTitle && (
              <p className="profile-value mb-0">
                <span className="profile-value-label">Puesto:</span>{" "}
                {profile.jobTitle}
              </p>
            )}
            {profile.company && (
              <p className="profile-value mb-0">
                <span className="profile-value-label">Compañía:</span>{" "}
                {profile.company}
              </p>
            )}
            {profile.studiedAt && (
              <p className="profile-value mb-0">
                <span className="profile-value-label">Estudió en:</span>{" "}
                {profile.studiedAt}
              </p>
            )}
          </div>
        </section>
      )}
    </>
  );
}

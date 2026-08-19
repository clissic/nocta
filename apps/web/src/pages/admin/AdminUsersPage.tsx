import { useEffect, useMemo, useState } from "react";
import {
  DRINKING_LABELS,
  EDUCATION_LEVEL_LABELS,
  FITNESS_LABELS,
  GENDER_LABELS,
  INTEREST_LABELS,
  LANGUAGE_LABELS,
  LOOKING_FOR_LABELS,
  PETS_LABELS,
  SEXUAL_ORIENTATION_LABELS,
  SOCIAL_NETWORKS,
  SOCIAL_NETWORK_LABELS,
  WORK_STATUS_LABELS,
  ZODIAC_INSIGHTS,
  ZODIAC_LABELS,
  type AuthUser,
  type Drinking,
  type EducationLevel,
  type Fitness,
  type Gender,
  type Interest,
  type Language,
  type LookingFor,
  type Pets,
  type SexualOrientation,
  type SocialNetwork,
  type WorkStatus,
  type ZodiacSign,
} from "@nocta/shared";
import { api, ApiError } from "../../lib/api";
import { OverflowFade } from "../../components/OverflowFade";
import { NoctaLoading } from "../../components/NoctaLoading";
import { useToast } from "../../components/ToastProvider";
import { LOOKING_FOR_ICONS } from "../../lib/lookingForIcons";

function UserAvatar({
  name,
  email,
  photo,
}: {
  name?: string;
  email: string;
  photo?: string;
}) {
  if (photo) {
    return <img src={photo} alt="" className="admin-list-thumb" />;
  }
  return (
    <div className="admin-list-thumb is-avatar" aria-hidden="true">
      {(name?.[0] ?? email[0] ?? "?").toUpperCase()}
    </div>
  );
}

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

function formatLikeCountdown(rechargeAt: string | null, now: number) {
  if (!rechargeAt) return null;
  const remaining = Math.max(0, new Date(rechargeAt).getTime() - now);
  const totalSeconds = Math.ceil(remaining / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

function labelLookingFor(value: string) {
  return value in LOOKING_FOR_LABELS
    ? LOOKING_FOR_LABELS[value as LookingFor]
    : value;
}

function labelInterest(value: string) {
  return value in INTEREST_LABELS
    ? INTEREST_LABELS[value as Interest]
    : value;
}

function labelGender(value?: string) {
  if (!value) return null;
  return value in GENDER_LABELS
    ? GENDER_LABELS[value as Gender]
    : value;
}

function labelWork(value?: string) {
  if (!value) return null;
  return value in WORK_STATUS_LABELS
    ? WORK_STATUS_LABELS[value as WorkStatus]
    : value;
}

function labelOrientation(value?: string) {
  if (!value) return null;
  return value in SEXUAL_ORIENTATION_LABELS
    ? SEXUAL_ORIENTATION_LABELS[value as SexualOrientation]
    : value;
}

function labelLanguage(value: string) {
  return value in LANGUAGE_LABELS
    ? LANGUAGE_LABELS[value as Language]
    : value;
}

function labelZodiac(value?: string) {
  if (!value) return null;
  return value in ZODIAC_LABELS ? ZODIAC_LABELS[value as ZodiacSign] : value;
}

function labelEducation(value?: string) {
  if (!value) return null;
  return value in EDUCATION_LEVEL_LABELS
    ? EDUCATION_LEVEL_LABELS[value as EducationLevel]
    : value;
}

function labelPets(value?: string) {
  if (!value) return null;
  return value in PETS_LABELS ? PETS_LABELS[value as Pets] : value;
}

function labelDrinking(value?: string) {
  if (!value) return null;
  return value in DRINKING_LABELS
    ? DRINKING_LABELS[value as Drinking]
    : value;
}

function labelFitness(value?: string) {
  if (!value) return null;
  return value in FITNESS_LABELS
    ? FITNESS_LABELS[value as Fitness]
    : value;
}

function formatLivesIn(profile: NonNullable<AuthUser["profile"]>) {
  const country = profile.livesIn?.country?.trim();
  const city = profile.livesIn?.city?.trim();
  if (!country || !city) return null;
  return `${city}, ${country}`;
}

function activeSocials(profile: NonNullable<AuthUser["profile"]>) {
  return SOCIAL_NETWORKS.flatMap((network) => {
    const handle = profile.socials?.[network]?.trim();
    if (!handle) return [];
    return [{ network: network as SocialNetwork, handle }];
  });
}

export function AdminUsersPage() {
  const toast = useToast();
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AuthUser | null>(null);
  const [modalNow, setModalNow] = useState(Date.now());

  useEffect(() => {
    void api<{ users: AuthUser[] }>("/api/admin/users")
      .then((res) => setUsers(res.users))
      .catch((err) =>
        toast.error(err instanceof ApiError ? err.message : "No se pudo cargar")
      )
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cargar una vez al montar
  }, []);

  useEffect(() => {
    if (!selected) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    setModalNow(Date.now());
    const interval = window.setInterval(() => setModalNow(Date.now()), 1000);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
      window.clearInterval(interval);
    };
  }, [selected]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const name = u.profile?.name?.toLowerCase() ?? "";
      return u.email.toLowerCase().includes(q) || name.includes(q);
    });
  }, [users, query]);

  async function copyUserId(user: AuthUser) {
    try {
      await navigator.clipboard.writeText(user.id);
      toast.success(
        `ID de ${user.profile?.name ?? user.email} copiado`
      );
    } catch {
      toast.error("No se pudo copiar el ID");
    }
  }

  const profile = selected?.profile ?? null;
  const age = profile?.birthDate ? calcAge(profile.birthDate) : null;
  const livesInLabel = profile ? formatLivesIn(profile) : null;
  const languages = (profile?.languages ?? []).filter(Boolean);
  const socials = profile ? activeSocials(profile) : [];
  const hasWorkDetails = Boolean(
    profile &&
      (profile.workStatus ||
        profile.jobTitle?.trim() ||
        profile.company?.trim() ||
        profile.studiedAt?.trim())
  );
  const hasLifestyle = Boolean(
    profile &&
      (profile.educationLevel ||
        profile.pets ||
        profile.drinking ||
        profile.fitness)
  );
  const zodiacInsight =
    profile?.zodiac && profile.zodiac in ZODIAC_INSIGHTS
      ? ZODIAC_INSIGHTS[profile.zodiac as ZodiacSign]
      : null;

  return (
    <div className="admin-page">
      <header className="admin-page-head">
        <div>
          <p className="admin-page-eyebrow">Administración</p>
          <h1 className="app-title h3 mb-1">Usuarios</h1>
          <p className="text-secondary small mb-0">
            Listado de cuentas con rol usuario.
          </p>
        </div>
      </header>

      <div className="admin-toolbar">
        <i className="bi bi-search" aria-hidden="true" />
        <input
          className="form-control"
          type="search"
          placeholder="Buscar por email o nombre…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {loading ? (
        <NoctaLoading variant="block" />
      ) : filtered.length === 0 ? (
        <p className="text-secondary small mb-0">Sin resultados.</p>
      ) : (
        <div className="admin-list">
          {filtered.map((u) => (
            <button
              key={u.id}
              type="button"
              className="admin-list-row admin-list-row-button"
              onClick={() => setSelected(u)}
            >
              <div className="admin-list-media">
                <UserAvatar
                  name={u.profile?.name}
                  email={u.email}
                  photo={u.profile?.photos?.[0]}
                />
                <span
                  className={`admin-badge ${
                    u.profileComplete ? "is-approved" : "is-pending"
                  }`}
                >
                  {u.profileComplete ? "Perfil OK" : "Pendiente"}
                </span>
              </div>
              <div className="admin-list-body min-w-0 text-start">
                <strong className="text-truncate d-block">
                  {u.profile?.name ?? "Sin nombre"}
                </strong>
                <div className="text-secondary small text-truncate">{u.email}</div>
                <div
                  className={`small ${
                    u.premium ? "admin-user-premium" : "text-secondary"
                  }`}
                >
                  {u.premium ? "Premium" : "Sin premium"}
                </div>
              </div>
              <i className="bi bi-chevron-right admin-list-chevron" aria-hidden="true" />
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="admin-modal" role="presentation">
          <button
            type="button"
            className="admin-modal-backdrop"
            aria-label="Cerrar ficha de usuario"
            onClick={() => setSelected(null)}
          />
          <div
            className="admin-modal-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-user-modal-title"
          >
            <header className="admin-modal-head">
              <div className="admin-modal-title-row">
                <UserAvatar
                  name={profile?.name}
                  email={selected.email}
                  photo={profile?.photos?.[0]}
                />
                <div className="min-w-0">
                  <h2 id="admin-user-modal-title" className="app-title h4 mb-1">
                    {profile?.name ?? "Sin nombre"}
                  </h2>
                  <p className="text-secondary small mb-0 text-truncate">
                    {selected.email}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="admin-modal-close"
                aria-label="Cerrar"
                onClick={() => setSelected(null)}
              >
                <i className="bi bi-x-lg" aria-hidden="true" />
              </button>
            </header>

            <OverflowFade className="admin-modal-body">
              <section className="admin-modal-section">
                <h3 className="admin-review-label">Cuenta</h3>
                <div className="admin-modal-grid">
                  <div className="admin-modal-field">
                    <span>ID</span>
                    <div className="admin-organizer-row">
                      <code className="small text-truncate">{selected.id}</code>
                      <button
                        type="button"
                        className="admin-copy-id"
                        title="Copiar ID"
                        aria-label="Copiar ID del usuario"
                        onClick={() => void copyUserId(selected)}
                      >
                        <i className="bi bi-clipboard" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                  <div className="admin-modal-field">
                    <span>Rol</span>
                    <strong>{selected.role}</strong>
                  </div>
                  <div className="admin-modal-field">
                    <span>Email verificado</span>
                    <strong>{selected.emailVerified ? "Sí" : "No"}</strong>
                  </div>
                  <div className="admin-modal-field">
                    <span>Perfil</span>
                    <strong>
                      {selected.profileComplete ? "Completo" : "Pendiente"}
                    </strong>
                  </div>
                  <div className="admin-modal-field">
                    <span>Suscripción</span>
                    <strong
                      className={
                        selected.premium ? "admin-user-premium" : undefined
                      }
                    >
                      {selected.premium ? "Premium" : "Sin premium"}
                    </strong>
                  </div>
                  <div className="admin-modal-field">
                    <span>Likes disponibles</span>
                    <strong>
                      {selected.premium
                        ? "Ilimitados"
                        : `${selected.remainingLikes ?? 50} / 50`}
                    </strong>
                  </div>
                  {!selected.premium && selected.likesRechargeAt && (
                    <div className="admin-modal-field">
                      <span>Recarga en</span>
                      <strong className="admin-like-countdown">
                        {formatLikeCountdown(
                          selected.likesRechargeAt,
                          modalNow
                        ) ?? "00:00:00"}
                      </strong>
                    </div>
                  )}
                </div>
              </section>

              <section className="admin-modal-section">
                <h3 className="admin-review-label">Actividad</h3>
                <div className="admin-modal-grid">
                  <div className="admin-modal-field">
                    <span>Seguidores</span>
                    <strong>{selected.followersCount ?? 0}</strong>
                  </div>
                  <div className="admin-modal-field">
                    <span>Siguiendo personas</span>
                    <strong>{selected.followingUsersCount ?? 0}</strong>
                  </div>
                  <div className="admin-modal-field">
                    <span>Siguiendo espacios</span>
                    <strong>{selected.followingVenuesCount ?? 0}</strong>
                  </div>
                </div>
              </section>

              {profile ? (
                <>
                  <section className="admin-modal-section">
                    <h3 className="admin-review-label">Perfil</h3>
                    <div className="admin-modal-grid">
                      {(age != null || profile.heightCm) && (
                        <div className="admin-modal-field">
                          <span>Edad · altura</span>
                          <strong>
                            {[
                              age != null ? `${age} años` : null,
                              profile.heightCm
                                ? `${profile.heightCm} cm`
                                : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </strong>
                        </div>
                      )}
                      {labelGender(profile.gender) && (
                        <div className="admin-modal-field">
                          <span>Género</span>
                          <strong>{labelGender(profile.gender)}</strong>
                        </div>
                      )}
                      {labelOrientation(profile.sexualOrientation) && (
                        <div className="admin-modal-field">
                          <span>Orientación</span>
                          <strong>
                            {labelOrientation(profile.sexualOrientation)}
                          </strong>
                        </div>
                      )}
                      {livesInLabel && (
                        <div className="admin-modal-field">
                          <span>Vive en</span>
                          <strong>{livesInLabel}</strong>
                        </div>
                      )}
                      {profile.birthDate && (
                        <div className="admin-modal-field">
                          <span>Nacimiento</span>
                          <strong>
                            {new Date(profile.birthDate).toLocaleDateString(
                              "es-UY"
                            )}
                          </strong>
                        </div>
                      )}
                    </div>
                    {profile.bio && (
                      <p className="admin-modal-bio mb-0">{profile.bio}</p>
                    )}
                  </section>

                  {hasWorkDetails && (
                    <section className="admin-modal-section">
                      <h3 className="admin-review-label">Trabajo y estudios</h3>
                      <div className="admin-modal-grid">
                        {labelWork(profile.workStatus) && (
                          <div className="admin-modal-field">
                            <span>Situación</span>
                            <strong>{labelWork(profile.workStatus)}</strong>
                          </div>
                        )}
                        {profile.jobTitle?.trim() && (
                          <div className="admin-modal-field">
                            <span>Puesto</span>
                            <strong>{profile.jobTitle.trim()}</strong>
                          </div>
                        )}
                        {profile.company?.trim() && (
                          <div className="admin-modal-field">
                            <span>Compañía</span>
                            <strong>{profile.company.trim()}</strong>
                          </div>
                        )}
                        {profile.studiedAt?.trim() && (
                          <div className="admin-modal-field">
                            <span>Estudió en</span>
                            <strong>{profile.studiedAt.trim()}</strong>
                          </div>
                        )}
                      </div>
                    </section>
                  )}

                  {profile.lookingFor.length > 0 && (
                    <section className="admin-modal-section">
                      <h3 className="admin-review-label">Busca</h3>
                      <div className="admin-modal-chips">
                        {profile.lookingFor.map((value) => (
                          <span key={value} className="admin-modal-chip">
                            {value in LOOKING_FOR_ICONS && (
                              <i
                                className={`bi ${LOOKING_FOR_ICONS[value as LookingFor]}`}
                                aria-hidden="true"
                              />
                            )}
                            {labelLookingFor(value)}
                          </span>
                        ))}
                      </div>
                    </section>
                  )}

                  {profile.interestedIn && profile.interestedIn.length > 0 && (
                    <section className="admin-modal-section">
                      <h3 className="admin-review-label">Interesado/a en</h3>
                      <div className="admin-modal-chips">
                        {profile.interestedIn.map((value) => (
                          <span key={value} className="admin-modal-chip">
                            {labelGender(value) ?? value}
                          </span>
                        ))}
                      </div>
                    </section>
                  )}

                  {languages.length > 0 && (
                    <section className="admin-modal-section">
                      <h3 className="admin-review-label">Idiomas</h3>
                      <div className="admin-modal-chips">
                        {languages.map((value) => (
                          <span key={value} className="admin-modal-chip">
                            {labelLanguage(value)}
                          </span>
                        ))}
                      </div>
                    </section>
                  )}

                  {labelZodiac(profile.zodiac) && (
                    <section className="admin-modal-section">
                      <h3 className="admin-review-label">Zodíaco</h3>
                      <div className="admin-modal-grid">
                        <div className="admin-modal-field">
                          <span>Signo</span>
                          <strong>{labelZodiac(profile.zodiac)}</strong>
                        </div>
                        {zodiacInsight && (
                          <div className="admin-modal-field">
                            <span>Compatible con</span>
                            <strong>
                              {zodiacInsight.compatibleWith
                                .map((sign) => ZODIAC_LABELS[sign])
                                .join(" · ")}
                            </strong>
                          </div>
                        )}
                      </div>
                      {zodiacInsight && (
                        <p className="admin-modal-bio mb-0">
                          {zodiacInsight.traits}
                        </p>
                      )}
                    </section>
                  )}

                  {hasLifestyle && (
                    <section className="admin-modal-section">
                      <h3 className="admin-review-label">Estilo de vida</h3>
                      <div className="admin-modal-grid">
                        {labelEducation(profile.educationLevel) && (
                          <div className="admin-modal-field">
                            <span>Educación</span>
                            <strong>
                              {labelEducation(profile.educationLevel)}
                            </strong>
                          </div>
                        )}
                        {labelPets(profile.pets) && (
                          <div className="admin-modal-field">
                            <span>Mascotas</span>
                            <strong>{labelPets(profile.pets)}</strong>
                          </div>
                        )}
                        {labelDrinking(profile.drinking) && (
                          <div className="admin-modal-field">
                            <span>Bebidas</span>
                            <strong>{labelDrinking(profile.drinking)}</strong>
                          </div>
                        )}
                        {labelFitness(profile.fitness) && (
                          <div className="admin-modal-field">
                            <span>Fitness</span>
                            <strong>{labelFitness(profile.fitness)}</strong>
                          </div>
                        )}
                      </div>
                    </section>
                  )}

                  {profile.interests.length > 0 && (
                    <section className="admin-modal-section">
                      <h3 className="admin-review-label">Gustos</h3>
                      <div className="admin-modal-chips">
                        {profile.interests.map((value) => (
                          <span key={value} className="admin-modal-chip">
                            {labelInterest(value)}
                          </span>
                        ))}
                      </div>
                    </section>
                  )}

                  {socials.length > 0 && (
                    <section className="admin-modal-section">
                      <h3 className="admin-review-label">Redes</h3>
                      <div className="admin-modal-grid">
                        {socials.map(({ network, handle }) => (
                          <div key={network} className="admin-modal-field">
                            <span>{SOCIAL_NETWORK_LABELS[network]}</span>
                            <strong>@{handle.replace(/^@/, "")}</strong>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {profile.photos.length > 0 && (
                    <section className="admin-modal-section">
                      <h3 className="admin-review-label">Fotos</h3>
                      <div className="admin-modal-photos">
                        {profile.photos.map((src) => (
                          <img key={src} src={src} alt="" />
                        ))}
                      </div>
                    </section>
                  )}
                </>
              ) : (
                <p className="text-secondary small mb-0">
                  Este usuario todavía no completó el onboarding.
                </p>
              )}
            </OverflowFade>
          </div>
        </div>
      )}
    </div>
  );
}

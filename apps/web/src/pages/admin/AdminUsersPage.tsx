import { useEffect, useState } from "react";
import {
  DRINKING_LABELS,
  EDUCATION_LEVEL_LABELS,
  FITNESS_LABELS,
  GENDER_LABELS,
  INTEREST_LABELS,
  LANGUAGE_LABELS,
  LOOKING_FOR_LABELS,
  PETS_LABELS,
  PREMIUM_PERIOD_LABELS,
  PREMIUM_PERIOD_MONTHS,
  PREMIUM_PLANS,
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
  type PremiumPeriodMonths,
  type PremiumPlanId,
  type SexualOrientation,
  type SocialNetwork,
  type WorkStatus,
  type ZodiacSign,
} from "@nocta/shared";
import { api, ApiError } from "../../lib/api";
import { OverflowFade } from "../../components/OverflowFade";
import { NoctaLoading } from "../../components/NoctaLoading";
import { ManualSearchInput } from "../../components/ManualSearchInput";
import { useToast } from "../../components/ToastProvider";
import { LOOKING_FOR_ICONS } from "../../lib/lookingForIcons";
import {
  ADMIN_PAGE_SIZE,
  AdminPagination,
} from "../../components/admin/AdminPagination";
import { AdminFiltersAccordion } from "../../components/admin/AdminFiltersAccordion";

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

type UserEditState = {
  email: string;
  isAdmin: boolean;
  /** `free` = sin Premium; si no, plan activo. */
  planChoice: "free" | PremiumPlanId;
  premiumPeriodMonths: PremiumPeriodMonths;
  emailVerified: boolean;
  boostsRemaining: string;
  heartshotsRemaining: string;
  teleportMode: boolean;
  discoverDisabled: boolean;
  rogueMode: boolean;
  name: string;
  birthDate: string;
  heightCm: string;
  bio: string;
  country: string;
  city: string;
  jobTitle: string;
  company: string;
  studiedAt: string;
};

function editStateFromUser(user: AuthUser): UserEditState {
  const profile = user.profile;
  const planChoice: UserEditState["planChoice"] =
    user.premium &&
    user.premiumPlanId &&
    PREMIUM_PLANS.some((plan) => plan.id === user.premiumPlanId)
      ? user.premiumPlanId
      : "free";
  const period =
    user.premiumPeriodMonths &&
    (PREMIUM_PERIOD_MONTHS as readonly number[]).includes(
      user.premiumPeriodMonths
    )
      ? (user.premiumPeriodMonths as PremiumPeriodMonths)
      : 1;
  return {
    email: user.email,
    isAdmin: user.role === "admin",
    planChoice,
    premiumPeriodMonths: period,
    emailVerified: user.emailVerified,
    boostsRemaining: String(user.boostsRemaining ?? 0),
    heartshotsRemaining: String(user.heartshotsRemaining ?? 0),
    teleportMode: Boolean(user.teleportMode),
    discoverDisabled: Boolean(user.discoverDisabled),
    rogueMode: Boolean(user.rogueMode),
    name: profile?.name ?? "",
    birthDate: profile?.birthDate?.slice(0, 10) ?? "",
    heightCm: profile?.heightCm ? String(profile.heightCm) : "",
    bio: profile?.bio ?? "",
    country: profile?.livesIn?.country ?? "",
    city: profile?.livesIn?.city ?? "",
    jobTitle: profile?.jobTitle ?? "",
    company: profile?.company ?? "",
    studiedAt: profile?.studiedAt ?? "",
  };
}

export function AdminUsersPage() {
  const toast = useToast();
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AuthUser | null>(null);
  const [edit, setEdit] = useState<UserEditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalNow, setModalNow] = useState(Date.now());

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(ADMIN_PAGE_SIZE),
    });
    if (submittedQuery) params.set("q", submittedQuery);
    void api<{
      users: AuthUser[];
      pagination: { total: number };
    }>(`/api/admin/users?${params}`)
      .then((res) => {
        setUsers(res.users);
        setTotalUsers(res.pagination.total);
      })
      .catch((err) =>
        toast.error(err instanceof ApiError ? err.message : "No se pudo cargar")
      )
      .finally(() => setLoading(false));
  }, [page, submittedQuery]);

  useEffect(() => {
    if (!selected) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) closeUser();
    };
    window.addEventListener("keydown", onKey);
    setModalNow(Date.now());
    const interval = window.setInterval(() => setModalNow(Date.now()), 1000);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
      window.clearInterval(interval);
    };
  }, [selected, saving]);

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

  function openUser(user: AuthUser) {
    setSelected(user);
    setEdit(editStateFromUser(user));
  }

  function closeUser() {
    if (saving) return;
    setSelected(null);
    setEdit(null);
  }

  function updateEdit<K extends keyof UserEditState>(
    key: K,
    value: UserEditState[K]
  ) {
    setEdit((current) => (current ? { ...current, [key]: value } : current));
  }

  async function saveUser() {
    if (!selected || !edit) return;
    setSaving(true);
    try {
      const hasLocation = Boolean(edit.country.trim() && edit.city.trim());
      const isPremium = edit.planChoice !== "free";
      const response = await api<{ user: AuthUser }>(
        `/api/admin/users/${selected.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            email: edit.email.trim(),
            role: edit.isAdmin ? "admin" : "user",
            premium: isPremium,
            ...(isPremium
              ? {
                  premiumPlanId: edit.planChoice,
                  premiumPeriodMonths: edit.premiumPeriodMonths,
                }
              : {}),
            emailVerified: edit.emailVerified,
            boostsRemaining: Number(edit.boostsRemaining) || 0,
            heartshotsRemaining: Number(edit.heartshotsRemaining) || 0,
            teleportMode: edit.teleportMode,
            discoverDisabled: edit.discoverDisabled,
            rogueMode: edit.rogueMode,
            profile: {
              ...(edit.name.trim() ? { name: edit.name.trim() } : {}),
              birthDate: edit.birthDate || null,
              heightCm: edit.heightCm ? Number(edit.heightCm) : null,
              bio: edit.bio.trim() || null,
              livesIn: hasLocation
                ? { country: edit.country.trim(), city: edit.city.trim() }
                : null,
              jobTitle: edit.jobTitle.trim() || null,
              company: edit.company.trim() || null,
              studiedAt: edit.studiedAt.trim() || null,
            },
          }),
        }
      );
      setUsers((current) =>
        current.map((user) =>
          user.id === response.user.id ? response.user : user
        )
      );
      setSelected(response.user);
      setEdit(editStateFromUser(response.user));
      toast.success("Usuario actualizado");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo actualizar el usuario"
      );
    } finally {
      setSaving(false);
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
            Gestión de cuentas de usuarios y administradores.
          </p>
        </div>
      </header>

      <AdminFiltersAccordion activeCount={submittedQuery ? 1 : 0}>
        <ManualSearchInput
          className="admin-toolbar"
          placeholder="Buscar por email o nombre…"
          ariaLabel="Buscar usuarios"
          value={query}
          onValueChange={setQuery}
          onSearch={(value) => {
            setSubmittedQuery(value);
            setPage(1);
          }}
        />
      </AdminFiltersAccordion>

      {loading ? (
        <NoctaLoading variant="block" />
      ) : users.length === 0 ? (
        <p className="text-secondary small mb-0">Sin resultados.</p>
      ) : (
        <div className="admin-list">
          {users.map((u) => (
            <button
              key={u.id}
              type="button"
              className="admin-list-row admin-list-row-button"
              onClick={() => openUser(u)}
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
                <strong className="admin-user-name text-truncate">
                  <span>{u.profile?.name ?? "Sin nombre"}</span>
                  {u.role === "admin" && (
                    <i
                      className="bi bi-shield-check admin-user-role-icon"
                      aria-label="Administrador"
                    />
                  )}
                </strong>
                <div className="text-secondary small text-truncate">{u.email}</div>
                <div
                  className={`small ${
                    u.premium ? "admin-user-premium" : "text-secondary"
                  }`}
                >
                  {u.premium ? "Premium" : "Sin premium"}
                </div>
                {u.moderationStatus === "suspended" && (
                  <div className="admin-user-suspended small">
                    Suspendido ·{" "}
                    {u.suspension?.duration === "permanent"
                      ? "Permanente"
                      : `${u.suspension?.duration ?? "—"} días`}
                  </div>
                )}
              </div>
              <i className="bi bi-chevron-right admin-list-chevron" aria-hidden="true" />
            </button>
          ))}
        </div>
      )}

      <AdminPagination
        page={page}
        totalItems={totalUsers}
        onPageChange={setPage}
        label="Páginas de usuarios"
      />

      {selected && (
        <div className="admin-modal" role="presentation">
          <button
            type="button"
            className="admin-modal-backdrop"
            aria-label="Cerrar ficha de usuario"
            onClick={closeUser}
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
                    {selected.role === "admin" && (
                      <i
                        className="bi bi-shield-check admin-user-role-icon ms-2"
                        aria-label="Administrador"
                      />
                    )}
                  </h2>
                  <p className="text-secondary small mb-0 text-truncate">
                    {selected.email}
                  </p>
                  {selected.moderationStatus === "suspended" && (
                    <p className="admin-user-suspended small mb-0">
                      Cuenta suspendida ·{" "}
                      {selected.suspension?.duration === "permanent"
                        ? "Permanente"
                        : `${selected.suspension?.duration ?? "—"} días`}
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                className="admin-modal-close"
                aria-label="Cerrar"
                disabled={saving}
                onClick={closeUser}
              >
                <i className="bi bi-x-lg" aria-hidden="true" />
              </button>
            </header>

            <OverflowFade className="admin-modal-body">
              {edit && (
                <section className="admin-modal-section">
                  <h3 className="admin-review-label">Editar usuario</h3>
                  <form
                    className="admin-user-edit-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void saveUser();
                    }}
                  >
                    <label className="admin-field">
                      <span>Email</span>
                      <input
                        className="form-control"
                        type="email"
                        required
                        value={edit.email}
                        onChange={(event) => updateEdit("email", event.target.value)}
                      />
                    </label>
                    <label className="admin-field">
                      <span>Nombre</span>
                      <input
                        className="form-control"
                        type="text"
                        minLength={2}
                        maxLength={60}
                        value={edit.name}
                        onChange={(event) => updateEdit("name", event.target.value)}
                      />
                    </label>
                    <label className="admin-field">
                      <span>Fecha de nacimiento</span>
                      <input
                        className="form-control"
                        type="date"
                        value={edit.birthDate}
                        onChange={(event) =>
                          updateEdit("birthDate", event.target.value)
                        }
                      />
                    </label>
                    <label className="admin-field">
                      <span>Altura (cm)</span>
                      <input
                        className="form-control"
                        type="number"
                        min={100}
                        max={250}
                        value={edit.heightCm}
                        onChange={(event) =>
                          updateEdit("heightCm", event.target.value)
                        }
                      />
                    </label>
                    <label className="admin-field admin-user-edit-wide">
                      <span>Biografía</span>
                      <textarea
                        className="form-control"
                        rows={3}
                        maxLength={500}
                        value={edit.bio}
                        onChange={(event) => updateEdit("bio", event.target.value)}
                      />
                    </label>
                    <label className="admin-field">
                      <span>País</span>
                      <input
                        className="form-control"
                        type="text"
                        maxLength={60}
                        value={edit.country}
                        onChange={(event) =>
                          updateEdit("country", event.target.value)
                        }
                      />
                    </label>
                    <label className="admin-field">
                      <span>Ciudad</span>
                      <input
                        className="form-control"
                        type="text"
                        maxLength={80}
                        value={edit.city}
                        onChange={(event) => updateEdit("city", event.target.value)}
                      />
                    </label>
                    <label className="admin-field">
                      <span>Puesto</span>
                      <input
                        className="form-control"
                        type="text"
                        maxLength={80}
                        value={edit.jobTitle}
                        onChange={(event) =>
                          updateEdit("jobTitle", event.target.value)
                        }
                      />
                    </label>
                    <label className="admin-field">
                      <span>Compañía</span>
                      <input
                        className="form-control"
                        type="text"
                        maxLength={80}
                        value={edit.company}
                        onChange={(event) =>
                          updateEdit("company", event.target.value)
                        }
                      />
                    </label>
                    <label className="admin-field admin-user-edit-wide">
                      <span>Estudió en</span>
                      <input
                        className="form-control"
                        type="text"
                        maxLength={120}
                        value={edit.studiedAt}
                        onChange={(event) =>
                          updateEdit("studiedAt", event.target.value)
                        }
                      />
                    </label>

                    <div className="admin-user-controls admin-user-edit-wide">
                      <div className="admin-user-switch-grid">
                        <label className="form-check form-switch admin-user-switch">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            checked={edit.isAdmin}
                            onChange={(event) =>
                              updateEdit("isAdmin", event.target.checked)
                            }
                          />
                          <span className="form-check-label">Administrador</span>
                        </label>
                        <label className="form-check form-switch admin-user-switch">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            checked={edit.emailVerified}
                            onChange={(event) =>
                              updateEdit("emailVerified", event.target.checked)
                            }
                          />
                          <span className="form-check-label">
                            Email verificado
                          </span>
                        </label>
                        <label className="form-check form-switch admin-user-switch">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            checked={edit.rogueMode}
                            onChange={(event) =>
                              updateEdit("rogueMode", event.target.checked)
                            }
                          />
                          <span className="form-check-label">Modo pícaro</span>
                        </label>
                        <label className="form-check form-switch admin-user-switch">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            checked={edit.teleportMode}
                            onChange={(event) =>
                              updateEdit("teleportMode", event.target.checked)
                            }
                          />
                          <span className="form-check-label">Teleport</span>
                        </label>
                        <label className="form-check form-switch admin-user-switch">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            checked={edit.discoverDisabled}
                            onChange={(event) =>
                              updateEdit(
                                "discoverDisabled",
                                event.target.checked
                              )
                            }
                          />
                          <span className="form-check-label">
                            Discover desactivado
                          </span>
                        </label>
                      </div>

                      <div className="admin-user-pair-grid">
                        <label className="admin-field">
                          <span>Plan</span>
                          <select
                            className="form-select"
                            value={edit.planChoice}
                            aria-label="Plan"
                            onChange={(event) =>
                              updateEdit(
                                "planChoice",
                                event.target
                                  .value as UserEditState["planChoice"]
                              )
                            }
                          >
                            <option value="free">Gratis</option>
                            {PREMIUM_PLANS.filter((p) => !p.comingSoon).map(
                              (plan) => (
                                <option key={plan.id} value={plan.id}>
                                  {plan.name
                                    .replace("Nocta ", "")
                                    .replace("A.M.", "AM")}
                                </option>
                              )
                            )}
                          </select>
                        </label>
                        <label className="admin-field">
                          <span>Periodo</span>
                          <select
                            className="form-select"
                            value={edit.premiumPeriodMonths}
                            disabled={edit.planChoice === "free"}
                            aria-label="Periodo"
                            onChange={(event) =>
                              updateEdit(
                                "premiumPeriodMonths",
                                Number(
                                  event.target.value
                                ) as PremiumPeriodMonths
                              )
                            }
                          >
                            {PREMIUM_PERIOD_MONTHS.map((months) => (
                              <option key={months} value={months}>
                                {PREMIUM_PERIOD_LABELS[months]}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>

                      <div className="admin-user-pair-grid">
                        <label className="admin-field">
                          <span>Boosts restantes</span>
                          <input
                            className="form-control"
                            type="number"
                            min={0}
                            max={999}
                            value={edit.boostsRemaining}
                            onChange={(event) =>
                              updateEdit("boostsRemaining", event.target.value)
                            }
                          />
                        </label>
                        <label className="admin-field">
                          <span>Heartshots restantes</span>
                          <input
                            className="form-control"
                            type="number"
                            min={0}
                            max={999}
                            value={edit.heartshotsRemaining}
                            onChange={(event) =>
                              updateEdit(
                                "heartshotsRemaining",
                                event.target.value
                              )
                            }
                          />
                        </label>
                      </div>
                    </div>

                    <div className="admin-user-edit-actions admin-user-edit-wide">
                      <button
                        className="btn btn-primary"
                        type="submit"
                        disabled={saving}
                      >
                        {saving ? "Guardando…" : "Guardar cambios"}
                      </button>
                    </div>
                  </form>
                </section>
              )}

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
                  {selected.premium && selected.premiumPlanId && (
                    <div className="admin-modal-field">
                      <span>Plan</span>
                      <strong>{selected.premiumPlanId}</strong>
                    </div>
                  )}
                  {selected.premium && (
                    <div className="admin-modal-field">
                      <span>Vence</span>
                      <strong>
                        {selected.premiumExpiresAt
                          ? new Date(
                              selected.premiumExpiresAt
                            ).toLocaleDateString("es-UY")
                          : "Sin vencimiento"}
                      </strong>
                    </div>
                  )}
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

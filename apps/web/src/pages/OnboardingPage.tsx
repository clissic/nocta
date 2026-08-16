import { useState, useRef } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import {
  ALLOWED_PHOTO_EXTENSIONS,
  DRINKING,
  DRINKING_LABELS,
  EDUCATION_LEVELS,
  EDUCATION_LEVEL_LABELS,
  FITNESS,
  FITNESS_LABELS,
  GENDERS,
  GENDER_LABELS,
  INTEREST_CATEGORIES,
  INTEREST_LABELS,
  LANGUAGES,
  LANGUAGE_LABELS,
  LOOKING_FOR,
  LOOKING_FOR_LABELS,
  MAX_AGE,
  MAX_PHOTO_UPLOAD_BYTES,
  MAX_PHOTO_UPLOAD_FILES,
  MAX_PHOTOS,
  MIN_AGE,
  MIN_PHOTOS,
  PETS,
  PETS_LABELS,
  PROFILE_COUNTRIES,
  SEXUAL_ORIENTATIONS,
  SEXUAL_ORIENTATION_LABELS,
  SOCIAL_NETWORKS,
  SOCIAL_NETWORK_LABELS,
  URUGUAY_CITIES,
  WORK_STATUS,
  WORK_STATUS_LABELS,
  ZODIAC_SIGNS,
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
  type ProfileSocials,
  type SexualOrientation,
  type SocialNetwork,
  type WorkStatus,
  type ZodiacSign,
} from "@nocta/shared";
import { useAuth } from "../auth/AuthContext";
import { NoctaWordmark } from "../components/NoctaWordmark";
import { api, ApiError } from "../lib/api";
import { LOOKING_FOR_ICONS } from "../lib/lookingForIcons";

type Photo =
  | { id: string; url: string; file?: never }
  | { id: string; url: string; file: File };

const STEPS = [
  ["Sobre vos", "Datos, identidad y dónde vivís", "bi-person-badge"],
  ["Estilo de vida", "Orientación, idiomas y más", "bi-heart"],
  ["Trabajo", "Puesto, compañía y estudios", "bi-briefcase"],
  ["Qué buscás", "Intención y gustos", "bi-stars"],
  ["Tus fotos", "Elegí las fotos de tu perfil", "bi-images"],
] as const;

const id = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function ageFrom(value: string) {
  const birth = new Date(value);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const month = today.getMonth() - birth.getMonth();
  if (month < 0 || (month === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function dateForAge(age: number) {
  const date = new Date();
  date.setFullYear(date.getFullYear() - age);
  return date.toISOString().slice(0, 10);
}

function emptySocials(): ProfileSocials {
  return {};
}

function Chips<T extends string>({
  values,
  selected,
  labels,
  onToggle,
}: {
  values: readonly T[];
  selected: readonly T[];
  labels: Record<T, string>;
  onToggle: (value: T) => void;
}) {
  return (
    <div className="onboard-chips">
      {values.map((value) => (
        <button
          key={value}
          type="button"
          className={`btn btn-sm btn-outline-secondary rounded-pill choice-btn ${
            selected.includes(value) ? "active" : ""
          }`}
          aria-pressed={selected.includes(value)}
          onClick={() => onToggle(value)}
        >
          {labels[value]}
        </button>
      ))}
    </div>
  );
}

function SingleChips<T extends string>({
  values,
  selected,
  labels,
  onSelect,
}: {
  values: readonly T[];
  selected: T | "";
  labels: Record<T, string>;
  onSelect: (value: T | "") => void;
}) {
  return (
    <div className="onboard-chips">
      {values.map((value) => (
        <button
          key={value}
          type="button"
          className={`btn btn-sm btn-outline-secondary rounded-pill choice-btn ${
            selected === value ? "active" : ""
          }`}
          aria-pressed={selected === value}
          onClick={() => onSelect(selected === value ? "" : value)}
        >
          {labels[value]}
        </button>
      ))}
    </div>
  );
}

function LookingForChoices({
  selected,
  onSelect,
}: {
  selected: LookingFor | "";
  onSelect: (value: LookingFor) => void;
}) {
  return (
    <div
      className="onboard-looking-grid"
      role="radiogroup"
      aria-label="Qué estás buscando"
    >
      {LOOKING_FOR.map((value) => (
        <button
          key={value}
          type="button"
          role="radio"
          className={`onboard-looking-option choice-btn ${
            selected === value ? "active" : ""
          }`}
          aria-checked={selected === value}
          onClick={() => onSelect(value)}
        >
          <i className={`bi ${LOOKING_FOR_ICONS[value]}`} aria-hidden="true" />
          <span>{LOOKING_FOR_LABELS[value]}</span>
        </button>
      ))}
    </div>
  );
}

export function OnboardingPage() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const editing = params.get("edit") === "1";
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(() => {
    const raw = Number(params.get("step"));
    if (!Number.isFinite(raw)) return 0;
    return Math.min(STEPS.length - 1, Math.max(0, Math.floor(raw) - 1));
  });
  const [name, setName] = useState(user?.profile?.name ?? "");
  const [birthDate, setBirthDate] = useState(
    user?.profile?.birthDate?.slice(0, 10) ?? ""
  );
  const [height, setHeight] = useState(
    user?.profile?.heightCm?.toString() ?? ""
  );
  const [gender, setGender] = useState<Gender | "">(
    (user?.profile?.gender as Gender) ?? ""
  );
  const [interestedIn, setInterestedIn] = useState<Gender[]>(
    (user?.profile?.interestedIn as Gender[]) ?? []
  );
  const [lookingFor, setLookingFor] = useState<LookingFor | "">(
    (user?.profile?.lookingFor?.[0] as LookingFor | undefined) ?? ""
  );
  const [interests, setInterests] = useState<Interest[]>(
    user?.profile?.interests ?? []
  );
  const [workStatus, setWorkStatus] = useState<WorkStatus | "">(
    user?.profile?.workStatus ?? ""
  );
  const [bio, setBio] = useState(user?.profile?.bio ?? "");
  const [country, setCountry] = useState(
    user?.profile?.livesIn?.country ?? "Uruguay"
  );
  const [city, setCity] = useState(user?.profile?.livesIn?.city ?? "");
  const [sexualOrientation, setSexualOrientation] = useState<
    SexualOrientation | ""
  >(user?.profile?.sexualOrientation ?? "");
  const [languages, setLanguages] = useState<Language[]>(
    user?.profile?.languages ?? []
  );
  const [zodiac, setZodiac] = useState<ZodiacSign | "">(
    user?.profile?.zodiac ?? ""
  );
  const [educationLevel, setEducationLevel] = useState<EducationLevel | "">(
    user?.profile?.educationLevel ?? ""
  );
  const [pets, setPets] = useState<Pets | "">(user?.profile?.pets ?? "");
  const [drinking, setDrinking] = useState<Drinking | "">(
    user?.profile?.drinking ?? ""
  );
  const [fitness, setFitness] = useState<Fitness | "">(
    user?.profile?.fitness ?? ""
  );
  const [socials, setSocials] = useState<ProfileSocials>(
    user?.profile?.socials ?? emptySocials()
  );
  const [jobTitle, setJobTitle] = useState(user?.profile?.jobTitle ?? "");
  const [company, setCompany] = useState(user?.profile?.company ?? "");
  const [studiedAt, setStudiedAt] = useState(user?.profile?.studiedAt ?? "");
  const [photos, setPhotos] = useState<Photo[]>(() =>
    (user?.profile?.photos ?? []).map((url) => ({ id: id(), url }))
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user?.role === "admin") return <Navigate to="/admin/overview" replace />;
  if (user?.profileComplete && !editing) return <Navigate to="/" replace />;

  function toggle<T>(list: T[], value: T, update: (next: T[]) => void) {
    update(
      list.includes(value)
        ? list.filter((item) => item !== value)
        : [...list, value]
    );
  }

  const uruguayCityLabels = URUGUAY_CITIES.map((item) => item.label) as string[];
  const isUruguay = country === "Uruguay";
  const cityIsListed = uruguayCityLabels.includes(city);

  function validate(current: number) {
    if (current === 0) {
      if (name.trim().length < 2) return "Ingresá tu nombre";
      const age = ageFrom(birthDate);
      if (age == null) return "Ingresá una fecha válida";
      if (age < MIN_AGE) return `Debés tener al menos ${MIN_AGE} años`;
      if (age > MAX_AGE) return "Fecha fuera de rango";
      if (height && (Number(height) < 100 || Number(height) > 250)) {
        return "La altura debe estar entre 100 y 250 cm";
      }
      if (!gender || !interestedIn.length) {
        return "Completá género y a quiénes te interesa conocer";
      }
      if (!country.trim() || !city.trim()) {
        return "Completá país y ciudad";
      }
    }
    if (current === 3 && (!lookingFor || !interests.length)) {
      return "Elegí al menos una opción en cada grupo";
    }
    if (current === 4 && photos.length < MIN_PHOTOS) {
      return `Necesitás al menos ${MIN_PHOTOS} foto`;
    }
    return "";
  }

  function next() {
    const message = validate(step);
    if (message) return setError(message);
    setError("");
    setStep((value) => value + 1);
  }

  function addPhotos(files: FileList | null) {
    if (!files) return;
    const available = MAX_PHOTOS - photos.length;
    const next: Photo[] = [];
    Array.from(files)
      .slice(0, available)
      .forEach((file) => {
        if (file.size > MAX_PHOTO_UPLOAD_BYTES) {
          setError(`${file.name} supera los 8 MB`);
        } else if (file.type.startsWith("image/")) {
          next.push({ id: id(), url: URL.createObjectURL(file), file });
        }
      });
    setPhotos((current) => [...current, ...next]);
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= photos.length) return;
    const next = [...photos];
    [next[index], next[target]] = [next[target]!, next[index]!];
    setPhotos(next);
  }

  function setSocial(network: SocialNetwork, value: string) {
    setSocials((current) => {
      const next = { ...current };
      const trimmed = value.trim();
      if (trimmed) next[network] = trimmed;
      else delete next[network];
      return next;
    });
  }

  async function save() {
    const message = validate(4);
    if (message) return setError(message);
    setBusy(true);
    setError("");
    try {
      const existing = photos.filter((photo) => !photo.file);
      const fresh = photos.filter(
        (photo): photo is Photo & { file: File } => Boolean(photo.file)
      );
      let response = await api<{ user: AuthUser }>("/api/profile", {
        method: "PUT",
        body: JSON.stringify({
          name: name.trim(),
          birthDate,
          heightCm: height ? Number(height) : undefined,
          gender,
          interestedIn,
          lookingFor: lookingFor ? [lookingFor] : [],
          interests,
          workStatus: workStatus || undefined,
          bio: bio.trim() || undefined,
          livesIn: {
            country: country.trim(),
            city: city.trim(),
          },
          sexualOrientation: sexualOrientation || undefined,
          languages,
          zodiac: zodiac || undefined,
          educationLevel: educationLevel || undefined,
          pets: pets || undefined,
          drinking: drinking || undefined,
          fitness: fitness || undefined,
          socials: Object.fromEntries(
            SOCIAL_NETWORKS.map((network) => [
              network,
              socials[network]?.trim() || undefined,
            ]).filter(([, value]) => Boolean(value))
          ),
          jobTitle: jobTitle.trim() || undefined,
          company: company.trim() || undefined,
          studiedAt: studiedAt.trim() || undefined,
          photos: existing.map((photo) => photo.url),
        }),
      });
      for (
        let index = 0;
        index < fresh.length;
        index += MAX_PHOTO_UPLOAD_FILES
      ) {
        const form = new FormData();
        const group = fresh.slice(index, index + MAX_PHOTO_UPLOAD_FILES);
        group.forEach((photo) =>
          form.append(group.length === 1 ? "photo" : "photos", photo.file)
        );
        response = await api<{ user: AuthUser }>("/api/profile/photos", {
          method: "POST",
          body: form,
        });
      }
      setUser(response.user);
      navigate(editing ? "/profile" : "/");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "No se pudo guardar el perfil"
      );
    } finally {
      setBusy(false);
    }
  }

  const [title, subtitle, icon] = STEPS[step]!;

  return (
    <div className="onboard-shell">
      <div className="onboard-layout">
        <aside className="onboard-aside d-none d-lg-flex">
          <div>
            <p className="onboard-brand">
              <NoctaWordmark />
            </p>
            <h2>Armá tu perfil en {STEPS.length} pasos</h2>
            <ol className="onboard-aside-steps">
              {STEPS.map(([label], index) => (
                <li
                  key={label}
                  className={
                    index === step
                      ? "is-current"
                      : index < step
                        ? "is-done"
                        : ""
                  }
                >
                  <span>{index + 1}</span>
                  {label}
                </li>
              ))}
            </ol>
          </div>
        </aside>
        <main className="onboard-main">
          <div className="onboard-panel fade-in">
            <div className="onboard-progress">
              <span
                style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
              />
            </div>
            <p className="small text-secondary mb-2">
              Paso {step + 1} de {STEPS.length}
            </p>
            <div className="onboard-heading">
              <span className="onboard-heading-icon">
                <i className={`bi ${icon}`} />
              </span>
              <div>
                <h1 className="h3 mb-1">{title}</h1>
                <p className="text-secondary mb-0">{subtitle}</p>
              </div>
            </div>

            <div className="onboard-body">
              {step === 0 && (
                <div className="onboard-about-step">
                  <div className="onboard-about-basics d-grid gap-3">
                    <label>
                      Nombre
                      <input
                        className="form-control mt-2"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </label>
                    <div className="row g-3">
                      <label className="col-md-6">
                        Fecha de nacimiento
                        <input
                          className="form-control mt-2"
                          type="date"
                          min={dateForAge(MAX_AGE)}
                          max={dateForAge(MIN_AGE)}
                          value={birthDate}
                          onChange={(e) => setBirthDate(e.target.value)}
                        />
                      </label>
                      <label className="col-md-6">
                        Altura (cm)
                        <input
                          className="form-control mt-2"
                          type="number"
                          min="100"
                          max="250"
                          placeholder="Opcional"
                          value={height}
                          onChange={(e) => setHeight(e.target.value)}
                        />
                      </label>
                    </div>
                  </div>

                  <div>
                    <p className="fw-semibold mb-3">Identidad</p>
                    <div className="d-grid gap-4">
                      <div>
                        <p>Género</p>
                        <Chips
                          values={GENDERS}
                          selected={gender ? [gender] : []}
                          labels={GENDER_LABELS}
                          onToggle={setGender}
                        />
                      </div>
                      <div>
                        <p>Me interesan</p>
                        <Chips
                          values={GENDERS}
                          selected={interestedIn}
                          labels={GENDER_LABELS}
                          onToggle={(value) =>
                            toggle(interestedIn, value, setInterestedIn)
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="fw-semibold mb-2">Dónde vivís</p>
                    <p className="text-secondary small mb-3">
                      Solo país y ciudad. Las fechas de promociones usan la zona
                      horaria de tu país (Uruguay = GMT-3).
                    </p>
                    <div className="row g-3">
                      <label className="col-md-6">
                        País
                        <select
                          className="form-select mt-2"
                          value={country}
                          onChange={(e) => {
                            const next = e.target.value;
                            setCountry(next);
                            if (next === "Uruguay" && !cityIsListed) {
                              setCity("");
                            }
                          }}
                        >
                          {PROFILE_COUNTRIES.map((value) => (
                            <option key={value} value={value}>
                              {value}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="col-md-6">
                        Ciudad
                        {isUruguay ? (
                          <select
                            className="form-select mt-2"
                            value={cityIsListed ? city : ""}
                            onChange={(e) => setCity(e.target.value)}
                          >
                            <option value="">Elegí una ciudad</option>
                            {URUGUAY_CITIES.map((item) => (
                              <option key={item.id} value={item.label}>
                                {item.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            className="form-control mt-2"
                            placeholder="Ej. Buenos Aires"
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                          />
                        )}
                      </label>
                    </div>
                    {country.trim() && city.trim() && (
                      <p className="small text-secondary mt-2 mb-0">
                        Se mostrará como{" "}
                        <strong>
                          {country.trim()}, {city.trim()}
                        </strong>
                      </p>
                    )}
                  </div>

                  <label className="onboard-about-bio">
                    Descripción (opcional)
                    <textarea
                      className="form-control mt-2"
                      rows={4}
                      maxLength={500}
                      placeholder="Algo de mí…"
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                    />
                  </label>
                </div>
              )}

              {step === 1 && (
                <div className="d-grid gap-4">
                  <div>
                    <p className="fw-semibold mb-2">Orientación sexual</p>
                    <SingleChips
                      values={SEXUAL_ORIENTATIONS}
                      selected={sexualOrientation}
                      labels={SEXUAL_ORIENTATION_LABELS}
                      onSelect={setSexualOrientation}
                    />
                  </div>
                  <div>
                    <p className="fw-semibold mb-2">Idiomas</p>
                    <Chips
                      values={LANGUAGES}
                      selected={languages}
                      labels={LANGUAGE_LABELS}
                      onToggle={(value) =>
                        toggle(languages, value, setLanguages)
                      }
                    />
                  </div>
                  <div>
                    <p className="fw-semibold mb-2">Zodíaco</p>
                    <SingleChips
                      values={ZODIAC_SIGNS}
                      selected={zodiac}
                      labels={ZODIAC_LABELS}
                      onSelect={setZodiac}
                    />
                  </div>
                  <div>
                    <p className="fw-semibold mb-2">Nivel educativo</p>
                    <SingleChips
                      values={EDUCATION_LEVELS}
                      selected={educationLevel}
                      labels={EDUCATION_LEVEL_LABELS}
                      onSelect={setEducationLevel}
                    />
                  </div>
                  <div>
                    <p className="fw-semibold mb-2">Mascotas</p>
                    <SingleChips
                      values={PETS}
                      selected={pets}
                      labels={PETS_LABELS}
                      onSelect={setPets}
                    />
                  </div>
                  <div>
                    <p className="fw-semibold mb-2">Bebidas</p>
                    <SingleChips
                      values={DRINKING}
                      selected={drinking}
                      labels={DRINKING_LABELS}
                      onSelect={setDrinking}
                    />
                  </div>
                  <div>
                    <p className="fw-semibold mb-2">Fitness</p>
                    <SingleChips
                      values={FITNESS}
                      selected={fitness}
                      labels={FITNESS_LABELS}
                      onSelect={setFitness}
                    />
                  </div>
                  <div>
                    <p className="fw-semibold mb-3">Redes sociales</p>
                    <div className="d-grid gap-3">
                      {SOCIAL_NETWORKS.map((network) => (
                        <label key={network}>
                          {SOCIAL_NETWORK_LABELS[network]}
                          <input
                            className="form-control mt-2"
                            placeholder={`usuario de ${SOCIAL_NETWORK_LABELS[network]}`}
                            value={socials[network] ?? ""}
                            onChange={(e) =>
                              setSocial(network, e.target.value)
                            }
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="d-grid gap-3">
                  <label>
                    Situación laboral
                    <select
                      className="form-select mt-2"
                      value={workStatus}
                      onChange={(e) =>
                        setWorkStatus(e.target.value as WorkStatus | "")
                      }
                    >
                      <option value="">Preferir no decir</option>
                      {WORK_STATUS.map((value) => (
                        <option key={value} value={value}>
                          {WORK_STATUS_LABELS[value]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Puesto
                    <input
                      className="form-control mt-2"
                      placeholder="Ej. Diseñador/a"
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                    />
                  </label>
                  <label>
                    Compañía
                    <input
                      className="form-control mt-2"
                      placeholder="Ej. Nocta"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                    />
                  </label>
                  <label>
                    Dónde estudió
                    <input
                      className="form-control mt-2"
                      placeholder="Ej. Universidad / instituto"
                      value={studiedAt}
                      onChange={(e) => setStudiedAt(e.target.value)}
                    />
                  </label>
                </div>
              )}

              {step === 3 && (
                <div className="d-grid gap-4">
                  <div>
                    <p>¿Qué estás buscando?</p>
                    <LookingForChoices
                      selected={lookingFor}
                      onSelect={setLookingFor}
                    />
                  </div>
                  <div>
                    <p className="mb-3">Gustos</p>
                    <div className="onboard-interest-categories">
                      {INTEREST_CATEGORIES.map((category) => (
                        <section
                          key={category.id}
                          className="onboard-interest-category"
                        >
                          <h3 className="onboard-interest-category-title">
                            {category.label}
                          </h3>
                          <Chips
                            values={category.interests}
                            selected={interests}
                            labels={INTEREST_LABELS}
                            onToggle={(value) =>
                              toggle(
                                interests,
                                value as Interest,
                                setInterests
                              )
                            }
                          />
                        </section>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="d-grid gap-3">
                  <input
                    ref={inputRef}
                    className="d-none"
                    type="file"
                    accept={[...ALLOWED_PHOTO_EXTENSIONS, "image/*"].join(",")}
                    multiple
                    onChange={(e) => addPhotos(e.target.files)}
                  />
                  <button
                    type="button"
                    className="onboard-dropzone"
                    onClick={() => inputRef.current?.click()}
                  >
                    <i className="bi bi-cloud-arrow-up" />
                    <strong>Subí tus fotos</strong>
                    <small>Desde PC o teléfono · máximo 8 MB</small>
                  </button>
                  <div className="onboard-photo-grid">
                    {photos.map((photo, index) => (
                      <div className="onboard-photo" key={photo.id}>
                        <img src={photo.url} alt="" />
                        {index === 0 && <span>Perfil</span>}
                        <div>
                          <button
                            type="button"
                            onClick={() => move(index, -1)}
                          >
                            ‹
                          </button>
                          <button
                            type="button"
                            onClick={() => move(index, 1)}
                          >
                            ›
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setPhotos(
                                photos.filter((item) => item.id !== photo.id)
                              )
                            }
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {error && <p className="text-danger small mt-3">{error}</p>}
            <div className="onboard-nav">
              {step > 0 ? (
                <button
                  className="btn btn-outline-light"
                  onClick={() => setStep(step - 1)}
                >
                  Atrás
                </button>
              ) : (
                <span />
              )}
              {step < STEPS.length - 1 ? (
                <button className="btn btn-primary" onClick={next}>
                  Siguiente
                </button>
              ) : (
                <button
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() => void save()}
                >
                  {busy
                    ? "Guardando…"
                    : editing
                      ? "Guardar cambios"
                      : "Guardar y Continuar"}
                </button>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

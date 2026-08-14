import { useState, useRef } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import {
  ALLOWED_PHOTO_EXTENSIONS,
  GENDERS,
  GENDER_LABELS,
  INTERESTS,
  INTEREST_LABELS,
  LOOKING_FOR,
  LOOKING_FOR_LABELS,
  MAX_AGE,
  MAX_PHOTO_UPLOAD_BYTES,
  MAX_PHOTO_UPLOAD_FILES,
  MAX_PHOTOS,
  MIN_AGE,
  MIN_PHOTOS,
  WORK_STATUS,
  WORK_STATUS_LABELS,
  type AuthUser,
  type Gender,
  type Interest,
  type LookingFor,
  type WorkStatus,
} from "@nocta/shared";
import { useAuth } from "../auth/AuthContext";
import { api, ApiError } from "../lib/api";

type Photo =
  | { id: string; url: string; file?: never }
  | { id: string; url: string; file: File };

const STEPS = [
  ["Sobre vos", "Nombre, edad y altura", "bi-person-badge"],
  ["Identidad", "Género y personas que te interesan", "bi-heart"],
  ["Qué buscás", "Intención y gustos", "bi-stars"],
  ["Más de vos", "Trabajo y descripción", "bi-chat-quote"],
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

export function OnboardingPage() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const editing = params.get("edit") === "1";
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);
  const [name, setName] = useState(user?.profile?.name ?? "");
  const [birthDate, setBirthDate] = useState(user?.profile?.birthDate?.slice(0, 10) ?? "");
  const [height, setHeight] = useState(user?.profile?.heightCm?.toString() ?? "");
  const [gender, setGender] = useState<Gender | "">(
    (user?.profile?.gender as Gender) ?? ""
  );
  const [interestedIn, setInterestedIn] = useState<Gender[]>(
    (user?.profile?.interestedIn as Gender[]) ?? []
  );
  const [lookingFor, setLookingFor] = useState<LookingFor[]>(
    user?.profile?.lookingFor ?? []
  );
  const [interests, setInterests] = useState<Interest[]>(
    user?.profile?.interests ?? []
  );
  const [workStatus, setWorkStatus] = useState<WorkStatus | "">(
    user?.profile?.workStatus ?? ""
  );
  const [bio, setBio] = useState(user?.profile?.bio ?? "");
  const [photos, setPhotos] = useState<Photo[]>(() =>
    (user?.profile?.photos ?? []).map((url) => ({ id: id(), url }))
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user?.role === "admin") return <Navigate to="/admin" replace />;
  if (user?.profileComplete && !editing) return <Navigate to="/" replace />;

  function toggle<T>(list: T[], value: T, update: (next: T[]) => void) {
    update(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  }

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
    }
    if (current === 1 && (!gender || !interestedIn.length)) {
      return "Completá género y a quiénes te interesa conocer";
    }
    if (current === 2 && (!lookingFor.length || !interests.length)) {
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
    Array.from(files).slice(0, available).forEach((file) => {
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
          lookingFor,
          interests,
          workStatus: workStatus || undefined,
          bio: bio.trim() || undefined,
          photos: existing.map((photo) => photo.url),
        }),
      });
      for (let index = 0; index < fresh.length; index += MAX_PHOTO_UPLOAD_FILES) {
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
      setError(err instanceof ApiError ? err.message : "No se pudo guardar el perfil");
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
            <p className="onboard-brand">Noc<span>ta</span></p>
            <h2>Armá tu perfil en 5 pasos</h2>
            <ol className="onboard-aside-steps">
              {STEPS.map(([label], index) => (
                <li
                  key={label}
                  className={index === step ? "is-current" : index < step ? "is-done" : ""}
                >
                  <span>{index + 1}</span>{label}
                </li>
              ))}
            </ol>
          </div>
        </aside>
        <main className="onboard-main">
          <div className="onboard-panel fade-in">
            <div className="onboard-progress">
              <span style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
            </div>
            <p className="small text-secondary mb-2">Paso {step + 1} de 5</p>
            <div className="onboard-heading">
              <span className="onboard-heading-icon"><i className={`bi ${icon}`} /></span>
              <div><h1 className="h3 mb-1">{title}</h1><p className="text-secondary mb-0">{subtitle}</p></div>
            </div>

            <div className="onboard-body">
              {step === 0 && (
                <div className="d-grid gap-3">
                  <label>Nombre<input className="form-control mt-2" value={name} onChange={(e) => setName(e.target.value)} /></label>
                  <div className="row g-3">
                    <label className="col-md-6">Fecha de nacimiento<input className="form-control mt-2" type="date" min={dateForAge(MAX_AGE)} max={dateForAge(MIN_AGE)} value={birthDate} onChange={(e) => setBirthDate(e.target.value)} /></label>
                    <label className="col-md-6">Altura (cm)<input className="form-control mt-2" type="number" min="100" max="250" placeholder="Opcional" value={height} onChange={(e) => setHeight(e.target.value)} /></label>
                  </div>
                </div>
              )}
              {step === 1 && (
                <div className="d-grid gap-4">
                  <div><p>Género</p><Chips values={GENDERS} selected={gender ? [gender] : []} labels={GENDER_LABELS} onToggle={setGender} /></div>
                  <div><p>Me interesan</p><Chips values={GENDERS} selected={interestedIn} labels={GENDER_LABELS} onToggle={(value) => toggle(interestedIn, value, setInterestedIn)} /></div>
                </div>
              )}
              {step === 2 && (
                <div className="d-grid gap-4">
                  <div><p>¿Qué estás buscando?</p><Chips values={LOOKING_FOR} selected={lookingFor} labels={LOOKING_FOR_LABELS} onToggle={(value) => toggle(lookingFor, value, setLookingFor)} /></div>
                  <div><p>Gustos</p><Chips values={INTERESTS} selected={interests} labels={INTEREST_LABELS} onToggle={(value) => toggle(interests, value, setInterests)} /></div>
                </div>
              )}
              {step === 3 && (
                <div className="d-grid gap-3">
                  <label>Situación laboral<select className="form-select mt-2" value={workStatus} onChange={(e) => setWorkStatus(e.target.value as WorkStatus | "")}><option value="">Preferir no decir</option>{WORK_STATUS.map((value) => <option key={value} value={value}>{WORK_STATUS_LABELS[value]}</option>)}</select></label>
                  <label>Descripción (opcional)<textarea className="form-control mt-2" rows={4} maxLength={500} value={bio} onChange={(e) => setBio(e.target.value)} /></label>
                </div>
              )}
              {step === 4 && (
                <div className="d-grid gap-3">
                  <input ref={inputRef} className="d-none" type="file" accept={[...ALLOWED_PHOTO_EXTENSIONS, "image/*"].join(",")} multiple onChange={(e) => addPhotos(e.target.files)} />
                  <button type="button" className="onboard-dropzone" onClick={() => inputRef.current?.click()}><i className="bi bi-cloud-arrow-up" /><strong>Subí tus fotos</strong><small>Desde PC o teléfono · máximo 8 MB</small></button>
                  <div className="onboard-photo-grid">
                    {photos.map((photo, index) => <div className="onboard-photo" key={photo.id}><img src={photo.url} alt="" />{index === 0 && <span>Perfil</span>}<div><button type="button" onClick={() => move(index, -1)}>‹</button><button type="button" onClick={() => move(index, 1)}>›</button><button type="button" onClick={() => setPhotos(photos.filter((item) => item.id !== photo.id))}>×</button></div></div>)}
                  </div>
                </div>
              )}
            </div>
            {error && <p className="text-danger small mt-3">{error}</p>}
            <div className="onboard-nav">
              {step > 0 ? <button className="btn btn-outline-light" onClick={() => setStep(step - 1)}>Atrás</button> : <span />}
              {step < 4 ? <button className="btn btn-primary" onClick={next}>Siguiente</button> : <button className="btn btn-primary" disabled={busy} onClick={() => void save()}>{busy ? "Guardando…" : editing ? "Guardar cambios" : "Guardar y Continuar"}</button>}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

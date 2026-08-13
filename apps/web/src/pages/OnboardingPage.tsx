import { FormEvent, useMemo, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import {
  GENDERS,
  GENDER_LABELS,
  INTERESTS,
  INTEREST_LABELS,
  LOOKING_FOR,
  LOOKING_FOR_LABELS,
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

const SAMPLE_PHOTOS = [
  "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=600",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600",
  "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=600",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600",
  "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600",
];

export function OnboardingPage() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const editing = params.get("edit") === "1";

  const [name, setName] = useState(user?.profile?.name ?? "");
  const [birthDate, setBirthDate] = useState(
    user?.profile?.birthDate?.slice(0, 10) ?? "1998-06-15"
  );
  const [heightCm, setHeightCm] = useState(user?.profile?.heightCm?.toString() ?? "");
  const [bio, setBio] = useState(user?.profile?.bio ?? "");
  const [lookingFor, setLookingFor] = useState<LookingFor[]>(
    (user?.profile?.lookingFor as LookingFor[]) ?? []
  );
  const [interests, setInterests] = useState<Interest[]>(
    (user?.profile?.interests as Interest[]) ?? []
  );
  const [workStatus, setWorkStatus] = useState<WorkStatus | "">(
    (user?.profile?.workStatus as WorkStatus) ?? ""
  );
  const [gender, setGender] = useState<Gender | "">(
    (user?.profile?.gender as Gender) ?? ""
  );
  const [interestedIn, setInterestedIn] = useState<string[]>(
    user?.profile?.interestedIn ?? []
  );
  const [photos, setPhotos] = useState<string[]>(
    user?.profile?.photos?.length
      ? user.profile.photos
      : SAMPLE_PHOTOS.slice(0, MIN_PHOTOS)
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const photoOk = useMemo(() => photos.filter(Boolean).length >= MIN_PHOTOS, [photos]);

  if (user?.role === "admin") return <Navigate to="/admin" replace />;
  if (user?.profileComplete && !editing) return <Navigate to="/" replace />;

  function toggleLooking(value: LookingFor) {
    setLookingFor((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  }

  function toggleInterest(value: Interest) {
    setInterests((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  }

  function toggleInterestedIn(value: string) {
    setInterestedIn((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!photoOk) {
      setError(`Necesitás al menos ${MIN_PHOTOS} fotos`);
      return;
    }
    if (!lookingFor.length) {
      setError("Elegí al menos una opción de lo que buscás");
      return;
    }

    setBusy(true);
    try {
      const data = await api<{ user: AuthUser }>("/api/profile", {
        method: "PUT",
        body: JSON.stringify({
          name,
          birthDate,
          heightCm: heightCm ? Number(heightCm) : undefined,
          lookingFor,
          photos: photos.filter(Boolean),
          bio: bio || undefined,
          interests,
          workStatus: workStatus || undefined,
          gender: gender || undefined,
          interestedIn,
        }),
      });
      setUser(data.user);
      navigate(editing ? "/profile" : "/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar el perfil");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-shell">
      <div className="app-frame">
        <div className="app-main" style={{ paddingBottom: "1.5rem" }}>
          <div className="app-screen fade-in" style={{ maxWidth: 640, width: "100%", marginInline: "auto" }}>
      {editing && (
        <button
          type="button"
          className="btn btn-link link-secondary text-decoration-none px-0 mb-2"
          onClick={() => navigate("/profile")}
        >
          <i className="bi bi-arrow-left me-1" aria-hidden="true"></i>
          Volver
        </button>
      )}
      <h1 className="app-title h3 mb-1">{editing ? "Editar perfil" : "Tu perfil"}</h1>
      <p className="text-secondary small mb-3">
        {editing
          ? "Actualizá tus datos. Sigue oculto hasta publicarte."
          : `Oculto hasta publicarte. Mínimo ${MIN_PHOTOS} fotos.`}
      </p>

      <form className="d-grid gap-3" onSubmit={onSubmit}>
        <div>
          <label className="form-label">Nombre</label>
          <input
            className="form-control"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
          />
        </div>

        <div className="row g-3">
          <div className="col-md-6">
            <label className="form-label">Fecha de nacimiento</label>
            <input
              className="form-control"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              required
            />
          </div>
          <div className="col-md-6">
            <label className="form-label">Altura (cm)</label>
            <input
              className="form-control"
              type="number"
              min={100}
              max={250}
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
              placeholder="Opcional"
            />
          </div>
        </div>

        <div>
          <div className="form-label">Género</div>
          <div className="d-flex flex-wrap gap-2">
            {GENDERS.map((item) => (
              <button
                key={item}
                type="button"
                className={`btn btn-sm btn-outline-secondary rounded-pill choice-btn ${
                  gender === item ? "active" : ""
                }`}
                onClick={() => setGender(item)}
              >
                {GENDER_LABELS[item]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="form-label">Me interesan</div>
          <div className="d-flex flex-wrap gap-2">
            {GENDERS.map((item) => (
              <button
                key={item}
                type="button"
                className={`btn btn-sm btn-outline-secondary rounded-pill choice-btn ${
                  interestedIn.includes(item) ? "active" : ""
                }`}
                onClick={() => toggleInterestedIn(item)}
              >
                {GENDER_LABELS[item]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="form-label">¿Qué estás buscando?</div>
          <div className="d-flex flex-wrap gap-2">
            {LOOKING_FOR.map((item) => (
              <button
                key={item}
                type="button"
                className={`btn btn-sm btn-outline-secondary rounded-pill choice-btn ${
                  lookingFor.includes(item) ? "active" : ""
                }`}
                onClick={() => toggleLooking(item)}
              >
                {LOOKING_FOR_LABELS[item]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="form-label">Gustos</div>
          <div className="d-flex flex-wrap gap-2">
            {INTERESTS.map((item) => (
              <button
                key={item}
                type="button"
                className={`btn btn-sm btn-outline-secondary rounded-pill choice-btn ${
                  interests.includes(item) ? "active" : ""
                }`}
                onClick={() => toggleInterest(item)}
              >
                {INTEREST_LABELS[item]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="form-label">Situación laboral</label>
          <select
            className="form-select"
            value={workStatus}
            onChange={(e) => setWorkStatus(e.target.value as WorkStatus | "")}
          >
            <option value="">Preferir no decir</option>
            {WORK_STATUS.map((w) => (
              <option key={w} value={w}>
                {WORK_STATUS_LABELS[w]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="form-label">Descripción (opcional)</label>
          <textarea
            className="form-control"
            rows={3}
            maxLength={500}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Contá algo de vos…"
          />
        </div>

        <div>
          <label className="form-label">Fotos (URLs) — {MIN_PHOTOS} mínimo</label>
          <div className="d-grid gap-2">
            {photos.map((photo, idx) => (
              <input
                key={idx}
                className="form-control"
                value={photo}
                onChange={(e) => {
                  const next = [...photos];
                  next[idx] = e.target.value;
                  setPhotos(next);
                }}
                placeholder={`Foto ${idx + 1}`}
                required={idx < MIN_PHOTOS}
              />
            ))}
            {photos.length < 8 && (
              <button
                type="button"
                className="btn btn-outline-light"
                onClick={() => setPhotos((p) => [...p, ""])}
              >
                <i className="bi bi-plus-lg me-1" aria-hidden="true"></i>
                Agregar foto
              </button>
            )}
          </div>
          <div className="row g-2 mt-2">
            {photos.filter(Boolean).map((src) => (
              <div className="col-6 col-md-3" key={src}>
                <img className="photo-thumb border border-secondary" src={src} alt="" />
              </div>
            ))}
          </div>
        </div>

        {error && <p className="text-danger small mb-0">{error}</p>}
        <div className="d-flex flex-wrap gap-2">
          {editing && (
            <button
              className="btn btn-outline-light"
              type="button"
              onClick={() => navigate("/profile")}
            >
              Cancelar
            </button>
          )}
          <button className="btn btn-primary w-100" type="submit" disabled={busy}>
            {busy ? "Guardando…" : editing ? "Guardar cambios" : "Guardar y continuar"}
          </button>
        </div>
      </form>
          </div>
        </div>
      </div>
    </div>
  );
}

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ALLOWED_PHOTO_EXTENSIONS,
  DEFAULT_URUGUAY_CITY,
  DISPLAY_ADDRESS_HINT,
  MAX_PHOTO_UPLOAD_BYTES,
  URUGUAY_CITIES,
  VENUE_TYPES,
  VENUE_TYPE_LABELS,
  type VenueRequest,
  type VenueType,
} from "@nocta/shared";
import { api, ApiError } from "../lib/api";
import {
  LocationPickerMap,
  type MapCoords,
} from "../components/LocationPickerMap";
import { useToast } from "../components/ToastProvider";

export function VenueRequestPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [mine, setMine] = useState<VenueRequest[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [geoBusy, setGeoBusy] = useState(false);

  const [name, setName] = useState("");
  const [type, setType] = useState<VenueType>("boliche");
  const [city, setCity] = useState<string>(DEFAULT_URUGUAY_CITY.label);
  const [location, setLocation] = useState<MapCoords | null>(null);
  const [geocodedAddress, setGeocodedAddress] = useState("");
  const [displayAddress, setDisplayAddress] = useState("");
  const [description, setDescription] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const cityCenter = useMemo(() => {
    const found = URUGUAY_CITIES.find((c) => c.label === city);
    return found
      ? { lat: found.lat, lng: found.lng }
      : { lat: DEFAULT_URUGUAY_CITY.lat, lng: DEFAULT_URUGUAY_CITY.lng };
  }, [city]);

  async function load() {
    const data = await api<{ requests: VenueRequest[] }>(
      "/api/venues/requests/mine"
    );
    setMine(data.requests);
  }

  useEffect(() => {
    void load().catch(() => setMine([]));
  }, []);

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  useEffect(() => {
    setLocation(null);
    setGeocodedAddress("");
  }, [city]);

  async function reverseFromPin(coords: MapCoords) {
    setLocation(coords);
    setGeoBusy(true);
    setError("");
    try {
      const data = await api<{ address: string }>(
        `/api/venues/geocode/reverse?lat=${coords.lat}&lng=${coords.lng}`
      );
      setGeocodedAddress(data.address);
      if (!displayAddress.trim()) {
        setDisplayAddress(data.address);
      }
    } catch (err) {
      setGeocodedAddress("");
      setError(
        err instanceof ApiError
          ? err.message
          : "No se pudo obtener la dirección del mapa"
      );
    } finally {
      setGeoBusy(false);
    }
  }

  function onPhotoChange(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (file.size > MAX_PHOTO_UPLOAD_BYTES) {
      setError("La foto supera los 8 MB");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("Elegí una imagen válida");
      return;
    }
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setError("");
  }

  function clearPhoto() {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(null);
    setPhotoPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function resetForm() {
    setName("");
    setType("boliche");
    setCity(DEFAULT_URUGUAY_CITY.label);
    setLocation(null);
    setGeocodedAddress("");
    setDisplayAddress("");
    setDescription("");
    setContactEmail("");
    setContactPhone("");
    clearPhoto();
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!location || !geocodedAddress.trim()) {
      setError("Marcá la ubicación del espacio en el mapa");
      return;
    }
    if (displayAddress.trim().length < 5) {
      setError("Completá la dirección para mostrar");
      return;
    }

    setBusy(true);
    try {
      const form = new FormData();
      form.append("name", name.trim());
      form.append("type", type);
      form.append("city", city);
      form.append("address", displayAddress.trim());
      form.append("geocodedAddress", geocodedAddress.trim());
      form.append("location", JSON.stringify(location));
      if (description.trim()) form.append("description", description.trim());
      if (contactEmail.trim()) form.append("contactEmail", contactEmail.trim());
      if (contactPhone.trim()) form.append("contactPhone", contactPhone.trim());
      if (photoFile) form.append("photo", photoFile);

      await api("/api/venues/requests", {
        method: "POST",
        body: form,
      });

      resetForm();
      toast.success(
        "¡Listo! Recibimos tu solicitud. Te avisamos cuando revisemos el espacio."
      );
      navigate("/profile");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo enviar la solicitud"
      );
    } finally {
      setBusy(false);
    }
  }

  const statusLabel: Record<VenueRequest["status"], string> = {
    pending: "Pendiente",
    approved: "Aprobada",
    rejected: "Rechazada",
  };

  return (
    <div className="app-screen venue-request-page fade-in">
      <p className="text-secondary small mb-1">
        <Link to="/profile" className="link-light text-decoration-none">
          ← Perfil
        </Link>
      </p>
      <header className="venue-request-head">
        <h1 className="app-title h3 mb-2">Registrar espacio</h1>
        <p className="venue-request-lead mb-0">
          Contanos de tu lugar y marcá dónde está en el mapa. El equipo de Nocta
          revisa la solicitud y, si todo está bien, publica el Espacio con vos
          como administrador.
        </p>
      </header>

      {error && <p className="text-danger small mt-3 mb-0">{error}</p>}

      <form className="venue-request-form" onSubmit={(e) => void submit(e)}>
        <section className="venue-request-section">
          <h2 className="venue-request-section-title">Datos del espacio</h2>
          <div className="venue-request-grid">
            <label className="venue-request-field">
              <span>Nombre</span>
              <input
                className="form-control"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Club Nocta"
                required
                minLength={2}
                maxLength={120}
              />
            </label>
            <label className="venue-request-field">
              <span>Tipo</span>
              <select
                className="form-select"
                value={type}
                onChange={(e) => setType(e.target.value as VenueType)}
              >
                {VENUE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {VENUE_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="venue-request-field venue-request-field-wide">
              <span>Ciudad</span>
              <select
                className="form-select"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                required
              >
                {URUGUAY_CITIES.map((c) => (
                  <option key={c.id} value={c.label}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="venue-request-section">
          <h2 className="venue-request-section-title">Ubicación</h2>
          <p className="venue-request-section-copy">
            Elegí la ciudad y hacé clic en el mapa donde está tu espacio.
          </p>
          <LocationPickerMap
            center={cityCenter}
            value={location}
            onPick={(coords) => void reverseFromPin(coords)}
          />
          <div className="venue-request-grid mt-3">
            <label className="venue-request-field venue-request-field-wide">
              <span>Dirección detectada</span>
              <input
                className="form-control"
                value={
                  geoBusy
                    ? "Buscando dirección…"
                    : geocodedAddress || "Tocá el mapa para detectar la dirección"
                }
                disabled
                readOnly
              />
            </label>
            <label className="venue-request-field venue-request-field-wide">
              <span>Dirección para mostrar</span>
              <input
                className="form-control"
                value={displayAddress}
                onChange={(e) => setDisplayAddress(e.target.value)}
                placeholder="Av. 18 de Julio 1234, esquina Ejido"
                required
                minLength={5}
                maxLength={200}
              />
              <small className="venue-request-hint">{DISPLAY_ADDRESS_HINT}</small>
            </label>
          </div>
        </section>

        <section className="venue-request-section">
          <h2 className="venue-request-section-title">Más detalles</h2>
          <label className="venue-request-field venue-request-field-wide">
            <span>Descripción (opcional)</span>
            <textarea
              className="form-control"
              rows={4}
              maxLength={1000}
              placeholder="Ambientación, música, horarios, cómo se vive la noche…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>

          <div className="venue-request-photo">
            <span className="venue-request-field-label">Foto (opcional)</span>
            <input
              ref={fileRef}
              className="d-none"
              type="file"
              accept={[...ALLOWED_PHOTO_EXTENSIONS, "image/*"].join(",")}
              onChange={(e) => onPhotoChange(e.target.files)}
            />
            {photoPreview ? (
              <div className="venue-request-photo-preview">
                <img src={photoPreview} alt="Vista previa del espacio" />
                <div className="venue-request-photo-actions">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-light"
                    onClick={() => fileRef.current?.click()}
                  >
                    Cambiar
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-light"
                    onClick={clearPhoto}
                  >
                    Quitar
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="venue-request-photo-upload"
                onClick={() => fileRef.current?.click()}
              >
                <i className="bi bi-image" aria-hidden="true" />
                <strong>Subir foto</strong>
                <small>JPG, PNG o WebP · máx. 8 MB</small>
              </button>
            )}
          </div>
        </section>

        <section className="venue-request-section">
          <h2 className="venue-request-section-title">Contacto (solo para Nocta)</h2>
          <p className="venue-request-section-copy">
            Opcional. No se muestra en el perfil público del Espacio; solo lo usa
            el equipo para coordinar la publicación.
          </p>
          <div className="venue-request-grid">
            <label className="venue-request-field">
              <span>Email</span>
              <input
                className="form-control"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="hola@tuespacio.com"
              />
            </label>
            <label className="venue-request-field">
              <span>Teléfono</span>
              <input
                className="form-control"
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="+598 99 123 456"
                maxLength={40}
              />
            </label>
          </div>
        </section>

        <div className="venue-request-actions">
          <button className="btn btn-primary" type="submit" disabled={busy || geoBusy}>
            {busy ? "Enviando…" : "Enviar solicitud"}
          </button>
        </div>
      </form>

      <section className="venue-request-mine">
        <h2 className="venue-request-section-title">Mis solicitudes</h2>
        {mine.length === 0 ? (
          <p className="text-secondary small mb-0">Todavía no enviaste ninguna.</p>
        ) : (
          <div className="venue-request-mine-list">
            {mine.map((r) => (
              <article key={r.id} className="venue-request-mine-item">
                <div className="min-w-0">
                  <strong>{r.name}</strong>
                  <p className="text-secondary small mb-0">
                    {VENUE_TYPE_LABELS[r.type]} · {statusLabel[r.status]} · {r.city}
                  </p>
                  {r.adminNote && (
                    <p className="small mb-0 mt-1">Nota: {r.adminNote}</p>
                  )}
                </div>
                {r.photos[0] ? (
                  <img src={r.photos[0]} alt="" className="venue-request-mine-thumb" />
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

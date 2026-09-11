import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  DEFAULT_VENUE_COUNTRY,
  DEFAULT_URUGUAY_CITY,
  DISPLAY_ADDRESS_HINT,
  VENUE_TYPES,
  VENUE_TYPE_LABELS,
  type VenueRequest,
  type VenueType,
} from "@nocta/shared";
import { api, ApiError } from "../lib/api";
import { useActiveAppCities } from "../lib/appCities";
import {
  LocationPickerMap,
  type MapCoords,
} from "../components/LocationPickerMap";
import { VenueCountryCityFields } from "../components/VenueFormFields";
import { useToast } from "../components/ToastProvider";
import { VenueClaimForm } from "../components/VenueClaimForm";
import { OptimizedImage } from "../components/OptimizedImage";
import {
  validateVenueEvidenceFiles,
  VenueEvidenceFields,
} from "../components/VenueEvidenceFields";

export function VenueRequestPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [mine, setMine] = useState<VenueRequest[]>([]);
  const [activeTab, setActiveTab] = useState<"create" | "claim">("create");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [geoBusy, setGeoBusy] = useState(false);

  const [name, setName] = useState("");
  const [type, setType] = useState<VenueType>("boliche");
  const [country, setCountry] = useState<string>(DEFAULT_VENUE_COUNTRY);
  const [city, setCity] = useState<string>(DEFAULT_URUGUAY_CITY.label);
  const [location, setLocation] = useState<MapCoords | null>(null);
  const [geocodedAddress, setGeocodedAddress] = useState("");
  const [displayAddress, setDisplayAddress] = useState("");
  const [description, setDescription] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [wantsToManage, setWantsToManage] = useState(false);
  const [managementMessage, setManagementMessage] = useState("");
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const forwardAbortRef = useRef<AbortController | null>(null);
  const automaticDisplayAddressRef = useRef("");
  const { cities: countryCities } = useActiveAppCities(country);

  const cityCenter = useMemo(() => {
    const found = countryCities.find(
      (candidate) => candidate.name.toLowerCase() === city.toLowerCase()
    );
    return found
      ? { lat: found.lat, lng: found.lng }
      : { lat: DEFAULT_URUGUAY_CITY.lat, lng: DEFAULT_URUGUAY_CITY.lng };
  }, [city, countryCities]);

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
    setLocation(null);
    setGeocodedAddress("");
  }, [city]);

  useEffect(() => {
    const address = displayAddress.trim();
    if (
      activeTab !== "create" ||
      address.length < 5 ||
      address === automaticDisplayAddressRef.current
    ) {
      if (address === automaticDisplayAddressRef.current) {
        automaticDisplayAddressRef.current = "";
      }
      return;
    }

    let controller: AbortController | null = null;
    const timer = window.setTimeout(() => {
      controller = new AbortController();
      forwardAbortRef.current = controller;
      setGeoBusy(true);
      setError("");
      const params = new URLSearchParams({ address, city, country });
      void api<{
        address: string;
        location: MapCoords;
      }>(`/api/venues/geocode/search?${params}`, {
        signal: controller.signal,
      })
        .then((data) => {
          if (controller?.signal.aborted) return;
          setLocation(data.location);
          setGeocodedAddress(data.address);
        })
        .catch((err) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          setLocation(null);
          setGeocodedAddress("");
          setError(
            err instanceof ApiError
              ? err.message
              : "No se pudo buscar la dirección en el mapa"
          );
        })
        .finally(() => {
          if (!controller?.signal.aborted) setGeoBusy(false);
        });
    }, 3000);

    return () => {
      window.clearTimeout(timer);
      if (controller) {
        controller.abort();
        setGeoBusy(false);
      }
      if (forwardAbortRef.current === controller) {
        forwardAbortRef.current = null;
      }
    };
  }, [activeTab, city, country, displayAddress]);

  async function reverseFromPin(coords: MapCoords) {
    forwardAbortRef.current?.abort();
    forwardAbortRef.current = null;
    setLocation(coords);
    setGeoBusy(true);
    setError("");
    try {
      const data = await api<{ address: string }>(
        `/api/venues/geocode/reverse?lat=${coords.lat}&lng=${coords.lng}`
      );
      setGeocodedAddress(data.address);
      if (!displayAddress.trim()) {
        automaticDisplayAddressRef.current = data.address;
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

  function resetForm() {
    setName("");
    setType("boliche");
    setCountry(DEFAULT_VENUE_COUNTRY);
    setCity(DEFAULT_URUGUAY_CITY.label);
    setLocation(null);
    setGeocodedAddress("");
    setDisplayAddress("");
    setDescription("");
    setContactEmail("");
    setContactPhone("");
    setWantsToManage(false);
    setManagementMessage("");
    setEvidenceFiles([]);
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
    if (wantsToManage) {
      const evidenceError = validateVenueEvidenceFiles(evidenceFiles);
      if (evidenceError) {
        setError(evidenceError);
        return;
      }
    }

    setBusy(true);
    try {
      const form = new FormData();
      form.append("name", name.trim());
      form.append("type", type);
      form.append("country", country);
      form.append("city", city);
      form.append("address", displayAddress.trim());
      form.append("geocodedAddress", geocodedAddress.trim());
      form.append("location", JSON.stringify(location));
      if (description.trim()) form.append("description", description.trim());
      if (contactEmail.trim()) form.append("contactEmail", contactEmail.trim());
      if (contactPhone.trim()) form.append("contactPhone", contactPhone.trim());
      form.append("wantsToManage", String(wantsToManage));
      if (wantsToManage && managementMessage.trim()) {
        form.append("managementMessage", managementMessage.trim());
      }
      if (wantsToManage) {
        evidenceFiles.forEach((file) => form.append("evidenceFiles", file));
      }

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
        <div
          className="venue-request-tabs"
          role="tablist"
          aria-label="Solicitudes de Espacios"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "create"}
            className={activeTab === "create" ? "is-active" : ""}
            onClick={() => setActiveTab("create")}
          >
            Registrar espacio
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "claim"}
            className={activeTab === "claim" ? "is-active" : ""}
            onClick={() => setActiveTab("claim")}
          >
            Reclamar espacio
          </button>
        </div>
        <p className="venue-request-lead mb-0">
          {activeTab === "create"
            ? "Contanos qué Espacio falta y marcá dónde está en el mapa. La portada la carga el equipo de Nocta al publicar. También podés solicitar ser su Organizador."
            : "Elegí un Espacio existente y acreditá que estás habilitado para administrarlo. El equipo de Nocta revisará la documentación."}
        </p>
      </header>

      {activeTab === "create" ? (
        <>
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
            <VenueCountryCityFields
              country={country}
              city={city}
              onCountryChange={(nextCountry) => {
                setCountry(nextCountry);
              }}
              onCityChange={setCity}
            />
          </div>
        </section>

        <section className="venue-request-section">
          <h2 className="venue-request-section-title">Ubicación</h2>
          <p className="venue-request-section-copy">
            Elegí la ciudad y hacé clic en el mapa donde está tu espacio.
          </p>
          <LocationPickerMap
            center={location ?? cityCenter}
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
                onChange={(e) => {
                  automaticDisplayAddressRef.current = "";
                  setDisplayAddress(e.target.value);
                  setGeocodedAddress("");
                  setLocation(null);
                }}
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

        <section className="venue-request-section">
          <h2 className="venue-request-section-title">Administración</h2>
          <p className="venue-request-section-copy">
            ¿Querés ser Organizador de este Espacio en Nocta?
          </p>
          <div
            className="venue-request-manage-choice"
            role="radiogroup"
            aria-label="Solicitud de administración"
          >
            <button
              type="button"
              role="radio"
              aria-checked={!wantsToManage}
              className={!wantsToManage ? "is-selected" : ""}
              onClick={() => setWantsToManage(false)}
            >
              <i
                className={`bi ${!wantsToManage ? "bi-check-circle-fill" : "bi-circle"}`}
                aria-hidden="true"
              />
              <span>
                <strong>No, solo sugerirlo</strong>
                <small>El Espacio quedará disponible sin Organizador.</small>
              </span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={wantsToManage}
              className={wantsToManage ? "is-selected" : ""}
              onClick={() => setWantsToManage(true)}
            >
              <i
                className={`bi ${wantsToManage ? "bi-check-circle-fill" : "bi-circle"}`}
                aria-hidden="true"
              />
              <span>
                <strong>Sí, quiero administrarlo</strong>
                <small>Deberás acreditar tu vínculo con el Espacio.</small>
              </span>
            </button>
          </div>

          {wantsToManage && (
            <div className="venue-request-evidence-fields fade-in">
              <p className="venue-request-section-copy">
                Los comprobantes son privados y solo puede verlos el equipo de
                Nocta.
              </p>
              <VenueEvidenceFields
                message={managementMessage}
                onMessageChange={setManagementMessage}
                files={evidenceFiles}
                onFilesChange={setEvidenceFiles}
                onError={setError}
              />
            </div>
          )}
        </section>

        <div className="venue-request-actions">
          <button className="btn btn-primary" type="submit" disabled={busy || geoBusy}>
            {busy ? "Enviando…" : "Enviar solicitud"}
          </button>
        </div>
          </form>
        </>
      ) : (
        <VenueClaimForm onSubmitted={load} />
      )}

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
                    {r.requestType === "claim"
                      ? "Reclamación"
                      : r.wantsToManage
                        ? "Alta con administración"
                        : "Sugerencia"}{" "}
                    · {VENUE_TYPE_LABELS[r.type]} ·{" "}
                    {statusLabel[r.status]} ·{" "}
                    {r.country}, {r.city}
                  </p>
                  {r.adminNote && (
                    <p className="small mb-0 mt-1">Nota: {r.adminNote}</p>
                  )}
                </div>
                {r.photos[0] ? (
                  <OptimizedImage
                    src={r.photos[0]}
                    alt=""
                    className="venue-request-mine-thumb"
                    variant="thumb"
                    sizes="64px"
                  />
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

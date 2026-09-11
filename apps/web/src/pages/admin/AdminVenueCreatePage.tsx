import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  DEFAULT_URUGUAY_CITY,
  DEFAULT_VENUE_COUNTRY,
  DISPLAY_ADDRESS_HINT,
  VENUE_TYPES,
  VENUE_TYPE_LABELS,
  type AuthUser,
  type VenueType,
} from "@nocta/shared";
import { api, ApiError } from "../../lib/api";
import { useActiveAppCities } from "../../lib/appCities";
import { useToast } from "../../components/ToastProvider";
import { NoctaLoading } from "../../components/NoctaLoading";
import { ADMIN_PAGE_SIZE } from "../../components/admin/AdminPagination";
import { AdminSearchSelect } from "../../components/admin/AdminSearchSelect";
import {
  LocationPickerMap,
  type MapCoords,
} from "../../components/LocationPickerMap";
import {
  validateVenueCoverFile,
  VenueCountryCityFields,
  VenueCoverField,
} from "../../components/VenueFormFields";

export function AdminVenueCreatePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [users, setUsers] = useState<AuthUser[]>([]);
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
  const [ownerId, setOwnerId] = useState("");
  const [ownerQuery, setOwnerQuery] = useState("");
  const [submittedOwnerQuery, setSubmittedOwnerQuery] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [geoBusy, setGeoBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
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

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({
      page: "1",
      limit: String(ADMIN_PAGE_SIZE),
    });
    if (submittedOwnerQuery) params.set("q", submittedOwnerQuery);
    void api<{ users: AuthUser[] }>(`/api/admin/users?${params}`)
      .then((res) => {
        setUsers(res.users);
        setOwnerId((current) =>
          res.users.some((user) => user.id === current)
            ? current
            : (res.users[0]?.id ?? "")
        );
      })
      .catch((err) =>
        toast.error(err instanceof ApiError ? err.message : "No se pudo cargar")
      )
      .finally(() => setLoading(false));
  }, [submittedOwnerQuery, toast]);

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  useEffect(() => {
    setLocation(null);
    setGeocodedAddress("");
  }, [city]);

  useEffect(() => {
    const address = displayAddress.trim();
    if (
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
  }, [city, country, displayAddress]);

  async function reverseFromPin(coords: MapCoords) {
    setGeoBusy(true);
    setError("");
    try {
      const data = await api<{
        address: string;
        location: MapCoords;
      }>(
        `/api/venues/geocode/reverse?lat=${coords.lat}&lng=${coords.lng}`
      );
      setLocation(data.location);
      setGeocodedAddress(data.address);
      automaticDisplayAddressRef.current = data.address;
      setDisplayAddress(data.address);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "No se pudo detectar la dirección"
      );
    } finally {
      setGeoBusy(false);
    }
  }

  async function onPhotoChange(file: File) {
    const validationError = await validateVenueCoverFile(file);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  function clearPhoto() {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(null);
    setPhotoPreview(null);
  }

  async function createVenue(e: FormEvent) {
    e.preventDefault();
    if (!ownerId) {
      toast.warning("Seleccioná un organizador");
      return;
    }
    if (!location) {
      toast.warning("Marcá la ubicación en el mapa");
      return;
    }
    if (!photoFile) {
      toast.warning("Agregá la imagen del Espacio");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("name", name.trim());
      form.append("type", type);
      form.append("address", displayAddress.trim());
      form.append("country", country);
      form.append("city", city);
      form.append("ownerId", ownerId);
      form.append("location", JSON.stringify(location));
      if (description.trim()) form.append("description", description.trim());
      if (contactEmail.trim()) form.append("contactEmail", contactEmail.trim());
      if (contactPhone.trim()) form.append("contactPhone", contactPhone.trim());
      form.append("photo", photoFile);

      await api("/api/venues", {
        method: "POST",
        body: form,
      });
      toast.success(`${name} creado`);
      navigate("/admin/venues");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "No se pudo crear";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-page admin-venue-create-form">
      <header className="admin-page-head">
        <div>
          <Link className="admin-venue-review-back" to="/admin/venues">
            <i className="bi bi-arrow-left" aria-hidden="true" />
            <span>Espacios</span>
          </Link>
          <p className="admin-page-eyebrow">Administración</p>
          <h1 className="app-title h3 mb-1">Alta de espacio</h1>
          <p className="text-secondary small mb-0">
            Completá los mismos datos que una recomendación y creá el Espacio
            directamente con su organizador.
          </p>
        </div>
      </header>

      {loading && users.length === 0 && !submittedOwnerQuery ? (
        <NoctaLoading variant="block" />
      ) : (
        <>
          {error && <p className="text-danger small mb-0">{error}</p>}
          <form className="venue-request-form" onSubmit={(e) => void createVenue(e)}>
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
                <div className="venue-request-field venue-request-field-wide">
                  <AdminSearchSelect
                    label="Organizador del espacio"
                    value={ownerId}
                    options={users.map((candidate) => ({
                      value: candidate.id,
                      label: candidate.profile?.name ?? candidate.email,
                      meta: candidate.profile?.name
                        ? candidate.email
                        : undefined,
                    }))}
                    query={ownerQuery}
                    placeholder="Seleccionar organizador"
                    searchPlaceholder="Buscar por nombre o email…"
                    emptyMessage="No se encontraron usuarios."
                    loading={loading}
                    onChange={setOwnerId}
                    onQueryChange={setOwnerQuery}
                    onSearch={setSubmittedOwnerQuery}
                  />
                </div>
              </div>
            </section>

            <section className="venue-request-section">
              <h2 className="venue-request-section-title">Ubicación</h2>
              <p className="venue-request-section-copy">
                Elegí la ciudad y hacé clic en el mapa donde está el espacio.
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
                        : geocodedAddress ||
                          "Tocá el mapa para detectar la dirección"
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
                  <small className="venue-request-hint">
                    {DISPLAY_ADDRESS_HINT}
                  </small>
                </label>
                <VenueCoverField
                  previewSrc={photoPreview}
                  required
                  onFileSelected={onPhotoChange}
                  onClear={clearPhoto}
                />
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
              <h2 className="venue-request-section-title">
                Contacto (solo para Nocta)
              </h2>
              <p className="venue-request-section-copy">
                Opcional. No se muestra en el perfil público del Espacio.
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
                  />
                </label>
              </div>
            </section>

            <div className="admin-form-actions">
              <Link className="btn btn-outline-light" to="/admin/venues">
                <i className="bi bi-x-lg" aria-hidden="true" />
                <span>Cancelar</span>
              </Link>
              <button className="btn btn-primary" type="submit" disabled={busy}>
                <i className="bi bi-plus-lg" aria-hidden="true" />
                <span>{busy ? "Creando…" : "Crear espacio"}</span>
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}

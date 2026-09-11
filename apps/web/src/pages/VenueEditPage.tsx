import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  DEFAULT_VENUE_COUNTRY,
  DEFAULT_URUGUAY_CITY,
  DISPLAY_ADDRESS_HINT,
  VENUE_TYPES,
  VENUE_TYPE_LABELS,
  type Venue,
  type VenueType,
} from "@nocta/shared";
import { LocationPickerMap, type MapCoords } from "../components/LocationPickerMap";
import { NoctaLoading } from "../components/NoctaLoading";
import {
  validateVenueCoverFile,
  VenueCountryCityFields,
  VenueCoverField,
} from "../components/VenueFormFields";
import { useToast } from "../components/ToastProvider";
import { api, ApiError } from "../lib/api";
import { useActiveAppCities } from "../lib/appCities";
import { venueCoverSrc } from "../lib/venuePhoto";

export function VenueEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [venue, setVenue] = useState<Venue | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [geoBusy, setGeoBusy] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [type, setType] = useState<VenueType>("boliche");
  const [country, setCountry] = useState<string>(DEFAULT_VENUE_COUNTRY);
  const [city, setCity] = useState<string>(DEFAULT_URUGUAY_CITY.label);
  const [location, setLocation] = useState<MapCoords | null>(null);
  const [geocodedAddress, setGeocodedAddress] = useState("");
  const [displayAddress, setDisplayAddress] = useState("");
  const [description, setDescription] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const { cities: countryCities } = useActiveAppCities(country);

  useEffect(() => {
    let alive = true;
    void api<{ venue: Venue }>(`/api/venues/${id}/manage`)
      .then(({ venue: loaded }) => {
        if (!alive) return;
        const nextCountry = loaded.country || DEFAULT_VENUE_COUNTRY;
        setVenue(loaded);
        setName(loaded.name);
        setType(loaded.type);
        setCountry(nextCountry);
        setCity(loaded.city || DEFAULT_URUGUAY_CITY.label);
        setLocation(loaded.location ?? null);
        setGeocodedAddress(loaded.address);
        setDisplayAddress(loaded.address);
        setDescription(loaded.description ?? "");
      })
      .catch((caught) => {
        if (!alive) return;
        const message =
          caught instanceof ApiError
            ? caught.message
            : "No se pudo cargar el Espacio";
        setError(message);
        if (caught instanceof ApiError && caught.status === 403) {
          toast.error("No tenés permiso para editar este Espacio");
          navigate("/profile", { replace: true });
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [id, navigate, toast]);

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  const cityCenter = useMemo(() => {
    const found = countryCities.find(
      (candidate) => candidate.name.toLowerCase() === city.toLowerCase()
    );
    return found
      ? { lat: found.lat, lng: found.lng }
      : { lat: DEFAULT_URUGUAY_CITY.lat, lng: DEFAULT_URUGUAY_CITY.lng };
  }, [city, countryCities]);

  async function reverseFromPin(coords: MapCoords) {
    setLocation(coords);
    setGeoBusy(true);
    setError("");
    try {
      const data = await api<{ address: string }>(
        `/api/venues/geocode/reverse?lat=${coords.lat}&lng=${coords.lng}`
      );
      setGeocodedAddress(data.address);
      if (!displayAddress.trim()) setDisplayAddress(data.address);
    } catch (caught) {
      setGeocodedAddress("");
      setError(
        caught instanceof ApiError
          ? caught.message
          : "No se pudo obtener la dirección del mapa"
      );
    } finally {
      setGeoBusy(false);
    }
  }

  function changeCountry(nextCountry: string) {
    setCountry(nextCountry);
    setLocation(null);
    setGeocodedAddress("");
  }

  function changeCity(nextCity: string) {
    setCity(nextCity);
    setLocation(null);
    setGeocodedAddress("");
  }

  async function changePhoto(file: File) {
    const validationError = await validateVenueCoverFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setError("");
  }

  function restorePhoto() {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(null);
    setPhotoPreview(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!id || !location) {
      setError("Marcá la ubicación del Espacio en el mapa");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("name", name.trim());
      form.append("type", type);
      form.append("country", country);
      form.append("city", city);
      form.append("address", displayAddress.trim());
      form.append("description", description.trim());
      form.append("location", JSON.stringify(location));
      if (photoFile) form.append("photo", photoFile);

      await api<{ venue: Venue }>(`/api/venues/${id}/manage`, {
        method: "PATCH",
        body: form,
      });
      toast.success("Información del Espacio actualizada");
      navigate(`/venues/${id}/manage`);
    } catch (caught) {
      const message =
        caught instanceof ApiError
          ? caught.message
          : "No se pudo actualizar el Espacio";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <NoctaLoading />;
  if (!venue) {
    return (
      <div className="app-screen venue-request-page fade-in">
        <p className="text-danger">{error || "Espacio no encontrado"}</p>
        <Link className="btn btn-outline-light align-self-start" to="/profile">
          Volver al perfil
        </Link>
      </div>
    );
  }

  return (
    <div className="app-screen venue-request-page fade-in">
      <p className="text-secondary small mb-1">
        <Link
          to={`/venues/${venue.id}/manage`}
          className="link-light text-decoration-none"
        >
          ← Administrar Espacio
        </Link>
      </p>
      <header className="venue-request-head">
        <h1 className="app-title h3 mb-2">Editar información</h1>
        <p className="venue-request-lead mb-0">
          Actualizá los datos que se muestran en la ficha pública del Espacio.
        </p>
      </header>

      {error && <p className="text-danger small mt-3 mb-0">{error}</p>}

      <form className="venue-request-form" onSubmit={(event) => void submit(event)}>
        <section className="venue-request-section">
          <h2 className="venue-request-section-title">Datos del Espacio</h2>
          <div className="venue-request-grid">
            <label className="venue-request-field">
              <span>Nombre</span>
              <input
                className="form-control"
                value={name}
                onChange={(event) => setName(event.target.value)}
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
                onChange={(event) => setType(event.target.value as VenueType)}
              >
                {VENUE_TYPES.map((venueType) => (
                  <option key={venueType} value={venueType}>
                    {VENUE_TYPE_LABELS[venueType]}
                  </option>
                ))}
              </select>
            </label>
            <VenueCountryCityFields
              country={country}
              city={city}
              onCountryChange={changeCountry}
              onCityChange={changeCity}
              preserveCity={venue?.city}
            />
          </div>
        </section>

        <section className="venue-request-section">
          <h2 className="venue-request-section-title">Ubicación</h2>
          <p className="venue-request-section-copy">
            Si cambiás el país o la ciudad, volvé a marcar el punto en el mapa.
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
                onChange={(event) => setDisplayAddress(event.target.value)}
                required
                minLength={5}
                maxLength={200}
              />
              <small className="venue-request-hint">{DISPLAY_ADDRESS_HINT}</small>
            </label>
            <VenueCoverField
              previewSrc={photoPreview ?? venueCoverSrc(venue)}
              required={false}
              hasNewFile={Boolean(photoFile)}
              onFileSelected={changePhoto}
              onClear={restorePhoto}
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
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Ambientación, música, horarios, cómo se vive la noche…"
            />
          </label>
        </section>

        <div className="venue-request-actions gap-2">
          <button
            className="btn btn-primary"
            type="submit"
            disabled={busy || geoBusy}
          >
            {busy ? "Guardando…" : "Guardar cambios"}
          </button>
          <Link className="btn btn-outline-light" to={`/venues/${venue.id}/manage`}>
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}

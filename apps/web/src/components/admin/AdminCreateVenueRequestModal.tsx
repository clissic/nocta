import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_URUGUAY_CITY,
  DEFAULT_VENUE_COUNTRY,
  DISPLAY_ADDRESS_HINT,
  VENUE_REQUEST_REJECT_REASON_LABELS,
  VENUE_REQUEST_REJECT_REASONS,
  VENUE_TYPES,
  VENUE_TYPE_LABELS,
  type VenueRequest,
  type VenueRequestRejectReason,
  type VenueType,
} from "@nocta/shared";
import { api, ApiError, downloadApiFile } from "../../lib/api";
import { useActiveAppCities } from "../../lib/appCities";
import { OverflowFade } from "../OverflowFade";
import { useToast } from "../ToastProvider";
import {
  LocationPickerMap,
  type MapCoords,
} from "../LocationPickerMap";
import {
  validateVenueCoverFile,
  VenueCountryCityFields,
  VenueCoverField,
} from "../VenueFormFields";

type Step = "choose" | "approve" | "reject";

type Props = {
  request: VenueRequest;
  onClose: () => void;
  onResolved: () => void;
};

export function AdminCreateVenueRequestModal({
  request,
  onClose,
  onResolved,
}: Props) {
  const toast = useToast();
  const [step, setStep] = useState<Step>("choose");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [geoBusy, setGeoBusy] = useState(false);

  const [name, setName] = useState(request.name);
  const [type, setType] = useState<VenueType>(request.type);
  const [country, setCountry] = useState(request.country || DEFAULT_VENUE_COUNTRY);
  const [city, setCity] = useState(request.city || DEFAULT_URUGUAY_CITY.label);
  const [location, setLocation] = useState<MapCoords | null>(
    request.location ?? null
  );
  const [geocodedAddress, setGeocodedAddress] = useState(
    request.geocodedAddress ?? ""
  );
  const [displayAddress, setDisplayAddress] = useState(request.address);
  const [description, setDescription] = useState(request.description ?? "");
  const [contactEmail, setContactEmail] = useState(request.contactEmail ?? "");
  const [contactPhone, setContactPhone] = useState(request.contactPhone ?? "");
  const [adminNote, setAdminNote] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [rejectReason, setRejectReason] = useState<VenueRequestRejectReason>(
    "incomplete_data"
  );
  const [rejectNote, setRejectNote] = useState("");

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
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  useEffect(() => {
    if (step !== "approve") return;
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
      void api<{ address: string; location: MapCoords }>(
        `/api/venues/geocode/search?${params}`,
        { signal: controller.signal }
      )
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
  }, [step, city, country, displayAddress]);

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

  async function onPhotoChange(file: File) {
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

  function clearPhoto() {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(null);
    setPhotoPreview(null);
  }

  async function downloadEvidence(file: VenueRequest["evidenceFiles"][number]) {
    try {
      const blob = await downloadApiFile(
        `/api/admin/venue-requests/${request.id}/evidence/${file.id}`
      );
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.originalName;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success("Comprobante descargado");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo descargar"
      );
    }
  }

  async function submitApprove(e: FormEvent) {
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
    if (!photoFile) {
      setError("Subí una imagen de portada (JPEG, PNG o WebP)");
      return;
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
      if (adminNote.trim()) form.append("adminNote", adminNote.trim());
      form.append("photo", photoFile);

      await api(`/api/admin/venue-requests/${request.id}/approve`, {
        method: "POST",
        body: form,
      });
      toast.success("Alta aprobada y Espacio publicado");
      onResolved();
      onClose();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "No se pudo aprobar";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function submitReject(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (rejectReason === "other" && !rejectNote.trim()) {
      setError("Agregá una explicación para el motivo «Otro»");
      return;
    }
    setBusy(true);
    try {
      await api(`/api/admin/venue-requests/${request.id}/reject`, {
        method: "POST",
        body: JSON.stringify({
          reason: rejectReason,
          adminNote: rejectNote.trim() || undefined,
        }),
      });
      toast.success("Solicitud rechazada");
      onResolved();
      onClose();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "No se pudo rechazar";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  const kindLabel = request.wantsToManage
    ? "Alta con administración"
    : "Sugerencia";

  return (
    <div className="admin-modal" role="presentation">
      <button
        type="button"
        className="admin-modal-backdrop"
        aria-label="Cerrar"
        onClick={onClose}
      />
      <div
        className="admin-modal-dialog admin-create-request-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-create-request-title"
      >
        <header className="admin-modal-head">
          <div className="admin-modal-title-row">
            <div>
              <p className="admin-page-eyebrow mb-1">{kindLabel}</p>
              <h2 id="admin-create-request-title" className="h5 mb-0">
                {request.name}
              </h2>
            </div>
            <button
              type="button"
              className="admin-modal-close"
              aria-label="Cerrar"
              onClick={onClose}
            >
              <i className="bi bi-x-lg" aria-hidden="true" />
            </button>
          </div>
        </header>

        <OverflowFade className="admin-modal-body">
          {error && <p className="text-danger small">{error}</p>}

          {step === "choose" && (
            <section className="admin-modal-section">
              <p className="text-secondary small mb-3">
                {VENUE_TYPE_LABELS[request.type]} · {request.address},{" "}
                {request.city}, {request.country}
              </p>
              {request.requester && (
                <p className="text-secondary small mb-3">
                  Solicitante:{" "}
                  {request.requester.name
                    ? `${request.requester.name} · ${request.requester.email}`
                    : request.requester.email}
                </p>
              )}
              {request.description && (
                <p className="mb-3">{request.description}</p>
              )}
              {request.wantsToManage && request.evidenceFiles.length > 0 && (
                <div className="admin-evidence-list mb-3">
                  {request.evidenceFiles.map((file) => (
                    <button
                      key={file.id}
                      type="button"
                      className="btn btn-sm btn-outline-light"
                      onClick={() => void downloadEvidence(file)}
                    >
                      <i className="bi bi-download" aria-hidden="true" />
                      <span>{file.originalName}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="d-flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setError("");
                    setStep("approve");
                  }}
                >
                  Aceptar
                </button>
                <button
                  type="button"
                  className="btn btn-outline-danger"
                  onClick={() => {
                    setError("");
                    setStep("reject");
                  }}
                >
                  Rechazar
                </button>
              </div>
            </section>
          )}

          {step === "approve" && (
            <form
              className="venue-request-form"
              onSubmit={(e) => void submitApprove(e)}
            >
              <section className="venue-request-section">
                <h3 className="venue-request-section-title">Publicar Espacio</h3>
                <p className="venue-request-section-copy">
                  Revisá o editá los datos y subí la portada obligatoria.
                </p>
                <div className="venue-request-grid">
                  <label className="venue-request-field">
                    <span>Nombre</span>
                    <input
                      className="form-control"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
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
                      {VENUE_TYPES.map((value) => (
                        <option key={value} value={value}>
                          {VENUE_TYPE_LABELS[value]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <VenueCountryCityFields
                    country={country}
                    city={city}
                    onCountryChange={(next) => {
                      setCountry(next);
                      setLocation(null);
                      setGeocodedAddress("");
                    }}
                    onCityChange={(next) => {
                      setCity(next);
                      setLocation(null);
                      setGeocodedAddress("");
                    }}
                  />
                </div>
              </section>

              <section className="venue-request-section">
                <h3 className="venue-request-section-title">Ubicación</h3>
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
                    onFileSelected={(file) => void onPhotoChange(file)}
                    onClear={clearPhoto}
                  />
                </div>
              </section>

              <section className="venue-request-section">
                <h3 className="venue-request-section-title">Más detalles</h3>
                <label className="venue-request-field venue-request-field-wide">
                  <span>Descripción (opcional)</span>
                  <textarea
                    className="form-control"
                    rows={3}
                    maxLength={1000}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </label>
                <div className="venue-request-grid">
                  <label className="venue-request-field">
                    <span>Email de contacto</span>
                    <input
                      className="form-control"
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                    />
                  </label>
                  <label className="venue-request-field">
                    <span>Teléfono</span>
                    <input
                      className="form-control"
                      type="tel"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      maxLength={40}
                    />
                  </label>
                </div>
                <label className="venue-request-field venue-request-field-wide">
                  <span>Nota interna (opcional)</span>
                  <textarea
                    className="form-control"
                    rows={2}
                    maxLength={500}
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                  />
                </label>
              </section>

              <div className="d-flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-outline-light"
                  disabled={busy}
                  onClick={() => setStep("choose")}
                >
                  Volver
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={busy || geoBusy}
                >
                  {busy ? "Publicando…" : "Confirmar y publicar"}
                </button>
              </div>
            </form>
          )}

          {step === "reject" && (
            <form onSubmit={(e) => void submitReject(e)}>
              <section className="admin-modal-section">
                <h3 className="h6 mb-3">Rechazar solicitud</h3>
                <label className="admin-modal-field d-block mb-3">
                  <span className="d-block small text-secondary mb-1">
                    Motivo
                  </span>
                  <select
                    className="form-select"
                    value={rejectReason}
                    onChange={(e) =>
                      setRejectReason(
                        e.target.value as VenueRequestRejectReason
                      )
                    }
                    required
                  >
                    {VENUE_REQUEST_REJECT_REASONS.map((value) => (
                      <option key={value} value={value}>
                        {VENUE_REQUEST_REJECT_REASON_LABELS[value]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="admin-modal-field d-block mb-3">
                  <span className="d-block small text-secondary mb-1">
                    Explicación
                    {rejectReason === "other" ? " (obligatoria)" : " (opcional)"}
                  </span>
                  <textarea
                    className="form-control"
                    rows={4}
                    maxLength={500}
                    value={rejectNote}
                    onChange={(e) => setRejectNote(e.target.value)}
                    required={rejectReason === "other"}
                  />
                </label>
                <div className="d-flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-outline-light"
                    disabled={busy}
                    onClick={() => setStep("choose")}
                  >
                    Volver
                  </button>
                  <button
                    type="submit"
                    className="btn btn-danger"
                    disabled={busy}
                  >
                    {busy ? "Rechazando…" : "Confirmar rechazo"}
                  </button>
                </div>
              </section>
            </form>
          )}
        </OverflowFade>
      </div>
    </div>
  );
}

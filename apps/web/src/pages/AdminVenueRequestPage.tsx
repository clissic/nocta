import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import {
  VENUE_REQUEST_REJECT_REASON_LABELS,
  VENUE_REQUEST_REJECT_REASONS,
  VENUE_TYPE_LABELS,
  type Venue,
  type VenueRequest,
  type VenueRequestRejectReason,
} from "@nocta/shared";
import { VenueMap } from "../components/VenueMap";
import { api, ApiError, downloadApiFile } from "../lib/api";
import { NoctaLoading } from "../components/NoctaLoading";
import { useToast } from "../components/ToastProvider";
import { VENUE_PHOTO_FALLBACK, venueCoverSrc } from "../lib/venuePhoto";
import { OptimizedImage } from "../components/OptimizedImage";

const STATUS_LABEL: Record<VenueRequest["status"], string> = {
  pending: "Pendiente",
  approved: "Aprobada",
  rejected: "Rechazada",
};

export function AdminVenueRequestPage() {
  const toast = useToast();
  const { id } = useParams();
  const [request, setRequest] = useState<VenueRequest | null>(null);
  const [targetVenue, setTargetVenue] = useState<Venue | null>(null);
  const [note, setNote] = useState("");
  const [rejectReason, setRejectReason] =
    useState<VenueRequestRejectReason>("incomplete_data");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [createdVenue, setCreatedVenue] = useState<Venue | null>(null);

  useEffect(() => {
    if (!id) return;
    void api<{ request: VenueRequest; venue?: Venue }>(
      `/api/admin/venue-requests/${id}`
    )
      .then(({ request: next, venue }) => {
        setRequest(next);
        setTargetVenue(venue ?? null);
        setNote(next.adminNote ?? "");
      })
      .catch((err) =>
        setError(
          err instanceof ApiError ? err.message : "No se pudo cargar la solicitud"
        )
      )
      .finally(() => setLoading(false));
  }, [id]);

  async function approveClaim() {
    if (!request) return;
    setBusy(true);
    setError("");
    try {
      const response = await api<{
        request: VenueRequest;
        venue?: Venue;
      }>(`/api/admin/venue-requests/${request.id}/approve`, {
        method: "POST",
        body: JSON.stringify({ adminNote: note.trim() || undefined }),
      });
      setRequest(response.request);
      setCreatedVenue(response.venue ?? null);
      toast.success("Reclamación aprobada");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "No se pudo revisar la solicitud"
      );
    } finally {
      setBusy(false);
    }
  }

  async function rejectClaim() {
    if (!request) return;
    if (rejectReason === "other" && !note.trim()) {
      setError("Agregá una explicación para el motivo «Otro»");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await api<{ request: VenueRequest }>(
        `/api/admin/venue-requests/${request.id}/reject`,
        {
          method: "POST",
          body: JSON.stringify({
            reason: rejectReason,
            adminNote: note.trim() || undefined,
          }),
        }
      );
      setRequest(response.request);
      toast.success("Reclamación rechazada");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "No se pudo revisar la solicitud"
      );
    } finally {
      setBusy(false);
    }
  }

  async function downloadEvidence(file: VenueRequest["evidenceFiles"][number]) {
    if (!request) return;
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

  if (loading) {
    return (
      <div className="admin-review-state admin-review-state-loading">
        <NoctaLoading variant="block" />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="admin-review-state">
        <h1 className="app-title h3">Solicitud no disponible</h1>
        <p className="text-secondary">{error || "No encontramos esta solicitud."}</p>
        <Link className="btn btn-outline-light" to="/admin/requests">
          <i className="bi bi-arrow-left" aria-hidden="true" />
          <span>Volver a solicitudes</span>
        </Link>
      </div>
    );
  }

  const isClaim = request.requestType === "claim";
  if (!isClaim && request.status === "pending") {
    return <Navigate to="/admin/requests" replace />;
  }

  const requestsManagement = isClaim || request.wantsToManage;
  const reviewVenue = targetVenue ?? createdVenue;

  return (
    <div className="admin-venue-review fade-in">
      <header className="admin-venue-review-head">
        <div>
          <Link className="admin-venue-review-back" to="/admin/requests">
            <i className="bi bi-arrow-left" aria-hidden="true" />
            <span>Solicitudes</span>
          </Link>
          <p className="admin-venue-review-eyebrow">
            {isClaim
              ? "Reclamación de Espacio"
              : requestsManagement
                ? "Alta con administración"
                : "Sugerencia de Espacio"}
          </p>
          <h1 className="app-title display-6 mb-2">{request.name}</h1>
          <p className="text-secondary mb-0">
            {VENUE_TYPE_LABELS[request.type]} · {request.country}, {request.city}
          </p>
        </div>
        <span className={`admin-review-status is-${request.status}`}>
          {STATUS_LABEL[request.status]}
        </span>
      </header>

      {error && <p className="text-danger small mb-0">{error}</p>}

      <div className="admin-venue-review-layout">
        <div className="admin-venue-review-media">
          {request.photos[0] || reviewVenue ? (
            <OptimizedImage
              src={
                request.photos[0] ||
                (reviewVenue ? venueCoverSrc(reviewVenue) : "")
              }
              alt={request.name}
              variant="large"
              sizes="(min-width: 768px) 42vw, 100vw"
              fallbackSrc={VENUE_PHOTO_FALLBACK}
            />
          ) : (
            <div className="admin-venue-review-media-empty">Sin foto</div>
          )}
          {request.location && (
            <VenueMap
              name={request.name}
              address={request.address}
              city={request.city}
              country={request.country}
              location={request.location}
            />
          )}
        </div>

        <div className="admin-venue-review-info">
          <section>
            <h2 className="admin-review-label">Ubicación</h2>
            <strong>{request.address}</strong>
            <p className="text-secondary small mb-0">
              {request.country}, {request.city}
            </p>
            {request.geocodedAddress && (
              <p className="admin-review-detected mb-0">
                Detectada: {request.geocodedAddress}
              </p>
            )}
          </section>

          {request.description && (
            <section>
              <h2 className="admin-review-label">
                {isClaim && !request.managementMessage
                  ? "Información aportada"
                  : "Descripción"}
              </h2>
              <p className="mb-0">{request.description}</p>
            </section>
          )}

          {request.managementMessage && (
            <section>
              <h2 className="admin-review-label">
                Información de administración
              </h2>
              <p className="mb-0">{request.managementMessage}</p>
            </section>
          )}

          {requestsManagement && (
            <section>
              <h2 className="admin-review-label">Comprobantes privados</h2>
              <div className="admin-evidence-list">
                {request.evidenceFiles.map((file) => (
                  <button
                    key={file.id}
                    type="button"
                    className="btn btn-sm btn-outline-light"
                    onClick={() => void downloadEvidence(file)}
                  >
                    <i
                      className={`bi ${
                        file.mimeType === "application/pdf"
                          ? "bi-file-earmark-pdf"
                          : "bi-file-earmark-image"
                      }`}
                      aria-hidden="true"
                    />
                    <span>{file.originalName}</span>
                    <small>{Math.ceil(file.size / 1024)} KB</small>
                  </button>
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="admin-review-label">Solicitante</h2>
            <p className="mb-0">
              {request.requester?.name || "Usuario Nocta"}
              <span className="text-secondary">
                {" "}
                · {request.requester?.email ?? request.requesterId}
              </span>
            </p>
          </section>

          {(request.contactEmail || request.contactPhone) && (
            <section>
              <h2 className="admin-review-label">Contacto privado</h2>
              <p className="mb-0">
                {[request.contactEmail, request.contactPhone]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </section>
          )}

          {request.status === "pending" && isClaim ? (
            <>
              <section>
                <label className="admin-review-label" htmlFor="reject-reason">
                  Motivo de rechazo
                </label>
                <select
                  id="reject-reason"
                  className="form-select mt-2"
                  value={rejectReason}
                  onChange={(e) =>
                    setRejectReason(e.target.value as VenueRequestRejectReason)
                  }
                >
                  {VENUE_REQUEST_REJECT_REASONS.map((value) => (
                    <option key={value} value={value}>
                      {VENUE_REQUEST_REJECT_REASON_LABELS[value]}
                    </option>
                  ))}
                </select>
              </section>
              <section>
                <label className="admin-review-label" htmlFor="admin-note">
                  Nota / explicación
                  {rejectReason === "other" ? " (obligatoria al rechazar)" : ""}
                </label>
                <textarea
                  id="admin-note"
                  className="form-control mt-2"
                  rows={3}
                  maxLength={500}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Opcional al aprobar; al rechazar con «Otro» es obligatoria"
                />
              </section>
              <div className="admin-venue-review-actions">
                <button
                  className="btn btn-primary"
                  type="button"
                  disabled={busy}
                  onClick={() => void approveClaim()}
                >
                  <i className="bi bi-check-lg" aria-hidden="true" />
                  <span>
                    {busy ? "Procesando…" : "Autorizar administración"}
                  </span>
                </button>
                <button
                  className="btn btn-outline-light"
                  type="button"
                  disabled={busy}
                  onClick={() => void rejectClaim()}
                >
                  <i className="bi bi-x-lg" aria-hidden="true" />
                  <span>Rechazar</span>
                </button>
              </div>
            </>
          ) : (
            <div className="admin-review-result">
              Esta solicitud ya fue{" "}
              {request.status === "approved" ? "aprobada" : "rechazada"}.
              {request.adminNote && (
                <p className="small mt-2 mb-0">Nota: {request.adminNote}</p>
              )}
              {createdVenue && (
                <Link to={`/venues/${createdVenue.id}`}> Ver Espacio</Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

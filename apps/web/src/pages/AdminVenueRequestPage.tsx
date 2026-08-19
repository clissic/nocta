import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  VENUE_TYPE_LABELS,
  type Venue,
  type VenueRequest,
} from "@nocta/shared";
import { VenueMap } from "../components/VenueMap";
import { api, ApiError } from "../lib/api";
import { NoctaLoading } from "../components/NoctaLoading";

const STATUS_LABEL: Record<VenueRequest["status"], string> = {
  pending: "Pendiente",
  approved: "Aprobada",
  rejected: "Rechazada",
};

export function AdminVenueRequestPage() {
  const { id } = useParams();
  const [request, setRequest] = useState<VenueRequest | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [createdVenue, setCreatedVenue] = useState<Venue | null>(null);

  useEffect(() => {
    if (!id) return;
    void api<{ request: VenueRequest }>(`/api/admin/venue-requests/${id}`)
      .then(({ request: next }) => {
        setRequest(next);
        setNote(next.adminNote ?? "");
      })
      .catch((err) =>
        setError(
          err instanceof ApiError ? err.message : "No se pudo cargar la solicitud"
        )
      )
      .finally(() => setLoading(false));
  }, [id]);

  async function review(action: "approve" | "reject") {
    if (!request) return;
    setBusy(true);
    setError("");
    try {
      const response = await api<{
        request: VenueRequest;
        venue?: Venue;
      }>(`/api/admin/venue-requests/${request.id}/${action}`, {
        method: "POST",
        body: JSON.stringify({ adminNote: note.trim() || undefined }),
      });
      setRequest(response.request);
      setCreatedVenue(response.venue ?? null);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "No se pudo revisar la solicitud"
      );
    } finally {
      setBusy(false);
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

  return (
    <div className="admin-venue-review fade-in">
      <header className="admin-venue-review-head">
        <div>
          <Link className="admin-venue-review-back" to="/admin/requests">
            <i className="bi bi-arrow-left" aria-hidden="true" />
            <span>Solicitudes</span>
          </Link>
          <p className="admin-venue-review-eyebrow">Revisión de Espacio</p>
          <h1 className="app-title display-6 mb-2">{request.name}</h1>
          <p className="text-secondary mb-0">
            {VENUE_TYPE_LABELS[request.type]} · {request.city}
          </p>
        </div>
        <span className={`admin-review-status is-${request.status}`}>
          {STATUS_LABEL[request.status]}
        </span>
      </header>

      {error && <p className="text-danger small mb-0">{error}</p>}

      <div className="admin-venue-review-layout">
        <div className="admin-venue-review-media">
          {request.photos[0] ? (
            <img src={request.photos[0]} alt={request.name} />
          ) : (
            <div className="admin-venue-review-media-empty">Sin foto</div>
          )}
          {request.location && (
            <VenueMap
              name={request.name}
              address={request.address}
              city={request.city}
              location={request.location}
            />
          )}
        </div>

        <div className="admin-venue-review-info">
          <section>
            <h2 className="admin-review-label">Ubicación</h2>
            <strong>{request.address}</strong>
            <p className="text-secondary small mb-0">{request.city}</p>
            {request.geocodedAddress && (
              <p className="admin-review-detected mb-0">
                Detectada: {request.geocodedAddress}
              </p>
            )}
          </section>

          {request.description && (
            <section>
              <h2 className="admin-review-label">Descripción</h2>
              <p className="mb-0">{request.description}</p>
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
                {[request.contactEmail, request.contactPhone].filter(Boolean).join(" · ")}
              </p>
            </section>
          )}

          <section>
            <label className="admin-review-label" htmlFor="admin-note">
              Motivo / nota de revisión
            </label>
            <textarea
              id="admin-note"
              className="form-control mt-2"
              rows={3}
              maxLength={500}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              disabled={request.status !== "pending"}
              placeholder="Si rechazás o aprobás, este texto puede ir en el email al solicitante"
            />
          </section>

          {request.status === "pending" ? (
            <div className="admin-venue-review-actions">
              <button
                className="btn btn-primary"
                type="button"
                disabled={busy}
                onClick={() => void review("approve")}
              >
                <i className="bi bi-check-lg" aria-hidden="true" />
                <span>{busy ? "Procesando…" : "Autorizar y crear Espacio"}</span>
              </button>
              <button
                className="btn btn-outline-light"
                type="button"
                disabled={busy}
                onClick={() => void review("reject")}
              >
                <i className="bi bi-x-lg" aria-hidden="true" />
                <span>Rechazar</span>
              </button>
            </div>
          ) : (
            <div className="admin-review-result">
              Esta solicitud ya fue {request.status === "approved" ? "aprobada" : "rechazada"}.
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

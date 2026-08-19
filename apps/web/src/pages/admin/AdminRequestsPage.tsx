import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  VENUE_TYPE_LABELS,
  type VenueRequest,
  type VenueRequestStatus,
} from "@nocta/shared";
import { api, ApiError } from "../../lib/api";
import { OverflowFade } from "../../components/OverflowFade";
import { NoctaLoading } from "../../components/NoctaLoading";

const FILTERS: { value: VenueRequestStatus | "all"; label: string; icon: string }[] = [
  { value: "pending", label: "Pendientes", icon: "bi-hourglass-split" },
  { value: "approved", label: "Aprobadas", icon: "bi-check-circle" },
  { value: "rejected", label: "Rechazadas", icon: "bi-x-circle" },
  { value: "all", label: "Todas", icon: "bi-list-ul" },
];

const STATUS_LABEL: Record<VenueRequestStatus, string> = {
  pending: "Pendiente",
  approved: "Aprobada",
  rejected: "Rechazada",
};

export function AdminRequestsPage() {
  const [status, setStatus] = useState<VenueRequestStatus | "all">("pending");
  const [requests, setRequests] = useState<VenueRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    const qs = status === "all" ? "" : `?status=${status}`;
    void api<{ requests: VenueRequest[] }>(`/api/admin/venue-requests${qs}`)
      .then((res) => setRequests(res.requests))
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "No se pudo cargar")
      )
      .finally(() => setLoading(false));
  }, [status]);

  return (
    <div className="admin-page">
      <header className="admin-page-head">
        <div>
          <p className="admin-page-eyebrow">Administración</p>
          <h1 className="app-title h3 mb-1">Solicitudes</h1>
          <p className="text-secondary small mb-0">
            Cola de altas de Espacios enviadas por usuarios.
          </p>
        </div>
      </header>

      <OverflowFade
        axis="x"
        className="admin-filter-row"
        role="tablist"
        aria-label="Filtro de estado"
      >
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            role="tab"
            aria-selected={status === f.value}
            className={`admin-filter-chip${status === f.value ? " is-active" : ""}`}
            onClick={() => setStatus(f.value)}
          >
            <i className={`bi ${f.icon}`} aria-hidden="true" />
            <span>{f.label}</span>
          </button>
        ))}
      </OverflowFade>

      {error && <p className="text-danger small">{error}</p>}
      {loading ? (
        <NoctaLoading variant="block" />
      ) : requests.length === 0 ? (
        <p className="text-secondary small mb-0">No hay solicitudes en este filtro.</p>
      ) : (
        <div className="admin-list">
          {requests.map((r) => (
            <Link
              key={r.id}
              className="admin-list-row admin-list-row-link"
              to={`/admin/venue-requests/${r.id}`}
            >
              {r.photos[0] ? (
                <img src={r.photos[0]} alt="" className="admin-list-thumb" />
              ) : (
                <div className="admin-list-thumb is-empty" aria-hidden="true">
                  <i className="bi bi-building" />
                </div>
              )}
              <div className="admin-list-body min-w-0">
                <div className="d-flex flex-wrap align-items-center gap-2">
                  <strong className="text-truncate">{r.name}</strong>
                  <span className={`admin-badge is-${r.status}`}>
                    {STATUS_LABEL[r.status]}
                  </span>
                </div>
                <div className="text-secondary small text-truncate">
                  {VENUE_TYPE_LABELS[r.type]} · {r.address}, {r.city}
                </div>
                <div className="text-secondary small text-truncate">
                  {r.requester?.name
                    ? `${r.requester.name} · ${r.requester.email}`
                    : r.requester?.email ?? r.requesterId}
                </div>
              </div>
              <i className="bi bi-chevron-right admin-list-chevron" aria-hidden="true" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

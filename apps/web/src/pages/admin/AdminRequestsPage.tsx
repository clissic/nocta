import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  VENUE_TYPE_LABELS,
  type VenueRequest,
  type VenueRequestStatus,
} from "@nocta/shared";
import { api, ApiError } from "../../lib/api";
import { NoctaLoading } from "../../components/NoctaLoading";
import { ManualSearchInput } from "../../components/ManualSearchInput";
import {
  ADMIN_PAGE_SIZE,
  AdminPagination,
} from "../../components/admin/AdminPagination";
import { AdminFiltersAccordion } from "../../components/admin/AdminFiltersAccordion";
import { OptimizedImage } from "../../components/OptimizedImage";
import { AdminCreateVenueRequestModal } from "../../components/admin/AdminCreateVenueRequestModal";

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
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [requests, setRequests] = useState<VenueRequest[]>([]);
  const [page, setPage] = useState(1);
  const [totalRequests, setTotalRequests] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeCreate, setActiveCreate] = useState<VenueRequest | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({
      page: String(page),
      limit: String(ADMIN_PAGE_SIZE),
    });
    if (status !== "all") params.set("status", status);
    if (submittedQuery) params.set("q", submittedQuery);
    void api<{
      requests: VenueRequest[];
      pagination: { total: number };
    }>(`/api/admin/venue-requests?${params}`)
      .then((res) => {
        setRequests(res.requests);
        setTotalRequests(res.pagination.total);
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "No se pudo cargar")
      )
      .finally(() => setLoading(false));
  }, [status, page, reloadKey, submittedQuery]);

  function openCreate(request: VenueRequest) {
    if (request.status !== "pending") return;
    setActiveCreate(request);
  }

  return (
    <div className="admin-page">
      <header className="admin-page-head">
        <div>
          <p className="admin-page-eyebrow">Administración</p>
          <h1 className="app-title h3 mb-1">Solicitudes</h1>
          <p className="text-secondary small mb-0">
            Cola de altas y reclamaciones de Espacios enviadas por usuarios.
          </p>
        </div>
      </header>

      <div
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
            onClick={() => {
              setStatus(f.value);
              setPage(1);
            }}
          >
            <i className={`bi ${f.icon}`} aria-hidden="true" />
            <span>{f.label}</span>
          </button>
        ))}
      </div>

      <AdminFiltersAccordion activeCount={submittedQuery ? 1 : 0}>
        <ManualSearchInput
          className="admin-toolbar"
          placeholder="Buscar por nombre, ciudad, solicitante…"
          ariaLabel="Buscar solicitudes"
          value={query}
          onValueChange={setQuery}
          onSearch={(value) => {
            setSubmittedQuery(value);
            setPage(1);
          }}
        />
      </AdminFiltersAccordion>

      {error && <p className="text-danger small">{error}</p>}
      {loading ? (
        <NoctaLoading variant="block" />
      ) : requests.length === 0 ? (
        <p className="text-secondary small mb-0">No hay solicitudes en este filtro.</p>
      ) : (
        <div className="admin-list">
            {requests.map((r) => {
              const isCreate = (r.requestType ?? "create") !== "claim";
              const canModal = isCreate && r.status === "pending";

              if (canModal) {
                return (
                  <div key={r.id} className="admin-list-row admin-list-row-actions">
                    <button
                      type="button"
                      className="admin-list-row-main"
                      onClick={() => openCreate(r)}
                    >
                      <div className="admin-list-thumb is-empty" aria-hidden="true">
                        <i className="bi bi-building" />
                      </div>
                      <div className="admin-list-body min-w-0">
                        <div className="d-flex flex-wrap align-items-center gap-2">
                          <strong className="text-truncate">{r.name}</strong>
                          <span className={`admin-badge is-${r.status}`}>
                            {STATUS_LABEL[r.status]}
                          </span>
                          <span className="admin-badge">
                            {r.wantsToManage
                              ? "Alta con administración"
                              : "Sugerencia"}
                          </span>
                        </div>
                        <div className="text-secondary small text-truncate">
                          {VENUE_TYPE_LABELS[r.type]} · {r.address}, {r.city},{" "}
                          {r.country}
                        </div>
                        <div className="text-secondary small text-truncate">
                          {r.requester?.name
                            ? `${r.requester.name} · ${r.requester.email}`
                            : r.requester?.email ?? r.requesterId}
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-light"
                      onClick={() => openCreate(r)}
                    >
                      Acciones
                    </button>
                  </div>
                );
              }

              return (
                <Link
                  key={r.id}
                  className="admin-list-row admin-list-row-link"
                  to={`/admin/venue-requests/${r.id}`}
                >
                  {r.photos[0] ? (
                    <OptimizedImage
                      src={r.photos[0]}
                      alt=""
                      className="admin-list-thumb"
                      variant="thumb"
                      sizes="64px"
                    />
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
                      <span className="admin-badge">
                        {r.requestType === "claim"
                          ? "Reclamación"
                          : r.wantsToManage
                            ? "Alta con administración"
                            : "Sugerencia"}
                      </span>
                    </div>
                    <div className="text-secondary small text-truncate">
                      {VENUE_TYPE_LABELS[r.type]} · {r.address}, {r.city},{" "}
                      {r.country}
                    </div>
                    <div className="text-secondary small text-truncate">
                      {r.requester?.name
                        ? `${r.requester.name} · ${r.requester.email}`
                        : r.requester?.email ?? r.requesterId}
                    </div>
                  </div>
                  <i
                    className="bi bi-chevron-right admin-list-chevron"
                    aria-hidden="true"
                  />
                </Link>
              );
            })}
        </div>
      )}

      <AdminPagination
        page={page}
        totalItems={totalRequests}
        onPageChange={setPage}
        label="Páginas de solicitudes"
      />

      {activeCreate && (
        <AdminCreateVenueRequestModal
          request={activeCreate}
          onClose={() => setActiveCreate(null)}
          onResolved={() => setReloadKey((n) => n + 1)}
        />
      )}
    </div>
  );
}

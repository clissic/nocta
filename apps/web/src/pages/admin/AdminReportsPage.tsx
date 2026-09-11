import { useCallback, useEffect, useState } from "react";
import {
  REPORT_REASON_LABELS,
  REPORT_STATUS_LABELS,
  type AdminReport,
  type ReportStatus,
} from "@nocta/shared";
import { api, ApiError } from "../../lib/api";
import { NoctaLoading } from "../../components/NoctaLoading";
import { ManualSearchInput } from "../../components/ManualSearchInput";
import {
  ADMIN_PAGE_SIZE,
  AdminPagination,
} from "../../components/admin/AdminPagination";
import { AdminFiltersAccordion } from "../../components/admin/AdminFiltersAccordion";
import { AdminUserDetailsModal } from "../../components/admin/AdminUserDetailsModal";
import { AdminReportActionsModal } from "../../components/admin/AdminReportActionsModal";

const FILTERS: { value: ReportStatus | "all"; label: string; icon: string }[] = [
  { value: "open", label: "Abiertas", icon: "bi-envelope-open" },
  { value: "reviewed", label: "Revisadas", icon: "bi-check2-square" },
  { value: "dismissed", label: "Descartadas", icon: "bi-slash-circle" },
  { value: "all", label: "Todas", icon: "bi-list-ul" },
];

export function AdminReportsPage() {
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [filter, setFilter] = useState<ReportStatus | "all">("open");
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalReports, setTotalReports] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<AdminReport | null>(
    null
  );
  const closeUserDetails = useCallback(() => setSelectedUserId(null), []);
  const closeReportActions = useCallback(() => setSelectedReport(null), []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(ADMIN_PAGE_SIZE),
    });
    if (filter !== "all") params.set("status", filter);
    if (submittedQuery) params.set("q", submittedQuery);
    void api<{
      reports: AdminReport[];
      pagination: { total: number };
    }>(`/api/admin/reports?${params}`)
      .then((res) => {
        setReports(res.reports);
        setTotalReports(res.pagination.total);
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "No se pudo cargar")
      )
      .finally(() => setLoading(false));
  }, [filter, page, submittedQuery]);

  const visible = reports;

  function handleResolved(updated: AdminReport) {
    const leavesCurrentFilter =
      filter !== "all" && updated.status !== filter;
    setReports((current) =>
      leavesCurrentFilter
        ? current.filter((report) => report.id !== updated.id)
        : current.map((report) =>
            report.id === updated.id ? updated : report
          )
    );
    if (leavesCurrentFilter) {
      setTotalReports((total) => Math.max(0, total - 1));
    }
  }

  return (
    <div className="admin-page">
      <header className="admin-page-head">
        <div>
          <p className="admin-page-eyebrow">Administración</p>
          <h1 className="app-title h3 mb-1">Denuncias</h1>
          <p className="text-secondary small mb-0">
            Moderación de denuncias de perfiles y conversaciones.
          </p>
        </div>
      </header>

      <div className="admin-panel mb-3">
        <p className="small mb-0">
          Las denuncias pueden originarse en un perfil o en una conversación
          vinculada a un match. La inspección detallada de conversaciones se
          incorporará más adelante.
        </p>
      </div>

      <div
        className="admin-filter-row"
        role="tablist"
        aria-label="Filtro de denuncias"
      >
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            role="tab"
            aria-selected={filter === f.value}
            className={`admin-filter-chip${filter === f.value ? " is-active" : ""}`}
            onClick={() => {
              setFilter(f.value);
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
          placeholder="Buscar por motivo, detalle o persona…"
          ariaLabel="Buscar denuncias"
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
      ) : visible.length === 0 ? (
        <p className="text-secondary small mb-0">No hay denuncias en este filtro.</p>
      ) : (
        <div className="admin-list">
          {visible.map((r) => (
            <div key={r.id} className="admin-list-row admin-list-row-stack">
              <div className="admin-list-body min-w-0">
                <div className="d-flex flex-wrap align-items-center gap-2">
                  <strong>{REPORT_REASON_LABELS[r.reason]}</strong>
                  <span className={`admin-badge is-${r.status}`}>
                    {REPORT_STATUS_LABELS[r.status]}
                  </span>
                </div>
                <div className="text-secondary small">
                  <button
                    className="admin-report-user-link"
                    type="button"
                    onClick={() => setSelectedUserId(r.reporter.id)}
                  >
                    {r.reporter.name}
                  </button>
                  <span aria-hidden="true"> → </span>
                  <button
                    className="admin-report-user-link"
                    type="button"
                    onClick={() => setSelectedUserId(r.reportedUser.id)}
                  >
                    {r.reportedUser.name}
                  </button>
                </div>
                <div className="text-secondary small">
                  Origen:{" "}
                  {r.source === "match"
                    ? `conversación${r.matchId ? ` · match ${r.matchId}` : ""}`
                    : "perfil"}
                </div>
                {r.details && (
                  <div className="small mt-1">{r.details}</div>
                )}
                <div className="text-secondary small">
                  {new Date(r.createdAt).toLocaleString("es-UY")}
                </div>
              </div>
              <div className="admin-list-actions">
                <button
                  className={
                    r.status !== "open"
                      ? "btn btn-sm btn-outline-light"
                      : "btn btn-sm btn-primary"
                  }
                  type="button"
                  onClick={() => setSelectedReport(r)}
                >
                  <i
                    className={`bi ${
                      r.status !== "open" ? "bi-eye" : "bi-three-dots"
                    }`}
                    aria-hidden="true"
                  />
                  <span>
                    {r.status !== "open" ? "Ver resolución" : "Acciones"}
                  </span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AdminPagination
        page={page}
        totalItems={totalReports}
        onPageChange={setPage}
        label="Páginas de denuncias"
      />

      {selectedUserId && (
        <AdminUserDetailsModal
          userId={selectedUserId}
          onClose={closeUserDetails}
        />
      )}
      {selectedReport && (
        <AdminReportActionsModal
          report={selectedReport}
          onClose={closeReportActions}
          onResolved={handleResolved}
        />
      )}
    </div>
  );
}

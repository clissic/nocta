import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  REPORT_REASON_LABELS,
  type MyReportListItem,
  type PaginationMeta,
} from "@nocta/shared";
import { ApiError, api } from "../lib/api";
import { NoctaLoading } from "../components/NoctaLoading";
import { useToast } from "../components/ToastProvider";

const PAGE_SIZE = 20;

function reportStatus(row: MyReportListItem) {
  if (row.resolutionAction === "suspend") {
    return { label: "Con medidas", className: "is-suspend" };
  }
  if (row.resolutionAction === "dismiss" || row.status === "dismissed") {
    return { label: "Descartada", className: "is-dismiss" };
  }
  return { label: "En revisión", className: "is-open" };
}

export function MyReportsPage() {
  const toast = useToast();
  const [reports, setReports] = useState<MyReportListItem[]>([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void api<{ reports: MyReportListItem[]; pagination: PaginationMeta }>(
      `/api/me/reports?page=${page}&limit=${PAGE_SIZE}`
    )
      .then((response) => {
        if (!alive) return;
        setReports((current) =>
          page === 1 ? response.reports : [...current, ...response.reports]
        );
        setPagination(response.pagination);
      })
      .catch((err) => {
        if (!alive) return;
        toast.error(
          err instanceof ApiError
            ? err.message
            : "No se pudieron cargar tus denuncias"
        );
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [page, toast]);

  return (
    <section className="blocked-users-page">
      <header className="blocked-users-head">
        <Link
          className="btn btn-sm btn-outline-light"
          to="/profile"
          aria-label="Volver al perfil"
        >
          <i className="bi bi-arrow-left" aria-hidden="true" />
        </Link>
        <div>
          <p className="admin-page-eyebrow mb-1">Privacidad y seguridad</p>
          <h1 className="app-title h3 mb-0">Mis denuncias</h1>
        </div>
      </header>

      {loading && page === 1 ? (
        <NoctaLoading />
      ) : reports.length === 0 ? (
        <div className="blocked-users-empty">
          <i className="bi bi-flag" aria-hidden="true" />
          <strong>Todavía no denunciaste</strong>
          <p className="text-secondary small mb-0">
            Cuando denuncies un perfil o una conversación, va a aparecer acá.
          </p>
        </div>
      ) : (
        <div className="blocked-users-list">
          {reports.map((row) => {
            const status = reportStatus(row);
            const when = new Date(row.createdAt).toLocaleDateString("es-UY");
            return (
              <Link
                className="report-history-row"
                key={row.id}
                to={`/reports/${row.id}`}
                state={{ from: "reports" }}
              >
                <div className="min-w-0">
                  <strong className="d-block text-truncate">
                    {row.reportedName}
                  </strong>
                  <small className="text-secondary">
                    {REPORT_REASON_LABELS[row.reason]} · {when}
                  </small>
                </div>
                <span className={`report-history-status ${status.className}`}>
                  {status.label}
                </span>
              </Link>
            );
          })}
          {pagination?.hasMore && (
            <button
              className="btn btn-outline-light blocked-users-more"
              type="button"
              disabled={loading}
              onClick={() => setPage((current) => current + 1)}
            >
              {loading ? "Cargando…" : "Cargar más"}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

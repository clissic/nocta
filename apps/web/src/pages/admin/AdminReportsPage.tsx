import { useEffect, useState } from "react";
import {
  REPORT_REASON_LABELS,
  REPORT_STATUS_LABELS,
  type AdminReport,
  type ReportStatus,
} from "@nocta/shared";
import { api, ApiError } from "../../lib/api";
import { OverflowFade } from "../../components/OverflowFade";
import { NoctaLoading } from "../../components/NoctaLoading";

const FILTERS: { value: ReportStatus | "all"; label: string; icon: string }[] = [
  { value: "open", label: "Abiertas", icon: "bi-envelope-open" },
  { value: "reviewed", label: "Revisadas", icon: "bi-check2-square" },
  { value: "dismissed", label: "Descartadas", icon: "bi-slash-circle" },
  { value: "all", label: "Todas", icon: "bi-list-ul" },
];

export function AdminReportsPage() {
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [filter, setFilter] = useState<ReportStatus | "all">("open");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    void api<{ reports: AdminReport[] }>("/api/admin/reports")
      .then((res) => setReports(res.reports))
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "No se pudo cargar")
      )
      .finally(() => setLoading(false));
  }, []);

  const visible =
    filter === "all" ? reports : reports.filter((r) => r.status === filter);

  async function setStatus(report: AdminReport, status: ReportStatus) {
    setBusyId(report.id);
    setError("");
    try {
      await api(`/api/admin/reports/${report.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setReports((prev) =>
        prev.map((r) => (r.id === report.id ? { ...r, status } : r))
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo actualizar");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="admin-page">
      <header className="admin-page-head">
        <div>
          <p className="admin-page-eyebrow">Administración</p>
          <h1 className="app-title h3 mb-1">Denuncias</h1>
          <p className="text-secondary small mb-0">
            Moderación de reportes entre usuarios.
          </p>
        </div>
      </header>

      <OverflowFade
        axis="x"
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
            onClick={() => setFilter(f.value)}
          >
            <i className={`bi ${f.icon}`} aria-hidden="true" />
            <span>{f.label}</span>
          </button>
        ))}
      </OverflowFade>

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
                  {r.reporter.name} → {r.reportedUser.name}
                </div>
                {r.details && (
                  <div className="small mt-1">{r.details}</div>
                )}
                <div className="text-secondary small">
                  {new Date(r.createdAt).toLocaleString("es-UY")}
                </div>
              </div>
              <div className="admin-list-actions">
                {r.status !== "reviewed" && (
                  <button
                    className="btn btn-sm btn-primary"
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => void setStatus(r, "reviewed")}
                  >
                    <i className="bi bi-check2" aria-hidden="true" />
                    <span>Revisada</span>
                  </button>
                )}
                {r.status !== "dismissed" && (
                  <button
                    className="btn btn-sm btn-outline-light"
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => void setStatus(r, "dismissed")}
                  >
                    <i className="bi bi-x-lg" aria-hidden="true" />
                    <span>Descartar</span>
                  </button>
                )}
                {r.status !== "open" && (
                  <button
                    className="btn btn-sm btn-outline-secondary"
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => void setStatus(r, "open")}
                  >
                    <i className="bi bi-arrow-counterclockwise" aria-hidden="true" />
                    <span>Reabrir</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

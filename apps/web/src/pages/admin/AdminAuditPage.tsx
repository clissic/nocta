import { useEffect, useState } from "react";
import {
  ADMIN_PAGE_SIZE,
  AdminPagination,
} from "../../components/admin/AdminPagination";
import { AdminFiltersAccordion } from "../../components/admin/AdminFiltersAccordion";
import type { AdminAuditEventItem, AdminAuditEventsResponse } from "@nocta/shared";
import { api, ApiError } from "../../lib/api";
import { useToast } from "../../components/ToastProvider";
import { NoctaLoading } from "../../components/NoctaLoading";
import { OverflowFade } from "../../components/OverflowFade";
import { ManualSearchInput } from "../../components/ManualSearchInput";

const ACTION_LABELS: Record<string, string> = {
  "user.premium_grant": "Premium otorgado",
  "user.premium_plan": "Plan Premium actualizado",
  "user.premium_revoke": "Premium revocado",
  "user.role_change": "Cambio de rol",
  "user.allowances": "Cupos Boost/Heartshot",
  "user.flags": "Flags de usuario",
  "user.end_presence": "Presencia revocada",
  "report.suspend": "Suspensión por denuncia",
  "report.dismiss": "Denuncia descartada",
};

const ACTION_OPTIONS = [
  { value: "all", label: "Todas las acciones" },
  ...Object.entries(ACTION_LABELS).map(([value, label]) => ({ value, label })),
] as const;

export function AdminAuditPage() {
  const toast = useToast();
  const [events, setEvents] = useState<AdminAuditEventItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(ADMIN_PAGE_SIZE),
    });
    if (submittedQuery) params.set("q", submittedQuery);
    if (actionFilter !== "all") params.set("action", actionFilter);
    void api<AdminAuditEventsResponse>(`/api/admin/audit?${params}`)
      .then((res) => {
        setEvents(res.events);
        setTotal(res.pagination.total);
      })
      .catch((err) => {
        toast.error(
          err instanceof ApiError
            ? err.message
            : "No se pudo cargar la auditoría"
        );
        setEvents([]);
      })
      .finally(() => setLoading(false));
  }, [page, submittedQuery, actionFilter, toast]);

  return (
    <div className="admin-page">
      <header className="admin-page-head">
        <div>
          <p className="admin-page-eyebrow">Control</p>
          <h1 className="app-title h3 mb-1">Auditoría</h1>
          <p className="text-secondary small mb-0">
            Registro de acciones admin: Premium, roles, cupos, presencia y
            moderación.
          </p>
        </div>
      </header>

      <AdminFiltersAccordion
        activeCount={(submittedQuery ? 1 : 0) + (actionFilter !== "all" ? 1 : 0)}
      >
        <label className="admin-field">
          <span>Tipo de acción</span>
          <select
            className="form-select"
            value={actionFilter}
            aria-label="Filtrar por tipo de acción"
            onChange={(event) => {
              setActionFilter(event.target.value);
              setPage(1);
            }}
          >
            {ACTION_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <ManualSearchInput
          className="admin-toolbar"
          placeholder="Buscar por acción, objetivo…"
          ariaLabel="Buscar auditoría"
          value={query}
          onValueChange={setQuery}
          onSearch={(value) => {
            setSubmittedQuery(value);
            setPage(1);
          }}
        />
      </AdminFiltersAccordion>

      {loading ? (
        <NoctaLoading />
      ) : !events.length ? (
        <div className="admin-panel">
          <strong className="d-block mb-1">Sin eventos todavía</strong>
          <p className="text-secondary small mb-0">
            Aparecen acá cuando un admin cambie Premium, roles, cupos,
            presencia o resuelva denuncias.
          </p>
        </div>
      ) : (
        <OverflowFade className="admin-panel">
          <div className="table-responsive">
            <table className="table table-dark table-sm align-middle mb-0">
              <thead>
                <tr>
                  <th>Cuándo</th>
                  <th>Acción</th>
                  <th>Actor</th>
                  <th>Objetivo</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id}>
                    <td className="text-secondary small text-nowrap">
                      {new Date(event.createdAt).toLocaleString("es-AR", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      })}
                    </td>
                    <td>
                      <strong className="d-block">
                        {ACTION_LABELS[event.action] ?? event.action}
                      </strong>
                      {event.meta && Object.keys(event.meta).length > 0 ? (
                        <span className="text-secondary small">
                          {JSON.stringify(event.meta)}
                        </span>
                      ) : null}
                    </td>
                    <td className="small">
                      <div>{event.actor.name}</div>
                      <div className="text-secondary">{event.actor.email}</div>
                    </td>
                    <td className="small text-secondary">
                      {event.targetType}/{event.targetId}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </OverflowFade>
      )}

      <AdminPagination
        page={page}
        totalItems={total}
        onPageChange={setPage}
        label="Páginas de auditoría"
      />
    </div>
  );
}

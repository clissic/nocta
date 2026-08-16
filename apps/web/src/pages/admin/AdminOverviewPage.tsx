import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { AdminStats } from "@nocta/shared";
import { api, ApiError } from "../../lib/api";

export function AdminOverviewPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void api<{ stats: AdminStats }>("/api/admin/stats")
      .then((res) => setStats(res.stats))
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "No se pudo cargar")
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-secondary small mb-0">Cargando resumen…</p>;
  }

  return (
    <div className="admin-page">
      <header className="admin-page-head">
        <div>
          <p className="admin-page-eyebrow">Administración</p>
          <h1 className="app-title h3 mb-1">Resumen</h1>
          <p className="text-secondary small mb-0">
            Vista rápida del estado de Nocta.
          </p>
        </div>
      </header>

      {error && <p className="text-danger small">{error}</p>}

      {stats && (
        <div className="admin-kpi-grid">
          {[
            ["Usuarios", stats.users],
            ["Espacios", stats.venues],
            ["Presencias", stats.activePresences],
            ["Matches", stats.matches],
            ["Solicitudes", stats.pendingVenueRequests],
          ].map(([label, value]) => (
            <div key={String(label)} className="admin-kpi">
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
          ))}
        </div>
      )}

      <div className="admin-shortcut-grid">
        <Link className="admin-shortcut" to="/admin/requests">
          <i className="bi bi-inbox" aria-hidden="true" />
          <div>
            <strong>Solicitudes</strong>
            <span>
              {stats?.pendingVenueRequests
                ? `${stats.pendingVenueRequests} pendientes`
                : "Revisar cola"}
            </span>
          </div>
        </Link>
        <Link className="admin-shortcut" to="/admin/venues">
          <i className="bi bi-geo-alt" aria-hidden="true" />
          <div>
            <strong>Espacios</strong>
            <span>Activar, crear y administrar</span>
          </div>
        </Link>
        <Link className="admin-shortcut" to="/admin/content">
          <i className="bi bi-newspaper" aria-hidden="true" />
          <div>
            <strong>Contenido</strong>
            <span>Promos y noticias</span>
          </div>
        </Link>
        <Link className="admin-shortcut" to="/admin/users">
          <i className="bi bi-people" aria-hidden="true" />
          <div>
            <strong>Usuarios</strong>
            <span>Cuentas y perfiles</span>
          </div>
        </Link>
        <Link className="admin-shortcut" to="/admin/reports">
          <i className="bi bi-flag" aria-hidden="true" />
          <div>
            <strong>Denuncias</strong>
            <span>Moderación de reportes</span>
          </div>
        </Link>
      </div>
    </div>
  );
}

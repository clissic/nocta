import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { AdminStats } from "@nocta/shared";
import { api, ApiError } from "../../lib/api";
import { NoctaLoading } from "../../components/NoctaLoading";

const uyu = new Intl.NumberFormat("es-UY", {
  style: "currency",
  currency: "UYU",
  maximumFractionDigits: 0,
});

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
    return <NoctaLoading variant="block" />;
  }

  return (
    <div className="admin-page">
      <header className="admin-page-head">
        <div>
          <p className="admin-page-eyebrow">Administración</p>
          <h1 className="app-title h3 mb-1">Dashboard de administrador</h1>
          <p className="text-secondary small mb-0">
            Estado operativo y accesos de gestión de Nocta.
          </p>
        </div>
      </header>

      {error && <p className="text-danger small">{error}</p>}

      {stats && (
        <div className="admin-kpi-grid">
          {[
            ["Usuarios", stats.users],
            ["Administradores", stats.admins],
            ["Espacios", stats.venues],
            ["Sin Organizador", stats.ownerlessVenues],
            ["Presencias", stats.activePresences],
            ["Matches", stats.matches],
            ["Solicitudes pendientes", stats.pendingVenueRequests],
            ["Denuncias abiertas", stats.openReports],
            ["Compras de promos", stats.promoPurchases],
            ["Importe en promos", uyu.format(stats.promoRevenueUyu)],
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
            <span>
              {stats?.openReports
                ? `${stats.openReports} abiertas`
                : "Moderación de reportes"}
            </span>
          </div>
        </Link>
        <Link className="admin-shortcut" to="/admin/transactions">
          <i className="bi bi-receipt" aria-hidden="true" />
          <div>
            <strong>Transacciones</strong>
            <span>Compras internas de promos</span>
          </div>
        </Link>
        <Link className="admin-shortcut" to="/admin/audit">
          <i className="bi bi-shield-check" aria-hidden="true" />
          <div>
            <strong>Auditoría</strong>
            <span>Módulo preparado, registro pendiente</span>
          </div>
        </Link>
      </div>

      <div className="admin-panel mt-4">
        <p className="admin-page-eyebrow mb-2">Próximas capacidades</p>
        <h2 className="h6 mb-2">Cobertura administrativa en desarrollo</h2>
        <p className="text-secondary small mb-0">
          El dashboard ya consolida la gestión real disponible. La auditoría,
          las denuncias directas de perfiles o contenido y la conciliación de
          pagos externos se incorporarán cuando existan sus fuentes de datos.
        </p>
      </div>
    </div>
  );
}

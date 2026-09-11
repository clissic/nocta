import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  VENUE_TYPE_LABELS,
  type Venue,
} from "@nocta/shared";
import { api, ApiError } from "../../lib/api";
import { useToast } from "../../components/ToastProvider";
import { NoctaLoading } from "../../components/NoctaLoading";
import { onVenuePhotoError, venueCoverSrc } from "../../lib/venuePhoto";
import { ManualSearchInput } from "../../components/ManualSearchInput";
import {
  ADMIN_PAGE_SIZE,
  AdminPagination,
} from "../../components/admin/AdminPagination";
import { AdminFiltersAccordion } from "../../components/admin/AdminFiltersAccordion";

export function AdminVenuesPage() {
  const toast = useToast();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalVenues, setTotalVenues] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(ADMIN_PAGE_SIZE),
    });
    if (submittedQuery) params.set("q", submittedQuery);
    void api<{
      venues: Venue[];
      pagination: { total: number };
    }>(`/api/venues/admin/all?${params}`)
      .then((response) => {
        setVenues(response.venues);
        setTotalVenues(response.pagination.total);
      })
      .catch((err) =>
        toast.error(err instanceof ApiError ? err.message : "No se pudo cargar")
      )
      .finally(() => setLoading(false));
  }, [page, submittedQuery, toast]);

  function organizerName(venue: Venue) {
    if (venue.owner?.name) return venue.owner.name;
    if (!venue.ownerId) return "Sin organizador";
    return "Organizador";
  }

  async function copyOrganizerId(id: string, name: string) {
    try {
      await navigator.clipboard.writeText(id);
      toast.success(`ID de ${name} copiado`);
    } catch {
      toast.error("No se pudo copiar el ID");
    }
  }

  async function toggleVenue(venue: Venue) {
    setBusyId(venue.id);
    try {
      const res = await api<{ venue: Venue }>(`/api/venues/${venue.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !venue.active }),
      });
      setVenues((prev) =>
        prev.map((v) => (v.id === venue.id ? { ...res.venue, owner: v.owner } : v))
      );
      toast.success(
        res.venue.active
          ? `${venue.name} quedó activo`
          : `${venue.name} quedó inactivo`
      );
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo actualizar");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="admin-page">
      <header className="admin-page-head admin-page-head-row">
        <div>
          <p className="admin-page-eyebrow">Administración</p>
          <h1 className="app-title h3 mb-1">Espacios</h1>
          <p className="text-secondary small mb-0">
            Activá, buscá y administrá los Espacios de Nocta.
          </p>
        </div>
        <div className="admin-page-actions">
          <Link className="btn btn-outline-light btn-sm" to="/admin/content">
            <i className="bi bi-newspaper" aria-hidden="true" />
            <span>Contenido</span>
          </Link>
          <Link className="btn btn-primary btn-sm" to="/admin/venues/new">
            <i className="bi bi-plus-lg" aria-hidden="true" />
            <span>Alta</span>
          </Link>
        </div>
      </header>

      <AdminFiltersAccordion activeCount={submittedQuery ? 1 : 0}>
        <ManualSearchInput
          className="admin-toolbar"
          placeholder="Buscar por nombre, ciudad o tipo…"
          ariaLabel="Buscar Espacios"
          value={query}
          onValueChange={setQuery}
          onSearch={(value) => {
            setSubmittedQuery(value);
            setPage(1);
          }}
        />
      </AdminFiltersAccordion>

      {loading ? (
        <NoctaLoading variant="block" />
      ) : venues.length === 0 ? (
        <p className="text-secondary small mb-0">Sin resultados.</p>
      ) : (
        <div className="admin-list">
          {venues.map((v) => {
            const name = organizerName(v);
            return (
              <div key={v.id} className="admin-list-row">
                <div className="admin-list-media">
                  <img
                    src={venueCoverSrc(v)}
                    alt=""
                    className="admin-list-thumb"
                    onError={onVenuePhotoError}
                  />
                  <span
                    className={`admin-badge ${v.active ? "is-approved" : "is-rejected"}`}
                  >
                    {v.active ? "Activo" : "Inactivo"}
                  </span>
                </div>
                <div className="admin-list-body min-w-0">
                  <strong className="text-truncate d-block">{v.name}</strong>
                  <div className="text-secondary small text-truncate">
                    {VENUE_TYPE_LABELS[v.type]} · {v.city}
                  </div>
                  {v.ownerId ? (
                    <div className="admin-organizer-row">
                      <span className="text-secondary small text-truncate">
                        {name}
                      </span>
                      <button
                        type="button"
                        className="admin-copy-id"
                        title="Copiar ID del organizador"
                        aria-label={`Copiar ID de ${name}`}
                        onClick={() => void copyOrganizerId(v.ownerId!, name)}
                      >
                        <i className="bi bi-clipboard" aria-hidden="true" />
                      </button>
                    </div>
                  ) : (
                    <div className="text-secondary small text-truncate">
                      Sin organizador
                    </div>
                  )}
                </div>
                <div className="admin-list-actions admin-list-actions-stack">
                  <Link
                    className="btn btn-sm btn-outline-light"
                    to={`/admin/content?venueId=${v.id}`}
                    title="Contenido"
                    aria-label={`Administrar contenido de ${v.name}`}
                  >
                    <i className="bi bi-newspaper" aria-hidden="true" />
                  </Link>
                  <button
                    className="btn btn-sm btn-outline-light"
                    type="button"
                    disabled={busyId === v.id}
                    onClick={() => void toggleVenue(v)}
                    aria-label={v.active ? "Desactivar" : "Activar"}
                    title={v.active ? "Desactivar" : "Activar"}
                  >
                    <i
                      className={`bi ${v.active ? "bi-toggle-on" : "bi-toggle-off"}`}
                      aria-hidden="true"
                    />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AdminPagination
        page={page}
        totalItems={totalVenues}
        onPageChange={setPage}
        label="Páginas de Espacios"
      />
    </div>
  );
}

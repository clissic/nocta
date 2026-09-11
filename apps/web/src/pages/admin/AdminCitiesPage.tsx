import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_URUGUAY_CITY,
  DEFAULT_VENUE_COUNTRY,
  ENABLED_VENUE_COUNTRIES,
  VENUE_COUNTRIES,
  type AppCity,
} from "@nocta/shared";
import { api, ApiError } from "../../lib/api";
import { invalidateAppCitiesCache } from "../../lib/appCities";
import { NoctaLoading } from "../../components/NoctaLoading";
import {
  ADMIN_PAGE_SIZE,
  AdminPagination,
} from "../../components/admin/AdminPagination";
import { AdminFiltersAccordion } from "../../components/admin/AdminFiltersAccordion";
import { LocationPickerMap, type MapCoords } from "../../components/LocationPickerMap";
import { useToast } from "../../components/ToastProvider";

type ActiveFilter = "all" | "true" | "false";

type EditorState = {
  id?: string;
  country: string;
  name: string;
  pin: MapCoords | null;
  active: boolean;
};

const ACTIVE_FILTERS: { value: ActiveFilter; label: string; icon: string }[] = [
  { value: "all", label: "Todas", icon: "bi-list-ul" },
  { value: "true", label: "Activas", icon: "bi-check-circle" },
  { value: "false", label: "Inactivas", icon: "bi-slash-circle" },
];

function emptyEditor(): EditorState {
  return {
    country: DEFAULT_VENUE_COUNTRY,
    name: "",
    pin: {
      lat: DEFAULT_URUGUAY_CITY.lat,
      lng: DEFAULT_URUGUAY_CITY.lng,
    },
    active: true,
  };
}

export function AdminCitiesPage() {
  const toast = useToast();
  const [cities, setCities] = useState<AppCity[]>([]);
  const [countryFilter, setCountryFilter] = useState<string>("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(ADMIN_PAGE_SIZE),
      active: activeFilter,
    });
    if (countryFilter) params.set("country", countryFilter);
    if (submittedQuery) params.set("q", submittedQuery);
    void api<{
      cities: AppCity[];
      pagination: { total: number };
    }>(`/api/admin/cities?${params}`)
      .then((res) => {
        setCities(res.cities);
        setTotal(res.pagination.total);
        setError("");
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "No se pudo cargar")
      )
      .finally(() => setLoading(false));
  }, [activeFilter, countryFilter, page, submittedQuery]);

  useEffect(() => {
    load();
  }, [load]);

  const mapCenter = useMemo(() => {
    if (editor?.pin) return editor.pin;
    return {
      lat: DEFAULT_URUGUAY_CITY.lat,
      lng: DEFAULT_URUGUAY_CITY.lng,
    };
  }, [editor?.pin]);

  function openCreate() {
    setEditor(emptyEditor());
  }

  function openEdit(city: AppCity) {
    setEditor({
      id: city.id,
      country: city.country,
      name: city.name,
      pin: { lat: city.lat, lng: city.lng },
      active: city.active,
    });
  }

  async function saveEditor(event: FormEvent) {
    event.preventDefault();
    if (!editor) return;
    if (!editor.pin) {
      toast.error("Marcá la ubicación en el mapa");
      return;
    }
    setBusy(true);
    try {
      const body = {
        country: editor.country,
        name: editor.name.trim(),
        lat: editor.pin.lat,
        lng: editor.pin.lng,
        active: editor.active,
      };
      if (editor.id) {
        await api<{ city: AppCity }>(`/api/admin/cities/${editor.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        toast.success("Ciudad actualizada");
      } else {
        await api<{ city: AppCity }>("/api/admin/cities", {
          method: "POST",
          body: JSON.stringify(body),
        });
        toast.success("Ciudad creada");
      }
      invalidateAppCitiesCache();
      setEditor(null);
      load();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo guardar"
      );
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(city: AppCity) {
    setBusy(true);
    try {
      if (city.active) {
        await api<{ city: AppCity }>(
          `/api/admin/cities/${city.id}/deactivate`,
          { method: "POST", body: JSON.stringify({}) }
        );
        toast.success("Ciudad desactivada");
      } else {
        await api<{ city: AppCity }>(`/api/admin/cities/${city.id}`, {
          method: "PATCH",
          body: JSON.stringify({ active: true }),
        });
        toast.success("Ciudad reactivada");
      }
      invalidateAppCitiesCache();
      load();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo actualizar"
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-page">
      <header className="admin-page-head">
        <div>
          <p className="admin-page-eyebrow">Administración</p>
          <h1 className="app-title h3 mb-1">Ciudades</h1>
          <p className="text-secondary small mb-0">
            Catálogo de proximidad para GPS, Teleport y Espacios.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={openCreate}
        >
          <i className="bi bi-plus-lg me-1" aria-hidden="true" />
          Nueva ciudad
        </button>
      </header>

      <div
        className="admin-filter-row"
        role="tablist"
        aria-label="Estado"
      >
        {ACTIVE_FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={activeFilter === item.value}
            className={`admin-filter-chip${
              activeFilter === item.value ? " is-active" : ""
            }`}
            onClick={() => {
              setPage(1);
              setActiveFilter(item.value);
            }}
          >
            <i className={`bi ${item.icon}`} aria-hidden="true" />
            {item.label}
          </button>
        ))}
      </div>

      <AdminFiltersAccordion
        activeCount={(countryFilter ? 1 : 0) + (submittedQuery ? 1 : 0)}
      >
        <div className="admin-panel">
          <form
            className="row g-2 align-items-end"
            onSubmit={(event) => {
              event.preventDefault();
              setPage(1);
              setSubmittedQuery(query.trim());
            }}
          >
            <div className="col-12 col-md-4">
              <label className="form-label small text-secondary mb-1">
                País
              </label>
              <select
                className="form-select"
                value={countryFilter}
                onChange={(event) => {
                  setPage(1);
                  setCountryFilter(event.target.value);
                }}
              >
                <option value="">Todos</option>
                {ENABLED_VENUE_COUNTRIES.map((country) => (
                  <option key={country} value={country}>
                    {country}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-12 col-md-5">
              <label className="form-label small text-secondary mb-1">
                Buscar
              </label>
              <input
                className="form-control"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Nombre de ciudad…"
              />
            </div>
            <div className="col-12 col-md-3">
              <button type="submit" className="btn btn-outline-light w-100">
                Aplicar
              </button>
            </div>
          </form>
        </div>
      </AdminFiltersAccordion>

      {loading ? (
        <NoctaLoading variant="block" />
      ) : error ? (
        <p className="text-danger">{error}</p>
      ) : cities.length === 0 ? (
        <p className="text-secondary">No hay ciudades con esos filtros.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="table admin-table mb-0">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>País</th>
                <th>Coords</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {cities.map((city) => (
                <tr key={city.id}>
                  <td>{city.name}</td>
                  <td>{city.country}</td>
                  <td className="small text-secondary">
                    {city.lat.toFixed(4)}, {city.lng.toFixed(4)}
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        city.active ? "text-bg-success" : "text-bg-secondary"
                      }`}
                    >
                      {city.active ? "Activa" : "Inactiva"}
                    </span>
                  </td>
                  <td className="text-end text-nowrap">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-light me-1"
                      onClick={() => openEdit(city)}
                      disabled={busy}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-light"
                      onClick={() => void toggleActive(city)}
                      disabled={busy}
                    >
                      {city.active ? "Desactivar" : "Reactivar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AdminPagination
        page={page}
        totalItems={total}
        onPageChange={setPage}
        label="Paginación de ciudades"
      />

      {editor ? (
        <div
          className="modal fade show d-block"
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-city-editor-title"
        >
          <div className="modal-dialog modal-lg modal-dialog-scrollable">
            <form className="modal-content" onSubmit={saveEditor}>
              <div className="modal-header">
                <h2
                  className="modal-title h5"
                  id="admin-city-editor-title"
                >
                  {editor.id ? "Editar ciudad" : "Nueva ciudad"}
                </h2>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Cerrar"
                  onClick={() => setEditor(null)}
                  disabled={busy}
                />
              </div>
              <div className="modal-body">
                <div className="row g-3 mb-3">
                  <div className="col-12 col-md-6">
                    <label className="form-label">País</label>
                    <select
                      className="form-select"
                      value={editor.country}
                      onChange={(event) =>
                        setEditor((current) =>
                          current
                            ? { ...current, country: event.target.value }
                            : current
                        )
                      }
                      required
                    >
                      {VENUE_COUNTRIES.filter((item) => item.enabled).map(
                        (item) => (
                          <option key={item.id} value={item.label}>
                            {item.label}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label">Nombre</label>
                    <input
                      className="form-control"
                      value={editor.name}
                      onChange={(event) =>
                        setEditor((current) =>
                          current
                            ? { ...current, name: event.target.value }
                            : current
                        )
                      }
                      minLength={2}
                      maxLength={80}
                      required
                    />
                  </div>
                </div>

                <p className="small text-secondary mb-2">
                  Hacé clic en el mapa para fijar latitud y longitud.
                </p>
                <LocationPickerMap
                  center={mapCenter}
                  value={editor.pin}
                  onPick={(coords) =>
                    setEditor((current) =>
                      current ? { ...current, pin: coords } : current
                    )
                  }
                />
                {editor.pin ? (
                  <p className="small text-secondary mt-2 mb-0">
                    {editor.pin.lat.toFixed(5)}, {editor.pin.lng.toFixed(5)}
                  </p>
                ) : null}

                {editor.id ? (
                  <div className="form-check form-switch mt-3">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="admin-city-active"
                      checked={editor.active}
                      onChange={(event) =>
                        setEditor((current) =>
                          current
                            ? { ...current, active: event.target.checked }
                            : current
                        )
                      }
                    />
                    <label
                      className="form-check-label"
                      htmlFor="admin-city-active"
                    >
                      Ciudad activa
                    </label>
                  </div>
                ) : null}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline-light"
                  onClick={() => setEditor(null)}
                  disabled={busy}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={busy}
                >
                  {busy ? "Guardando…" : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      {editor ? <div className="modal-backdrop fade show" /> : null}
    </div>
  );
}

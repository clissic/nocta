import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  VENUE_TYPES,
  VENUE_TYPE_LABELS,
  VENUES_PAGE_SIZE,
  type PaginatedVenuesResponse,
  type Presence,
  type Venue,
  type VenueType,
} from "@nocta/shared";
import { api } from "../lib/api";

type TypeFilter = "all" | VenueType;

const FALLBACK_PHOTO =
  "https://images.unsplash.com/photo-1571266028247-e6734c9d1d0c?w=800";

const TYPE_FILTERS: { id: TypeFilter; label: string }[] = [
  { id: "all", label: "Todos" },
  ...VENUE_TYPES.map((type) => ({
    id: type as TypeFilter,
    label: VENUE_TYPE_LABELS[type],
  })),
];

function buildVenuesUrl(page: number, typeFilter: TypeFilter, query: string) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(VENUES_PAGE_SIZE),
  });
  if (typeFilter !== "all") params.set("type", typeFilter);
  const q = query.trim();
  if (q) params.set("q", q);
  return `/api/venues?${params.toString()}`;
}

export function VenuesPage() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [presence, setPresence] = useState<Presence | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingMoreRef = useRef(false);
  const hasMoreRef = useRef(false);
  const pageRef = useRef(1);

  useEffect(() => {
    loadingMoreRef.current = loadingMore;
  }, [loadingMore]);
  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);
  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    let alive = true;
    api<{ presence: Presence | null }>("/api/presence/me")
      .then((res) => {
        if (alive) setPresence(res.presence);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const loadPage = useCallback(
    async (nextPage: number, replace: boolean) => {
      if (!replace && loadingMoreRef.current) return;
      if (replace) {
        setLoading(true);
        setError("");
      } else {
        setLoadingMore(true);
      }
      try {
        const res = await api<PaginatedVenuesResponse>(
          buildVenuesUrl(nextPage, typeFilter, debouncedQuery)
        );
        setVenues((prev) => (replace ? res.venues : [...prev, ...res.venues]));
        setPage(res.pagination.page);
        setHasMore(res.pagination.hasMore);
        setTotal(res.pagination.total);
      } catch {
        setError("No se pudieron cargar los espacios.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [typeFilter, debouncedQuery]
  );

  useEffect(() => {
    void loadPage(1, true);
  }, [loadPage]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        if (!hasMoreRef.current || loadingMoreRef.current) return;
        void loadPage(pageRef.current + 1, false);
      },
      { root: null, rootMargin: "240px 0px", threshold: 0 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadPage, loading, venues.length]);

  const liveVenueId = presence?.venueId ?? presence?.venue?.id;

  if (loading) {
    return (
      <div className="app-screen text-secondary fade-in">Cargando espacios…</div>
    );
  }

  return (
    <div className="app-screen venues-page fade-in">
      <div className="venues-head">
        <div>
          <h1 className="app-title h3 mb-1">¿A dónde vas?</h1>
          <p className="text-secondary small mb-0">
            Publicate en un espacio y descubrí quién más va.
          </p>
        </div>
        {total > 0 && (
          <span className="text-secondary small d-none d-md-inline">
            {total} espacio{total === 1 ? "" : "s"}
          </span>
        )}
      </div>

      <div className="venues-toolbar">
        <div className="venue-search input-group">
          <span className="input-group-text bg-transparent border-secondary">
            <i className="bi bi-search" aria-hidden="true" />
          </span>
          <input
            type="search"
            className="form-control bg-transparent border-secondary"
            placeholder="Buscar por nombre, barrio…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Buscar espacios"
          />
          {query && (
            <button
              type="button"
              className="btn btn-outline-secondary"
              aria-label="Limpiar búsqueda"
              onClick={() => setQuery("")}
            >
              <i className="bi bi-x-lg" aria-hidden="true" />
            </button>
          )}
        </div>

        <select
          className="form-select bg-transparent border-secondary venue-type-select"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
          aria-label="Filtrar por tipo"
        >
          {TYPE_FILTERS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>

        <div className="venue-type-filters" role="group" aria-label="Tipos de espacio">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`btn venue-filter-chip ${
                typeFilter === f.id ? "btn-primary" : "btn-outline-secondary"
              }`}
              onClick={() => setTypeFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {presence?.venue && (
        <div className="status-strip fade-in">
          <span className="live-dot" aria-hidden="true" />
          <span className="text-primary small fw-semibold">Publicado</span>
          <span className="status-strip-copy small">
            {presence.venue.name}
            {presence.endsAt
              ? ` · hasta ${new Date(presence.endsAt).toLocaleString("es-AR", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                })}`
              : " · permanente"}
          </span>
          <Link
            to="/discover"
            className="btn btn-sm btn-primary status-strip-discover"
            aria-label="Discover"
          >
            <i className="bi bi-fire d-md-none" aria-hidden="true" />
            <span className="d-none d-md-inline">Discover</span>
          </Link>
        </div>
      )}

      {error && <p className="text-danger small">{error}</p>}

      <div className="venues-grid">
        {venues.map((venue, index) => {
          const isLive = liveVenueId === venue.id;
          return (
            <Link
              key={venue.id}
              to={`/venues/${venue.id}`}
              className={`venue-card fade-in-up${isLive ? " venue-live" : ""}`}
              style={{
                animationDelay: `${Math.min(index % VENUES_PAGE_SIZE, 8) * 40}ms`,
              }}
            >
              <div className="venue-card-media">
                <img
                  src={venue.photos[0] ?? FALLBACK_PHOTO}
                  alt={venue.name}
                />
                <div className="venue-card-fade" />
                {isLive && (
                  <span className="venue-card-live">
                    <span className="live-dot" aria-hidden="true" />
                    Ahora
                  </span>
                )}
                <div className="venue-card-caption">
                  <div className="venue-card-type">
                    {VENUE_TYPE_LABELS[venue.type]}
                  </div>
                  <div className="venue-card-name">{venue.name}</div>
                  <div className="venue-card-address text-truncate">
                    {venue.address}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {!venues.length && (
        <p className="text-secondary small mt-3 fade-in">
          Todavía no hay espacios
          {debouncedQuery || typeFilter !== "all" ? " con ese filtro." : "."}
        </p>
      )}

      <div ref={sentinelRef} className="infinite-sentinel" aria-hidden="true" />

      {venues.length > 0 && (
        <p className="venues-footer text-secondary small text-center fade-in">
          {loadingMore
            ? "Cargando más…"
            : hasMore
              ? `Mostrando ${venues.length} de ${total}`
              : `${total} espacio${total === 1 ? "" : "s"}`}
        </p>
      )}
    </div>
  );
}

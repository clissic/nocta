import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  PRESENCE_PRESETS,
  VENUE_TYPE_LABELS,
  type Presence,
  type Promotion,
  type Venue,
} from "@nocta/shared";
import { api, ApiError } from "../lib/api";
import { VenueMap } from "../components/VenueMap";

const FALLBACK_PHOTO =
  "https://images.unsplash.com/photo-1571266028247-e6734c9d1d0c?w=1200";

export function VenueDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [venue, setVenue] = useState<Venue | null>(null);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [presence, setPresence] = useState<Presence | null>(null);
  const [hours, setHours] = useState<number | null>(24);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [data, presenceResponse] = await Promise.all([
          api<{ venue: Venue; promotions: Promotion[] }>(`/api/venues/${id}`),
          api<{ presence: Presence | null }>("/api/presence/me"),
        ]);
        if (!alive) return;
        setVenue(data.venue);
        setPromotions(data.promotions);
        setPresence(presenceResponse.presence);
      } catch {
        if (alive) setError("Local no encontrado");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  async function publish() {
    if (!venue) return;
    setBusy(true);
    setError("");
    try {
      await api<{ presence: Presence }>("/api/presence", {
        method: "POST",
        body: JSON.stringify({ venueId: venue.id, hours }),
      });
      navigate("/discover");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo publicar");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="app-screen text-secondary">Cargando…</div>;
  if (!venue) {
    return <div className="app-screen text-danger">{error || "Local no encontrado"}</div>;
  }

  const isPublishedHere = presence?.venueId === venue.id;
  const hero = venue.photos.filter(Boolean)[0] ?? FALLBACK_PHOTO;

  return (
    <div className="app-screen flush venue-detail-page fade-in">
      <div className="venue-detail-layout">
        <div className="venue-detail-media">
          <div className="venue-detail-hero">
            <img src={hero} alt={venue.name} />
            <div className="venue-detail-hero-fade" />
            <button
              type="button"
              className="venue-detail-back"
              aria-label="Volver"
              onClick={() => navigate("/")}
            >
              <i className="bi bi-arrow-left" aria-hidden="true" />
            </button>
            <div className="venue-detail-hero-caption d-md-none">
              <span className="venue-detail-type">
                {VENUE_TYPE_LABELS[venue.type]}
              </span>
              <h1 className="app-title h3 mb-1 text-white">{venue.name}</h1>
              <p className="mb-0 small text-white-50">{venue.address}</p>
            </div>
          </div>
        </div>

        <div className="venue-detail-info">
          <div className="venue-detail-body">
            <header className="venue-detail-head d-none d-md-block">
              <span className="venue-detail-type">
                {VENUE_TYPE_LABELS[venue.type]}
              </span>
              <h1 className="app-title h3 mb-1">{venue.name}</h1>
              <p className="text-secondary small mb-0">{venue.address}</p>
            </header>

            {venue.description && (
              <section className="venue-detail-section">
                <h2 className="venue-detail-label">Sobre el lugar</h2>
                <p className="mb-0 venue-detail-desc">{venue.description}</p>
              </section>
            )}

            {!!promotions.length && (
              <section className="venue-detail-section">
                <h2 className="venue-detail-label">Promos</h2>
                <div className="venue-detail-promos">
                  {promotions.map((promotion) => (
                    <div key={promotion.id} className="venue-detail-promo">
                      <strong>{promotion.title}</strong>
                      <p className="text-secondary small mb-0">
                        {promotion.description}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          <section className="venue-detail-action">
            {isPublishedHere ? (
              <>
                <div className="venue-detail-status">
                  <span className="live-dot" aria-hidden="true" />
                  <div className="min-w-0">
                    <div className="text-primary small fw-semibold">
                      Publicado aquí
                    </div>
                    <p className="text-secondary small mb-0">
                      Tu perfil está visible. Seguí buscando gente en Discover.
                    </p>
                  </div>
                </div>
                {error && <p className="text-danger small mb-2">{error}</p>}
                <Link to="/discover" className="btn btn-primary w-100">
                  <i className="bi bi-fire me-1" aria-hidden="true" />
                  Ir al Discover
                </Link>
              </>
            ) : (
              <>
                <h2 className="venue-detail-label">Publicarme aquí</h2>
                <p className="text-secondary small mb-2">
                  Visible solo para quienes también se publicaron en este local.
                </p>
                <div
                  className="venue-detail-presets"
                  role="group"
                  aria-label="Duración"
                >
                  {PRESENCE_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      className={`venue-filter-chip${
                        hours === preset.hours ? " is-active" : ""
                      }`}
                      onClick={() => setHours(preset.hours)}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                {error && <p className="text-danger small mb-2">{error}</p>}
                <button
                  className="btn btn-primary w-100"
                  type="button"
                  disabled={busy}
                  onClick={() => void publish()}
                >
                  <i
                    className="bi bi-broadcast-pin me-1"
                    aria-hidden="true"
                  />
                  {busy ? "Publicando…" : "Publicar perfil"}
                </button>
              </>
            )}
          </section>
        </div>

        <VenueMap
          name={venue.name}
          address={venue.address}
          city={venue.city}
          location={venue.location}
        />
      </div>
    </div>
  );
}

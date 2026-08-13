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

export function VenueDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [venue, setVenue] = useState<Venue | null>(null);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [hours, setHours] = useState<number | null>(24);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await api<{ venue: Venue; promotions: Promotion[] }>(
          `/api/venues/${id}`
        );
        if (!alive) return;
        setVenue(data.venue);
        setPromotions(data.promotions);
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

  return (
    <div className="app-screen flush fade-in">
      <div className="position-relative">
        <img
          className="bleed-cover"
          src={
            venue.photos[0] ??
            "https://images.unsplash.com/photo-1571266028247-e6734c9d1d0c?w=1000"
          }
          alt={venue.name}
        />
        <button
          type="button"
          className="btn btn-dark btn-sm position-absolute top-0 start-0 m-2 m-md-3 rounded-circle"
          style={{ width: 36, height: 36 }}
          aria-label="Volver"
          onClick={() => navigate("/")}
        >
          <i className="bi bi-arrow-left" aria-hidden="true"></i>
        </button>
      </div>

      <div className="px-3 px-md-0 pt-3 pb-4" style={{ maxWidth: 640 }}>
        <p className="text-secondary small mb-1">{VENUE_TYPE_LABELS[venue.type]}</p>
        <h1 className="app-title h3 mb-1">{venue.name}</h1>
        <p className="text-secondary small mb-2">{venue.address}</p>
        {venue.description && <p className="mb-3">{venue.description}</p>}

        {!!promotions.length && (
          <section className="mb-3">
            <h2 className="h6 text-secondary text-uppercase mb-2" style={{ letterSpacing: "0.06em" }}>
              Promos
            </h2>
            {promotions.map((p) => (
              <div key={p.id} className="py-2 border-bottom border-secondary">
                <strong>{p.title}</strong>
                <p className="text-secondary small mb-0">{p.description}</p>
              </div>
            ))}
          </section>
        )}

        <h2 className="h6 mb-2">Publicarme aquí</h2>
        <p className="text-secondary small mb-2">
          Visible solo para quienes también se publicaron en este local.
        </p>
        <div className="d-flex flex-wrap gap-2 mb-3">
          {PRESENCE_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              className={`btn btn-sm btn-outline-secondary rounded-pill choice-btn ${
                hours === preset.hours ? "active" : ""
              }`}
              onClick={() => setHours(preset.hours)}
            >
              {preset.label}
            </button>
          ))}
        </div>
        {error && <p className="text-danger small">{error}</p>}
        <button
          className="btn btn-primary w-100"
          type="button"
          disabled={busy}
          onClick={publish}
        >
          <i className="bi bi-broadcast-pin me-1" aria-hidden="true"></i>
          {busy ? "Publicando…" : "Publicar perfil"}
        </button>
        <Link to="/discover" className="btn btn-link link-secondary w-100 mt-1">
          Ir al Discover
        </Link>
      </div>
    </div>
  );
}

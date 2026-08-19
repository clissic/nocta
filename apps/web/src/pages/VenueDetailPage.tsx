import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  PRESENCE_PRESETS,
  VENUE_TYPE_LABELS,
  type Presence,
  type Promotion,
  type Venue,
  type VenueNews,
} from "@nocta/shared";
import { api, ApiError } from "../lib/api";
import { VenueMap } from "../components/VenueMap";
import { VenueReviewsSection } from "../components/VenueReviewsSection";
import { OverflowFade } from "../components/OverflowFade";
import { useToast } from "../components/ToastProvider";
import { VenueTrustBadge } from "../components/VenueTrustBadge";
import { onVenuePhotoError, venueCoverSrc } from "../lib/venuePhoto";
import { NoctaLoading } from "../components/NoctaLoading";

export function VenueDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [venue, setVenue] = useState<Venue | null>(null);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [news, setNews] = useState<VenueNews[]>([]);
  const [presence, setPresence] = useState<Presence | null>(null);
  const [hours, setHours] = useState<number | null>(24);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [data, presenceResponse] = await Promise.all([
          api<{
            venue: Venue;
            promotions: Promotion[];
            news: VenueNews[];
          }>(`/api/venues/${id}`),
          api<{ presence: Presence | null }>("/api/presence/me"),
        ]);
        if (!alive) return;
        setVenue(data.venue);
        setPromotions(data.promotions);
        setNews(data.news);
        setPresence(presenceResponse.presence);
      } catch {
        if (alive) setError("Espacio no encontrado");
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

  async function toggleFollow() {
    if (!venue || followBusy) return;
    const nextFollowing = !venue.isFollowing;
    setFollowBusy(true);
    setError("");
    setVenue((prev) =>
      prev
        ? {
            ...prev,
            isFollowing: nextFollowing,
            followersCount: Math.max(
              0,
              (prev.followersCount ?? 0) + (nextFollowing ? 1 : -1)
            ),
          }
        : prev
    );
    try {
      const res = await api<{ isFollowing: boolean; followersCount: number }>(
        `/api/venues/${venue.id}/follow`,
        { method: nextFollowing ? "POST" : "DELETE" }
      );
      setVenue((prev) =>
        prev
          ? {
              ...prev,
              isFollowing: res.isFollowing,
              followersCount: res.followersCount,
            }
          : prev
      );
      toast.success(nextFollowing ? "Espacio seguido" : "Dejaste de seguir");
    } catch (err) {
      setVenue((prev) =>
        prev
          ? {
              ...prev,
              isFollowing: !nextFollowing,
              followersCount: Math.max(
                0,
                (prev.followersCount ?? 0) + (nextFollowing ? -1 : 1)
              ),
            }
          : prev
      );
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo actualizar el follow"
      );
      setError(
        err instanceof ApiError ? err.message : "No se pudo actualizar el follow"
      );
    } finally {
      setFollowBusy(false);
    }
  }

  if (loading) return <NoctaLoading />;
  if (!venue) {
    return (
      <div className="app-screen text-danger">{error || "Espacio no encontrado"}</div>
    );
  }

  const isPublishedHere = presence?.venueId === venue.id;
  const hero = venueCoverSrc(venue);
  const following = Boolean(venue.isFollowing);

  function renderFollowButton() {
    return (
      <button
        type="button"
        className={`venue-follow-btn${following ? " is-following" : ""}`}
        aria-pressed={following}
        disabled={followBusy}
        onClick={() => void toggleFollow()}
      >
        <i
          className={`bi ${following ? "bi-bookmark-fill" : "bi-bookmark"}`}
          aria-hidden="true"
        />
        <span>{following ? "Siguiendo" : "Seguir"}</span>
      </button>
    );
  }

  return (
    <div className="app-screen flush venue-detail-page fade-in">
      <div className="row g-0 venue-detail-layout">
        <div className="col-12 col-md-5 venue-detail-visual">
          <div className="venue-detail-media">
            <div className="venue-detail-hero">
              <img
                src={hero}
                alt={venue.name}
                onError={onVenuePhotoError}
              />
              <div className="venue-detail-hero-fade" />
              <button
                type="button"
                className="venue-detail-back"
                aria-label="Volver"
                onClick={() => navigate(-1)}
              >
                <i className="bi bi-arrow-left" aria-hidden="true" />
              </button>
              <div className="venue-detail-hero-caption d-md-none">
                <span className="venue-detail-type">
                  {VENUE_TYPE_LABELS[venue.type]}
                </span>
                <div className="venue-detail-title-row">
                  <div className="venue-detail-title-text">
                    <h1 className="app-title h3 mb-0 text-white">{venue.name}</h1>
                    <VenueTrustBadge ownerId={venue.ownerId} />
                  </div>
                  {renderFollowButton()}
                </div>
                <p className="mb-0 mt-1 small text-white-50">{venue.address}</p>
              </div>
            </div>
          </div>

          <VenueMap
            name={venue.name}
            address={venue.address}
            city={venue.city}
            location={venue.location}
          />
        </div>

        <div className="col-12 col-md-7 d-md-flex flex-md-column venue-detail-info">
          <OverflowFade className="venue-detail-body">
            <header className="venue-detail-head d-none d-md-block">
              <span className="venue-detail-type">
                {VENUE_TYPE_LABELS[venue.type]}
              </span>
              <div className="venue-detail-title-row">
                <div className="venue-detail-title-text">
                  <h1 className="app-title h3 mb-0">{venue.name}</h1>
                  <VenueTrustBadge ownerId={venue.ownerId} />
                </div>
                {renderFollowButton()}
              </div>
              <p className="text-secondary small mb-0 mt-1">{venue.address}</p>
              {typeof venue.followersCount === "number" && (
                <p className="venue-detail-followers mb-0">
                  {venue.followersCount}{" "}
                  {venue.followersCount === 1 ? "seguidor" : "seguidores"}
                </p>
              )}
              {(venue.ratingCount ?? 0) > 0 && venue.ratingAvg != null && (
                <p className="venue-detail-rating mb-0">
                  <span className="venue-review-stars-static" aria-hidden="true">
                    <i className="bi bi-star-fill" />
                  </span>{" "}
                  {venue.ratingAvg.toFixed(1).replace(".", ",")} ·{" "}
                  {venue.ratingCount}{" "}
                  {venue.ratingCount === 1 ? "reseña" : "reseñas"}
                </p>
              )}
            </header>

            {venue.description && (
              <section className="venue-detail-section">
                <h2 className="venue-detail-label">Sobre el lugar</h2>
                <p className="mb-0 venue-detail-desc">{venue.description}</p>
              </section>
            )}

            <VenueReviewsSection
              venueId={venue.id}
              venue={venue}
              onVenuePatch={(patch) =>
                setVenue((prev) => (prev ? { ...prev, ...patch } : prev))
              }
            />

            {!!promotions.length && (
              <section className="venue-detail-section">
                <h2 className="venue-detail-label">Últimas promociones</h2>
                <div className="venue-detail-promos">
                  {promotions.map((promotion) => (
                    <div key={promotion.id} className="venue-detail-promo">
                      <strong>{promotion.title}</strong>
                      <p className="text-secondary small mb-0">
                        {promotion.description}
                      </p>
                      {typeof promotion.priceUyu === "number" && (
                        <p className="venue-detail-promo-price mb-0">
                          {new Intl.NumberFormat("es-UY", {
                            style: "currency",
                            currency: "UYU",
                            maximumFractionDigits: 0,
                          }).format(promotion.priceUyu)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {!!news.length && (
              <section className="venue-detail-section">
                <h2 className="venue-detail-label">Últimas noticias</h2>
                <div className="venue-detail-news">
                  {news.map((item) => (
                    <article key={item.id} className="venue-detail-news-item">
                      {item.photos[0] && (
                        <img src={item.photos[0]} alt="" />
                      )}
                      <div className="min-w-0">
                        <strong>{item.title}</strong>
                        <p className="text-secondary small mb-0">{item.body}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {!following && (
              <aside className="venue-detail-follow-callout">
                <strong>
                  Para enterarte de más de tu Espacio favorito, ¡empezá a
                  seguirlo!
                </strong>
                <p className="text-secondary small mb-0">
                  Sus próximas noticias y promociones van a aparecer en el perfil
                  del Espacio.
                </p>
              </aside>
            )}
          </OverflowFade>

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
                  Visible solo para quienes también se publicaron en este espacio.
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
                  <i className="bi bi-broadcast-pin me-1" aria-hidden="true" />
                  {busy ? "Publicando…" : "Publicar perfil"}
                </button>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

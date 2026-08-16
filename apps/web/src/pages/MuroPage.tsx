import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { MuroFeedResponse, Venue } from "@nocta/shared";
import { api } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import { MuroActivityTimeline } from "../components/MuroActivityTimeline";
import { MuroPublishModal } from "../components/MuroPublishModal";

const EMPTY_FEED: MuroFeedResponse = {
  news: [],
  promotions: [],
  activity: [],
  followingUsers: [],
};

export function MuroPage() {
  const { user } = useAuth();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [feed, setFeed] = useState<MuroFeedResponse>(EMPTY_FEED);
  const [loading, setLoading] = useState(true);
  const [publishOpen, setPublishOpen] = useState(false);

  const loadFeed = useCallback(async () => {
    const [following, muro] = await Promise.all([
      api<{ venues: Venue[] }>("/api/me/following"),
      api<MuroFeedResponse>("/api/muro/feed"),
    ]);
    setVenues(following.venues);
    setFeed({
      news: muro.news ?? [],
      promotions: muro.promotions ?? [],
      activity: muro.activity ?? [],
      followingUsers: muro.followingUsers ?? [],
    });
  }, []);

  useEffect(() => {
    let alive = true;
    void loadFeed()
      .catch(() => {
        if (!alive) return;
        setVenues([]);
        setFeed(EMPTY_FEED);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [loadFeed]);

  if (loading) {
    return (
      <div className="app-screen muro-page fade-in">
        <div className="container muro-shell">
          <div className="muro-loading text-secondary small">
            Preparando tu Muro…
          </div>
        </div>
      </div>
    );
  }

  const hasFavorites = venues.length > 0;
  const hasActivity = feed.activity.length > 0;
  const hasNewsOrPromos =
    feed.news.length > 0 || feed.promotions.length > 0;
  const hasPeople = (feed.followingUsers?.length ?? 0) > 0;
  // Mi actividad siempre está disponible → mostrar layout del Muro
  const hasContent = true;
  const showMainEmpty = !hasNewsOrPromos && !hasActivity && !hasPeople;

  return (
    <div className="app-screen muro-page fade-in">
      <div className="container muro-shell">
        <header className="muro-head">
          <p className="muro-eyebrow mb-0">Tu noche, en un solo lugar</p>
          {showMainEmpty && <span className="muro-soon">Próximamente</span>}
        </header>

        {hasContent ? (
          <div className="row g-4 align-items-start muro-layout">
            <aside className="col-12 col-lg-4 muro-layout-aside">
              <MuroActivityTimeline
                activity={feed.activity}
                followingUsers={feed.followingUsers}
                currentUser={user}
                onPublishClick={() => setPublishOpen(true)}
              />
            </aside>

            <div className="col-12 col-lg-8 muro-layout-main">
              {showMainEmpty ? (
                <section className="muro-empty muro-empty-inline" aria-labelledby="muro-empty-title">
                  <div className="muro-copy">
                    <p className="muro-overline">
                      {hasFavorites ? "Tu selección" : "Armá tu propia noche"}
                    </p>
                    <h2 id="muro-empty-title" className="muro-title">
                      {hasFavorites
                        ? "Las novedades van por llegar."
                        : "Tu Muro todavía está esperando su primera historia."}
                    </h2>
                    <p className="muro-description">
                      {hasFavorites
                        ? `Ya seguís ${venues.length} ${
                            venues.length === 1 ? "espacio" : "espacios"
                          }. Acá van a aparecer noticias, promociones y la actividad de quienes seguís.`
                        : "Publicá desde Mi actividad, o seguí espacios y personas para llenar este muro."}
                    </p>
                    <div className="muro-copy-actions">
                      <Link className="btn btn-primary muro-cta" to="/venues">
                        {hasFavorites
                          ? "Descubrir más espacios"
                          : "Explorar espacios"}
                        <i className="bi bi-arrow-up-right" aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                </section>
              ) : (
                <>
                  <section
                    className="muro-carousel-block"
                    aria-labelledby="muro-news-title"
                  >
                    <div className="muro-carousel-head">
                      <h2 id="muro-news-title" className="muro-carousel-title">
                        Noticias
                      </h2>
                      <p className="muro-carousel-sub">
                        De los espacios que seguís
                      </p>
                    </div>
                    {feed.news.length === 0 ? (
                      <p className="text-secondary small mb-0">
                        Todavía no hay noticias.
                      </p>
                    ) : (
                      <div
                        className="row row-cols-1 row-cols-md-2 g-3 muro-card-grid"
                        role="list"
                      >
                        {feed.news.map((item) => (
                          <div key={item.id} className="col" role="listitem">
                            <article className="muro-card h-100">
                              {item.photos[0] || item.venuePhoto ? (
                                <img
                                  src={item.photos[0] || item.venuePhoto}
                                  alt=""
                                  className="muro-card-media"
                                />
                              ) : (
                                <div className="muro-card-media muro-card-media-empty" />
                              )}
                              <div className="muro-card-body">
                                <p className="muro-card-venue">
                                  {item.venueName ?? "Espacio"}
                                </p>
                                <h3 className="muro-card-title">{item.title}</h3>
                                <p className="muro-card-text">{item.body}</p>
                                <Link
                                  className="muro-card-link"
                                  to={`/venues/${item.venueId}`}
                                >
                                  Ver espacio
                                </Link>
                              </div>
                            </article>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  <section
                    className="muro-carousel-block"
                    aria-labelledby="muro-promos-title"
                  >
                    <div className="muro-carousel-head">
                      <h2 id="muro-promos-title" className="muro-carousel-title">
                        Promociones
                      </h2>
                      <p className="muro-carousel-sub">Ofertas vigentes</p>
                    </div>
                    {feed.promotions.length === 0 ? (
                      <p className="text-secondary small mb-0">
                        Todavía no hay promociones.
                      </p>
                    ) : (
                      <div
                        className="row row-cols-1 row-cols-md-2 g-3 muro-card-grid"
                        role="list"
                      >
                        {feed.promotions.map((item) => (
                          <div key={item.id} className="col" role="listitem">
                            <article className="muro-promo-card h-100">
                              <div className="muro-promo-media">
                                {item.venuePhoto ? (
                                  <img src={item.venuePhoto} alt="" />
                                ) : (
                                  <div className="muro-promo-media-empty" />
                                )}
                                <div className="muro-promo-fade" />
                                <div className="muro-promo-caption">
                                  <p className="muro-promo-venue">
                                    {item.venueName ?? "Espacio"}
                                  </p>
                                  <h3 className="muro-promo-title">
                                    {item.title}
                                  </h3>
                                  <p className="muro-promo-text">
                                    {item.description}
                                  </p>
                                  {typeof item.priceUyu === "number" && (
                                    <p className="muro-promo-price">
                                      {new Intl.NumberFormat("es-UY", {
                                        style: "currency",
                                        currency: "UYU",
                                        maximumFractionDigits: 0,
                                      }).format(item.priceUyu)}
                                    </p>
                                  )}
                                  <Link
                                    className="muro-promo-link"
                                    to={`/venues/${item.venueId}`}
                                  >
                                    Ver espacio
                                  </Link>
                                </div>
                              </div>
                            </article>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </>
              )}
            </div>
          </div>
        ) : null}

        <MuroPublishModal
          open={publishOpen}
          onClose={() => setPublishOpen(false)}
          onPublished={() => {
            void loadFeed().catch(() => undefined);
          }}
        />
      </div>
    </div>
  );
}

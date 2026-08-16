import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import {
  ALLOWED_PHOTO_EXTENSIONS,
  MAX_PHOTO_UPLOAD_BYTES,
  VENUE_TYPE_LABELS,
  timezoneFromCountry,
  todayInTimeZone,
  type Promotion,
  type Venue,
  type VenueNews,
} from "@nocta/shared";
import { useAuth } from "../auth/AuthContext";
import { api, ApiError } from "../lib/api";
import { useToast } from "../components/ToastProvider";

function formatDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("es-UY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatValidityRange(from?: string, until?: string) {
  const start = formatDate(from);
  const end = formatDate(until);
  if (start && end) return `${start} – ${end}`;
  if (end) return `Hasta ${end}`;
  if (start) return `Desde ${start}`;
  return null;
}

function formatPriceUyu(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency: "UYU",
    maximumFractionDigits: 0,
  }).format(value);
}

export function VenueManagePage() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const userTimeZone = timezoneFromCountry(user?.profile?.livesIn?.country);

  const [venue, setVenue] = useState<Venue | null>(null);
  const [news, setNews] = useState<VenueNews[]>([]);
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [paymentHelpOpen, setPaymentHelpOpen] = useState(false);

  const [newsTitle, setNewsTitle] = useState("");
  const [newsBody, setNewsBody] = useState("");
  const [newsPhotoFile, setNewsPhotoFile] = useState<File | null>(null);
  const [newsPhotoPreview, setNewsPhotoPreview] = useState<string | null>(null);
  const newsFileRef = useRef<HTMLInputElement>(null);
  const [promoTitle, setPromoTitle] = useState("");
  const [promoDescription, setPromoDescription] = useState("");
  const [promoPrice, setPromoPrice] = useState("");
  const [promoValidFrom, setPromoValidFrom] = useState(() =>
    todayInTimeZone(userTimeZone)
  );
  const [promoValidUntil, setPromoValidUntil] = useState("");
  const [newsListOpen, setNewsListOpen] = useState(false);
  const [promoListOpen, setPromoListOpen] = useState(false);
  const [newsQuery, setNewsQuery] = useState("");
  const [promoQuery, setPromoQuery] = useState("");

  const filteredNews = useMemo(() => {
    const q = newsQuery.trim().toLowerCase();
    if (!q) return news;
    return news.filter((item) => {
      const haystack = `${item.title} ${item.body}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [news, newsQuery]);

  const filteredPromos = useMemo(() => {
    const q = promoQuery.trim().toLowerCase();
    if (!q) return promos;
    return promos.filter((item) => {
      const haystack = `${item.title} ${item.description}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [promos, promoQuery]);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    setLoading(true);
    setForbidden(false);

    void (async () => {
      try {
        const venueRes = await api<{ venue: Venue }>(`/api/venues/${id}`);
        if (!alive) return;

        const nextVenue = venueRes.venue;
        const isOwner = nextVenue.ownerId === user?.id;
        const isAdmin = user?.role === "admin";
        if (!isOwner && !isAdmin) {
          setForbidden(true);
          setVenue(null);
          return;
        }

        setVenue(nextVenue);

        const [newsRes, promoRes] = await Promise.all([
          api<{ news: VenueNews[] }>(`/api/venues/${id}/news`),
          api<{ promotions: Promotion[] }>(`/api/venues/${id}/promotions`),
        ]);
        if (!alive) return;
        setNews(newsRes.news);
        setPromos(promoRes.promotions);
      } catch (err) {
        if (!alive) return;
        if (err instanceof ApiError && err.status === 403) {
          setForbidden(true);
        } else {
          toast.error(
            err instanceof ApiError ? err.message : "No se pudo cargar el espacio"
          );
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- id + user
  }, [id, user?.id, user?.role]);

  useEffect(() => {
    return () => {
      if (newsPhotoPreview) URL.revokeObjectURL(newsPhotoPreview);
    };
  }, [newsPhotoPreview]);

  function onNewsPhotoChange(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (file.size > MAX_PHOTO_UPLOAD_BYTES) {
      toast.error("La imagen supera los 8 MB");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Elegí una imagen válida");
      return;
    }
    if (newsPhotoPreview) URL.revokeObjectURL(newsPhotoPreview);
    setNewsPhotoFile(file);
    setNewsPhotoPreview(URL.createObjectURL(file));
  }

  function clearNewsPhoto() {
    if (newsPhotoPreview) URL.revokeObjectURL(newsPhotoPreview);
    setNewsPhotoFile(null);
    setNewsPhotoPreview(null);
    if (newsFileRef.current) newsFileRef.current.value = "";
  }

  async function createNews(e: FormEvent) {
    e.preventDefault();
    if (!id || !newsTitle.trim() || !newsBody.trim()) return;
    if (!newsPhotoFile) {
      toast.error("Subí una imagen para la noticia");
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.append("title", newsTitle.trim());
      form.append("body", newsBody.trim());
      form.append("photo", newsPhotoFile);

      const res = await api<{ news: VenueNews }>(`/api/venues/${id}/news`, {
        method: "POST",
        body: form,
      });
      setNews((prev) => [res.news, ...prev]);
      setNewsTitle("");
      setNewsBody("");
      clearNewsPhoto();
      toast.success("Noticia publicada");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo crear la noticia"
      );
    } finally {
      setBusy(false);
    }
  }

  async function toggleNews(item: VenueNews) {
    if (!id) return;
    try {
      const res = await api<{ news: VenueNews }>(
        `/api/venues/${id}/news/${item.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ active: !item.active }),
        }
      );
      setNews((prev) => prev.map((n) => (n.id === item.id ? res.news : n)));
      toast.success(res.news.active ? "Noticia activa" : "Noticia ocultada");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo actualizar"
      );
    }
  }

  async function createPromo(e: FormEvent) {
    e.preventDefault();
    if (!id || !promoTitle.trim() || !promoDescription.trim()) return;
    const priceUyu = Number(promoPrice);
    if (!Number.isFinite(priceUyu) || priceUyu < 0) {
      toast.error("Indicá un precio válido en UYU");
      return;
    }
    if (!promoValidFrom || !promoValidUntil) {
      toast.error("Indicá el período de validez");
      return;
    }
    if (promoValidUntil < promoValidFrom) {
      toast.error("La fecha de fin no puede ser anterior al inicio");
      return;
    }
    setBusy(true);
    try {
      const res = await api<{ promotion: Promotion }>(
        `/api/venues/${id}/promotions`,
        {
          method: "POST",
          body: JSON.stringify({
            title: promoTitle.trim(),
            description: promoDescription.trim(),
            priceUyu,
            validFrom: promoValidFrom,
            validUntil: promoValidUntil,
          }),
        }
      );
      setPromos((prev) => [res.promotion, ...prev]);
      setPromoTitle("");
      setPromoDescription("");
      setPromoPrice("");
      setPromoValidFrom(todayInTimeZone(userTimeZone));
      setPromoValidUntil("");
      toast.success("Promoción creada");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo crear la promo"
      );
    } finally {
      setBusy(false);
    }
  }

  async function togglePromo(item: Promotion) {
    if (!id) return;
    try {
      const res = await api<{ promotion: Promotion }>(
        `/api/venues/${id}/promotions/${item.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ active: !item.active }),
        }
      );
      setPromos((prev) =>
        prev.map((p) => (p.id === item.id ? res.promotion : p))
      );
      toast.success(
        res.promotion.active ? "Promoción activa" : "Promoción ocultada"
      );
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo actualizar"
      );
    }
  }

  if (forbidden) {
    return <Navigate to="/profile" replace />;
  }

  if (loading) {
    return (
      <div className="app-screen venue-manage-page fade-in">
        <p className="text-secondary small mb-0">Cargando espacio…</p>
      </div>
    );
  }

  if (!venue) {
    return (
      <div className="app-screen venue-manage-page fade-in">
        <p className="text-secondary small venue-manage-back">
          <Link to="/profile" className="link-light text-decoration-none">
            ← Perfil
          </Link>
        </p>
        <p className="text-secondary mb-0">Espacio no encontrado.</p>
      </div>
    );
  }

  return (
    <div className="app-screen venue-manage-page fade-in">
      <p className="text-secondary small venue-manage-back">
        <Link to="/profile" className="link-light text-decoration-none">
          ← Perfil
        </Link>
      </p>

      <div className="venue-manage-overview">
        <header className="venue-manage-head">
          {venue.photos[0] ? (
            <img src={venue.photos[0]} alt="" className="venue-manage-thumb" />
          ) : (
            <span className="venue-manage-thumb is-empty" aria-hidden="true" />
          )}
          <div className="venue-manage-head-copy min-w-0">
            <div className="venue-manage-title-row">
              <h1 className="app-title h4 mb-0 text-truncate">{venue.name}</h1>
              <span
                className={`venue-manage-status ${
                  venue.active ? "is-on" : "is-off"
                }`}
              >
                {venue.active ? "Activo" : "Inactivo"}
              </span>
            </div>
            <p className="venue-manage-meta mb-0">
              {VENUE_TYPE_LABELS[venue.type]} · {venue.city}
            </p>
            <p className="venue-manage-address text-secondary small mb-0">
              {venue.address}
            </p>
            <Link
              className="venue-manage-public-link small"
              to={`/venues/${venue.id}`}
            >
              Ver ficha pública
            </Link>
          </div>
        </header>

        <aside className="venue-manage-followers" aria-label="Seguidores">
          <i className="bi bi-people-fill" aria-hidden="true" />
          <div>
            <strong>{venue.followersCount ?? 0}</strong>
            <span>
              {(venue.followersCount ?? 0) === 1 ? "seguidor" : "seguidores"}
            </span>
          </div>
        </aside>
      </div>

      <div className="venue-manage-content-grid">
        <section className="venue-manage-section">
        <div className="venue-manage-section-head">
          <h2 className="venue-manage-section-title">Noticias</h2>
          <span className="text-secondary small">{news.length}</span>
        </div>

        <form className="venue-manage-form" onSubmit={(e) => void createNews(e)}>
          <input
            className="form-control"
            placeholder="Título"
            value={newsTitle}
            onChange={(e) => setNewsTitle(e.target.value)}
            maxLength={120}
            required
          />
          <textarea
            className="form-control"
            placeholder="Qué querés contar…"
            rows={3}
            value={newsBody}
            onChange={(e) => setNewsBody(e.target.value)}
            maxLength={4000}
            required
          />
          <div className="venue-manage-news-photo">
            <input
              ref={newsFileRef}
              className="d-none"
              type="file"
              accept={[...ALLOWED_PHOTO_EXTENSIONS, "image/*"].join(",")}
              onChange={(e) => onNewsPhotoChange(e.target.files)}
            />
            {newsPhotoPreview ? (
              <div className="venue-manage-news-photo-preview">
                <img src={newsPhotoPreview} alt="" />
                <div className="venue-manage-news-photo-actions">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-light"
                    onClick={() => newsFileRef.current?.click()}
                  >
                    Cambiar
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-light"
                    onClick={clearNewsPhoto}
                  >
                    Quitar
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="venue-manage-news-photo-upload"
                onClick={() => newsFileRef.current?.click()}
              >
                <i className="bi bi-image" aria-hidden="true" />
                <span>Imagen para el muro</span>
              </button>
            )}
          </div>
          <button
            className="btn btn-primary btn-sm align-self-start"
            type="submit"
            disabled={busy}
          >
            Publicar noticia
          </button>
        </form>

        <div className="venue-manage-accordion">
          <button
            type="button"
            className={`venue-manage-accordion-toggle${
              newsListOpen ? " is-open" : ""
            }`}
            aria-expanded={newsListOpen}
            aria-controls="venue-manage-news-panel"
            onClick={() => setNewsListOpen((open) => !open)}
          >
            <span>
              Publicadas
              <span className="text-secondary"> · {news.length}</span>
            </span>
            <i
              className={`bi ${newsListOpen ? "bi-chevron-up" : "bi-chevron-down"}`}
              aria-hidden="true"
            />
          </button>

          <div
            id="venue-manage-news-panel"
            className={`venue-manage-accordion-panel${
              newsListOpen ? " is-open" : ""
            }`}
            hidden={!newsListOpen}
          >
            {news.length === 0 ? (
              <p className="text-secondary small mb-0">
                Todavía no hay noticias.
              </p>
            ) : (
              <>
                <label className="venue-manage-search">
                  <i className="bi bi-search" aria-hidden="true" />
                  <input
                    className="form-control"
                    type="search"
                    placeholder="Buscar por palabras clave…"
                    value={newsQuery}
                    onChange={(e) => setNewsQuery(e.target.value)}
                  />
                </label>
                {filteredNews.length === 0 ? (
                  <p className="text-secondary small mb-0">
                    Ninguna noticia coincide con “{newsQuery.trim()}”.
                  </p>
                ) : (
                  <ul className="venue-manage-list">
                    {filteredNews.map((item) => (
                      <li key={item.id} className="venue-manage-item">
                        {item.photos[0] ? (
                          <img
                            src={item.photos[0]}
                            alt=""
                            className="venue-manage-item-thumb"
                          />
                        ) : null}
                        <div className="min-w-0 flex-grow-1">
                          <div className="venue-manage-item-title">
                            <strong className="text-truncate">{item.title}</strong>
                            {!item.active && (
                              <span className="venue-manage-pill">Oculta</span>
                            )}
                          </div>
                          <p className="venue-manage-item-body mb-0">
                            {item.body}
                          </p>
                          <small className="text-secondary">
                            {formatDate(item.publishedAt) ?? "Sin fecha"}
                          </small>
                        </div>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-light"
                          onClick={() => void toggleNews(item)}
                        >
                          {item.active ? "Ocultar" : "Activar"}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        </div>
        </section>

        <section className="venue-manage-section">
        <div className="venue-manage-section-head">
          <h2 className="venue-manage-section-title">Promociones</h2>
          <span className="text-secondary small">{promos.length}</span>
        </div>

        <form className="venue-manage-form" onSubmit={(e) => void createPromo(e)}>
          <input
            className="form-control"
            placeholder="Título"
            value={promoTitle}
            onChange={(e) => setPromoTitle(e.target.value)}
            maxLength={120}
            required
          />
          <label className="venue-manage-price-field">
            <span>UYU</span>
            <input
              className="form-control"
              type="number"
              inputMode="decimal"
              min={0}
              step={1}
              placeholder="Precio"
              value={promoPrice}
              onChange={(e) => setPromoPrice(e.target.value)}
              required
            />
          </label>
          <textarea
            className="form-control"
            placeholder="Detalle de la promo…"
            rows={2}
            value={promoDescription}
            onChange={(e) => setPromoDescription(e.target.value)}
            maxLength={500}
            required
          />
          <div className="venue-manage-validity">
            <label className="venue-manage-validity-field">
              <span>Válida desde</span>
              <input
                className="form-control"
                type="date"
                value={promoValidFrom}
                onChange={(e) => setPromoValidFrom(e.target.value)}
                required
              />
            </label>
            <label className="venue-manage-validity-field">
              <span>Válida hasta</span>
              <input
                className="form-control"
                type="date"
                value={promoValidUntil}
                min={promoValidFrom || undefined}
                onChange={(e) => setPromoValidUntil(e.target.value)}
                required
              />
            </label>
          </div>
          <button
            className="btn btn-primary btn-sm align-self-start"
            type="submit"
            disabled={busy}
          >
            Crear promoción
          </button>
        </form>

        <div className="venue-manage-accordion">
          <button
            type="button"
            className={`venue-manage-accordion-toggle${
              promoListOpen ? " is-open" : ""
            }`}
            aria-expanded={promoListOpen}
            aria-controls="venue-manage-promos-panel"
            onClick={() => setPromoListOpen((open) => !open)}
          >
            <span>
              Publicadas
              <span className="text-secondary"> · {promos.length}</span>
            </span>
            <i
              className={`bi ${
                promoListOpen ? "bi-chevron-up" : "bi-chevron-down"
              }`}
              aria-hidden="true"
            />
          </button>

          <div
            id="venue-manage-promos-panel"
            className={`venue-manage-accordion-panel${
              promoListOpen ? " is-open" : ""
            }`}
            hidden={!promoListOpen}
          >
            {promos.length === 0 ? (
              <p className="text-secondary small mb-0">
                Todavía no hay promociones.
              </p>
            ) : (
              <>
                <label className="venue-manage-search">
                  <i className="bi bi-search" aria-hidden="true" />
                  <input
                    className="form-control"
                    type="search"
                    placeholder="Buscar por palabras clave…"
                    value={promoQuery}
                    onChange={(e) => setPromoQuery(e.target.value)}
                  />
                </label>
                {filteredPromos.length === 0 ? (
                  <p className="text-secondary small mb-0">
                    Ninguna promoción coincide con “{promoQuery.trim()}”.
                  </p>
                ) : (
                  <ul className="venue-manage-list">
                    {filteredPromos.map((item) => {
                      const validity = formatValidityRange(
                        item.validFrom,
                        item.validUntil
                      );
                      const expired =
                        !!item.validUntil &&
                        new Date(item.validUntil).getTime() < Date.now();
                      return (
                      <li key={item.id} className="venue-manage-item">
                        <div className="min-w-0">
                          <div className="venue-manage-item-title">
                            <strong className="text-truncate">{item.title}</strong>
                            {!item.active && (
                              <span className="venue-manage-pill">Oculta</span>
                            )}
                            {item.active && expired && (
                              <span className="venue-manage-pill">Vencida</span>
                            )}
                          </div>
                          <p className="venue-manage-item-body mb-0">
                            {item.description}
                          </p>
                          <div className="venue-manage-item-meta">
                            {formatPriceUyu(item.priceUyu) && (
                              <strong className="venue-manage-price">
                                {formatPriceUyu(item.priceUyu)}
                              </strong>
                            )}
                            {validity && (
                              <small className="text-secondary">{validity}</small>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-light"
                          onClick={() => void togglePromo(item)}
                        >
                          {item.active ? "Ocultar" : "Activar"}
                        </button>
                      </li>
                      );
                    })}
                  </ul>
                )}
              </>
            )}
          </div>
        </div>
        </section>
      </div>

      <section className="venue-manage-payments">
        <div className="venue-manage-payments-copy">
          <span className="venue-manage-payments-logo" aria-hidden="true">
            <i className="bi bi-wallet2" />
          </span>
          <div>
            <div className="venue-manage-payments-title">
              <h2 className="venue-manage-section-title">Cuenta de Mercado Pago</h2>
              <span
                className={`venue-manage-help ${paymentHelpOpen ? "is-open" : ""}`}
              >
                <button
                  type="button"
                  className="venue-manage-help-trigger"
                  aria-label="¿Para qué se usa la cuenta de Mercado Pago?"
                  aria-expanded={paymentHelpOpen}
                  onClick={() => setPaymentHelpOpen((open) => !open)}
                >
                  <i className="bi bi-question-circle" aria-hidden="true" />
                </button>
                <span className="venue-manage-help-popover" role="tooltip">
                  La cuenta se utilizará para recibir el dinero de entradas,
                  promociones y otros cobros realizados desde Nocta.
                </span>
              </span>
            </div>
            <p className="text-secondary small mb-0">
              Vinculá la cuenta donde querés recibir los pagos de este Espacio.
            </p>
          </div>
        </div>
        <button
          type="button"
          className="btn btn-outline-light venue-manage-payments-action"
          onClick={() =>
            toast.info("La vinculación segura con Mercado Pago estará disponible próximamente")
          }
        >
          Configurar cuenta
        </button>
      </section>
    </div>
  );
}

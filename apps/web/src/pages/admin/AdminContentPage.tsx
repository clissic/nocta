import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  timezoneFromCountry,
  todayInTimeZone,
  type Promotion,
  type Venue,
  type VenueNews,
} from "@nocta/shared";
import { useAuth } from "../../auth/AuthContext";
import { api, ApiError } from "../../lib/api";

export function AdminContentPage() {
  const { user } = useAuth();
  const userTimeZone = timezoneFromCountry(user?.profile?.livesIn?.country);
  const [searchParams, setSearchParams] = useSearchParams();
  const venueIdParam = searchParams.get("venueId") ?? "";

  const [venues, setVenues] = useState<Venue[]>([]);
  const [venueId, setVenueId] = useState(venueIdParam);
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [news, setNews] = useState<VenueNews[]>([]);
  const [loadingVenues, setLoadingVenues] = useState(true);
  const [loadingContent, setLoadingContent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [promoTitle, setPromoTitle] = useState("");
  const [promoDescription, setPromoDescription] = useState("");
  const [promoPrice, setPromoPrice] = useState("");
  const [promoValidFrom, setPromoValidFrom] = useState(() =>
    todayInTimeZone(userTimeZone)
  );
  const [promoValidUntil, setPromoValidUntil] = useState("");
  const [newsTitle, setNewsTitle] = useState("");
  const [newsBody, setNewsBody] = useState("");
  const [newsPhoto, setNewsPhoto] = useState<File | null>(null);

  useEffect(() => {
    void api<{ venues: Venue[] }>("/api/venues/admin/all")
      .then((res) => {
        setVenues(res.venues);
        const initial =
          venueIdParam && res.venues.some((v) => v.id === venueIdParam)
            ? venueIdParam
            : res.venues[0]?.id ?? "";
        setVenueId(initial);
        if (initial && initial !== venueIdParam) {
          setSearchParams({ venueId: initial }, { replace: true });
        }
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "No se pudo cargar")
      )
      .finally(() => setLoadingVenues(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar
  }, []);

  useEffect(() => {
    if (!venueId) {
      setPromos([]);
      setNews([]);
      return;
    }
    setLoadingContent(true);
    setError("");
    void Promise.all([
      api<{ promotions: Promotion[] }>(`/api/venues/${venueId}/promotions`),
      api<{ news: VenueNews[] }>(`/api/venues/${venueId}/news`),
    ])
      .then(([promoRes, newsRes]) => {
        setPromos(promoRes.promotions);
        setNews(newsRes.news);
      })
      .catch((err) =>
        setError(
          err instanceof ApiError ? err.message : "No se pudo cargar el contenido"
        )
      )
      .finally(() => setLoadingContent(false));
  }, [venueId]);

  function selectVenue(nextId: string) {
    setVenueId(nextId);
    setSearchParams(nextId ? { venueId: nextId } : {}, { replace: true });
  }

  async function createPromo(e: FormEvent) {
    e.preventDefault();
    if (!venueId || !promoTitle.trim()) return;
    const priceUyu = Number(promoPrice);
    if (!Number.isFinite(priceUyu) || priceUyu < 0) {
      setError("Indicá un precio válido en UYU");
      return;
    }
    if (!promoValidFrom || !promoValidUntil) {
      setError("Indicá el período de validez");
      return;
    }
    if (promoValidUntil < promoValidFrom) {
      setError("La fecha de fin no puede ser anterior al inicio");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await api<{ promotion: Promotion }>(
        `/api/venues/${venueId}/promotions`,
        {
          method: "POST",
          body: JSON.stringify({
            title: promoTitle.trim(),
            description: promoDescription.trim() || promoTitle.trim(),
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
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo crear la promo");
    } finally {
      setBusy(false);
    }
  }

  async function createNews(e: FormEvent) {
    e.preventDefault();
    if (!venueId || !newsTitle.trim() || !newsBody.trim()) return;
    if (!newsPhoto) {
      setError("Subí una imagen para la noticia");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("title", newsTitle.trim());
      form.append("body", newsBody.trim());
      form.append("photo", newsPhoto);

      const res = await api<{ news: VenueNews }>(`/api/venues/${venueId}/news`, {
        method: "POST",
        body: form,
      });
      setNews((prev) => [res.news, ...prev]);
      setNewsTitle("");
      setNewsBody("");
      setNewsPhoto(null);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "No se pudo crear la noticia"
      );
    } finally {
      setBusy(false);
    }
  }

  async function togglePromo(promo: Promotion) {
    setError("");
    try {
      const res = await api<{ promotion: Promotion }>(
        `/api/admin/promotions/${promo.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ active: !promo.active }),
        }
      );
      setPromos((prev) =>
        prev.map((p) => (p.id === promo.id ? res.promotion : p))
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo actualizar");
    }
  }

  async function deactivatePromo(promo: Promotion) {
    setError("");
    try {
      const res = await api<{ promotion: Promotion }>(
        `/api/admin/promotions/${promo.id}`,
        { method: "DELETE" }
      );
      setPromos((prev) =>
        prev.map((p) => (p.id === promo.id ? res.promotion : p))
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo desactivar");
    }
  }

  async function toggleNews(item: VenueNews) {
    setError("");
    try {
      const res = await api<{ news: VenueNews }>(`/api/admin/news/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !item.active }),
      });
      setNews((prev) =>
        prev.map((n) => (n.id === item.id ? res.news : n))
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo actualizar");
    }
  }

  async function deactivateNews(item: VenueNews) {
    setError("");
    try {
      const res = await api<{ news: VenueNews }>(`/api/admin/news/${item.id}`, {
        method: "DELETE",
      });
      setNews((prev) =>
        prev.map((n) => (n.id === item.id ? res.news : n))
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo desactivar");
    }
  }

  const selectedVenue = venues.find((v) => v.id === venueId);

  return (
    <div className="admin-page">
      <header className="admin-page-head">
        <div>
          <p className="admin-page-eyebrow">Administración</p>
          <h1 className="app-title h3 mb-1">Contenido</h1>
          <p className="text-secondary small mb-0">
            Promociones y noticias por Espacio.
          </p>
        </div>
      </header>

      {error && <p className="text-danger small">{error}</p>}

      {loadingVenues ? (
        <p className="text-secondary small mb-0">Cargando espacios…</p>
      ) : venues.length === 0 ? (
        <p className="text-secondary small mb-0">Todavía no hay espacios.</p>
      ) : (
        <>
          <label className="admin-field admin-field-inline">
            <span><i className="bi bi-geo-alt" aria-hidden="true" /> Espacio</span>
            <select
              className="form-select"
              value={venueId}
              onChange={(e) => selectVenue(e.target.value)}
            >
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} {v.active ? "" : "(inactivo)"}
                </option>
              ))}
            </select>
          </label>

          {selectedVenue && (
            <p className="text-secondary small">
              Gestionando <strong className="text-light">{selectedVenue.name}</strong>
            </p>
          )}

          {loadingContent ? (
            <p className="text-secondary small mb-0">Cargando contenido…</p>
          ) : (
            <div className="admin-content-grid">
              <section className="admin-section">
                <h2 className="admin-section-title">Promociones</h2>
                <form className="admin-form admin-form-compact" onSubmit={createPromo}>
                  <label className="admin-field">
                    <span>Título</span>
                    <input
                      className="form-control"
                      value={promoTitle}
                      onChange={(e) => setPromoTitle(e.target.value)}
                      required
                    />
                  </label>
                  <label className="admin-field">
                    <span>Descripción</span>
                    <textarea
                      className="form-control"
                      rows={2}
                      value={promoDescription}
                      onChange={(e) => setPromoDescription(e.target.value)}
                    />
                  </label>
                  <div className="admin-validity-row">
                    <label className="admin-field">
                      <span>Válida desde</span>
                      <input
                        className="form-control"
                        type="date"
                        value={promoValidFrom}
                        onChange={(e) => setPromoValidFrom(e.target.value)}
                        required
                      />
                    </label>
                    <label className="admin-field">
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
                  <label className="admin-field">
                    <span>Precio (UYU)</span>
                    <input
                      className="form-control"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={1}
                      value={promoPrice}
                      onChange={(e) => setPromoPrice(e.target.value)}
                      required
                    />
                  </label>
                  <button
                    className="btn btn-primary btn-sm"
                    type="submit"
                    disabled={busy}
                  >
                    <i className="bi bi-plus-lg" aria-hidden="true" />
                    <span>Crear promo</span>
                  </button>
                </form>

                {promos.length === 0 ? (
                  <p className="text-secondary small mb-0">Sin promociones.</p>
                ) : (
                  <div className="admin-list">
                    {promos.map((p) => (
                      <div key={p.id} className="admin-list-row admin-list-row-stack">
                        <div className="admin-list-body min-w-0">
                          <div className="d-flex flex-wrap align-items-center gap-2">
                            <strong>{p.title}</strong>
                            <span
                              className={`admin-badge ${
                                p.active ? "is-approved" : "is-rejected"
                              }`}
                            >
                              {p.active ? "Activa" : "Inactiva"}
                            </span>
                          </div>
                          {p.description && (
                            <div className="text-secondary small">{p.description}</div>
                          )}
                          {typeof p.priceUyu === "number" && (
                            <div className="small">
                              {new Intl.NumberFormat("es-UY", {
                                style: "currency",
                                currency: "UYU",
                                maximumFractionDigits: 0,
                              }).format(p.priceUyu)}
                            </div>
                          )}
                          {(p.validFrom || p.validUntil) && (
                            <div className="text-secondary small">
                              {p.validFrom
                                ? new Date(p.validFrom).toLocaleDateString(
                                    "es-UY"
                                  )
                                : "—"}
                              {" – "}
                              {p.validUntil
                                ? new Date(p.validUntil).toLocaleDateString(
                                    "es-UY"
                                  )
                                : "—"}
                            </div>
                          )}
                        </div>
                        <div className="admin-list-actions">
                          <button
                            className="btn btn-sm btn-outline-light"
                            type="button"
                            onClick={() => void togglePromo(p)}
                          >
                            <i
                              className={`bi ${p.active ? "bi-toggle-on" : "bi-toggle-off"}`}
                              aria-hidden="true"
                            />
                            <span>{p.active ? "Desactivar" : "Activar"}</span>
                          </button>
                          {p.active && (
                            <button
                              className="btn btn-sm btn-outline-danger"
                              type="button"
                              onClick={() => void deactivatePromo(p)}
                            >
                              <i className="bi bi-power" aria-hidden="true" />
                              <span>Apagar</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="admin-section">
                <h2 className="admin-section-title">Noticias</h2>
                <form className="admin-form admin-form-compact" onSubmit={createNews}>
                  <label className="admin-field">
                    <span>Título</span>
                    <input
                      className="form-control"
                      value={newsTitle}
                      onChange={(e) => setNewsTitle(e.target.value)}
                      required
                    />
                  </label>
                  <label className="admin-field">
                    <span>Contenido</span>
                    <textarea
                      className="form-control"
                      rows={3}
                      value={newsBody}
                      onChange={(e) => setNewsBody(e.target.value)}
                      required
                    />
                  </label>
                  <label className="admin-field">
                    <span>Imagen para el muro</span>
                    <input
                      className="form-control"
                      type="file"
                      accept="image/*"
                      required
                      onChange={(e) => setNewsPhoto(e.target.files?.[0] ?? null)}
                    />
                  </label>
                  <button
                    className="btn btn-primary btn-sm"
                    type="submit"
                    disabled={busy}
                  >
                    <i className="bi bi-plus-lg" aria-hidden="true" />
                    <span>Crear noticia</span>
                  </button>
                </form>

                {news.length === 0 ? (
                  <p className="text-secondary small mb-0">Sin noticias.</p>
                ) : (
                  <div className="admin-list">
                    {news.map((n) => (
                      <div key={n.id} className="admin-list-row admin-list-row-stack">
                        <div className="admin-list-body min-w-0">
                          <div className="d-flex flex-wrap align-items-center gap-2">
                            <strong>{n.title}</strong>
                            <span
                              className={`admin-badge ${
                                n.active ? "is-approved" : "is-rejected"
                              }`}
                            >
                              {n.active ? "Activa" : "Inactiva"}
                            </span>
                          </div>
                          <div className="text-secondary small">{n.body}</div>
                        </div>
                        <div className="admin-list-actions">
                          <button
                            className="btn btn-sm btn-outline-light"
                            type="button"
                            onClick={() => void toggleNews(n)}
                          >
                            <i
                              className={`bi ${n.active ? "bi-toggle-on" : "bi-toggle-off"}`}
                              aria-hidden="true"
                            />
                            <span>{n.active ? "Desactivar" : "Activar"}</span>
                          </button>
                          {n.active && (
                            <button
                              className="btn btn-sm btn-outline-danger"
                              type="button"
                              onClick={() => void deactivateNews(n)}
                            >
                              <i className="bi bi-power" aria-hidden="true" />
                              <span>Apagar</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </>
      )}
    </div>
  );
}

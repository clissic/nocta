import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { AdDetail } from "@nocta/shared";
import { ApiError, api } from "../lib/api";
import { NoctaLoading } from "../components/NoctaLoading";

export function AdPage() {
  const { id = "" } = useParams();
  const [ad, setAd] = useState<AdDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    void api<{ ad: AdDetail }>(`/api/ads/${id}`)
      .then((res) => setAd(res.ad))
      .catch((err) =>
        setError(
          err instanceof ApiError ? err.message : "No se pudo cargar el anuncio"
        )
      )
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <NoctaLoading />;

  if (error || !ad) {
    return (
      <div className="app-screen ad-page fade-in">
        <p className="text-danger mb-3">{error || "Anuncio no encontrado"}</p>
        <Link className="btn btn-outline-light" to="/discover">
          Volver a Discover
        </Link>
      </div>
    );
  }

  const external =
    ad.ctaUrl.startsWith("http://") || ad.ctaUrl.startsWith("https://");

  return (
    <div className="app-screen ad-page fade-in">
      <header className="ad-page-head">
        <Link
          className="btn btn-outline-light ad-page-back"
          to="/discover"
          aria-label="Volver a Discover"
        >
          <i className="bi bi-arrow-left" aria-hidden="true" />
        </Link>
        <div>
          <p className="text-secondary small mb-1">
            Anuncio
            {ad.sponsorName ? ` · ${ad.sponsorName}` : ""}
          </p>
          <h1 className="app-title h3 mb-0">{ad.title}</h1>
        </div>
      </header>

      <div className="ad-page-hero">
        <img src={ad.imageUrl} alt="" />
      </div>

      {(ad.subtitle || ad.body) && (
        <div className="ad-page-copy">
          {ad.subtitle && <p className="lead mb-2">{ad.subtitle}</p>}
          {ad.body && <p className="text-secondary mb-0">{ad.body}</p>}
        </div>
      )}

      <div className="ad-page-actions">
        {external ? (
          <a
            className="btn btn-primary"
            href={ad.ctaUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {ad.ctaLabel || "Ver más"}
            <i className="bi bi-box-arrow-up-right ms-2" aria-hidden="true" />
          </a>
        ) : (
          <Link className="btn btn-primary" to={ad.ctaUrl}>
            {ad.ctaLabel || "Ver más"}
          </Link>
        )}
        <Link className="btn btn-outline-light" to="/discover">
          Seguir descubriendo
        </Link>
      </div>
    </div>
  );
}

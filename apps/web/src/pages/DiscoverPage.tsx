import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  INTEREST_LABELS,
  LOOKING_FOR_LABELS,
  type DiscoverCard,
  type Interest,
  type LookingFor,
  type Presence,
} from "@nocta/shared";
import { api, ApiError } from "../lib/api";

type MatchFlash = {
  matchId: string;
  name: string;
  photo?: string;
};

export function DiscoverPage() {
  const [cards, setCards] = useState<DiscoverCard[]>([]);
  const [presence, setPresence] = useState<Presence | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [matchFlash, setMatchFlash] = useState<MatchFlash | null>(null);
  const [photoIdx, setPhotoIdx] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const presenceRes = await api<{ presence: Presence | null }>("/api/presence/me");
      setPresence(presenceRes.presence);
      if (!presenceRes.presence) {
        setCards([]);
        return;
      }
      const feed = await api<{ cards: DiscoverCard[] }>("/api/discover/feed");
      setCards(feed.cards);
      setPhotoIdx(0);
    } catch (err) {
      if (err instanceof ApiError && err.code === "NO_PRESENCE") {
        setPresence(null);
        setCards([]);
      } else {
        setError(err instanceof ApiError ? err.message : "Error al cargar");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const current = cards[0];
  const photos = current?.profile.photos ?? [];

  async function swipe(direction: "like" | "pass") {
    if (!current) return;
    const swiped = current;
    setCards((prev) => prev.slice(1));
    setPhotoIdx(0);
    try {
      const res = await api<{ match: { id: string } | null }>("/api/discover/swipe", {
        method: "POST",
        body: JSON.stringify({ toUserId: swiped.userId, direction }),
      });
      if (res.match) {
        setMatchFlash({
          matchId: res.match.id,
          name: swiped.profile.name,
          photo: swiped.profile.photos[0],
        });
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al swippear");
      void load();
    }
  }

  if (loading) {
    return (
      <div className="app-screen justify-content-center align-items-center text-secondary fade-in">
        Cargando…
      </div>
    );
  }

  if (!presence) {
    return (
      <div className="app-screen justify-content-center fade-in">
        <h1 className="app-title h3 mb-2">Todavía no estás publicado</h1>
        <p className="text-secondary mb-3">
          Elegí un local y publicá tu perfil para ver quién más va.
        </p>
        <Link className="btn btn-primary" to="/">
          Ver locales
        </Link>
      </div>
    );
  }

  return (
    <div
      className="app-screen flush d-flex flex-column flex-grow-1 fade-in"
      style={{ minHeight: 0 }}
    >
      <div className="d-flex align-items-center justify-content-between px-3 px-md-0 py-2">
        <div>
          <div className="app-title h5 mb-0">Discover</div>
          <div className="text-secondary small">{presence.venue?.name}</div>
        </div>
        <button
          className="btn btn-sm btn-link link-secondary text-decoration-none"
          type="button"
          aria-label="Dejar de publicar"
          onClick={async () => {
            await api("/api/presence/me", { method: "DELETE" });
            setPresence(null);
            setCards([]);
          }}
        >
          <i className="bi bi-eye-slash fs-5" aria-hidden="true" />
        </button>
      </div>

      {error && <p className="text-danger small px-3 mb-0">{error}</p>}

      {!current ? (
        <div className="app-screen justify-content-center text-secondary">
          No hay más perfiles en este local por ahora.
        </div>
      ) : (
        <div className="swipe-deck px-2 pb-2">
          <div className="swipe-card">
            <div className="photo-segments">
              {photos.map((_, i) => (
                <span key={i} className={i === photoIdx ? "on" : undefined} />
              ))}
            </div>
            <img
              src={photos[photoIdx] ?? photos[0]}
              alt={current.profile.name}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const left = e.clientX - rect.left < rect.width / 2;
                setPhotoIdx((i) => {
                  if (left) return Math.max(0, i - 1);
                  return Math.min(photos.length - 1, i + 1);
                });
              }}
            />
            <div className="swipe-gradient" />
            <div className="swipe-meta">
              <h2 className="h3 mb-1 text-white">
                {current.profile.name}, {current.age}
                {current.profile.heightCm ? (
                  <span className="fs-6 fw-normal opacity-75">
                    {" "}
                    · {current.profile.heightCm} cm
                  </span>
                ) : null}
              </h2>
              <p className="small mb-1 opacity-90">
                {current.profile.lookingFor
                  .map((l) => LOOKING_FOR_LABELS[l as LookingFor] ?? l)
                  .join(" · ")}
              </p>
              {current.profile.bio && (
                <p className="mb-2 small opacity-90">{current.profile.bio}</p>
              )}
              <p className="small mb-0 opacity-75">
                {current.profile.interests
                  .slice(0, 5)
                  .map((i) => INTEREST_LABELS[i as Interest] ?? i)
                  .join(" · ")}
              </p>
            </div>
            <div className="swipe-actions">
              <button
                className="btn btn-light"
                type="button"
                aria-label="Pass"
                onClick={() => void swipe("pass")}
              >
                <i className="bi bi-x-lg fs-4 text-danger" aria-hidden="true" />
              </button>
              <button
                className="btn btn-primary"
                type="button"
                aria-label="Like"
                onClick={() => void swipe("like")}
              >
                <i className="bi bi-heart-fill fs-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      )}

      {matchFlash && (
        <div className="match-overlay" role="dialog" aria-modal="true" aria-label="Match">
          <button
            type="button"
            className="match-overlay-backdrop"
            aria-label="Cerrar"
            onClick={() => setMatchFlash(null)}
          />
          <div className="match-overlay-panel">
            <div className="match-burst" aria-hidden="true">
              <span className="match-ring match-ring-a" />
              <span className="match-ring match-ring-b" />
              <span className="match-ring match-ring-c" />
              {matchFlash.photo ? (
                <img className="match-photo" src={matchFlash.photo} alt="" />
              ) : (
                <span className="match-icon">
                  <i className="bi bi-heart-fill" />
                </span>
              )}
            </div>
            <p className="match-kicker">¡Es un match!</p>
            <h2 className="match-title">{matchFlash.name}</h2>
            <p className="match-sub">
              Ambos se gustaron en {presence.venue?.name ?? "el local"}.
            </p>
            <div className="match-actions">
              <Link
                className="btn btn-primary"
                to={`/matches/${matchFlash.matchId}`}
                onClick={() => setMatchFlash(null)}
              >
                Ir al chat
              </Link>
              <button
                type="button"
                className="btn btn-outline-light"
                onClick={() => setMatchFlash(null)}
              >
                Seguir descubriendo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

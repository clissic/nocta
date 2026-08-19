import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { ReceivedLike, ReceivedLikesResponse } from "@nocta/shared";
import { api, ApiError } from "../lib/api";
import { useToast } from "../components/ToastProvider";
import { PremiumPackagesModal } from "../components/PremiumPackagesModal";
import { NoctaLoading } from "../components/NoctaLoading";

const FALLBACK_PHOTO =
  "https://images.unsplash.com/photo-1511367461989-f85a21fda167?w=400";

function formatLikeTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return date.toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }
  return date.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
  });
}

export function LikesPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [likes, setLikes] = useState<ReceivedLike[]>([]);
  const [viewerPremium, setViewerPremium] = useState(false);
  const [premiumModalOpen, setPremiumModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const data = await api<ReceivedLikesResponse>("/api/discover/likes");
      setLikes(data.likes ?? []);
      setViewerPremium(data.viewerPremium);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "No se pudieron cargar los likes"
      );
      setLikes([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function openLike(like: ReceivedLike) {
    if (!viewerPremium || !like.user.id) {
      setPremiumModalOpen(true);
      return;
    }
    navigate(`/discover?userId=${encodeURIComponent(like.user.id)}`);
  }

  if (loading) {
    return (
      <NoctaLoading />
    );
  }

  if (!likes.length) {
    return (
      <div className="app-screen likes-empty-page fade-in">
        <div className="likes-empty-visual" aria-hidden="true">
          <span className="likes-empty-orbit is-one" />
          <span className="likes-empty-orbit is-two" />
          <span className="likes-empty-orbit is-three" />
          <span className="likes-empty-core">
            <i className="bi bi-heart-fill" />
          </span>
        </div>
        <div className="likes-empty-copy">
          <p className="likes-empty-eyebrow">Likes</p>
          <h1 className="app-title display-6 mb-2">Todavía nadie te dio like</h1>
          <p className="text-secondary mb-0">
            Cuando alguien del mismo Espacio te dé like, aparece acá para que
            puedas responder.
          </p>
          <div className="likes-empty-actions">
            <Link className="btn btn-primary" to="/discover">
              <i className="bi bi-fire me-2" aria-hidden="true" />
              Ir al Discover
            </Link>
            <Link className="btn btn-outline-light" to="/venues">
              Explorar espacios
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-screen likes-page fade-in">
      <div className="likes-head">
        <div>
          <h1 className="app-title h3 mb-1">Likes</h1>
          <p className="text-secondary small mb-0">
            Personas que te dieron like y todavía no respondiste.
          </p>
        </div>
      </div>

      <div className="likes-grid">
        {likes.map((like) => {
          return (
            <article
              key={like.id}
              className={`likes-card${viewerPremium ? "" : " is-locked"}`}
              role="button"
              tabIndex={0}
              aria-label={
                viewerPremium
                  ? `Ver el perfil de ${like.user.name} en Discover`
                  : `Conocer quién te dio like en ${like.venueName}`
              }
              onClick={() => openLike(like)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openLike(like);
                }
              }}
            >
              <div className="likes-card-media">
                {viewerPremium && (like.user.photo || FALLBACK_PHOTO) ? (
                  <img src={like.user.photo || FALLBACK_PHOTO} alt="" />
                ) : (
                  <div className="likes-card-locked-media" aria-hidden="true">
                    <span className="likes-card-locked-blob is-one" />
                    <span className="likes-card-locked-blob is-two" />
                    <span className="likes-card-locked-blob is-three" />
                    <i className="bi bi-lock-fill" />
                  </div>
                )}
                <div className="likes-card-fade" />
                <div className="likes-card-caption">
                  <h2 className="likes-card-name">
                    {viewerPremium && like.user.name ? (
                      <>
                        {like.user.name}
                        <span> · {like.user.age}</span>
                      </>
                    ) : (
                      <>
                        <span
                          className="likes-card-name-placeholder"
                          aria-hidden="true"
                        />
                        <span> · {like.user.age}</span>
                      </>
                    )}
                  </h2>
                  <p className="likes-card-venue mb-0">
                    {like.venueName}
                    <span aria-hidden="true"> · </span>
                    {formatLikeTime(like.createdAt)}
                  </p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {premiumModalOpen && (
        <PremiumPackagesModal onClose={() => setPremiumModalOpen(false)} />
      )}
    </div>
  );
}

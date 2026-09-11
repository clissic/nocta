import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import type { ReceivedLike, ReceivedLikesResponse } from "@nocta/shared";
import { useAuth } from "../auth/AuthContext";
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
  const [searchParams, setSearchParams] = useSearchParams();
  const { refresh } = useAuth();
  const [likes, setLikes] = useState<ReceivedLike[]>([]);
  const [canSeeLikes, setCanSeeLikes] = useState(false);
  const [premiumModalOpen, setPremiumModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLike, setActionLike] = useState<ReceivedLike | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await api<ReceivedLikesResponse>("/api/discover/likes");
      setLikes(data.likes ?? []);
      setCanSeeLikes(Boolean(data.canSeeLikes));
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

  useEffect(() => {
    const status = searchParams.get("premium");
    if (!status) return;
    if (status === "success") {
      toast.success("Premium activado. ¡Bienvenido a Nocta Premium!");
      void refresh().then(() => void load());
    } else if (status === "pending") {
      toast.info("Pago pendiente. Te avisamos cuando se confirme.");
    } else if (status === "failure") {
      toast.error("No se completó el pago. Podés intentar de nuevo.");
      setPremiumModalOpen(true);
    }
    const next = new URLSearchParams(searchParams);
    next.delete("premium");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, toast, refresh]);

  function isRevealed(like: ReceivedLike) {
    return Boolean(like.isHeartshot || (canSeeLikes && like.user.id));
  }

  function openLike(like: ReceivedLike) {
    if (like.isHeartshot && like.user.id) {
      setActionLike(like);
      return;
    }
    if (!canSeeLikes || !like.user.id) {
      setPremiumModalOpen(true);
      return;
    }
    if (!like.canRespond) {
      toast.info("Publicate en este Espacio para abrir Discover");
      navigate(`/venues/${encodeURIComponent(like.venueId)}`);
      return;
    }
    navigate(
      `/discover?userId=${encodeURIComponent(like.user.id)}&venueId=${encodeURIComponent(like.venueId)}`
    );
  }

  async function respondToHeartshot(direction: "like" | "pass") {
    if (!actionLike?.user.id || actionBusy) return;
    if (!actionLike.canRespond) {
      toast.error("Publicate en el mismo Espacio para responder");
      navigate(`/venues/${encodeURIComponent(actionLike.venueId)}`);
      return;
    }
    setActionBusy(true);
    try {
      const res = await api<{ match?: { id: string } | null }>(
        "/api/discover/swipe",
        {
          method: "POST",
          body: JSON.stringify({
            toUserId: actionLike.user.id,
            direction,
            venueId: actionLike.venueId,
          }),
        }
      );
      setLikes((prev) => prev.filter((item) => item.id !== actionLike.id));
      setActionLike(null);
      if (direction === "like" && res.match?.id) {
        toast.success("¡Es un match!");
        navigate(`/matches/${res.match.id}`);
      } else if (direction === "like") {
        toast.success("Like enviado");
      } else {
        toast.info("Heartshot rechazado");
      }
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo responder"
      );
    } finally {
      setActionBusy(false);
    }
  }

  if (loading) {
    return <NoctaLoading />;
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
          const revealed = isRevealed(like);
          return (
            <article
              key={like.id}
              className={`likes-card${revealed ? "" : " is-locked"}${
                like.isHeartshot ? " is-heartshot" : ""
              }`}
              role="button"
              tabIndex={0}
              aria-label={
                like.isHeartshot && like.user.name
                  ? `Responder Heartshot de ${like.user.name}`
                  : revealed
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
                {revealed && (like.user.photo || FALLBACK_PHOTO) ? (
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
                {like.isHeartshot ? (
                  <span className="likes-card-heartshot-badge">
                    <i className="bi bi-arrow-through-heart" aria-hidden="true" />
                    Heartshot
                  </span>
                ) : null}
                <div className="likes-card-caption">
                  <h2 className="likes-card-name">
                    {revealed && like.user.name ? (
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

      {actionLike && (
        <div className="logout-confirm-layer" role="presentation">
          <button
            type="button"
            className="logout-confirm-backdrop"
            aria-label="Cerrar"
            onClick={() => setActionLike(null)}
          />
          <section
            className="logout-confirm-dialog likes-heartshot-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="likes-heartshot-title"
          >
            <div className="likes-heartshot-dialog-photo" aria-hidden="true">
              <img
                src={actionLike.user.photo || FALLBACK_PHOTO}
                alt=""
              />
            </div>
            <h2 id="likes-heartshot-title">
              {actionLike.user.name ?? "Alguien"} te mandó un Heartshot
            </h2>
            <p>
              {actionLike.canRespond
                ? "Podés darle like para matchear o rechazarlo."
                : "Publicate en el mismo Espacio para poder responder."}
            </p>
            <div className="logout-confirm-actions">
              {!actionLike.canRespond ? (
                <Link
                  className="btn btn-primary"
                  to={`/venues/${encodeURIComponent(actionLike.venueId)}`}
                  onClick={() => setActionLike(null)}
                >
                  Publicate en este Espacio
                </Link>
              ) : null}
              <button
                type="button"
                className="btn btn-outline-light"
                disabled={actionBusy || !actionLike.canRespond}
                onClick={() => void respondToHeartshot("pass")}
              >
                Rechazar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={actionBusy || !actionLike.canRespond}
                onClick={() => void respondToHeartshot("like")}
              >
                Dar like
              </button>
            </div>
          </section>
        </div>
      )}

      {premiumModalOpen && (
        <PremiumPackagesModal onClose={() => setPremiumModalOpen(false)} />
      )}
    </div>
  );
}

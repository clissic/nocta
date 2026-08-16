import { useCallback, useEffect, useRef, useState } from "react";
import type {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
} from "react";
import { Link } from "react-router-dom";
import {
  DRINKING_LABELS,
  EDUCATION_LEVEL_LABELS,
  FITNESS_LABELS,
  INTEREST_LABELS,
  LANGUAGE_LABELS,
  LOOKING_FOR_LABELS,
  PETS_LABELS,
  SEXUAL_ORIENTATION_LABELS,
  SOCIAL_NETWORKS,
  SOCIAL_NETWORK_LABELS,
  WORK_STATUS_LABELS,
  ZODIAC_INSIGHTS,
  ZODIAC_LABELS,
  type Drinking,
  type DiscoverCard,
  type DiscoverFeedResponse,
  type DiscoverRewindResponse,
  type DiscoverSwipeResponse,
  type EducationLevel,
  type Fitness,
  type Interest,
  type Language,
  type LikeAllowance,
  type LookingFor,
  type Pets,
  type Presence,
  type SexualOrientation,
  type WorkStatus,
  type ZodiacSign,
} from "@nocta/shared";
import { DiscoverProfileDetail } from "../components/DiscoverProfileDetail";
import { api, ApiError } from "../lib/api";
import { useToast } from "../components/ToastProvider";

type MatchFlash = {
  matchId: string;
  name: string;
  photo?: string;
};

type SwipeDirection = "like" | "pass";

type PhotoExtra = {
  icon: string;
  title: string;
  body: string;
};

function photoExtra(
  card: DiscoverCard,
  photoIndex: number
): PhotoExtra | null {
  const profile = card.profile;
  switch (photoIndex) {
    case 0: {
      const looking = profile.lookingFor
        .map((l) => LOOKING_FOR_LABELS[l as LookingFor] ?? l)
        .filter(Boolean);
      if (!looking.length) return null;
      return {
        icon: "bi-search-heart",
        title: "Busca",
        body: looking.join(" · "),
      };
    }
    case 1: {
      const bio = profile.bio?.trim();
      if (!bio) return null;
      return { icon: "bi-chat-quote", title: "Sobre mí", body: bio };
    }
    case 2: {
      const interests = profile.interests
        .slice(0, 10)
        .map((i) => INTEREST_LABELS[i as Interest] ?? i)
        .filter(Boolean);
      if (!interests.length) return null;
      return {
        icon: "bi-stars",
        title: "Gustos",
        body: interests.join(" · "),
      };
    }
    case 3:
      if (!profile.heightCm) return null;
      return {
        icon: "bi-rulers",
        title: "Altura",
        body: `${profile.heightCm} cm`,
      };
    case 4:
      {
        const work = [
          profile.workStatus
            ? WORK_STATUS_LABELS[profile.workStatus as WorkStatus] ??
              profile.workStatus
            : null,
          profile.jobTitle,
          profile.company,
          profile.studiedAt ? `Estudió en ${profile.studiedAt}` : null,
          profile.educationLevel
            ? EDUCATION_LEVEL_LABELS[
                profile.educationLevel as EducationLevel
              ] ?? profile.educationLevel
            : null,
        ].filter(Boolean);
        if (!work.length) return null;
        return {
          icon: "bi-briefcase",
          title: "Trabajo",
          body: work.join(" · "),
        };
      }
    case 5: {
      const country = profile.livesIn?.country?.trim();
      const city = profile.livesIn?.city?.trim();
      if (!country || !city) return null;
      return {
        icon: "bi-geo-alt",
        title: "Vive en",
        body: `${country}, ${city}`,
      };
    }
    case 6: {
      const identity = [
        profile.sexualOrientation
          ? SEXUAL_ORIENTATION_LABELS[
              profile.sexualOrientation as SexualOrientation
            ] ?? profile.sexualOrientation
          : null,
        ...(profile.languages ?? []).map(
          (language) =>
            LANGUAGE_LABELS[language as Language] ?? language
        ),
      ].filter(Boolean);
      if (!identity.length) return null;
      return {
        icon: "bi-translate",
        title: "Orientación e idiomas",
        body: identity.join(" · "),
      };
    }
    case 7: {
      if (!profile.zodiac) return null;
      const zodiac = profile.zodiac as ZodiacSign;
      const insight = ZODIAC_INSIGHTS[zodiac];
      const compatible = insight.compatibleWith
        .map((sign) => ZODIAC_LABELS[sign])
        .join(" y ");
      return {
        icon: "bi-moon-stars",
        title: "Zodíaco",
        body: `${ZODIAC_LABELS[zodiac]}\n${insight.traits}\nEspecialmente compatible con ${compatible}`,
      };
    }
    case 8: {
      const lifestyle = [
        profile.pets
          ? `Mascotas: ${PETS_LABELS[profile.pets as Pets] ?? profile.pets}`
          : null,
        profile.drinking
          ? `Bebidas: ${
              DRINKING_LABELS[profile.drinking as Drinking] ??
              profile.drinking
            }`
          : null,
        profile.fitness
          ? `Fitness: ${
              FITNESS_LABELS[profile.fitness as Fitness] ?? profile.fitness
            }`
          : null,
      ].filter(Boolean);
      if (!lifestyle.length) return null;
      return {
        icon: "bi-heart-pulse",
        title: "Estilo de vida",
        body: lifestyle.join(" · "),
      };
    }
    case 9: {
      const networks = SOCIAL_NETWORKS.map((network) => {
        const handle = profile.socials?.[network]?.trim();
        return handle
          ? `${SOCIAL_NETWORK_LABELS[network]}: @${handle.replace(/^@/, "")}`
          : null;
      }).filter(Boolean);
      if (!networks.length) return null;
      return {
        icon: "bi-at",
        title: "Redes sociales",
        body: networks.join(" · "),
      };
    }
    default:
      return null;
  }
}

function formatCountdown(rechargeAt: string | null, now: number) {
  if (!rechargeAt) return "00:00:00";
  const remaining = Math.max(0, new Date(rechargeAt).getTime() - now);
  const totalSeconds = Math.ceil(remaining / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

const SWIPE_THRESHOLD = 90;
const SWIPE_EXIT_MS = 240;

export function DiscoverPage() {
  const toast = useToast();
  const [cards, setCards] = useState<DiscoverCard[]>([]);
  const [presence, setPresence] = useState<Presence | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [matchFlash, setMatchFlash] = useState<MatchFlash | null>(null);
  const [likeAllowance, setLikeAllowance] = useState<LikeAllowance | null>(
    null
  );
  const [likeLimitOpen, setLikeLimitOpen] = useState(false);
  const [countdownNow, setCountdownNow] = useState(Date.now());
  const [photoIdx, setPhotoIdx] = useState(0);
  const [detailOpen, setDetailOpen] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [settling, setSettling] = useState(false);
  const [exitDirection, setExitDirection] = useState<SwipeDirection | null>(
    null
  );
  const [canRewind, setCanRewind] = useState(false);
  const [followingBusy, setFollowingBusy] = useState(false);
  const [followingIds, setFollowingIds] = useState<Set<string>>(
    () => new Set()
  );
  const [requestedIds, setRequestedIds] = useState<Set<string>>(
    () => new Set()
  );
  const [followPulse, setFollowPulse] = useState<"follow" | "unfollow" | null>(
    null
  );
  const [rewindBusy, setRewindBusy] = useState(false);
  const lastSwipedRef = useRef<DiscoverCard | null>(null);
  const followPulseTimer = useRef<number | null>(null);
  const dragStartX = useRef(0);
  const dragStartY = useRef(0);
  const dragXRef = useRef(0);
  const activePointerId = useRef<number | null>(null);
  const didDrag = useRef(false);
  const settleTimer = useRef<number | null>(null);
  const cardScrollRef = useRef<HTMLDivElement | null>(null);

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
      const feed = await api<DiscoverFeedResponse>("/api/discover/feed");
      setCards(feed.cards);
      setLikeAllowance(feed.likeAllowance);
      setFollowingIds(
        new Set(
          feed.cards.filter((c) => c.isFollowing).map((c) => c.userId)
        )
      );
      setRequestedIds(
        new Set(
          feed.cards.filter((c) => c.isFollowRequested).map((c) => c.userId)
        )
      );
      setPhotoIdx(0);
      setDetailOpen(false);
      lastSwipedRef.current = null;
      setCanRewind(false);
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

  useEffect(() => {
    if (!likeLimitOpen) return;
    setCountdownNow(Date.now());
    const interval = window.setInterval(() => setCountdownNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [likeLimitOpen]);

  useEffect(() => {
    if (
      !likeLimitOpen ||
      !likeAllowance?.rechargeAt ||
      new Date(likeAllowance.rechargeAt).getTime() > countdownNow
    ) {
      return;
    }
    setLikeLimitOpen(false);
    void load();
  }, [countdownNow, likeAllowance, likeLimitOpen, load]);

  const current = cards[0];
  const next = cards[1];
  const photos = (current?.profile.photos ?? []).filter(Boolean);
  const nextPhoto = (next?.profile.photos ?? []).find(Boolean);
  const photoExtraInfo = current ? photoExtra(current, photoIdx) : null;
  const swipeProgress = exitDirection
    ? 1
    : Math.min(1, Math.abs(dragX) / 110);

  useEffect(() => {
    setDetailOpen(false);
    setPhotoIdx(0);
    setSettling(false);
    if (settleTimer.current) {
      window.clearTimeout(settleTimer.current);
      settleTimer.current = null;
    }
    if (cardScrollRef.current) cardScrollRef.current.scrollTop = 0;
  }, [current?.userId]);

  useEffect(() => {
    return () => {
      if (settleTimer.current) window.clearTimeout(settleTimer.current);
      if (followPulseTimer.current) window.clearTimeout(followPulseTimer.current);
    };
  }, []);

  async function swipe(direction: SwipeDirection) {
    if (!current) return;
    const swiped = current;
    setDetailOpen(false);
    setCards((prev) => prev.slice(1));
    setPhotoIdx(0);
    try {
      const res = await api<DiscoverSwipeResponse>("/api/discover/swipe", {
        method: "POST",
        body: JSON.stringify({ toUserId: swiped.userId, direction }),
      });
      setLikeAllowance(res.likeAllowance);
      lastSwipedRef.current = swiped;
      setCanRewind(true);
      if (res.match) {
        setMatchFlash({
          matchId: res.match.id,
          name: swiped.profile.name,
          photo: swiped.profile.photos[0],
        });
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === "LIKES_EXHAUSTED") {
        const allowance = err.data.likeAllowance as LikeAllowance | undefined;
        if (allowance) setLikeAllowance(allowance);
        setCards((prev) => [swiped, ...prev]);
        setPhotoIdx(0);
        setDetailOpen(false);
        setLikeLimitOpen(true);
        return;
      }
      setError(err instanceof ApiError ? err.message : "Error al swippear");
      void load();
    }
  }

  async function rewind() {
    if (!canRewind || rewindBusy || exitDirection) return;
    setRewindBusy(true);
    setMatchFlash(null);
    try {
      const res = await api<DiscoverRewindResponse>("/api/discover/rewind", {
        method: "POST",
      });
      setLikeAllowance(res.likeAllowance);
      const restored = res.card ?? lastSwipedRef.current;
      if (restored) {
        setCards((prev) => {
          if (prev.some((c) => c.userId === restored.userId)) return prev;
          return [restored, ...prev];
        });
        setPhotoIdx(0);
        setDetailOpen(false);
      }
      lastSwipedRef.current = null;
      setCanRewind(false);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo volver atrás"
      );
    } finally {
      setRewindBusy(false);
    }
  }

  async function toggleFollowCurrent() {
    if (!current || followingBusy || exitDirection) return;
    const userId = current.userId;
    const isFollowing = followingIds.has(userId);
    const isRequested = requestedIds.has(userId);
    const cancelling = isFollowing || isRequested;

    setFollowingBusy(true);
    setFollowPulse(cancelling ? "unfollow" : "follow");
    if (followPulseTimer.current) window.clearTimeout(followPulseTimer.current);
    followPulseTimer.current = window.setTimeout(() => {
      setFollowPulse(null);
      followPulseTimer.current = null;
    }, 650);

    if (cancelling) {
      setFollowingIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
      setRequestedIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    } else {
      setRequestedIds((prev) => new Set(prev).add(userId));
    }

    try {
      const res = await api<{
        isFollowing: boolean;
        isFollowRequested: boolean;
        status: string;
      }>(`/api/users/${userId}/follow`, {
        method: cancelling ? "DELETE" : "POST",
      });
      setFollowingIds((prev) => {
        const next = new Set(prev);
        if (res.isFollowing) next.add(userId);
        else next.delete(userId);
        return next;
      });
      setRequestedIds((prev) => {
        const next = new Set(prev);
        if (res.isFollowRequested) next.add(userId);
        else next.delete(userId);
        return next;
      });
      toast.success(
        cancelling
          ? isFollowing
            ? "Dejaste de seguir"
            : "Solicitud cancelada"
          : "Solicitud enviada"
      );
    } catch (err) {
      if (cancelling) {
        if (isFollowing) {
          setFollowingIds((prev) => new Set(prev).add(userId));
        } else if (isRequested) {
          setRequestedIds((prev) => new Set(prev).add(userId));
        }
      } else {
        setRequestedIds((prev) => {
          const next = new Set(prev);
          next.delete(userId);
          return next;
        });
      }
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo actualizar"
      );
    } finally {
      setFollowingBusy(false);
    }
  }

  function animateSwipe(direction: SwipeDirection) {
    if (!current || exitDirection) return;
    setIsDragging(false);
    setExitDirection(direction);
    window.setTimeout(() => {
      dragXRef.current = 0;
      setDragX(0);
      setExitDirection(null);
      void swipe(direction);
    }, SWIPE_EXIT_MS);
  }

  function changePhotoFromTap(clientX: number, cardWidth: number) {
    if (photos.length <= 1) return;
    const left = clientX < cardWidth / 2;
    setPhotoIdx((i) => {
      if (left) return Math.max(0, i - 1);
      return Math.min(photos.length - 1, i + 1);
    });
  }

  function onCardPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (exitDirection || e.button !== 0) return;
    const target = e.target as Element | null;
    if (target?.closest("button, a, input, textarea, select")) return;
    // En perfil ampliado, el cuerpo scrollea nativo; el swipe sigue desde la foto.
    if (detailOpen && target?.closest(".discover-detail-info")) return;

    activePointerId.current = e.pointerId;
    dragStartX.current = e.clientX;
    dragStartY.current = e.clientY;
    dragXRef.current = 0;
    didDrag.current = false;
  }

  function onCardPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (activePointerId.current !== e.pointerId) return;

    const deltaX = e.clientX - dragStartX.current;
    const deltaY = e.clientY - dragStartY.current;

    if (!didDrag.current) {
      const verticalBias = detailOpen ? 6 : 8;
      const horizontalBias = detailOpen ? 14 : 10;
      if (
        Math.abs(deltaY) > verticalBias &&
        Math.abs(deltaY) >= Math.abs(deltaX)
      ) {
        // Scroll vertical: soltamos el gesto para no pelear con el touch
        activePointerId.current = null;
        return;
      }
      if (
        Math.abs(deltaX) <= horizontalBias ||
        Math.abs(deltaX) <= Math.abs(deltaY)
      ) {
        return;
      }
      didDrag.current = true;
      setIsDragging(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    }

    dragXRef.current = deltaX;
    setDragX(deltaX);
  }

  function finishCardDrag(e: ReactPointerEvent<HTMLDivElement>) {
    if (activePointerId.current !== e.pointerId) return;

    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    activePointerId.current = null;
    setIsDragging(false);

    if (!didDrag.current) {
      const target = e.target as Element | null;
      if (
        target?.closest(
          ".swipe-actions, .swipe-meta, .swipe-expand-btn, .discover-detail-info"
        )
      ) {
        return;
      }
      if (!target?.closest(".swipe-card-photo-hit")) return;
      const hit = target.closest(".swipe-card-photo-hit") as HTMLElement;
      const rect = hit.getBoundingClientRect();
      changePhotoFromTap(e.clientX - rect.left, rect.width);
      return;
    }

    const threshold = Math.max(
      SWIPE_THRESHOLD,
      e.currentTarget.clientWidth * 0.22
    );
    if (dragXRef.current >= threshold) {
      animateSwipe("like");
    } else if (dragXRef.current <= -threshold) {
      animateSwipe("pass");
    } else {
      dragXRef.current = 0;
      setDragX(0);
      // Mantener transform un instante para animar el retorno (sobre todo en detalle).
      if (settleTimer.current) window.clearTimeout(settleTimer.current);
      setSettling(true);
      settleTimer.current = window.setTimeout(() => {
        setSettling(false);
        settleTimer.current = null;
      }, 230);
    }
  }

  function cancelCardDrag(e: ReactPointerEvent<HTMLDivElement>) {
    if (activePointerId.current !== e.pointerId) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    activePointerId.current = null;
    dragXRef.current = 0;
    didDrag.current = false;
    setIsDragging(false);
    setDragX(0);
    if (settleTimer.current) window.clearTimeout(settleTimer.current);
    setSettling(false);
  }

  const cardStyle = {
    "--swipe-x": `${dragX}px`,
    "--swipe-rotate": `${dragX / 24}deg`,
    "--swipe-like-opacity": Math.min(1, Math.max(0, dragX / 90)),
    "--swipe-pass-opacity": Math.min(1, Math.max(0, -dragX / 90)),
  } as CSSProperties;

  const stackStyle = {
    "--swipe-progress": String(swipeProgress),
  } as CSSProperties;
  const likesExhausted =
    !likeAllowance?.unlimited && likeAllowance?.remainingLikes === 0;

  if (loading) {
    return (
      <div className="app-screen justify-content-center align-items-center text-secondary fade-in">
        Cargando…
      </div>
    );
  }

  if (!presence) {
    return (
      <div className="app-screen discover-empty-page fade-in">
        <div className="discover-empty-visual" aria-hidden="true">
          <span className="discover-empty-orbit is-one" />
          <span className="discover-empty-orbit is-two" />
          <span className="discover-empty-orbit is-three" />
          <span className="discover-empty-dot is-one" />
          <span className="discover-empty-dot is-two" />
          <span className="discover-empty-dot is-three" />
          <span className="discover-empty-core">
            <img
              className="discover-empty-core-logo"
              src="/images/nocta-logo-negro-nobg.png"
              alt=""
            />
          </span>
        </div>

        <div className="discover-empty-copy">
          <p className="discover-empty-eyebrow">Discover</p>
          <h1 className="app-title display-6 mb-2">
            La noche empieza en un Espacio
          </h1>
          <p className="text-secondary mb-0">
            Publicá tu perfil para descubrir a las personas que están saliendo
            en el mismo lugar que vos.
          </p>

          <div className="discover-empty-actions">
            <Link className="btn btn-primary" to="/venues">
              <i className="bi bi-geo-alt-fill me-2" aria-hidden="true" />
              Explorar espacios
              <i className="bi bi-arrow-right ms-2" aria-hidden="true" />
            </Link>
            <Link className="btn btn-outline-light" to="/profile">
              <i className="bi bi-person me-2" aria-hidden="true" />
              Ver mi perfil
            </Link>
          </div>

          <p className="discover-empty-note mb-0">
            Tu perfil permanece oculto hasta que decidas publicarte.
          </p>
        </div>
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
        <div className="discover-deck-empty">
          <div
            className="discover-empty-visual discover-deck-empty-visual"
            aria-hidden="true"
          >
            <span className="discover-empty-orbit is-one" />
            <span className="discover-empty-orbit is-two" />
            <span className="discover-empty-orbit is-three" />
            <span className="discover-empty-dot is-one" />
            <span className="discover-empty-dot is-two" />
            <span className="discover-empty-dot is-three" />
            <span className="discover-empty-core discover-deck-empty-core">
              <i className="bi bi-check2-all" />
            </span>
          </div>

          <div className="discover-empty-copy">
            <p className="discover-empty-eyebrow">Deck completo</p>
            <h1 className="app-title display-6 mb-2">
              Ya viste a todos por ahora
            </h1>
            <p className="text-secondary mb-0">
              Recorriste todos los perfiles disponibles en{" "}
              <strong>{presence.venue?.name ?? "este Espacio"}</strong>. Volvé
              más tarde: la noche siempre suma gente nueva.
            </p>

            <div className="discover-empty-actions">
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => void load()}
              >
                <i className="bi bi-arrow-clockwise me-2" aria-hidden="true" />
                Volver a revisar
              </button>
              <Link className="btn btn-outline-light" to="/venues">
                <i className="bi bi-geo-alt me-2" aria-hidden="true" />
                Explorar espacios
              </Link>
            </div>

            <p className="discover-empty-note mb-0">
              Solo aparecen personas publicadas en el mismo Espacio que vos.
            </p>
          </div>
        </div>
      ) : (
        <div className="swipe-deck px-2 pb-2">
          <div className="swipe-stack" style={stackStyle}>
            {next && (
              <div
                key={`next-${next.userId}`}
                className="swipe-card swipe-card-next"
                aria-hidden="true"
                style={
                  nextPhoto
                    ? ({
                        "--swipe-next-photo": `url(${JSON.stringify(nextPhoto)})`,
                      } as CSSProperties)
                    : undefined
                }
              >
                {!nextPhoto && <div className="swipe-card-fallback" />}
                <div className="swipe-gradient" />
                <div className="swipe-meta">
                  <h2 className="h3 mb-0 text-white">
                    {next.profile.name}, {next.age}
                  </h2>
                </div>
              </div>
            )}

            <div className="swipe-slot">
              <div
                key={current.userId}
                className={[
                  "swipe-card",
                  "swipe-card-top",
                  detailOpen ? "is-detail-open" : "",
                  isDragging || exitDirection || settling ? "is-motion" : "",
                  isDragging ? "is-dragging" : "",
                  exitDirection ? `is-exiting-${exitDirection}` : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={cardStyle}
                onPointerDown={onCardPointerDown}
                onPointerMove={onCardPointerMove}
                onPointerUp={finishCardDrag}
                onPointerCancel={cancelCardDrag}
              >
                <div className="swipe-stamp swipe-stamp-pass" aria-hidden="true">
                  <i className="bi bi-x-lg" />
                </div>
                <div className="swipe-stamp swipe-stamp-like" aria-hidden="true">
                  <i
                    className={`bi ${
                      likesExhausted ? "bi-clock-history" : "bi-heart-fill"
                    }`}
                  />
                </div>

                <div className="swipe-card-scroller" ref={cardScrollRef}>
                  {detailOpen ? (
                    <DiscoverProfileDetail
                      card={current}
                      photoIndex={photoIdx}
                      onCollapse={() => {
                        setDetailOpen(false);
                        if (cardScrollRef.current) {
                          cardScrollRef.current.scrollTop = 0;
                        }
                      }}
                    />
                  ) : (
                    <div className="swipe-card-compact">
                      <div className="photo-segments">
                        {photos.map((_, i) => (
                          <span
                            key={i}
                            className={i === photoIdx ? "on" : undefined}
                          />
                        ))}
                      </div>
                      <div className="swipe-card-photo-hit">
                        <img
                          className="swipe-card-photo"
                          src={photos[photoIdx] ?? photos[0]}
                          alt={current.profile.name}
                          draggable={false}
                        />
                      </div>
                      <div className="swipe-gradient" />
                      <div className="swipe-meta">
                        <div className="swipe-meta-heading">
                          <h2 className="h3 mb-0 text-white">
                            {current.profile.name}, {current.age}
                          </h2>
                          <button
                            type="button"
                            className="swipe-expand-btn"
                            aria-label="Ver perfil ampliado"
                            aria-expanded={detailOpen}
                            onClick={() => {
                              setDetailOpen(true);
                              if (cardScrollRef.current) {
                                cardScrollRef.current.scrollTop = 0;
                              }
                            }}
                          >
                            <i
                              className="bi bi-chevron-up"
                              aria-hidden="true"
                            />
                          </button>
                        </div>
                        {photoExtraInfo && (
                          <div className="swipe-meta-extra">
                            <p className="swipe-meta-label text-secondary small mb-1">
                              <i
                                className={`bi ${photoExtraInfo.icon}`}
                                aria-hidden="true"
                              />
                              <span>{photoExtraInfo.title}</span>
                            </p>
                            <p className="small mb-0 opacity-90">
                              {photoExtraInfo.body}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div
                className={[
                  "swipe-actions",
                  exitDirection ? "is-exiting" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <button
                  className="btn btn-light swipe-action-secondary"
                  type="button"
                  aria-label="Volver a la tarjeta anterior"
                  disabled={
                    Boolean(exitDirection) || !canRewind || rewindBusy
                  }
                  onClick={() => void rewind()}
                >
                  <i className="bi bi-arrow-counterclockwise" aria-hidden="true" />
                </button>
                <button
                  className="btn btn-light swipe-action-primary"
                  type="button"
                  aria-label="Pass"
                  disabled={Boolean(exitDirection)}
                  onClick={() => animateSwipe("pass")}
                >
                  <i className="bi bi-x-lg" aria-hidden="true" />
                </button>
                <button
                  className="btn btn-primary swipe-action-primary"
                  type="button"
                  aria-label="Like"
                  disabled={Boolean(exitDirection)}
                  onClick={() => animateSwipe("like")}
                >
                  <i
                    className={`bi ${
                      likesExhausted ? "bi-clock-history" : "bi-heart-fill"
                    }`}
                    aria-hidden="true"
                  />
                </button>
                <button
                  className={[
                    "btn btn-light swipe-action-secondary",
                    current && followingIds.has(current.userId)
                      ? "is-following"
                      : "",
                    current && requestedIds.has(current.userId)
                      ? "is-requested"
                      : "",
                    followPulse === "follow" ? "is-pulse-follow" : "",
                    followPulse === "unfollow" ? "is-pulse-unfollow" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  type="button"
                  aria-label={
                    current && followingIds.has(current.userId)
                      ? "Dejar de seguir"
                      : current && requestedIds.has(current.userId)
                        ? "Cancelar solicitud"
                        : "Enviar solicitud de seguimiento"
                  }
                  aria-pressed={Boolean(
                    current &&
                      (followingIds.has(current.userId) ||
                        requestedIds.has(current.userId))
                  )}
                  disabled={Boolean(exitDirection) || followingBusy || !current}
                  onClick={() => void toggleFollowCurrent()}
                >
                  <i
                    className={`bi ${
                      current && followingIds.has(current.userId)
                        ? "bi-person-check-fill"
                        : current && requestedIds.has(current.userId)
                          ? "bi-hourglass-split"
                          : "bi-person-plus"
                    }`}
                    aria-hidden="true"
                  />
                </button>
              </div>
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
              Ambos se gustaron en {presence.venue?.name ?? "el espacio"}.
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

      {likeLimitOpen && likeAllowance && (
        <div
          className="match-overlay like-limit-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Likes agotados"
        >
          <button
            type="button"
            className="match-overlay-backdrop"
            aria-label="Cerrar"
            onClick={() => setLikeLimitOpen(false)}
          />
          <div className="match-overlay-panel">
            <div className="match-burst" aria-hidden="true">
              <span className="match-ring match-ring-a" />
              <span className="match-ring match-ring-b" />
              <span className="match-ring match-ring-c" />
              <span className="match-icon like-limit-icon">
                <i className="bi bi-clock-history" />
              </span>
            </div>
            <p className="match-kicker like-limit-kicker">Likes en pausa</p>
            <h2 className="match-title like-limit-countdown">
              {formatCountdown(likeAllowance.rechargeAt, countdownNow)}
            </h2>
            <p className="match-sub">
              Usaste tus {likeAllowance.limit ?? 50} likes. Cuando termine el
              contador vas a recuperarlos todos.
            </p>
            <div className="match-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setLikeLimitOpen(false)}
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

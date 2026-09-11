import { useCallback, useEffect, useRef, useState } from "react";
import type {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
} from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
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
  VENUE_TYPE_LABELS,
  planHasFeature,
  AD_SWIPE_INTERVAL_MIN,
  AD_SWIPE_INTERVAL_MAX,
  isDiscoverAdCard,
  type Drinking,
  type DiscoverAdCard,
  type DiscoverCard,
  type DiscoverDeckItem,
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
import { OverflowFade } from "../components/OverflowFade";
import { api, ApiError } from "../lib/api";
import { useToast } from "../components/ToastProvider";
import { NoctaLoading } from "../components/NoctaLoading";
import { DiscoverSafetyModal,
  type DiscoverSafetyAction,
} from "../components/DiscoverSafetyModal";
import { PremiumPackagesModal } from "../components/PremiumPackagesModal";
import { OptimizedImage } from "../components/OptimizedImage";
import { VenueTrustBadge } from "../components/VenueTrustBadge";
import {
  DISCOVER_SWIPE_SIZES,
  DISCOVER_SWIPE_VARIANTS,
  discoverVisiblePhotoPlan,
  useDiscoverSwipePhotoVariant,
} from "../lib/discoverImages";
import { VENUE_PHOTO_FALLBACK, venueCoverSrc } from "../lib/venuePhoto";
import { useAuth } from "../auth/AuthContext";

type MatchFlash = {
  matchId: string;
  name: string;
  photo?: string;
};

function nextAdThreshold() {
  return (
    AD_SWIPE_INTERVAL_MIN +
    Math.floor(
      Math.random() * (AD_SWIPE_INTERVAL_MAX - AD_SWIPE_INTERVAL_MIN + 1)
    )
  );
}

type SwipeDirection = "like" | "pass";
type ExitDirection = SwipeDirection | "heartshot";

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
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const [searchParams] = useSearchParams();
  const focusedUserId = searchParams.get("userId");
  const focusedVenueId = searchParams.get("venueId");
  const [cards, setCards] = useState<DiscoverDeckItem[]>([]);
  const [presence, setPresence] = useState<Presence | null>(null);
  const [presences, setPresences] = useState<Presence[]>([]);
  const [maxPresences, setMaxPresences] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [matchFlash, setMatchFlash] = useState<MatchFlash | null>(null);
  const [likeAllowance, setLikeAllowance] = useState<LikeAllowance | null>(
    null
  );
  const [likeLimitOpen, setLikeLimitOpen] = useState(false);
  const [premiumModalOpen, setPremiumModalOpen] = useState(false);
  const [countdownNow, setCountdownNow] = useState(Date.now());
  const [photoIdx, setPhotoIdx] = useState(0);
  const [detailOpen, setDetailOpen] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [settling, setSettling] = useState(false);
  const [exitDirection, setExitDirection] = useState<ExitDirection | null>(
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
  const [boostBusy, setBoostBusy] = useState(false);
  const [safetyBusy, setSafetyBusy] = useState(false);
  const [safetyDialog, setSafetyDialog] = useState<{
    action: DiscoverSafetyAction;
    userId: string;
    name: string;
  } | null>(null);
  const followPulseTimer = useRef<number | null>(null);
  const dragStartX = useRef(0);
  const dragStartY = useRef(0);
  const dragXRef = useRef(0);
  const dragYRef = useRef(0);
  const dragAxisRef = useRef<"x" | "y" | null>(null);
  const activePointerId = useRef<number | null>(null);
  const didDrag = useRef(false);
  const settleTimer = useRef<number | null>(null);
  const cardScrollRef = useRef<HTMLDivElement | null>(null);
  const swipesUntilAdRef = useRef(nextAdThreshold());

  const load = useCallback(
    async (venueId?: string | null) => {
      setLoading(true);
      setError("");
      try {
        const presenceRes = await api<{
          presence: Presence | null;
          presences?: Presence[];
          maxPresences?: number;
        }>("/api/presence/me");
        const list =
          presenceRes.presences ??
          (presenceRes.presence ? [presenceRes.presence] : []);
        setPresences(list);
        setMaxPresences(presenceRes.maxPresences ?? 1);

        if (!list.length) {
          setPresence(null);
          setCards([]);
          return;
        }

        const targetVenueId =
          venueId ??
          (focusedVenueId &&
          list.some((row) => row.venueId === focusedVenueId)
            ? focusedVenueId
            : null) ??
          (list.length === 1 ? list[0]!.venueId : null);

        if (!targetVenueId) {
          setPresence(null);
          setCards([]);
          return;
        }

        const chosen =
          list.find((row) => row.venueId === targetVenueId) ?? null;
        if (!chosen) {
          setPresence(null);
          setCards([]);
          setError("No estás publicado en ese Espacio");
          return;
        }

        setPresence(chosen);

        const params = new URLSearchParams();
        params.set("venueId", chosen.venueId);
        if (focusedUserId) params.set("userId", focusedUserId);
        const feed = await api<DiscoverFeedResponse>(
          `/api/discover/feed?${params.toString()}`
        );
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
        setCanRewind(false);
      } catch (err) {
        if (err instanceof ApiError && err.code === "NO_PRESENCE") {
          setPresence(null);
          setCards([]);
        } else if (err instanceof ApiError && err.code === "SELECT_VENUE") {
          setPresence(null);
          setCards([]);
        } else {
          setError(err instanceof ApiError ? err.message : "Error al cargar");
        }
      } finally {
        setLoading(false);
      }
    },
    [focusedUserId, focusedVenueId]
  );

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
  const currentAd = current && isDiscoverAdCard(current) ? current : null;
  const currentProfile =
    current && !isDiscoverAdCard(current) ? current : null;
  const nextAd = next && isDiscoverAdCard(next) ? next : null;
  const nextProfile = next && !isDiscoverAdCard(next) ? next : null;
  const photos = currentAd
    ? [currentAd.imageUrl].filter(Boolean)
    : (currentProfile?.profile.photos ?? []).filter(Boolean);
  const nextPhoto = nextAd
    ? nextAd.imageUrl
    : (nextProfile?.profile.photos ?? []).find(Boolean);
  const swipePhotoVariant = useDiscoverSwipePhotoVariant();
  const { renderSrc: activeSwipePhoto, preloadNext } = discoverVisiblePhotoPlan({
    currentPhotos: photos,
    photoIndex: currentAd ? 0 : photoIdx,
    nextPrimaryPhoto: nextPhoto,
    detailOpen,
  });
  const photoExtraInfo =
    currentProfile ? photoExtra(currentProfile, photoIdx) : null;
  const swipeProgress = exitDirection
    ? 1
    : Math.min(1, Math.max(Math.abs(dragX), Math.abs(dragY)) / 110);
  const deckKey = currentAd
    ? `ad:${currentAd.id}`
    : currentProfile
      ? `user:${currentProfile.userId}`
      : "";

  useEffect(() => {
    setDetailOpen(false);
    setPhotoIdx(0);
    setSettling(false);
    if (settleTimer.current) {
      window.clearTimeout(settleTimer.current);
      settleTimer.current = null;
    }
    if (cardScrollRef.current) cardScrollRef.current.scrollTop = 0;
  }, [deckKey]);

  useEffect(() => {
    return () => {
      if (settleTimer.current) window.clearTimeout(settleTimer.current);
      if (followPulseTimer.current) window.clearTimeout(followPulseTimer.current);
    };
  }, []);

  async function maybeInsertAd() {
    if (user?.premium && planHasFeature(user.premiumPlanId, "no_ads")) return;
    swipesUntilAdRef.current -= 1;
    if (swipesUntilAdRef.current > 0) return;
    swipesUntilAdRef.current = nextAdThreshold();
    try {
      const res = await api<{ ad: DiscoverAdCard | null }>("/api/ads/next");
      if (res.ad) {
        setCards((prev) => {
          if (prev.some((c) => isDiscoverAdCard(c) && c.id === res.ad!.id)) {
            return prev;
          }
          return [res.ad!, ...prev];
        });
      }
    } catch {
      /* sin anuncio disponible */
    }
  }

  async function swipe(direction: SwipeDirection, isHeartshot = false) {
    if (!current) return;

    if (isDiscoverAdCard(current)) {
      const ad = current;
      setDetailOpen(false);
      setCards((prev) => prev.slice(1));
      setPhotoIdx(0);
      setCanRewind(false);
      if (direction === "like") {
        navigate(ad.href || `/ads/${ad.id}`);
      }
      return;
    }

    const swiped = current;
    setDetailOpen(false);
    setCards((prev) => prev.slice(1));
    setPhotoIdx(0);
    try {
      const res = await api<DiscoverSwipeResponse>("/api/discover/swipe", {
        method: "POST",
        body: JSON.stringify({
          toUserId: swiped.userId,
          direction,
          ...(presence?.venueId ? { venueId: presence.venueId } : {}),
          ...(isHeartshot ? { isHeartshot: true } : {}),
        }),
      });
      setLikeAllowance(res.likeAllowance);
      setCanRewind(true);
      if (isHeartshot && user) {
        setUser({
          ...user,
          heartshotsRemaining: Math.max(0, (user.heartshotsRemaining ?? 0) - 1),
        });
      }
      if (res.match) {
        setMatchFlash({
          matchId: res.match.id,
          name: swiped.profile.name,
          photo: swiped.profile.photos[0],
        });
      }
      void maybeInsertAd();
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
      if (
        err instanceof ApiError &&
        (err.code === "NO_HEARTSHOTS" ||
          err.code === "PLAN_REQUIRED" ||
          err.code === "PREMIUM_REQUIRED")
      ) {
        setCards((prev) => [swiped, ...prev]);
        setPhotoIdx(0);
        if (err.code === "NO_HEARTSHOTS") {
          toast.error(err.message);
        } else {
          setPremiumModalOpen(true);
        }
        return;
      }
      setError(err instanceof ApiError ? err.message : "Error al swippear");
      void load();
    }
  }

  async function activateBoost() {
    if (boostBusy) return;
    if (!planHasFeature(user?.premiumPlanId, "boost")) {
      setPremiumModalOpen(true);
      return;
    }
    if ((user?.boostsRemaining ?? 0) <= 0) {
      toast.error("No te quedan Boosts este periodo");
      return;
    }
    if (user?.boostExpiresAt && new Date(user.boostExpiresAt).getTime() > Date.now()) {
      toast.info("Ya tenés un Boost activo");
      return;
    }
    setBoostBusy(true);
    try {
      const res = await api<{
        user: typeof user;
        boostExpiresAt: string | null;
        boostsRemaining: number;
      }>("/api/premium/boost", {
        method: "POST",
        body: JSON.stringify({}),
      });
      if (res.user) setUser(res.user);
      toast.success("Boost activado · prioridad 30 min");
    } catch (err) {
      if (
        err instanceof ApiError &&
        (err.code === "PLAN_REQUIRED" || err.code === "PREMIUM_REQUIRED")
      ) {
        setPremiumModalOpen(true);
      } else {
        toast.error(
          err instanceof ApiError ? err.message : "No se pudo activar el Boost"
        );
      }
    } finally {
      setBoostBusy(false);
    }
  }

  async function rewind() {
    if (exitDirection || rewindBusy) return;
    if (!user?.premium) {
      setPremiumModalOpen(true);
      return;
    }
    if (!canRewind) return;
    setRewindBusy(true);
    setMatchFlash(null);
    try {
      const res = await api<DiscoverRewindResponse>("/api/discover/rewind", {
        method: "POST",
        body: JSON.stringify(
          presence?.venueId ? { venueId: presence.venueId } : {}
        ),
      });
      setLikeAllowance(res.likeAllowance);
      const restored = res.card;
      if (restored) {
        setCards((prev) => {
          if (
            prev.some(
              (c) => !isDiscoverAdCard(c) && c.userId === restored.userId
            )
          ) {
            return prev;
          }
          return [restored, ...prev];
        });
        setPhotoIdx(0);
        setDetailOpen(false);
      }
      setCanRewind(false);
    } catch (err) {
      if (err instanceof ApiError && err.code === "PREMIUM_REQUIRED") {
        setPremiumModalOpen(true);
        return;
      }
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo volver atrás"
      );
    } finally {
      setRewindBusy(false);
    }
  }

  async function toggleFollowCurrent() {
    if (!currentProfile || followingBusy || exitDirection) return;
    const userId = currentProfile.userId;
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

  function openSafetyAction(action: DiscoverSafetyAction) {
    if (!currentProfile) return;
    setSafetyDialog({
      action,
      userId: currentProfile.userId,
      name: currentProfile.profile.name,
    });
  }

  const closeSafetyDialog = useCallback(() => {
    if (!safetyBusy) setSafetyDialog(null);
  }, [safetyBusy]);

  async function confirmSafetyAction() {
    if (!safetyDialog || safetyBusy) return;
    if (safetyDialog.action === "report") {
      const userId = safetyDialog.userId;
      setSafetyDialog(null);
      navigate(`/report/${userId}`);
      return;
    }

    setSafetyBusy(true);
    try {
      await api(`/api/users/${safetyDialog.userId}/block`, {
        method: "POST",
      });
      const blockedUserId = safetyDialog.userId;
      setCards((prev) =>
        prev.filter(
          (card) => isDiscoverAdCard(card) || card.userId !== blockedUserId
        )
      );
      setFollowingIds((prev) => {
        const next = new Set(prev);
        next.delete(blockedUserId);
        return next;
      });
      setRequestedIds((prev) => {
        const next = new Set(prev);
        next.delete(blockedUserId);
        return next;
      });
      setDetailOpen(false);
      setPhotoIdx(0);
      setCanRewind(false);
      setSafetyDialog(null);
      toast.success("Usuario bloqueado");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo bloquear"
      );
    } finally {
      setSafetyBusy(false);
    }
  }

  function animateSwipe(direction: SwipeDirection, isHeartshot = false) {
    if (!current || exitDirection) return;
    setIsDragging(false);
    setExitDirection(
      isHeartshot ? "heartshot" : direction === "pass" ? "pass" : "like"
    );
    window.setTimeout(() => {
      dragXRef.current = 0;
      dragYRef.current = 0;
      dragAxisRef.current = null;
      setDragX(0);
      setDragY(0);
      setExitDirection(null);
      void swipe(direction, isHeartshot);
    }, SWIPE_EXIT_MS);
  }

  function tryHeartshot() {
    if (!current || isDiscoverAdCard(current)) return false;
    if (!planHasFeature(user?.premiumPlanId, "heartshot")) {
      setPremiumModalOpen(true);
      return false;
    }
    if ((user?.heartshotsRemaining ?? 0) <= 0) {
      toast.error("No te quedan Heartshots este periodo");
      return false;
    }
    animateSwipe("like", true);
    return true;
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
    dragYRef.current = 0;
    dragAxisRef.current = null;
    didDrag.current = false;
  }

  function onCardPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (activePointerId.current !== e.pointerId) return;

    const deltaX = e.clientX - dragStartX.current;
    const deltaY = e.clientY - dragStartY.current;

    if (!didDrag.current) {
      const verticalBias = detailOpen ? 6 : 8;
      const horizontalBias = detailOpen ? 14 : 10;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      // Swipe arriba → Heartshot (no en anuncios).
      if (
        deltaY < -verticalBias &&
        absY >= absX &&
        current &&
        !isDiscoverAdCard(current)
      ) {
        didDrag.current = true;
        dragAxisRef.current = "y";
        setIsDragging(true);
        e.currentTarget.setPointerCapture(e.pointerId);
      } else if (deltaY > verticalBias && absY >= absX) {
        // Scroll / gesto hacia abajo: soltamos para no pelear con el touch.
        activePointerId.current = null;
        return;
      } else if (absX > horizontalBias && absX > absY) {
        didDrag.current = true;
        dragAxisRef.current = "x";
        setIsDragging(true);
        e.currentTarget.setPointerCapture(e.pointerId);
      } else {
        return;
      }
    }

    if (dragAxisRef.current === "y") {
      const up = Math.min(0, deltaY);
      dragXRef.current = 0;
      dragYRef.current = up;
      setDragX(0);
      setDragY(up);
      return;
    }

    dragXRef.current = deltaX;
    dragYRef.current = 0;
    setDragX(deltaX);
    setDragY(0);
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

    const axis = dragAxisRef.current;
    dragAxisRef.current = null;

    const threshold = Math.max(
      SWIPE_THRESHOLD,
      e.currentTarget.clientWidth * 0.22
    );
    const upThreshold = Math.max(
      SWIPE_THRESHOLD,
      e.currentTarget.clientHeight * 0.18
    );

    if (axis === "y") {
      const shouldSettle =
        dragYRef.current > -upThreshold || !tryHeartshot();
      if (shouldSettle) {
        dragXRef.current = 0;
        dragYRef.current = 0;
        setDragX(0);
        setDragY(0);
        if (settleTimer.current) window.clearTimeout(settleTimer.current);
        setSettling(true);
        settleTimer.current = window.setTimeout(() => {
          setSettling(false);
          settleTimer.current = null;
        }, 230);
      }
      return;
    }

    if (dragXRef.current >= threshold) {
      animateSwipe("like");
    } else if (dragXRef.current <= -threshold) {
      animateSwipe("pass");
    } else {
      dragXRef.current = 0;
      dragYRef.current = 0;
      setDragX(0);
      setDragY(0);
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
    dragYRef.current = 0;
    dragAxisRef.current = null;
    didDrag.current = false;
    setIsDragging(false);
    setDragX(0);
    setDragY(0);
    if (settleTimer.current) window.clearTimeout(settleTimer.current);
    setSettling(false);
  }

  const cardStyle = {
    "--swipe-x": `${dragX}px`,
    "--swipe-y": `${dragY}px`,
    "--swipe-rotate": `${dragX / 24}deg`,
    "--swipe-like-opacity": Math.min(1, Math.max(0, dragX / 90)),
    "--swipe-pass-opacity": Math.min(1, Math.max(0, -dragX / 90)),
    "--swipe-heartshot-opacity": Math.min(1, Math.max(0, -dragY / 90)),
  } as CSSProperties;

  const stackStyle = {
    "--swipe-progress": String(swipeProgress),
  } as CSSProperties;
  const likesExhausted =
    !likeAllowance?.unlimited && likeAllowance?.remainingLikes === 0;

  if (loading) {
    return (
      <NoctaLoading />
    );
  }

  if (!presence) {
    if (presences.length > 1) {
      return (
        <div className="app-screen discover-venue-picker fade-in">
          <div className="discover-venue-picker-shell">
            <div className="discover-venue-picker-copy">
              <p className="discover-empty-eyebrow mb-1">
                <i className="bi bi-people me-1" aria-hidden="true" />
                Clone
              </p>
              <h1 className="app-title h3 mb-2">Elegí un Espacio</h1>
              <p className="text-secondary mb-0">
                Estás publicado en {presences.length} de {maxPresences}. Tocá
                uno para entrar a su Discover.
              </p>
            </div>
            <div className="discover-venue-picker-grid">
              {presences.map((row) => {
                const venue = row.venue;
                const name = venue?.name ?? "Espacio";
                const typeLabel = venue?.type
                  ? VENUE_TYPE_LABELS[venue.type]
                  : null;
                return (
                  <button
                    key={row.id}
                    type="button"
                    className="venue-card discover-venue-picker-card"
                    onClick={() => void load(row.venueId)}
                    aria-label={`Abrir Discover en ${name}`}
                  >
                    <div className="venue-card-media discover-venue-picker-media">
                      {venue ? (
                        <OptimizedImage
                          src={venueCoverSrc(venue)}
                          alt=""
                          variant="thumb"
                          variants={DISCOVER_SWIPE_VARIANTS}
                          sizes="(max-width: 767px) 50vw, 220px"
                          fallbackSrc={VENUE_PHOTO_FALLBACK}
                        />
                      ) : (
                        <span
                          className="discover-venue-picker-fallback"
                          aria-hidden="true"
                        >
                          <i className="bi bi-geo-alt" />
                        </span>
                      )}
                      <div className="venue-card-fade" />
                      <div className="venue-card-caption">
                        {typeLabel ? (
                          <div className="venue-card-type">{typeLabel}</div>
                        ) : null}
                        <div className="venue-card-name">
                          <span className="venue-card-name-text text-truncate">
                            {name}
                          </span>
                          {venue ? (
                            <VenueTrustBadge
                              ownerId={venue.ownerId}
                              showUnclaimed={false}
                            />
                          ) : null}
                        </div>
                        {venue?.address ? (
                          <div className="venue-card-address text-truncate">
                            {venue.address}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      );
    }

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
      <div className="d-flex align-items-center justify-content-between px-3 px-md-0 py-2 gap-2">
        <div className="min-w-0 d-flex align-items-center gap-2">
          {presences.length > 1 && (
            <button
              type="button"
              className="btn btn-sm btn-link link-secondary text-decoration-none px-1"
              aria-label="Cambiar Espacio"
              onClick={() => {
                setPresence(null);
                setCards([]);
              }}
            >
              <i className="bi bi-arrow-left fs-5" aria-hidden="true" />
            </button>
          )}
          <div className="min-w-0">
            <div className="app-title h5 mb-0">Discover</div>
            <div className="text-secondary small text-truncate">
              {presence.venue?.name}
            </div>
          </div>
        </div>
        <div className="d-flex align-items-center gap-1 flex-shrink-0">
          <button
            className={[
              "btn btn-sm discover-boost-btn",
              user?.boostExpiresAt &&
              new Date(user.boostExpiresAt).getTime() > Date.now()
                ? "is-active"
                : "",
              !planHasFeature(user?.premiumPlanId, "boost")
                ? "is-premium-hook"
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
            type="button"
            disabled={boostBusy}
            aria-label={
              planHasFeature(user?.premiumPlanId, "boost")
                ? `Boost · ${user?.boostsRemaining ?? 0} restantes`
                : "Boost con Premium 4 A.M."
            }
            onClick={() => void activateBoost()}
          >
            <i className="bi bi-rocket-takeoff" aria-hidden="true" />
            <span className="discover-boost-count">
              {planHasFeature(user?.premiumPlanId, "boost")
                ? user?.boostExpiresAt &&
                  new Date(user.boostExpiresAt).getTime() > Date.now()
                  ? "ON"
                  : String(user?.boostsRemaining ?? 0)
                : "·"}
            </span>
          </button>
          <button
            className="btn btn-sm btn-link link-secondary text-decoration-none"
            type="button"
            aria-label="Dejar de publicar"
            onClick={async () => {
              const venueId = presence.venueId;
              await api(
                `/api/presence/me${
                  venueId ? `?venueId=${encodeURIComponent(venueId)}` : ""
                }`,
                { method: "DELETE" }
              );
              await load(null);
            }}
          >
            <i className="bi bi-eye-slash fs-5" aria-hidden="true" />
          </button>
        </div>
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
                key={
                  nextAd
                    ? `next-ad-${nextAd.id}`
                    : `next-${nextProfile!.userId}`
                }
                className={[
                  "swipe-card",
                  "swipe-card-next",
                  nextAd ? "swipe-card-ad" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-hidden="true"
              >
                {preloadNext ? (
                  <OptimizedImage
                    key={`preload-${preloadNext}`}
                    className="swipe-card-photo swipe-card-next-photo"
                    src={preloadNext}
                    alt=""
                    variant="thumb"
                    variants={DISCOVER_SWIPE_VARIANTS}
                    sizes={DISCOVER_SWIPE_SIZES}
                    loading="eager"
                    fetchPriority="low"
                    draggable={false}
                  />
                ) : (
                  <div className="swipe-card-fallback" />
                )}
                <div className="swipe-gradient" />
                <div className="swipe-meta">
                  <h2 className="h3 mb-0 text-white">
                    {nextAd
                      ? nextAd.title
                      : `${nextProfile!.profile.name}, ${nextProfile!.age}`}
                  </h2>
                </div>
              </div>
            )}

            <div className="swipe-slot">
              <div
                key={deckKey}
                className={[
                  "swipe-card",
                  "swipe-card-top",
                  currentAd ? "swipe-card-ad" : "",
                  detailOpen && currentProfile ? "is-detail-open" : "",
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
                      currentAd
                        ? "bi-box-arrow-up-right"
                        : likesExhausted
                          ? "bi-clock-history"
                          : "bi-heart-fill"
                    }`}
                  />
                </div>
                <div
                  className="swipe-stamp swipe-stamp-heartshot"
                  aria-hidden="true"
                >
                  <i className="bi bi-arrow-through-heart" />
                </div>

                <OverflowFade
                  className="swipe-card-scroller"
                  fadeClassName="swipe-card-scroller-fade"
                  scrollRef={cardScrollRef}
                >
                  {currentAd ? (
                    <div className="swipe-card-compact">
                      <div className="swipe-card-photo-hit">
                        <OptimizedImage
                          className="swipe-card-photo"
                          src={currentAd.imageUrl}
                          alt={currentAd.title}
                          variant={swipePhotoVariant}
                          variants={DISCOVER_SWIPE_VARIANTS}
                          sizes={DISCOVER_SWIPE_SIZES}
                          loading="eager"
                          fetchPriority="high"
                          draggable={false}
                        />
                      </div>
                      <div className="swipe-gradient" />
                      <div className="swipe-meta">
                        <p className="swipe-ad-eyebrow small mb-1 text-uppercase">
                          Anuncio
                          {currentAd.sponsorName
                            ? ` · ${currentAd.sponsorName}`
                            : ""}
                        </p>
                        <div className="swipe-meta-heading">
                          <h2 className="h3 mb-0 text-white">
                            {currentAd.title}
                          </h2>
                        </div>
                        {(currentAd.subtitle || currentAd.body) && (
                          <div className="swipe-meta-extra">
                            {currentAd.subtitle && (
                              <p className="small mb-1 opacity-90">
                                {currentAd.subtitle}
                              </p>
                            )}
                            {currentAd.body && (
                              <p className="small mb-0 opacity-75">
                                {currentAd.body}
                              </p>
                            )}
                          </div>
                        )}
                        <p className="swipe-ad-cta small mb-0 mt-2">
                          {currentAd.ctaLabel || "Ver más"} · Like para abrir
                        </p>
                      </div>
                    </div>
                  ) : detailOpen && currentProfile ? (
                    <DiscoverProfileDetail
                      card={currentProfile}
                      photoIndex={photoIdx}
                      onBlock={() => openSafetyAction("block")}
                      onReport={() => openSafetyAction("report")}
                      onCollapse={() => {
                        setDetailOpen(false);
                        if (cardScrollRef.current) {
                          cardScrollRef.current.scrollTop = 0;
                        }
                      }}
                    />
                  ) : currentProfile ? (
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
                        {activeSwipePhoto ? (
                          <OptimizedImage
                            key={`${deckKey}:${photoIdx}:${activeSwipePhoto}`}
                            className="swipe-card-photo"
                            src={activeSwipePhoto}
                            alt={currentProfile.profile.name}
                            variant={swipePhotoVariant}
                            variants={DISCOVER_SWIPE_VARIANTS}
                            sizes={DISCOVER_SWIPE_SIZES}
                            loading="eager"
                            fetchPriority="high"
                            draggable={false}
                          />
                        ) : null}
                      </div>
                      <div className="swipe-gradient" />
                      <div className="swipe-meta">
                        <div className="swipe-meta-heading">
                          <h2 className="h3 mb-0 text-white">
                            {currentProfile.profile.name}, {currentProfile.age}
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
                  ) : null}
                </OverflowFade>
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
                  className={[
                    "btn btn-light swipe-action-secondary",
                    !user?.premium ? "is-premium-hook" : "",
                    currentAd ? "invisible" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  type="button"
                  aria-label={
                    user?.premium
                      ? "Volver a la tarjeta anterior"
                      : "Rewind con Premium"
                  }
                  disabled={
                    Boolean(currentAd) ||
                    Boolean(exitDirection) ||
                    rewindBusy ||
                    (Boolean(user?.premium) && !canRewind)
                  }
                  onClick={() => void rewind()}
                >
                  <i
                    className="bi bi-arrow-counterclockwise"
                    aria-hidden="true"
                  />
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
                  className={[
                    "btn btn-light swipe-action-heartshot",
                    !planHasFeature(user?.premiumPlanId, "heartshot")
                      ? "is-premium-hook"
                      : "",
                    currentAd ? "invisible" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  type="button"
                  aria-label={
                    planHasFeature(user?.premiumPlanId, "heartshot")
                      ? `Heartshot · ${user?.heartshotsRemaining ?? 0} restantes`
                      : "Heartshot con Premium 4 A.M."
                  }
                  disabled={Boolean(currentAd) || Boolean(exitDirection)}
                  onClick={() => {
                    void tryHeartshot();
                  }}
                >
                  <i className="bi bi-arrow-through-heart" aria-hidden="true" />
                </button>
                <button
                  className="btn btn-primary swipe-action-primary"
                  type="button"
                  aria-label={currentAd ? "Abrir anuncio" : "Like"}
                  disabled={Boolean(exitDirection)}
                  onClick={() => animateSwipe("like")}
                >
                  <i
                    className={`bi ${
                      currentAd
                        ? "bi-box-arrow-up-right"
                        : likesExhausted
                          ? "bi-clock-history"
                          : "bi-heart-fill"
                    }`}
                    aria-hidden="true"
                  />
                </button>
                <button
                  className={[
                    "btn btn-light swipe-action-secondary",
                    currentProfile && followingIds.has(currentProfile.userId)
                      ? "is-following"
                      : "",
                    currentProfile && requestedIds.has(currentProfile.userId)
                      ? "is-requested"
                      : "",
                    followPulse === "follow" ? "is-pulse-follow" : "",
                    followPulse === "unfollow" ? "is-pulse-unfollow" : "",
                    currentAd ? "invisible" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  type="button"
                  aria-label={
                    currentProfile && followingIds.has(currentProfile.userId)
                      ? "Dejar de seguir"
                      : currentProfile &&
                          requestedIds.has(currentProfile.userId)
                        ? "Cancelar solicitud"
                        : "Enviar solicitud de seguimiento"
                  }
                  aria-pressed={Boolean(
                    currentProfile &&
                      (followingIds.has(currentProfile.userId) ||
                        requestedIds.has(currentProfile.userId))
                  )}
                  disabled={
                    Boolean(currentAd) ||
                    Boolean(exitDirection) ||
                    followingBusy ||
                    !currentProfile
                  }
                  onClick={() => void toggleFollowCurrent()}
                >
                  <i
                    className={`bi ${
                      currentProfile && followingIds.has(currentProfile.userId)
                        ? "bi-person-check-fill"
                        : currentProfile &&
                            requestedIds.has(currentProfile.userId)
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
                <OptimizedImage
                  className="match-photo"
                  src={matchFlash.photo}
                  alt=""
                  variant="thumb"
                  variants={DISCOVER_SWIPE_VARIANTS}
                  sizes="120px"
                  loading="eager"
                />
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

      {safetyDialog && (
        <DiscoverSafetyModal
          action={safetyDialog.action}
          personName={safetyDialog.name}
          busy={safetyBusy}
          onClose={closeSafetyDialog}
          onConfirm={() => void confirmSafetyAction()}
        />
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
              contador vas a recuperarlos todos — o pasá a Nocta Premium para
              likes ilimitados.
            </p>
            <div className="match-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setLikeLimitOpen(false);
                  setPremiumModalOpen(true);
                }}
              >
                Ver Premium
              </button>
              <button
                type="button"
                className="btn btn-outline-light"
                onClick={() => setLikeLimitOpen(false)}
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {premiumModalOpen && (
        <PremiumPackagesModal
          onClose={() => setPremiumModalOpen(false)}
        />
      )}
    </div>
  );
}

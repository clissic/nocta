import { useCallback, useEffect, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type {
  BottomTabNavigationProp,
  BottomTabScreenProps,
} from "@react-navigation/bottom-tabs";
import type { CompositeNavigationProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  AD_SWIPE_INTERVAL_MAX,
  AD_SWIPE_INTERVAL_MIN,
  isDiscoverAdCard,
  planHasFeature,
  type DiscoverAdCard,
  type DiscoverCard,
  type DiscoverDeckItem,
  type DiscoverFeedResponse,
  type DiscoverRewindResponse,
  type DiscoverSwipeResponse,
  type LikeAllowance,
  type Presence,
} from "@nocta/shared";
import { useAuth } from "../auth/AuthContext";
import { BoostPulse } from "../components/BoostPulse";
import { DiscoverDeckEmpty } from "../components/discover/DiscoverDeckEmpty";
import { DiscoverVenuePicker } from "../components/discover/DiscoverVenuePicker";
import { DiscoverEmptyPresence } from "../components/discover/DiscoverEmptyPresence";
import { DiscoverProfileSheet } from "../components/discover/DiscoverProfileSheet";
import type { DiscoverSafetyAction } from "../components/discover/DiscoverSafetyDialog";
import { HeartshotIcon } from "../components/discover/HeartshotIcon";
import { photoExtra } from "../components/discover/photoExtra";
import { MatchFlashModal } from "../components/discover/MatchFlashModal";
import {
  SwipeCard,
  SwipeCardBack,
  type SwipeExit,
} from "../components/discover/SwipeCard";
import { useToast } from "../components/ToastProvider";
import { Chip, LoadingBlock, Screen } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { colors, fonts, radii, spacing, tabBar } from "../theme/tokens";
import type { MainTabParamList, RootStackParamList } from "../navigation/types";

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, "Discover">,
  NativeStackNavigationProp<RootStackParamList>
>;

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

function cardKey(card: DiscoverDeckItem) {
  return isDiscoverAdCard(card) ? `ad:${card.id}` : `user:${card.userId}`;
}

function cardPhoto(card: DiscoverDeckItem, photoIndex = 0) {
  if (isDiscoverAdCard(card)) return card.imageUrl;
  return card.profile.photos?.[photoIndex] ?? card.profile.photos?.[0] ?? null;
}

function cardTitle(card: DiscoverDeckItem) {
  return isDiscoverAdCard(card)
    ? card.title
    : `${card.profile.name}, ${card.age}`;
}

function asProfile(card: DiscoverDeckItem | undefined): DiscoverCard | null {
  if (!card || isDiscoverAdCard(card)) return null;
  return card;
}

export function DiscoverScreen() {
  const navigation = useNavigation<Nav>();
  const route =
    useRoute<BottomTabScreenProps<MainTabParamList, "Discover">["route"]>();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { user, setUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [presence, setPresence] = useState<Presence | null>(null);
  const [presences, setPresences] = useState<Presence[]>([]);
  const [maxPresences, setMaxPresences] = useState(1);
  const [cards, setCards] = useState<DiscoverDeckItem[]>([]);
  const [likeAllowance, setLikeAllowance] = useState<LikeAllowance | null>(
    null
  );
  const [busy, setBusy] = useState(false);
  const [boostBusy, setBoostBusy] = useState(false);
  const [unpublishBusy, setUnpublishBusy] = useState(false);
  const [rewindBusy, setRewindBusy] = useState(false);
  const [canRewind, setCanRewind] = useState(false);
  const [followingBusy, setFollowingBusy] = useState(false);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set());
  const [photoIdx, setPhotoIdx] = useState(0);
  const [detailOpen, setDetailOpen] = useState(false);
  const [safety, setSafety] = useState<{
    action: DiscoverSafetyAction;
    userId: string;
    name: string;
  } | null>(null);
  const [safetyBusy, setSafetyBusy] = useState(false);
  const [programmedExit, setProgrammedExit] = useState<SwipeExit | null>(null);
  const [matchFlash, setMatchFlash] = useState<MatchFlash | null>(null);
  const swipesUntilAdRef = useRef(nextAdThreshold());
  const presenceVenueRef = useRef<string | undefined>(undefined);
  const toastRef = useRef(toast);
  const loadGenRef = useRef(0);
  toastRef.current = toast;

  const syncFollowState = useCallback((list: DiscoverDeckItem[]) => {
    const following = new Set<string>();
    const requested = new Set<string>();
    for (const card of list) {
      if (isDiscoverAdCard(card)) continue;
      if (card.isFollowing) following.add(card.userId);
      if (card.isFollowRequested) requested.add(card.userId);
    }
    setFollowingIds(following);
    setRequestedIds(requested);
  }, []);

  const load = useCallback(
    async (venueId?: string, focusUserId?: string) => {
      const gen = ++loadGenRef.current;
      setLoading(true);
      try {
        const presenceRes = await api<{
          presence: Presence | null;
          presences?: Presence[];
          maxPresences?: number;
        }>("/api/presence/me");
        if (gen !== loadGenRef.current) return;
        const list =
          presenceRes.presences ??
          (presenceRes.presence ? [presenceRes.presence] : []);
        setPresences(list);
        setMaxPresences(presenceRes.maxPresences ?? 1);

        if (!list.length) {
          setPresence(null);
          presenceVenueRef.current = undefined;
          setCards([]);
          return;
        }

        const preferred = venueId ?? presenceVenueRef.current;
        const chosen =
          (preferred && list.find((p) => p.venueId === preferred)) ||
          (list.length === 1 ? list[0] : null) ||
          null;

        if (!chosen) {
          setPresence(null);
          presenceVenueRef.current = undefined;
          setCards([]);
          return;
        }

        setPresence(chosen);
        presenceVenueRef.current = chosen.venueId;
        const params = new URLSearchParams({ venueId: chosen.venueId });
        if (focusUserId) params.set("userId", focusUserId);
        const feed = await api<DiscoverFeedResponse>(
          `/api/discover/feed?${params.toString()}`
        );
        if (gen !== loadGenRef.current) return;
        setCards(feed.cards);
        syncFollowState(feed.cards);
        setLikeAllowance(feed.likeAllowance ?? null);
        setProgrammedExit(null);
        setPhotoIdx(0);
        setDetailOpen(false);
        setCanRewind(false);
      } catch (err) {
        if (gen !== loadGenRef.current) return;
        if (
          err instanceof ApiError &&
          (err.code === "NO_PRESENCE" || err.code === "SELECT_VENUE")
        ) {
          setPresence(null);
          presenceVenueRef.current = undefined;
          setCards([]);
        } else {
          toastRef.current.error(
            err instanceof ApiError ? err.message : "Error al cargar Discover"
          );
        }
      } finally {
        if (gen === loadGenRef.current) setLoading(false);
      }
    },
    [syncFollowState]
  );

  const routeVenueId = route.params?.venueId;
  const routeUserId = route.params?.userId;
  const loadRef = useRef(load);
  loadRef.current = load;
  // Solo remount / cambio de params — no re-fetch si cambia la identidad de `load`.
  useEffect(() => {
    void loadRef.current(routeVenueId, routeUserId);
  }, [routeVenueId, routeUserId]);

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
      /* sin anuncio */
    }
  }

  async function commitSwipe(direction: "like" | "pass", isHeartshot = false) {
    const current = cards[0];
    if (!current || busy) return;

    if (isDiscoverAdCard(current)) {
      setCards((prev) => prev.slice(1));
      setProgrammedExit(null);
      setPhotoIdx(0);
      setCanRewind(false);
      if (direction === "like") {
        navigation.navigate("Ad", { adId: current.id });
      }
      return;
    }

    const swiped = current;
    setBusy(true);
    setCards((prev) => prev.slice(1));
    setProgrammedExit(null);
    setPhotoIdx(0);
    setDetailOpen(false);
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
      setLikeAllowance(res.likeAllowance ?? null);
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
          photo: swiped.profile.photos?.[0],
        });
      }
      await maybeInsertAd();
    } catch (err) {
      if (err instanceof ApiError && err.code === "LIKES_EXHAUSTED") {
        const allowance = err.data?.likeAllowance as LikeAllowance | undefined;
        if (allowance) setLikeAllowance(allowance);
        setCards((prev) => [swiped, ...prev]);
        toast.warning("Se te agotaron los likes por ahora");
        return;
      }
      if (
        err instanceof ApiError &&
        (err.code === "NO_HEARTSHOTS" ||
          err.code === "PLAN_REQUIRED" ||
          err.code === "PREMIUM_REQUIRED")
      ) {
        setCards((prev) => [swiped, ...prev]);
        if (err.code === "NO_HEARTSHOTS") {
          toast.error(err.message);
        } else {
          toast.info("Heartshot requiere Premium 4 A.M.");
          navigation.navigate("Premium");
        }
        return;
      }
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo enviar el swipe"
      );
      await load(presence?.venueId);
    } finally {
      setBusy(false);
    }
  }

  function onCardSwipe(exit: SwipeExit) {
    if (exit === "heartshot") {
      void commitSwipe("like", true);
      return;
    }
    void commitSwipe(exit, false);
  }

  function requestExit(exit: SwipeExit) {
    if (!cards[0] || busy || programmedExit) return;
    if (exit === "heartshot") {
      if (isDiscoverAdCard(cards[0])) return;
      if (!planHasFeature(user?.premiumPlanId, "heartshot")) {
        toast.info("Heartshot requiere Premium 4 A.M.");
        navigation.navigate("Premium");
        return;
      }
      if ((user?.heartshotsRemaining ?? 0) <= 0) {
        toast.error("No te quedan Heartshots este periodo");
        return;
      }
    }
    setProgrammedExit(exit);
  }

  async function rewind() {
    if (programmedExit || rewindBusy || busy) return;
    if (!user?.premium) {
      toast.info("Rewind requiere Premium");
      navigation.navigate("Premium");
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
        if (restored.isFollowing) {
          setFollowingIds((prev) => new Set(prev).add(restored.userId));
        }
        if (restored.isFollowRequested) {
          setRequestedIds((prev) => new Set(prev).add(restored.userId));
        }
        setPhotoIdx(0);
        setDetailOpen(false);
      }
      setCanRewind(false);
    } catch (err) {
      if (err instanceof ApiError && err.code === "PREMIUM_REQUIRED") {
        navigation.navigate("Premium");
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
    const current = asProfile(cards[0]);
    if (!current || followingBusy || programmedExit || busy) return;
    const userId = current.userId;
    const isFollowing = followingIds.has(userId);
    const isRequested = requestedIds.has(userId);
    const cancelling = isFollowing || isRequested;

    setFollowingBusy(true);
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
        err instanceof ApiError ? err.message : "No se pudo actualizar el follow"
      );
    } finally {
      setFollowingBusy(false);
    }
  }

  async function activateBoost() {
    if (boostBusy) return;
    if (!planHasFeature(user?.premiumPlanId, "boost")) {
      toast.info("Boost requiere Premium 4 A.M.");
      navigation.navigate("Premium");
      return;
    }
    if ((user?.boostsRemaining ?? 0) <= 0) {
      toast.error("No te quedan Boosts este periodo");
      return;
    }
    if (
      user?.boostExpiresAt &&
      new Date(user.boostExpiresAt).getTime() > Date.now()
    ) {
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
        navigation.navigate("Premium");
      } else {
        toast.error(
          err instanceof ApiError ? err.message : "No se pudo activar el Boost"
        );
      }
    } finally {
      setBoostBusy(false);
    }
  }

  async function unpublish() {
    if (!presence || unpublishBusy) return;
    setUnpublishBusy(true);
    try {
      await api(
        `/api/presence/me?venueId=${encodeURIComponent(presence.venueId)}`,
        { method: "DELETE" }
      );
      presenceVenueRef.current = undefined;
      toast.success("Dejaste de publicarte");
      await load();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo dejar de publicar"
      );
    } finally {
      setUnpublishBusy(false);
    }
  }

  const actionsBottom =
    Math.max(insets.bottom, 10) + tabBar.height + spacing.sm;
  const boostActive =
    Boolean(user?.boostExpiresAt) &&
    new Date(user!.boostExpiresAt!).getTime() > Date.now();

  if (loading) return <LoadingBlock label="Cargando Discover…" />;

  if (!presences.length) {
    return (
      <Screen padded={false} safeTop={false}>
        <DiscoverEmptyPresence
          onExploreVenues={() => navigation.navigate("Venues")}
          onOpenProfile={() => navigation.navigate("Profile")}
        />
      </Screen>
    );
  }

  if (!presence) {
    return (
      <Screen padded={false} safeTop={false}>
        <DiscoverVenuePicker
          presences={presences}
          maxPresences={maxPresences}
          bottomInset={insets.bottom}
          onSelect={(venueId) => void load(venueId)}
        />
      </Screen>
    );
  }

  const current = cards[0];
  const next = cards[1];
  const currentAd = current && isDiscoverAdCard(current) ? current : null;
  const currentProfile = asProfile(current);

  function openSafety(action: DiscoverSafetyAction) {
    if (!currentProfile) return;
    setSafety({
      action,
      userId: currentProfile.userId,
      name: currentProfile.profile.name,
    });
  }

  async function confirmSafety() {
    if (!safety || safetyBusy) return;
    if (safety.action === "report") {
      const userId = safety.userId;
      setSafety(null);
      setDetailOpen(false);
      navigation.navigate("UserReport", { userId });
      return;
    }

    setSafetyBusy(true);
    try {
      await api(`/api/users/${safety.userId}/block`, { method: "POST" });
      const blockedUserId = safety.userId;
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
      setSafety(null);
      toast.success("Usuario bloqueado");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo bloquear"
      );
    } finally {
      setSafetyBusy(false);
    }
  }

  const photoInfo = currentProfile ? photoExtra(currentProfile, photoIdx) : null;
  const photosCount = currentProfile?.profile.photos?.filter(Boolean).length ?? 1;
  const likesExhausted =
    likeAllowance &&
    !likeAllowance.unlimited &&
    (likeAllowance.remainingLikes ?? 0) <= 0;
  const exiting = Boolean(programmedExit);
  const isFollowing =
    currentProfile != null && followingIds.has(currentProfile.userId);
  const isRequested =
    currentProfile != null && requestedIds.has(currentProfile.userId);

  function discoverActions() {
    return (
      <>
        <ActionCircle
          size="sm"
          variant={!user?.premium ? "premiumHook" : "secondary"}
          icon="arrow-undo"
          label={
            user?.premium
              ? "Volver a la tarjeta anterior"
              : "Rewind con Premium"
          }
          disabled={
            Boolean(currentAd) ||
            exiting ||
            rewindBusy ||
            (Boolean(user?.premium) && !canRewind)
          }
          onPress={() => {
            setDetailOpen(false);
            void rewind();
          }}
        />
        <ActionCircle
          size="lg"
          variant="pass"
          icon="close"
          label="Pass"
          disabled={exiting}
          onPress={() => {
            setDetailOpen(false);
            requestExit("pass");
          }}
        />
        <ActionCircle
          size="md"
          variant={
            planHasFeature(user?.premiumPlanId, "heartshot")
              ? "heartshot"
              : "heartshotHook"
          }
          icon="heart"
          useHeartshotIcon
          label={
            planHasFeature(user?.premiumPlanId, "heartshot")
              ? `Heartshot · ${user?.heartshotsRemaining ?? 0} restantes`
              : "Heartshot con Premium 4 A.M."
          }
          disabled={Boolean(currentAd) || exiting}
          onPress={() => {
            setDetailOpen(false);
            requestExit("heartshot");
          }}
        />
        <ActionCircle
          size="lg"
          variant="like"
          icon={
            currentAd
              ? "open-outline"
              : likesExhausted
                ? "time-outline"
                : "heart"
          }
          label={currentAd ? "Abrir anuncio" : "Like"}
          disabled={exiting}
          onPress={() => {
            setDetailOpen(false);
            requestExit("like");
          }}
        />
        <ActionCircle
          size="sm"
          variant={
            isFollowing ? "following" : isRequested ? "requested" : "secondary"
          }
          icon={
            isFollowing
              ? "person"
              : isRequested
                ? "hourglass"
                : "person-add"
          }
          label={
            isFollowing
              ? "Dejar de seguir"
              : isRequested
                ? "Cancelar solicitud"
                : "Enviar solicitud de seguimiento"
          }
          disabled={
            Boolean(currentAd) ||
            exiting ||
            followingBusy ||
            !currentProfile
          }
          hidden={Boolean(currentAd)}
          onPress={() => void toggleFollowCurrent()}
        />
      </>
    );
  }

  return (
    <Screen padded={false} safeTop={false} style={styles.flush}>
      <View style={styles.topBar}>
        <View style={styles.topLeft}>
          <Text style={styles.screenTitleCompact}>Discover</Text>
          <Text style={styles.venueLine} numberOfLines={1}>
            {presence.venue?.name || "Espacio"}
            {likeAllowance && !likeAllowance.unlimited
              ? ` · ${likeAllowance.remainingLikes ?? 0}/${likeAllowance.limit ?? 0}`
              : ""}
          </Text>
        </View>
        <View style={styles.topActions}>
          <BoostPulse active={boostActive}>
          <Pressable
            onPress={() => void activateBoost()}
            disabled={boostBusy}
            style={[
              styles.boostBtn,
              boostActive && styles.boostBtnActive,
              !planHasFeature(user?.premiumPlanId, "boost") &&
                styles.boostPremiumHook,
            ]}
            accessibilityLabel={
              boostActive
                ? "Boost activo"
                : planHasFeature(user?.premiumPlanId, "boost")
                  ? `Boost · ${user?.boostsRemaining ?? 0} restantes`
                  : "Boost con Premium"
            }
          >
            <Ionicons
              name="rocket"
              size={16}
              color={boostActive ? colors.primary : colors.primary}
            />
            <Text
              style={[styles.boostCount, boostActive && styles.boostCountActive]}
            >
              {boostActive
                ? "ON"
                : planHasFeature(user?.premiumPlanId, "boost")
                  ? String(user?.boostsRemaining ?? 0)
                  : "·"}
            </Text>
          </Pressable>
        </BoostPulse>
        <Pressable
          onPress={() => void unpublish()}
          disabled={unpublishBusy}
          style={({ pressed }) => [
            styles.unpublishBtn,
            pressed && { opacity: 0.85 },
            unpublishBusy && { opacity: 0.5 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Dejar de publicar"
        >
          <Ionicons name="eye-off-outline" size={18} color={colors.danger} />
        </Pressable>
        </View>
      </View>

      {presences.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
          style={styles.chipsScroll}
        >
          {presences.map((p) => (
            <Chip
              key={p.id}
              label={p.venue?.name || "Espacio"}
              active={p.venueId === presence.venueId}
              onPress={() => {
                if (p.venueId !== presence.venueId) void load(p.venueId);
              }}
            />
          ))}
        </ScrollView>
      ) : null}

      {!current ? (
        <View style={[styles.emptyDeck, { paddingBottom: actionsBottom }]}>
          <DiscoverDeckEmpty
            venueName={presence.venue?.name}
            onReload={() => void load(presence.venueId)}
            onExploreVenues={() => navigation.navigate("Venues")}
          />
        </View>
      ) : (
        <>
          <View style={styles.deck}>
            {next ? (
              <SwipeCardBack photo={cardPhoto(next)} title={cardTitle(next)} />
            ) : null}
            <SwipeCard
              key={cardKey(current)}
              photo={cardPhoto(current, photoIdx)}
              photosCount={isDiscoverAdCard(current) ? 1 : photosCount}
              photoIndex={photoIdx}
              title={cardTitle(current)}
              subtitle={currentAd?.subtitle || undefined}
              detail={
                currentAd
                  ? {
                      body: currentAd.body || undefined,
                      cta: `${currentAd.ctaLabel || "Ver más"} · Like para abrir`,
                    }
                  : photoInfo
                    ? {
                        icon: photoInfo.icon,
                        label: photoInfo.title,
                        body: photoInfo.body,
                      }
                    : null
              }
              eyebrow={
                currentAd
                  ? `Anuncio${currentAd.sponsorName ? ` · ${currentAd.sponsorName}` : ""}`
                  : undefined
              }
              isAd={Boolean(currentAd)}
              disabled={busy}
              programmedExit={programmedExit}
              onSwipe={onCardSwipe}
              onExpand={
                currentProfile
                  ? () => {
                      setDetailOpen(true);
                    }
                  : undefined
              }
              metaBottom={110}
              onPhotoStep={
                currentProfile && photosCount > 1
                  ? (delta) => {
                      setPhotoIdx((prev) => {
                        if (delta < 0) {
                          return prev <= 0 ? photosCount - 1 : prev - 1;
                        }
                        return prev >= photosCount - 1 ? 0 : prev + 1;
                      });
                    }
                  : undefined
              }
            />
          </View>

          <View
            style={[
              styles.actions,
              { bottom: 32 },
              exiting && styles.actionsExiting,
            ]}
            pointerEvents={exiting ? "none" : "box-none"}
          >
            {discoverActions()}
          </View>
        </>
      )}

      <DiscoverProfileSheet
        visible={detailOpen && Boolean(currentProfile)}
        card={currentProfile}
        photoIndex={photoIdx}
        onClose={() => {
          if (safetyBusy) return;
          setSafety(null);
          setDetailOpen(false);
        }}
        onPhotoIndexChange={setPhotoIdx}
        onBlock={() => openSafety("block")}
        onReport={() => openSafety("report")}
        safetyAction={
          safety && currentProfile && safety.userId === currentProfile.userId
            ? safety.action
            : null
        }
        safetyBusy={safetyBusy}
        onSafetyClose={() => {
          if (!safetyBusy) setSafety(null);
        }}
        onSafetyConfirm={() => void confirmSafety()}
        actions={currentProfile ? discoverActions() : null}
      />

      <MatchFlashModal
        visible={Boolean(matchFlash)}
        name={matchFlash?.name}
        photo={matchFlash?.photo}
        venueName={presence.venue?.name}
        onClose={() => setMatchFlash(null)}
        onOpenChat={() => {
          const id = matchFlash?.matchId;
          setMatchFlash(null);
          if (id) navigation.navigate("Chat", { matchId: id });
        }}
      />
    </Screen>
  );
}

function ActionCircle({
  size,
  variant,
  icon,
  useHeartshotIcon,
  label,
  disabled,
  hidden,
  onPress,
}: {
  size: "sm" | "md" | "lg";
  variant:
    | "secondary"
    | "premiumHook"
    | "pass"
    | "like"
    | "heartshot"
    | "heartshotHook"
    | "following"
    | "requested";
  icon: keyof typeof Ionicons.glyphMap;
  useHeartshotIcon?: boolean;
  label: string;
  disabled?: boolean;
  hidden?: boolean;
  onPress: () => void;
}) {
  const dim = size === "lg" ? 60 : size === "md" ? 52 : 48;
  const iconSize = size === "lg" ? 26 : size === "md" ? 22 : 20;
  let iconColor: string = colors.text;
  if (variant === "pass") iconColor = colors.danger;
  if (variant === "like") iconColor = colors.onPrimary;
  if (variant === "heartshot" || variant === "heartshotHook")
    iconColor = "#c4b5fd";
  if (variant === "premiumHook") iconColor = colors.primary;
  if (variant === "following") iconColor = colors.primary;
  if (variant === "requested") iconColor = colors.warning;

  return (
    <Pressable
      accessibilityLabel={label}
      disabled={disabled || hidden}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionBtn,
        { width: dim, height: dim, borderRadius: dim / 2 },
        variant === "secondary" && styles.actionSecondary,
        variant === "premiumHook" && styles.actionPremiumHook,
        variant === "pass" && styles.actionPass,
        variant === "like" && styles.actionLike,
        variant === "heartshot" && styles.actionHeartshot,
        variant === "heartshotHook" && styles.actionHeartshotHook,
        variant === "following" && styles.actionFollowing,
        variant === "requested" && styles.actionRequested,
        (disabled || hidden) && { opacity: hidden ? 0 : 0.4 },
        pressed && !disabled && { transform: [{ scale: 0.94 }] },
      ]}
    >
      {useHeartshotIcon ? (
        <HeartshotIcon size={iconSize + 2} color={iconColor} />
      ) : (
        <Ionicons name={icon} size={iconSize} color={iconColor} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flush: { flex: 1 },
  center: { flex: 1, justifyContent: "center" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingTop: 2,
    paddingBottom: 4,
    gap: spacing.sm,
  },
  topLeft: { flex: 1, minWidth: 0 },
  screenTitleCompact: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 22,
    letterSpacing: -0.03 * 22,
  },
  venueLine: {
    marginTop: 2,
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
  },
  chipsScroll: { maxHeight: 44, marginBottom: spacing.sm },
  chipsRow: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    alignItems: "center",
  },
  topActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
  },
  unpublishBtn: {
    height: 32,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "rgba(255,107,107,0.7)",
    backgroundColor: "rgba(255,107,107,0.14)",
  },
  boostBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  boostBtnActive: {
    borderColor: "rgba(214,255,75,0.55)",
    backgroundColor: "rgba(214,255,75,0.14)",
  },
  boostPremiumHook: { opacity: 0.7 },
  boostCount: {
    color: "rgba(255,255,255,0.85)",
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    minWidth: 14,
    textAlign: "center",
  },
  boostCountActive: { color: colors.primary },
  deck: {
    flex: 1,
    marginHorizontal: spacing.sm,
    position: "relative",
  },
  emptyDeck: { flex: 1 },
  actions: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    zIndex: 8,
  },
  actionsExiting: { opacity: 0 },
  actionBtn: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    shadowColor: "#000",
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  actionSecondary: {
    borderColor: "rgba(255,255,255,0.18)",
  },
  actionPremiumHook: {
    borderColor: "rgba(214,255,75,0.55)",
  },
  actionPass: {
    borderColor: "rgba(255,107,107,0.55)",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  actionLike: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  actionHeartshot: {
    borderColor: "rgba(139,92,246,0.55)",
    backgroundColor: "rgba(139,92,246,0.16)",
  },
  actionHeartshotHook: {
    borderColor: "rgba(139,92,246,0.45)",
    backgroundColor: "rgba(139,92,246,0.12)",
    opacity: 0.72,
  },
  actionFollowing: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryDim,
  },
  actionRequested: {
    borderColor: "rgba(240,192,64,0.55)",
    backgroundColor: "rgba(240,192,64,0.12)",
  },
});

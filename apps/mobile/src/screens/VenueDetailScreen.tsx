import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  PRESENCE_PRESETS,
  VENUE_PHOTO_FALLBACK,
  VENUE_TYPE_LABELS,
  maxActivePresencesForPlan,
  planHasFeature,
  venueCoverSrc,
  type PaginatedReviewsResponse,
  type Presence,
  type Promotion,
  type Venue,
  type VenueNews,
  type VenueReview,
} from "@nocta/shared";
import { useAuth } from "../auth/AuthContext";
import { LiveDot } from "../components/LiveDot";
import { NoctaImage } from "../components/NoctaImage";
import { VenueMap } from "../components/VenueMap";
import { useToast } from "../components/ToastProvider";
import { LoadingBlock, Screen } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { colors, fonts, radii, spacing } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "VenueDetail">;

export function VenueDetailScreen({ route, navigation }: Props) {
  const { venueId } = route.params;
  const { user } = useAuth();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const heroH = Math.max(240, Math.round(width * (3 / 4)));

  const discoverDisabled = Boolean(user?.discoverDisabled);
  const [venue, setVenue] = useState<Venue | null>(null);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [news, setNews] = useState<VenueNews[]>([]);
  const [reviews, setReviews] = useState<VenueReview[]>([]);
  const [presence, setPresence] = useState<Presence | null>(null);
  const [presences, setPresences] = useState<Presence[]>([]);
  const [maxPresences, setMaxPresences] = useState(1);
  const [hours, setHours] = useState<number | null>(24);
  const [busy, setBusy] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [trustOpen, setTrustOpen] = useState(false);

  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewBody, setReviewBody] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, presenceResponse, reviewsResponse] = await Promise.all([
        api<{
          venue: Venue;
          promotions: Promotion[];
          news: VenueNews[];
        }>(`/api/venues/${venueId}`),
        api<{
          presence: Presence | null;
          presences?: Presence[];
          maxPresences?: number;
        }>("/api/presence/me"),
        api<PaginatedReviewsResponse>(
          `/api/venues/${venueId}/reviews?limit=8`
        ).catch(() => ({ reviews: [], pagination: null })),
      ]);
      setVenue(data.venue);
      setPromotions(data.promotions ?? []);
      setNews(data.news ?? []);
      setReviews(reviewsResponse.reviews ?? []);
      const list =
        presenceResponse.presences ??
        (presenceResponse.presence ? [presenceResponse.presence] : []);
      setPresences(list);
      setMaxPresences(
        presenceResponse.maxPresences ??
          maxActivePresencesForPlan(user?.premiumPlanId)
      );
      setPresence(
        list.find((row) => row.venueId === venueId) ?? presenceResponse.presence
      );
      if (data.venue.myReview) {
        setReviewRating(data.venue.myReview.rating);
        setReviewBody(data.venue.myReview.body ?? "");
      }
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Espacio no encontrado"
      );
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [navigation, toast, user?.premiumPlanId, venueId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleFollow() {
    if (!venue || followBusy) return;
    const nextFollowing = !venue.isFollowing;
    setFollowBusy(true);
    setVenue((prev) =>
      prev
        ? {
            ...prev,
            isFollowing: nextFollowing,
            followersCount: Math.max(
              0,
              (prev.followersCount ?? 0) + (nextFollowing ? 1 : -1)
            ),
          }
        : prev
    );
    try {
      const res = await api<{ isFollowing: boolean; followersCount: number }>(
        `/api/venues/${venue.id}/follow`,
        { method: nextFollowing ? "POST" : "DELETE" }
      );
      setVenue((prev) =>
        prev
          ? {
              ...prev,
              isFollowing: res.isFollowing,
              followersCount: res.followersCount,
            }
          : prev
      );
      toast.success(nextFollowing ? "Espacio seguido" : "Dejaste de seguir");
    } catch (err) {
      setVenue((prev) =>
        prev
          ? {
              ...prev,
              isFollowing: !nextFollowing,
              followersCount: Math.max(
                0,
                (prev.followersCount ?? 0) + (nextFollowing ? -1 : 1)
              ),
            }
          : prev
      );
      toast.error(
        err instanceof ApiError
          ? err.message
          : "No se pudo actualizar el follow"
      );
    } finally {
      setFollowBusy(false);
    }
  }

  async function publish() {
    if (!venue) return;
    setBusy(true);
    try {
      await api<{ presence: Presence }>("/api/presence", {
        method: "POST",
        body: JSON.stringify({ venueId: venue.id, hours }),
      });
      toast.success("Publicado");
      navigation.navigate("Main", {
        screen: "Discover",
        params: { venueId: venue.id },
      } as never);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo publicar"
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveReview() {
    if (!venue || reviewBusy) return;
    setReviewBusy(true);
    try {
      const form = new FormData();
      form.append("rating", String(reviewRating));
      if (reviewBody.trim()) form.append("body", reviewBody.trim());
      const res = await api<{ review: VenueReview; venue: Venue }>(
        `/api/venues/${venue.id}/reviews`,
        { method: "POST", body: form }
      );
      setVenue((prev) =>
        prev
          ? {
              ...prev,
              myReview: res.review,
              ratingAvg: res.venue.ratingAvg,
              ratingCount: res.venue.ratingCount,
            }
          : prev
      );
      setReviews((prev) => {
        const without = prev.filter((r) => r.id !== res.review.id);
        return [res.review, ...without].slice(0, 8);
      });
      setReviewOpen(false);
      toast.success("Reseña guardada");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo guardar la reseña"
      );
    } finally {
      setReviewBusy(false);
    }
  }

  async function deleteReview() {
    if (!venue?.myReview) return;
    Alert.alert("Eliminar reseña", "¿Querés borrar tu reseña?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: () => {
          void (async () => {
            setReviewBusy(true);
            try {
              const res = await api<{ venue: Venue }>(
                `/api/venues/${venue.id}/reviews/${venue.myReview!.id}`,
                { method: "DELETE" }
              );
              setVenue((prev) =>
                prev
                  ? {
                      ...prev,
                      myReview: undefined,
                      ratingAvg: res.venue.ratingAvg,
                      ratingCount: res.venue.ratingCount,
                    }
                  : prev
              );
              setReviews((prev) =>
                prev.filter((r) => r.id !== venue.myReview!.id)
              );
              setReviewBody("");
              setReviewRating(5);
              setReviewOpen(false);
              toast.success("Reseña eliminada");
            } catch (err) {
              toast.error(
                err instanceof ApiError
                  ? err.message
                  : "No se pudo eliminar"
              );
            } finally {
              setReviewBusy(false);
            }
          })();
        },
      },
    ]);
  }

  if (loading || !venue) return <LoadingBlock label="Cargando espacio…" />;

  const following = Boolean(venue.isFollowing);
  const isPublishedHere =
    presence?.venueId === venue.id ||
    presences.some((row) => row.venueId === venue.id);
  const teleportPlus = planHasFeature(user?.premiumPlanId, "teleport_plus");
  const activeCount = presences.length;
  const nextSlot = activeCount + 1;
  const atPresenceLimit =
    teleportPlus && !isPublishedHere && activeCount >= maxPresences;
  const publishLabel =
    teleportPlus && !isPublishedHere
      ? `Publicar perfil ${Math.min(nextSlot, maxPresences)}/${maxPresences}`
      : "Publicar perfil";
  const hasReviews = (venue.ratingCount ?? 0) > 0 && venue.ratingAvg != null;
  const canReview = Boolean(user?.profileComplete && user.role === "user");
  const verified = Boolean(venue.ownerId);

  return (
    <Screen padded={false} safeTop={false}>
      <ScrollView
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom, spacing.sm),
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.hero, { height: heroH }]}>
          <NoctaImage
            src={venueCoverSrc(venue)}
            fallbackSrc={VENUE_PHOTO_FALLBACK}
            variant="large"
            style={styles.cover}
            contentFit="cover"
          />
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.88)"]}
            locations={[0.35, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <Pressable
            style={[styles.backBtn, { top: 12 }]}
            onPress={() => navigation.goBack()}
            accessibilityLabel="Volver"
          >
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </Pressable>

          <View style={styles.heroCaption}>
            <Text style={styles.type}>{VENUE_TYPE_LABELS[venue.type]}</Text>
            <View style={styles.titleRow}>
              <View style={styles.titleText}>
                <View style={styles.nameLine}>
                  <Text style={styles.name} numberOfLines={2}>
                    {venue.name}
                  </Text>
                  {verified ? (
                    <Ionicons
                      name="checkmark-circle"
                      size={18}
                      color={colors.primary}
                    />
                  ) : (
                    <Pressable
                      onPress={() => setTrustOpen((v) => !v)}
                      hitSlop={8}
                      accessibilityLabel="Este espacio aún no tiene organizador en Nocta"
                    >
                      <Ionicons
                        name="help-circle"
                        size={18}
                        color="rgba(242,240,235,0.7)"
                      />
                    </Pressable>
                  )}
                </View>
                {trustOpen && !verified ? (
                  <Text style={styles.trustHint}>
                    Si sos el organizador de este espacio y querés
                    administrarlo en Nocta, usá la pestaña Reclamar espacio en
                    el formulario de tu perfil.
                  </Text>
                ) : null}
              </View>
              <Pressable
                disabled={followBusy}
                onPress={() => void toggleFollow()}
                style={[
                  styles.followBtn,
                  following && styles.followBtnActive,
                  followBusy && { opacity: 0.55 },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: following }}
              >
                <Ionicons
                  name={following ? "bookmark" : "bookmark-outline"}
                  size={16}
                  color={following ? colors.onPrimary : "#fff"}
                />
                <Text
                  style={[
                    styles.followText,
                    following && styles.followTextActive,
                  ]}
                >
                  {following ? "Siguiendo" : "Seguir"}
                </Text>
              </Pressable>
            </View>
            <Text style={styles.address} numberOfLines={2}>
              {venue.address}
            </Text>
          </View>
        </View>

        <View style={styles.body}>
          {typeof venue.followersCount === "number" ? (
            <Text style={styles.metaLine}>
              {venue.followersCount}{" "}
              {venue.followersCount === 1 ? "seguidor" : "seguidores"}
            </Text>
          ) : null}
          {hasReviews ? (
            <View style={styles.metaRow}>
              <Ionicons name="star" size={13} color={colors.primary} />
              <Text style={styles.metaLine}>
                {venue.ratingAvg!.toFixed(1).replace(".", ",")} ·{" "}
                {venue.ratingCount}{" "}
                {venue.ratingCount === 1 ? "reseña" : "reseñas"}
              </Text>
            </View>
          ) : null}

          {venue.description ? (
            <View style={styles.section}>
              <Text style={styles.label}>Sobre el lugar</Text>
              <Text style={styles.desc}>{venue.description}</Text>
            </View>
          ) : null}

          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={styles.label}>Reseñas</Text>
              {canReview ? (
                <Pressable
                  onPress={() => {
                    if (venue.myReview) {
                      setReviewRating(venue.myReview.rating);
                      setReviewBody(venue.myReview.body ?? "");
                    }
                    setReviewOpen((open) => !open);
                  }}
                >
                  <Text style={styles.sectionLink}>
                    {venue.myReview ? "Editar mi reseña" : "Escribir reseña"}
                  </Text>
                </Pressable>
              ) : null}
            </View>

            {hasReviews ? (
              <Text style={styles.reviewSummary}>
                {venue.ratingAvg!.toFixed(1).replace(".", ",")} ·{" "}
                {venue.ratingCount}{" "}
                {venue.ratingCount === 1 ? "reseña" : "reseñas"}
              </Text>
            ) : (
              <Text style={styles.hint}>
                Sé el primero en reseñar este Espacio.
              </Text>
            )}

            {reviewOpen ? (
              <View style={styles.reviewComposer}>
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <Pressable
                      key={value}
                      onPress={() => setReviewRating(value)}
                      hitSlop={4}
                    >
                      <Ionicons
                        name={value <= reviewRating ? "star" : "star-outline"}
                        size={26}
                        color={colors.primary}
                      />
                    </Pressable>
                  ))}
                </View>
                <TextInput
                  value={reviewBody}
                  onChangeText={(text) => setReviewBody(text.slice(0, 1000))}
                  placeholder="Contá tu experiencia…"
                  placeholderTextColor={colors.textFaint}
                  multiline
                  style={styles.reviewInput}
                />
                <View style={styles.reviewActions}>
                  <Pressable
                    disabled={reviewBusy}
                    onPress={() => void saveReview()}
                    style={[
                      styles.primaryBtn,
                      reviewBusy && { opacity: 0.55 },
                    ]}
                  >
                    <Text style={styles.primaryBtnText}>
                      {reviewBusy
                        ? "Guardando…"
                        : venue.myReview
                          ? "Guardar"
                          : "Publicar"}
                    </Text>
                  </Pressable>
                  {venue.myReview ? (
                    <Pressable
                      disabled={reviewBusy}
                      onPress={deleteReview}
                      style={styles.ghostBtn}
                    >
                      <Text style={styles.ghostBtnDanger}>Eliminar</Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={() => setReviewOpen(false)}
                      style={styles.ghostBtn}
                    >
                      <Text style={styles.ghostBtnText}>Cancelar</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            ) : null}

            {reviews.map((review) => (
              <View key={review.id} style={styles.reviewItem}>
                {review.author?.photo ? (
                  <NoctaImage
                    src={review.author.photo}
                    variant="thumb"
                    style={styles.reviewAvatar}
                    contentFit="cover"
                  />
                ) : (
                  <View style={[styles.reviewAvatar, styles.reviewAvatarEmpty]}>
                    <Text style={styles.reviewInitial}>
                      {(review.author?.name ?? "?").slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.reviewCopy}>
                  <Text style={styles.reviewAuthor}>
                    {review.author?.name ?? "Usuario"}
                    <Text style={styles.reviewMeta}>
                      {" "}
                      · {review.rating}/5
                    </Text>
                  </Text>
                  {review.body ? (
                    <Text style={styles.reviewBody}>{review.body}</Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>

          {promotions.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.label}>Últimas promociones</Text>
              <View style={styles.cardList}>
                {promotions.map((promo) => (
                  <View key={promo.id} style={styles.promoCard}>
                    <Text style={styles.cardTitle}>{promo.title}</Text>
                    <Text style={styles.cardBody}>{promo.description}</Text>
                    {typeof promo.priceUyu === "number" ? (
                      <Text style={styles.promoPrice}>
                        {new Intl.NumberFormat("es-UY", {
                          style: "currency",
                          currency: "UYU",
                          maximumFractionDigits: 0,
                        }).format(promo.priceUyu)}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {news.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.label}>Últimas noticias</Text>
              <View style={styles.cardList}>
                {news.map((item) => (
                  <View key={item.id} style={styles.newsItem}>
                    {item.photos[0] ? (
                      <NoctaImage
                        src={item.photos[0]}
                        variant="thumb"
                        style={styles.newsThumb}
                        contentFit="cover"
                      />
                    ) : null}
                    <View style={styles.newsCopy}>
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={styles.cardBody} numberOfLines={2}>
                        {item.body}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {!following ? (
            <View style={styles.followCallout}>
              <Text style={styles.followCalloutTitle}>
                Para enterarte de más de tu Espacio favorito, ¡empezá a
                seguirlo!
              </Text>
              <Text style={styles.hint}>
                Sus próximas noticias y promociones van a aparecer en el perfil
                del Espacio.
              </Text>
            </View>
          ) : null}

          <View style={styles.section}>
            {isPublishedHere ? (
              <>
                <View style={styles.publishedStatus}>
                  <LiveDot style={styles.liveDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.publishedTitle}>Publicado aquí</Text>
                    <Text style={styles.hint}>
                      Tu perfil está visible. Seguí buscando gente en Discover.
                    </Text>
                  </View>
                </View>
                <Pressable
                  onPress={() =>
                    navigation.navigate("Main", {
                      screen: "Discover",
                      params: { venueId: venue.id },
                    } as never)
                  }
                  style={styles.primaryBtn}
                >
                  <Ionicons name="flame" size={18} color={colors.onPrimary} />
                  <Text style={styles.primaryBtnText}>Ir al Discover</Text>
                </Pressable>
              </>
            ) : discoverDisabled ? (
              <>
                <Text style={styles.label}>Publicarme aquí</Text>
                <Text style={styles.hint}>
                  Tenés Discover desactivado. Activalo en Configuración para
                  publicarte en un Espacio.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.label}>Publicarme aquí</Text>
                <Text style={[styles.hint, { marginBottom: 10 }]}>
                  Visible solo para quienes también se publicaron en este
                  espacio.
                </Text>
                <View style={styles.presets}>
                  {PRESENCE_PRESETS.map((preset) => {
                    const active = hours === preset.hours;
                    return (
                      <Pressable
                        key={preset.label}
                        onPress={() => setHours(preset.hours)}
                        style={[
                          styles.presetChip,
                          active && styles.presetChipActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.presetChipText,
                            active && styles.presetChipTextActive,
                          ]}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.75}
                        >
                          {preset.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Pressable
                  disabled={busy || atPresenceLimit}
                  onPress={() => void publish()}
                  style={[
                    styles.primaryBtn,
                    (busy || atPresenceLimit) && { opacity: 0.5 },
                  ]}
                >
                  <Ionicons
                    name="radio-outline"
                    size={18}
                    color={colors.onPrimary}
                  />
                  <Text style={styles.primaryBtnText}>
                    {busy
                      ? "Publicando…"
                      : atPresenceLimit
                        ? `Límite ${maxPresences}/${maxPresences}`
                        : publishLabel}
                  </Text>
                </Pressable>
                {atPresenceLimit ? (
                  <Text style={[styles.hint, { marginTop: 8 }]}>
                    Ya estás en {maxPresences} Espacios. Sacá uno desde Discover
                    para publicar acá.
                  </Text>
                ) : null}
              </>
            )}
          </View>
        </View>

        <VenueMap
          name={venue.name}
          address={venue.address}
          city={venue.city}
          country={venue.country}
          location={venue.location}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    position: "relative",
    width: "100%",
    backgroundColor: colors.panel,
    overflow: "hidden",
  },
  cover: {
    ...StyleSheet.absoluteFill,
    width: "100%",
    height: "100%",
  },
  backBtn: {
    position: "absolute",
    left: spacing.md,
    zIndex: 2,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(10,10,11,0.62)",
  },
  heroCaption: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: 4,
  },
  type: {
    color: "rgba(214,255,75,0.92)",
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  titleText: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  nameLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  name: {
    flexShrink: 1,
    color: "#fff",
    fontFamily: fonts.display,
    fontSize: 26,
    letterSpacing: -0.03 * 26,
    lineHeight: 30,
  },
  trustHint: {
    color: "rgba(242,240,235,0.75)",
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 16,
  },
  followBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.45)",
    backgroundColor: "rgba(10,10,11,0.35)",
  },
  followBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  followText: {
    color: "#fff",
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
  },
  followTextActive: {
    color: colors.onPrimary,
  },
  address: {
    color: "rgba(242,240,235,0.72)",
    fontFamily: fonts.body,
    fontSize: 13,
    marginTop: 2,
  },
  body: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    gap: 4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 2,
  },
  metaLine: {
    color: colors.textMuted,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    marginBottom: 2,
  },
  section: {
    marginTop: spacing.md,
    gap: 8,
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  sectionLink: {
    color: colors.primary,
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
  },
  label: {
    color: colors.textMuted,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  desc: {
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
  },
  hint: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
  },
  reviewSummary: {
    color: colors.text,
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
  },
  reviewComposer: {
    gap: 10,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
  },
  starsRow: {
    flexDirection: "row",
    gap: 6,
  },
  reviewInput: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 12,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 14,
    textAlignVertical: "top",
  },
  reviewActions: {
    flexDirection: "row",
    gap: 8,
  },
  reviewItem: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  reviewAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.elevated,
  },
  reviewAvatarEmpty: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryDim,
  },
  reviewInitial: {
    color: colors.primary,
    fontFamily: fonts.bodyBold,
  },
  reviewCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  reviewAuthor: {
    color: colors.text,
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
  },
  reviewMeta: {
    color: colors.textMuted,
    fontFamily: fonts.bodyMedium,
  },
  reviewBody: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
  },
  cardList: {
    gap: 10,
  },
  promoCard: {
    gap: 4,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
  },
  cardTitle: {
    color: colors.text,
    fontFamily: fonts.bodyBold,
    fontSize: 15,
  },
  cardBody: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
  },
  promoPrice: {
    color: colors.primary,
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    marginTop: 2,
  },
  newsItem: {
    flexDirection: "row",
    gap: 10,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
  },
  newsThumb: {
    width: 64,
    height: 64,
    borderRadius: radii.sm,
    backgroundColor: colors.elevated,
  },
  newsCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  followCallout: {
    marginTop: spacing.md,
    gap: 6,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(214,255,75,0.28)",
    backgroundColor: "rgba(214,255,75,0.06)",
  },
  followCalloutTitle: {
    color: colors.text,
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    lineHeight: 20,
  },
  publishedStatus: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 10,
  },
  liveDot: {
    marginTop: 5,
  },
  publishedTitle: {
    color: colors.primary,
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
  },
  presets: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8,
    marginBottom: 10,
  },
  presetChip: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.elevated,
  },
  presetChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryDim,
  },
  presetChipText: {
    color: colors.textMuted,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    textAlign: "center",
  },
  presetChipTextActive: {
    color: colors.primary,
    fontFamily: fonts.bodyBold,
  },
  primaryBtn: {
    minHeight: 46,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: spacing.md,
  },
  primaryBtnText: {
    color: colors.onPrimary,
    fontFamily: fonts.bodyBold,
    fontSize: 15,
  },
  ghostBtn: {
    minHeight: 46,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  ghostBtnText: {
    color: colors.textMuted,
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
  },
  ghostBtnDanger: {
    color: colors.danger,
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
  },
});

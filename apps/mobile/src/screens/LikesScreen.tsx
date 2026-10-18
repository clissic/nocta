import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { CompositeNavigationProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ReceivedLike, ReceivedLikesResponse } from "@nocta/shared";
import { NoctaImage } from "../components/NoctaImage";
import { LikesEmptyPresence } from "../components/likes/LikesEmptyPresence";
import { useToast } from "../components/ToastProvider";
import { LoadingBlock, Screen } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { colors, fonts, radii, spacing, tabBar } from "../theme/tokens";
import type { MainTabParamList, RootStackParamList } from "../navigation/types";

const FALLBACK_PHOTO =
  "https://images.unsplash.com/photo-1511367461989-f85a21fda167?w=400";

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, "Likes">,
  NativeStackNavigationProp<RootStackParamList>
>;

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

function isRevealed(like: ReceivedLike, canSeeLikes: boolean) {
  return Boolean(like.isHeartshot || (canSeeLikes && like.user.id));
}

export function LikesScreen() {
  const navigation = useNavigation<Nav>();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const gap = 10;
  const pad = spacing.md;
  const cardW = (width - pad * 2 - gap) / 2;

  const [likes, setLikes] = useState<ReceivedLike[]>([]);
  const [canSeeLikes, setCanSeeLikes] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLike, setActionLike] = useState<ReceivedLike | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const load = useCallback(async () => {
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
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  function openLike(like: ReceivedLike) {
    if (like.isHeartshot && like.user.id) {
      setActionLike(like);
      return;
    }
    if (!canSeeLikes || !like.user.id) {
      navigation.navigate("Premium");
      return;
    }
    if (!like.canRespond) {
      toast.info("Publicate en este Espacio para abrir Discover");
      navigation.navigate("VenueDetail", { venueId: like.venueId });
      return;
    }
    navigation.navigate("Discover", {
      venueId: like.venueId,
      userId: like.user.id,
    });
  }

  async function respondToHeartshot(direction: "like" | "pass") {
    if (!actionLike?.user.id || actionBusy) return;
    if (!actionLike.canRespond) {
      toast.error("Publicate en el mismo Espacio para responder");
      navigation.navigate("VenueDetail", { venueId: actionLike.venueId });
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
        navigation.navigate("Chat", { matchId: res.match.id });
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

  if (loading) return <LoadingBlock label="Cargando likes…" />;

  if (!likes.length) {
    return (
      <Screen padded={false} safeTop={false}>
        <LikesEmptyPresence
          onOpenDiscover={() => navigation.navigate("Discover")}
          onExploreVenues={() => navigation.navigate("Venues")}
        />
      </Screen>
    );
  }

  return (
    <Screen padded={false} safeTop={false}>
      <FlatList
        data={likes}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={[
          styles.list,
          {
            paddingHorizontal: pad,
            paddingBottom: Math.max(insets.bottom, 10) + tabBar.height + spacing.md,
          },
        ]}
        ListHeaderComponent={
          <View style={styles.head}>
            <Text style={styles.title}>Likes</Text>
            <Text style={styles.subtitle}>
              Personas que te dieron like y todavía no respondiste.
            </Text>
          </View>
        }
        renderItem={({ item, index }) => {
          const revealed = isRevealed(item, canSeeLikes);
          return (
            <Pressable
              onPress={() => openLike(item)}
              style={({ pressed }) => [
                styles.card,
                { width: cardW, marginRight: index % 2 === 0 ? gap : 0 },
                item.isHeartshot && styles.cardHeartshot,
                pressed && { opacity: 0.92, transform: [{ translateY: -1 }] },
              ]}
              accessibilityRole="button"
              accessibilityLabel={
                item.isHeartshot && item.user.name
                  ? `Responder Heartshot de ${item.user.name}`
                  : revealed
                    ? `Ver el perfil de ${item.user.name} en Discover`
                    : `Conocer quién te dio like en ${item.venueName ?? "un Espacio"}`
              }
            >
              <View style={styles.media}>
                {revealed ? (
                  <NoctaImage
                    src={item.user.photo || FALLBACK_PHOTO}
                    fallbackSrc={FALLBACK_PHOTO}
                    variant="medium"
                    style={styles.photo}
                    contentFit="cover"
                  />
                ) : (
                  <View style={styles.lockedMedia}>
                    {item.user.photo ? (
                      <NoctaImage
                        src={item.user.photo}
                        style={styles.photo}
                        contentFit="cover"
                      />
                    ) : (
                      <>
                        <View style={[styles.blob, styles.blobOne]} />
                        <View style={[styles.blob, styles.blobTwo]} />
                        <View style={[styles.blob, styles.blobThree]} />
                      </>
                    )}
                    <View style={styles.lockedScrim} pointerEvents="none" />
                    <Ionicons
                      name="lock-closed"
                      size={28}
                      color="rgba(242,240,235,0.7)"
                    />
                  </View>
                )}
                <LinearGradient
                  colors={["transparent", "rgba(0,0,0,0.82)"]}
                  locations={[0.45, 1]}
                  style={styles.fade}
                  pointerEvents="none"
                />
                {item.isHeartshot ? (
                  <View style={styles.heartshotBadge}>
                    <Ionicons name="heart" size={11} color="#111" />
                    <Text style={styles.heartshotBadgeText}>Heartshot</Text>
                  </View>
                ) : null}
                <View style={styles.caption}>
                  <View style={styles.nameRow}>
                    {revealed && item.user.name ? (
                      <Text style={styles.name} numberOfLines={1}>
                        {item.user.name}
                        <Text style={styles.age}> · {item.user.age}</Text>
                      </Text>
                    ) : (
                      <View style={styles.nameLockedRow}>
                        <View style={styles.namePlaceholder} />
                        <Text style={styles.age}> · {item.user.age}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.venue} numberOfLines={1}>
                    {item.venueName || "Espacio"}
                    {" · "}
                    {formatLikeTime(item.createdAt)}
                  </Text>
                </View>
              </View>
            </Pressable>
          );
        }}
      />

      <Modal
        visible={actionLike != null}
        transparent
        animationType="fade"
        onRequestClose={() => setActionLike(null)}
      >
        <View style={styles.modalLayer}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setActionLike(null)}
            accessibilityLabel="Cerrar"
          />
          <View style={styles.modalDialog}>
            {actionLike ? (
              <>
                <View style={styles.modalPhotoWrap}>
                  <NoctaImage
                    src={actionLike.user.photo || FALLBACK_PHOTO}
                    fallbackSrc={FALLBACK_PHOTO}
                    variant="thumb"
                    style={styles.modalPhoto}
                    contentFit="cover"
                  />
                </View>
                <Text style={styles.modalTitle}>
                  {actionLike.user.name ?? "Alguien"} te mandó un Heartshot
                </Text>
                <Text style={styles.modalBody}>
                  {actionLike.canRespond
                    ? "Podés darle like para matchear o rechazarlo."
                    : "Publicate en el mismo Espacio para poder responder."}
                </Text>
                <View style={styles.modalActions}>
                  {!actionLike.canRespond ? (
                    <Pressable
                      style={styles.btnPrimary}
                      onPress={() => {
                        const venueId = actionLike.venueId;
                        setActionLike(null);
                        navigation.navigate("VenueDetail", { venueId });
                      }}
                    >
                      <Text style={styles.btnPrimaryText}>
                        Publicate en este Espacio
                      </Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    disabled={actionBusy || !actionLike.canRespond}
                    style={[
                      styles.btnOutline,
                      (actionBusy || !actionLike.canRespond) && { opacity: 0.45 },
                    ]}
                    onPress={() => void respondToHeartshot("pass")}
                  >
                    <Text style={styles.btnOutlineText}>Rechazar</Text>
                  </Pressable>
                  <Pressable
                    disabled={actionBusy || !actionLike.canRespond}
                    style={[
                      styles.btnPrimary,
                      (actionBusy || !actionLike.canRespond) && { opacity: 0.45 },
                    ]}
                    onPress={() => void respondToHeartshot("like")}
                  >
                    <Text style={styles.btnPrimaryText}>Dar like</Text>
                  </Pressable>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingTop: spacing.sm,
  },
  head: {
    marginBottom: spacing.md,
    gap: 4,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 26,
    letterSpacing: -0.03 * 26,
  },
  subtitle: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
  },
  row: {
    marginBottom: 10,
  },
  card: {
    borderRadius: radii.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(242,240,235,0.1)",
    backgroundColor: "rgba(242,240,235,0.03)",
  },
  cardHeartshot: {
    borderColor: "rgba(255,107,157,0.45)",
  },
  media: {
    aspectRatio: 4 / 5,
    backgroundColor: "#111",
  },
  photo: {
    ...StyleSheet.absoluteFill,
    width: "100%",
    height: "100%",
  },
  lockedMedia: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0d0d0f",
    overflow: "hidden",
  },
  lockedScrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  blob: {
    position: "absolute",
    borderRadius: 999,
    opacity: 0.9,
  },
  blobOne: {
    width: "58%",
    height: "42%",
    left: "8%",
    top: "18%",
    backgroundColor: "rgba(214,255,75,0.28)",
  },
  blobTwo: {
    width: "48%",
    height: "38%",
    right: "4%",
    top: "36%",
    backgroundColor: "rgba(160,120,255,0.22)",
  },
  blobThree: {
    width: "62%",
    height: "44%",
    left: "18%",
    bottom: "6%",
    backgroundColor: "rgba(80,180,255,0.16)",
  },
  fade: {
    ...StyleSheet.absoluteFill,
  },
  heartshotBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    zIndex: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,107,157,0.92)",
  },
  heartshotBadgeText: {
    color: "#111",
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 0.2,
  },
  caption: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    zIndex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  nameLockedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  name: {
    flexShrink: 1,
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 16,
    letterSpacing: -0.03 * 16,
  },
  age: {
    fontFamily: fonts.bodyMedium,
    color: "rgba(242,240,235,0.72)",
    fontSize: 15,
  },
  namePlaceholder: {
    width: 68,
    height: 12,
    borderRadius: radii.pill,
    backgroundColor: "rgba(242,240,235,0.28)",
  },
  venue: {
    marginTop: 3,
    color: colors.primary,
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
  },
  modalLayer: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.66)",
  },
  modalDialog: {
    backgroundColor: colors.panel,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  modalPhotoWrap: {
    alignSelf: "center",
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255,107,157,0.55)",
    marginBottom: spacing.sm,
  },
  modalPhoto: {
    width: "100%",
    height: "100%",
  },
  modalTitle: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 22,
    letterSpacing: -0.03 * 22,
    textAlign: "center",
  },
  modalBody: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  modalActions: {
    marginTop: spacing.md,
    gap: 10,
  },
  btnPrimary: {
    minHeight: 44,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  btnPrimaryText: {
    color: colors.onPrimary,
    fontFamily: fonts.bodyBold,
    fontSize: 15,
  },
  btnOutline: {
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(242,240,235,0.35)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  btnOutlineText: {
    color: colors.text,
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
  },
});

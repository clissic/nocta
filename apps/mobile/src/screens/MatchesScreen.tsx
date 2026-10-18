import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { CompositeNavigationProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  REPORT_REASON_LABELS,
  REPORT_REASONS,
  type MatchSummary,
  type ReportReason,
} from "@nocta/shared";
import { NoctaImage } from "../components/NoctaImage";
import { MatchesEmptyPresence } from "../components/matches/MatchesEmptyPresence";
import { useToast } from "../components/ToastProvider";
import { LoadingBlock, Screen } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { colors, fonts, radii, spacing, tabBar } from "../theme/tokens";
import type { MainTabParamList, RootStackParamList } from "../navigation/types";

const FALLBACK_PHOTO =
  "https://images.unsplash.com/photo-1511367461989-f85a21fda167?w=400";

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, "Matches">,
  NativeStackNavigationProp<RootStackParamList>
>;

function formatMessageTime(iso?: string) {
  if (!iso) return "";
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
    });
  }
  return date.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
  });
}

export function MatchesScreen() {
  const navigation = useNavigation<Nav>();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  /** Parity web: <768 lista; ≥768 2 cols; ≥992 3 cols. */
  const cols = width >= 992 ? 3 : width >= 768 ? 2 : 1;
  const isGrid = cols > 1;
  const pad = spacing.md;
  const gap = width >= 992 ? 20 : 16;
  const cardW = isGrid ? (width - pad * 2 - gap * (cols - 1)) / cols : width - pad * 2;

  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuMatch, setMenuMatch] = useState<MatchSummary | null>(null);
  const [mode, setMode] = useState<"menu" | "report">("menu");
  const [reportReason, setReportReason] = useState<ReportReason>("spam");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await api<{ matches: MatchSummary[] }>("/api/matches");
      setMatches(data.matches);
    } catch (err) {
      if (!silent) {
        toast.error(
          err instanceof ApiError ? err.message : "No se pudieron cargar"
        );
        setMatches([]);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load(true);
      const id = setInterval(() => void load(true), 12000);
      return () => clearInterval(id);
    }, [load])
  );

  function closeSheet() {
    setMenuMatch(null);
    setMode("menu");
    setReportReason("spam");
  }

  async function removeMatch(id: string) {
    setBusy(true);
    try {
      await api(`/api/matches/${id}`, { method: "DELETE" });
      setMatches((prev) => prev.filter((m) => m.id !== id));
      closeSheet();
      toast.success("Match eliminado");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo eliminar"
      );
    } finally {
      setBusy(false);
    }
  }

  async function blockMatch(id: string) {
    setBusy(true);
    try {
      await api(`/api/matches/${id}/block`, {
        method: "POST",
        body: "{}",
      });
      setMatches((prev) => prev.filter((m) => m.id !== id));
      closeSheet();
      toast.success("Persona bloqueada");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo bloquear"
      );
    } finally {
      setBusy(false);
    }
  }

  async function reportMatch(id: string) {
    setBusy(true);
    try {
      await api(`/api/matches/${id}/report`, {
        method: "POST",
        body: JSON.stringify({ reason: reportReason, unmatch: true }),
      });
      setMatches((prev) => prev.filter((m) => m.id !== id));
      closeSheet();
      toast.success("Denuncia enviada");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo denunciar"
      );
    } finally {
      setBusy(false);
    }
  }

  function confirmRemove(match: MatchSummary) {
    Alert.alert("Eliminar match", "¿Eliminar este match?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: () => void removeMatch(match.id),
      },
    ]);
  }

  function confirmBlock(match: MatchSummary) {
    Alert.alert(
      "Bloquear",
      "¿Bloquear a esta persona? Se eliminará el match.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Bloquear",
          style: "destructive",
          onPress: () => void blockMatch(match.id),
        },
      ]
    );
  }

  function openMenu(match: MatchSummary) {
    setMenuMatch(match);
    setMode("menu");
  }

  if (loading) return <LoadingBlock label="Cargando matches…" />;

  if (!matches.length) {
    return (
      <Screen padded={false} safeTop={false}>
        <MatchesEmptyPresence
          onOpenDiscover={() => navigation.navigate("Discover")}
          onExploreVenues={() => navigation.navigate("Venues")}
        />
      </Screen>
    );
  }

  return (
    <Screen padded={false} safeTop={false}>
      <FlatList
        key={`matches-${cols}`}
        data={matches}
        keyExtractor={(item) => item.id}
        numColumns={cols}
        columnWrapperStyle={isGrid ? styles.gridRow : undefined}
        contentContainerStyle={[
          styles.list,
          {
            paddingHorizontal: pad,
            paddingBottom:
              Math.max(insets.bottom, 10) + tabBar.height + spacing.md,
          },
        ]}
        ListHeaderComponentStyle={styles.listHeader}
        ListHeaderComponent={
          <View style={[styles.head, isGrid && styles.headGrid]}>
            <Text style={styles.title}>Matches</Text>
            <Text style={styles.subtitle}>Gente del mismo espacio.</Text>
          </View>
        }
        renderItem={({ item, index }) => {
          const time = formatMessageTime(item.lastMessage?.createdAt);
          const isLast = index === matches.length - 1;

          if (isGrid) {
            const rowGap = width >= 992 ? 24 : 20;
            return (
              <View
                style={[
                  styles.card,
                  {
                    width: cardW,
                    marginRight: index % cols === cols - 1 ? 0 : gap,
                    marginBottom: rowGap,
                  },
                ]}
              >
                <Pressable
                  style={({ pressed }) => [
                    styles.cardMain,
                    pressed && { opacity: 0.92 },
                  ]}
                  onPress={() =>
                    navigation.navigate("Chat", { matchId: item.id })
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`Abrir chat con ${item.otherUser.name}`}
                >
                  <View style={styles.cardPhotoWrap}>
                    <NoctaImage
                      src={item.otherUser.photo || FALLBACK_PHOTO}
                      fallbackSrc={FALLBACK_PHOTO}
                      variant="medium"
                      style={[
                        styles.cardAvatar,
                        width >= 992 && styles.cardAvatarLg,
                      ]}
                      contentFit="cover"
                    />
                    <View style={styles.cardTools}>
                      {item.unreadCount > 0 ? (
                        <View
                          style={styles.unreadBadge}
                          accessibilityLabel={`${item.unreadCount} mensajes sin leer`}
                        >
                          <Text style={styles.unreadBadgeText}>
                            {item.unreadCount > 99 ? "99+" : item.unreadCount}
                          </Text>
                        </View>
                      ) : null}
                      <Pressable
                        style={({ pressed }) => [
                          styles.cardMenu,
                          pressed && { backgroundColor: "rgba(10,10,11,0.75)" },
                        ]}
                        onPress={() => openMenu(item)}
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityLabel={`Opciones de ${item.otherUser.name}`}
                      >
                        <Ionicons name="ellipsis-vertical" size={16} color="#f2f0eb" />
                      </Pressable>
                    </View>
                  </View>
                  <View style={styles.cardCopy}>
                    <Text style={styles.name} numberOfLines={1}>
                      {item.otherUser.name}
                    </Text>
                    <Text style={styles.venue} numberOfLines={1}>
                      {item.venueName ?? "Espacio"}
                    </Text>
                    <Text style={styles.preview} numberOfLines={1}>
                      <Text style={styles.previewBody}>
                        {item.lastMessage?.body ?? "Decí hola"}
                      </Text>
                      {time ? (
                        <Text style={styles.previewTime}>{` · ${time}`}</Text>
                      ) : null}
                    </Text>
                  </View>
                </Pressable>
              </View>
            );
          }

          return (
            <View
              style={[
                styles.row,
                isLast && styles.rowLast,
              ]}
            >
              <Pressable
                style={({ pressed }) => [
                  styles.rowMain,
                  pressed && { opacity: 0.88 },
                ]}
                onPress={() =>
                  navigation.navigate("Chat", { matchId: item.id })
                }
                accessibilityRole="button"
                accessibilityLabel={`Abrir chat con ${item.otherUser.name}`}
              >
                <NoctaImage
                  src={item.otherUser.photo || FALLBACK_PHOTO}
                  fallbackSrc={FALLBACK_PHOTO}
                  variant="thumb"
                  style={styles.avatar}
                  contentFit="cover"
                />
                <View style={styles.copy}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.otherUser.name}
                  </Text>
                  <Text style={styles.venue} numberOfLines={1}>
                    {item.venueName ?? "Espacio"}
                  </Text>
                  <Text style={styles.preview} numberOfLines={1}>
                    <Text style={styles.previewBody}>
                      {item.lastMessage?.body ?? "Decí hola"}
                    </Text>
                    {time ? (
                      <Text style={styles.previewTime}>{` · ${time}`}</Text>
                    ) : null}
                  </Text>
                </View>
              </Pressable>
              <View style={styles.rowSide}>
                {item.unreadCount > 0 ? (
                  <View
                    style={styles.unreadBadge}
                    accessibilityLabel={`${item.unreadCount} mensajes sin leer`}
                  >
                    <Text style={styles.unreadBadgeText}>
                      {item.unreadCount > 99 ? "99+" : item.unreadCount}
                    </Text>
                  </View>
                ) : null}
                <Pressable
                  style={({ pressed }) => [
                    styles.menuBtn,
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={() => openMenu(item)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Opciones de ${item.otherUser.name}`}
                >
                  <Ionicons
                    name="ellipsis-vertical"
                    size={18}
                    color={colors.textMuted}
                  />
                </Pressable>
              </View>
            </View>
          );
        }}
      />

      <Modal
        visible={menuMatch != null}
        transparent
        animationType="slide"
        onRequestClose={closeSheet}
      >
        <View style={styles.sheetRoot}>
          <Pressable
            style={styles.sheetBackdrop}
            onPress={closeSheet}
            accessibilityLabel="Cerrar"
          />
          <View
            style={[
              styles.sheetPanel,
              { paddingBottom: Math.max(insets.bottom, spacing.md) },
            ]}
          >
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>
              {menuMatch?.otherUser.name ?? ""}
            </Text>

            {mode === "menu" ? (
              <View style={styles.sheetActions}>
                <Pressable
                  style={({ pressed }) => [
                    styles.btnPrimary,
                    pressed && { opacity: 0.9 },
                  ]}
                  onPress={() => {
                    const id = menuMatch?.id;
                    closeSheet();
                    if (id) navigation.navigate("Chat", { matchId: id });
                  }}
                >
                  <Ionicons
                    name="chatbubble-ellipses"
                    size={18}
                    color={colors.onPrimary}
                  />
                  <Text style={styles.btnPrimaryText}>Abrir chat</Text>
                </Pressable>
                <Pressable
                  disabled={busy}
                  style={({ pressed }) => [
                    styles.btnOutline,
                    (busy || pressed) && { opacity: busy ? 0.45 : 0.9 },
                  ]}
                  onPress={() => menuMatch && confirmRemove(menuMatch)}
                >
                  <Ionicons
                    name="trash-outline"
                    size={18}
                    color={colors.text}
                  />
                  <Text style={styles.btnOutlineText}>Eliminar match</Text>
                </Pressable>
                <Pressable
                  disabled={busy}
                  style={({ pressed }) => [
                    styles.btnWarningOutline,
                    (busy || pressed) && { opacity: busy ? 0.45 : 0.9 },
                  ]}
                  onPress={() => setMode("report")}
                >
                  <Ionicons
                    name="flag-outline"
                    size={18}
                    color={colors.warning}
                  />
                  <Text style={styles.btnWarningText}>Denunciar</Text>
                </Pressable>
                <Pressable
                  disabled={busy}
                  style={({ pressed }) => [
                    styles.btnDangerOutline,
                    (busy || pressed) && { opacity: busy ? 0.45 : 0.9 },
                  ]}
                  onPress={() => menuMatch && confirmBlock(menuMatch)}
                >
                  <Ionicons
                    name="ban-outline"
                    size={18}
                    color={colors.danger}
                  />
                  <Text style={styles.btnDangerText}>Bloquear</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.btnLink,
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={closeSheet}
                >
                  <Text style={styles.btnLinkText}>Cancelar</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.sheetActions}>
                <Text style={styles.reportHint}>
                  Elegí el motivo. Se eliminará el match.
                </Text>
                <View style={styles.reasonList}>
                  {REPORT_REASONS.map((reason) => {
                    const selected = reportReason === reason;
                    return (
                      <Pressable
                        key={reason}
                        onPress={() => setReportReason(reason)}
                        style={[
                          styles.reasonOption,
                          selected && styles.reasonOptionSelected,
                        ]}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                      >
                        <Text
                          style={[
                            styles.reasonOptionText,
                            selected && styles.reasonOptionTextSelected,
                          ]}
                        >
                          {REPORT_REASON_LABELS[reason]}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Pressable
                  disabled={busy}
                  style={({ pressed }) => [
                    styles.btnWarning,
                    (busy || pressed) && { opacity: busy ? 0.45 : 0.9 },
                  ]}
                  onPress={() =>
                    menuMatch && void reportMatch(menuMatch.id)
                  }
                >
                  <Text style={styles.btnWarningSolidText}>
                    Enviar denuncia
                  </Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.btnLink,
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={() => setMode("menu")}
                >
                  <Text style={styles.btnLinkText}>Volver</Text>
                </Pressable>
              </View>
            )}
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
  listHeader: {
    width: "100%",
  },
  head: {
    marginBottom: 12,
    gap: 4,
    width: "100%",
  },
  headGrid: {
    marginBottom: 20,
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
  gridRow: {
    flexDirection: "row",
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 4,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.elevated,
    marginTop: 2,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  card: {
    position: "relative",
  },
  cardMain: {
    gap: 9,
  },
  cardPhotoWrap: {
    position: "relative",
    width: "100%",
    aspectRatio: 1,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: colors.elevated,
  },
  cardAvatar: {
    width: "100%",
    height: "100%",
    borderRadius: 14,
  },
  cardAvatarLg: {
    borderRadius: 16,
  },
  cardTools: {
    position: "absolute",
    top: 7,
    right: 6,
    zIndex: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  cardMenu: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(10,10,11,0.55)",
  },
  rowSide: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    alignSelf: "center",
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadBadgeText: {
    color: colors.onPrimary,
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    lineHeight: 14,
  },
  cardCopy: {
    paddingHorizontal: 2,
    paddingBottom: 2,
    gap: 0,
  },
  name: {
    color: colors.text,
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    lineHeight: 20,
  },
  venue: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 17,
    marginTop: 2,
  },
  preview: {
    marginTop: 3,
    fontSize: 13,
    lineHeight: 17,
  },
  previewBody: {
    color: colors.textMuted,
    fontFamily: fonts.body,
  },
  previewTime: {
    color: colors.textFaint,
    fontFamily: fonts.body,
  },
  menuBtn: {
    flexShrink: 0,
    paddingHorizontal: 6,
    paddingVertical: 8,
    alignSelf: "center",
  },
  sheetRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(6,6,8,0.72)",
  },
  sheetPanel: {
    backgroundColor: colors.panel,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: "rgba(242,240,235,0.22)",
    marginBottom: spacing.sm,
  },
  sheetTitle: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 18,
    letterSpacing: -0.03 * 18,
    marginBottom: spacing.sm,
  },
  sheetActions: {
    gap: 10,
  },
  reportHint: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
  },
  reasonList: {
    gap: 8,
  },
  reasonOption: {
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(242,240,235,0.22)",
    paddingHorizontal: spacing.md,
    justifyContent: "center",
  },
  reasonOptionSelected: {
    borderColor: colors.warning,
    backgroundColor: "rgba(240,192,64,0.12)",
  },
  reasonOptionText: {
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 15,
  },
  reasonOptionTextSelected: {
    fontFamily: fonts.bodySemiBold,
    color: colors.warning,
  },
  btnPrimary: {
    minHeight: 46,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: spacing.md,
  },
  btnPrimaryText: {
    color: colors.onPrimary,
    fontFamily: fonts.bodyBold,
    fontSize: 15,
  },
  btnOutline: {
    minHeight: 46,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(242,240,235,0.35)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: spacing.md,
  },
  btnOutlineText: {
    color: colors.text,
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
  },
  btnWarningOutline: {
    minHeight: 46,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(240,192,64,0.55)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: spacing.md,
  },
  btnWarningText: {
    color: colors.warning,
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
  },
  btnDangerOutline: {
    minHeight: 46,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(255,107,107,0.55)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: spacing.md,
  },
  btnDangerText: {
    color: colors.danger,
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
  },
  btnWarning: {
    minHeight: 46,
    borderRadius: radii.md,
    backgroundColor: colors.warning,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  btnWarningSolidText: {
    color: colors.onPrimary,
    fontFamily: fonts.bodyBold,
    fontSize: 15,
  },
  btnLink: {
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  btnLinkText: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 15,
  },
});

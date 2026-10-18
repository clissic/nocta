import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  PREMIUM_PLANS,
  planHasFeature,
  type AuthUser,
  type PremiumPlanId,
} from "@nocta/shared";
import { useAuth } from "../../auth/AuthContext";
import { useToast } from "../ToastProvider";
import { NoctaImage } from "../NoctaImage";
import { NoctaWordmark } from "../NoctaWordmark";
import { ProfileSettingsSheet } from "../profile/ProfileSettingsSheet";
import { LogoutConfirm } from "./LogoutConfirm";
import { api, ApiError } from "../../lib/api";
import { colors, fonts } from "../../theme/tokens";
import type { RootStackParamList } from "../../navigation/types";

const PLAN_PILL: Record<
  PremiumPlanId | "free",
  { label: string; color: string; bg: string; border: string }
> = {
  nocta_2am: {
    label: "2 AM",
    color: "#d6ff4b",
    bg: "rgba(214,255,75,0.18)",
    border: "rgba(214,255,75,0.45)",
  },
  nocta_4am: {
    label: "4 AM",
    color: "#7ec4ff",
    bg: "rgba(77,166,255,0.18)",
    border: "rgba(77,166,255,0.45)",
  },
  nocta_6am: {
    label: "6 AM",
    color: "#c4a0ff",
    bg: "rgba(167,112,255,0.18)",
    border: "rgba(167,112,255,0.45)",
  },
  free: {
    label: "Gratis",
    color: "rgba(255,255,255,0.72)",
    bg: "rgba(255,255,255,0.08)",
    border: "rgba(255,255,255,0.18)",
  },
};

function formatBoostCountdown(remainingMs: number) {
  const totalSec = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function teleportLabel(user: AuthUser) {
  if (!user.premium || !user.teleportMode) return "Teleport: desactivado";
  if (user.teleportCity?.city) return `Teleport: ${user.teleportCity.city}`;
  return "Teleport: sin ciudad";
}

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function AccountDrawer({ visible, onClose }: Props) {
  const { user, setUser, logout } = useAuth();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const drawerW = Math.min(width * 0.84, 340);
  const translate = useRef(new Animated.Value(drawerW)).current;
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const afterCloseRef = useRef<(() => void) | null>(null);
  const afterCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mounted, setMounted] = useState(visible);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsFocus, setSettingsFocus] = useState<"teleport" | undefined>();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [boostBusy, setBoostBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [avatarBroken, setAvatarBroken] = useState(false);

  useEffect(() => {
    if (visible) setMounted(true);
    Animated.timing(translate, {
      toValue: visible ? 0 : drawerW,
      duration: 240,
      useNativeDriver: true,
    }).start(() => {
      if (!visibleRef.current) setMounted(false);
    });
  }, [visible, drawerW, translate]);

  function flushAfterClose() {
    if (visibleRef.current) return;
    const fn = afterCloseRef.current;
    if (!fn) return;
    afterCloseRef.current = null;
    fn();
  }

  useEffect(() => {
    if (mounted || !afterCloseRef.current) return;
    if (afterCloseTimer.current) clearTimeout(afterCloseTimer.current);
    // iOS no puede abrir otro modal ni navegar hasta que el menú soltó la pantalla.
    const delay = Platform.OS === "ios" ? 550 : 80;
    afterCloseTimer.current = setTimeout(() => {
      afterCloseTimer.current = null;
      flushAfterClose();
    }, delay);
  }, [mounted]);

  useEffect(() => {
    return () => {
      if (afterCloseTimer.current) clearTimeout(afterCloseTimer.current);
    };
  }, []);

  const boostExpiresAt = user?.boostExpiresAt
    ? new Date(user.boostExpiresAt).getTime()
    : 0;

  useEffect(() => {
    if (!boostExpiresAt || boostExpiresAt <= Date.now()) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [boostExpiresAt]);

  if (!user) return null;

  const name = user.profile?.name?.trim() || user.email;
  const avatar = user.profile?.photos?.[0];
  const pill = user.premium && user.premiumPlanId
    ? PLAN_PILL[user.premiumPlanId]
    : PLAN_PILL.free;
  const canBoost = planHasFeature(user.premiumPlanId, "boost");
  const boostRemainingMs = boostExpiresAt - now;
  const boostActive = boostRemainingMs > 0;
  const boostCountdown = boostActive
    ? formatBoostCountdown(boostRemainingMs)
    : null;

  function closeThen(fn: () => void) {
    afterCloseRef.current = fn;
    onClose();
  }

  function openSettings(focus?: "teleport") {
    setSettingsFocus(focus);
    closeThen(() => setSettingsOpen(true));
  }

  function openTeleport() {
    if (!user) return;
    const canTeleport = Boolean(
      user.premium && planHasFeature(user.premiumPlanId, "teleport")
    );
    if (!canTeleport) {
      const planId = PREMIUM_PLANS.find(
        (plan) => !plan.comingSoon && plan.features.includes("teleport")
      )?.id;
      closeThen(() =>
        navigation.navigate("Premium", planId ? { planId } : undefined)
      );
      return;
    }
    openSettings("teleport");
  }

  async function activateBoost() {
    if (boostBusy) return;
    if (!canBoost) {
      closeThen(() => navigation.navigate("Premium"));
      return;
    }
    if (boostActive) {
      toast.info("Ya tenés un Boost activo");
      return;
    }
    if ((user?.boostsRemaining ?? 0) <= 0) {
      toast.error("No te quedan Boosts este periodo");
      return;
    }
    setBoostBusy(true);
    try {
      const res = await api<{ user?: AuthUser }>("/api/premium/boost", {
        method: "POST",
        body: JSON.stringify({}),
      });
      if (res.user) setUser(res.user);
      toast.success("Boost activado · prioridad 30 min");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo activar el Boost"
      );
    } finally {
      setBoostBusy(false);
    }
  }

  return (
    <>
      <Modal
        visible={mounted}
        transparent
        animationType="none"
        onRequestClose={onClose}
        statusBarTranslucent
      >
        <View style={styles.layer}>
          <Pressable
            style={styles.backdrop}
            onPress={onClose}
            accessibilityLabel="Cerrar menú de cuenta"
          />
          <Animated.View
            style={[
              styles.drawer,
              {
                width: drawerW,
                paddingTop: Math.max(insets.top, 12),
                paddingBottom: Math.max(insets.bottom, 12),
                transform: [{ translateX: translate }],
              },
            ]}
          >
            <View style={styles.head}>
              <Text style={styles.headLabel}>Cuenta</Text>
              <Pressable
                onPress={onClose}
                style={styles.closeBtn}
                accessibilityLabel="Cerrar menú de cuenta"
              >
                <Ionicons name="close" size={18} color={colors.primary} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.body}
              contentContainerStyle={styles.bodyContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.profile}>
                <View style={styles.avatar}>
                  {avatar && !avatarBroken ? (
                    <NoctaImage
                      src={avatar}
                      variant="thumb"
                      style={styles.avatarImg}
                      contentFit="cover"
                      onError={() => setAvatarBroken(true)}
                    />
                  ) : (
                    <Ionicons name="person" size={26} color="rgba(255,255,255,0.55)" />
                  )}
                </View>
                <View style={styles.identity}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name} numberOfLines={1}>
                      {name}
                    </Text>
                    {user.identityVerified ? (
                      <Ionicons
                        name="checkmark-circle"
                        size={16}
                        color={colors.primary}
                        accessibilityLabel="Cuenta verificada"
                      />
                    ) : null}
                  </View>
                  <View style={styles.planRow}>
                    <Text style={styles.planLabel}>Plan</Text>
                    <View
                      style={[
                        styles.pill,
                        { backgroundColor: pill.bg, borderColor: pill.border },
                      ]}
                    >
                      <Text style={[styles.pillText, { color: pill.color }]}>
                        {pill.label}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              <Pressable
                style={styles.outlineBtn}
                onPress={() =>
                  closeThen(() =>
                    navigation.navigate("Onboarding", { edit: true })
                  )
                }
              >
                <Ionicons name="pencil" size={16} color={colors.text} />
                <Text style={styles.outlineText}>Editar perfil</Text>
              </Pressable>
              <Pressable
                style={styles.outlineBtn}
                onPress={() => openSettings()}
              >
                <Ionicons name="settings-outline" size={16} color={colors.text} />
                <Text style={styles.outlineText}>Configuración</Text>
              </Pressable>

              <View style={styles.teleport}>
                <Ionicons name="location-outline" size={16} color={colors.primary} />
                <Text style={styles.teleportText}>{teleportLabel(user)}</Text>
                <Pressable
                  onPress={openTeleport}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Opciones de Teleport"
                  style={styles.teleportGear}
                >
                  <Ionicons
                    name="settings-outline"
                    size={18}
                    color={colors.textMuted}
                  />
                </Pressable>
              </View>

              <Pressable
                style={[styles.boost, boostActive && styles.boostActive]}
                disabled={boostBusy}
                onPress={() => void activateBoost()}
              >
                <Ionicons name="rocket" size={18} color={colors.primary} />
                <View style={styles.boostCopy}>
                  <Text style={styles.boostTitle}>Boost</Text>
                  <Text style={styles.boostSub}>
                    {!canBoost
                      ? "Desde Nocta 4 A.M."
                      : boostActive
                        ? "Activo ahora"
                        : `${user.boostsRemaining ?? 0} restantes`}
                  </Text>
                </View>
                <Text style={styles.boostAction}>
                  {!canBoost ? "Ver planes" : boostCountdown ?? "Usar"}
                </Text>
              </Pressable>

              <View style={styles.links}>
                <DrawerLink
                  icon="person-outline"
                  label="Mi perfil"
                  onPress={() =>
                    closeThen(() =>
                      navigation.navigate("Main", { screen: "Profile" })
                    )
                  }
                />
                <DrawerLink
                  icon="diamond-outline"
                  label="Premium"
                  onPress={() => closeThen(() => navigation.navigate("Premium"))}
                />
                <DrawerLink
                  icon="qr-code-outline"
                  label="Mis promos"
                  onPress={() =>
                    closeThen(() => navigation.navigate("MyPromos"))
                  }
                />
                {user.role === "admin" ? (
                  <DrawerLink
                    icon="speedometer-outline"
                    label="Panel"
                    onPress={() =>
                      closeThen(() => toast.info("El panel se abre en la web"))
                    }
                  />
                ) : null}
              </View>
            </ScrollView>

            <Pressable
              style={styles.logout}
              onPress={() => closeThen(() => setLogoutOpen(true))}
            >
              <Ionicons name="log-out-outline" size={18} color="#ff8f8f" />
              <Text style={styles.logoutText}>Cerrar sesión</Text>
            </Pressable>

            <View style={styles.footer}>
              <NoctaWordmark size={14} />
              <Text style={styles.footerCopy}>
                © {new Date().getFullYear()} Nocta ·{" "}
                <Text
                  style={styles.footerLink}
                  onPress={() =>
                    closeThen(() => navigation.navigate("Terms"))
                  }
                >
                  Términos y Condiciones
                </Text>
              </Text>
            </View>
          </Animated.View>
        </View>
      </Modal>

      <ProfileSettingsSheet
        visible={settingsOpen}
        focus={settingsFocus}
        user={user}
        onClose={() => {
          setSettingsOpen(false);
          setSettingsFocus(undefined);
        }}
        onUserUpdated={setUser}
        onOpenPremium={(planId?: PremiumPlanId) => {
          setSettingsOpen(false);
          setTimeout(
            () =>
              navigation.navigate("Premium", planId ? { planId } : undefined),
            Platform.OS === "ios" ? 550 : 80
          );
        }}
        onDeleteAccount={() => {
          setSettingsOpen(false);
          setTimeout(
            () => setDeleteOpen(true),
            Platform.OS === "ios" ? 550 : 80
          );
        }}
      />
      <DeleteAccountModal
        visible={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onDeleted={() => {
          setDeleteOpen(false);
          logout();
        }}
      />
      <LogoutConfirm
        visible={logoutOpen}
        onCancel={() => setLogoutOpen(false)}
        onConfirm={() => {
          setLogoutOpen(false);
          logout();
        }}
      />
    </>
  );
}

function DrawerLink({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.link} onPress={onPress}>
      <Ionicons name={icon} size={18} color={colors.text} />
      <Text style={styles.linkText}>{label}</Text>
      <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.45)" />
    </Pressable>
  );
}

function DeleteAccountModal({
  visible,
  onClose,
  onDeleted,
}: {
  visible: boolean;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const toast = useToast();
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const canDelete = confirmation === "Eliminar";

  useEffect(() => {
    if (!visible) setConfirmation("");
  }, [visible]);

  async function deleteAccount() {
    if (!canDelete || busy) return;
    setBusy(true);
    try {
      await api("/api/me/account", {
        method: "DELETE",
        body: JSON.stringify({ confirmation }),
      });
      toast.success(
        "Cuenta programada para eliminar. Tenés 30 días para recuperarla."
      );
      onDeleted();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo eliminar la cuenta"
      );
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.confirmLayer}>
        <Pressable style={styles.confirmBackdrop} onPress={busy ? undefined : onClose} />
        <View style={styles.confirmCard}>
          <Text style={styles.confirmTitle}>Eliminar cuenta</Text>
          <Text style={styles.confirmBody}>
            Tu cuenta se programará para eliminar. Tendrás 30 días para
            recuperarla iniciando sesión. Escribí Eliminar para confirmar.
          </Text>
          <TextInput
            value={confirmation}
            onChangeText={setConfirmation}
            placeholder="Eliminar"
            placeholderTextColor={colors.textFaint}
            editable={!busy}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.deleteInput}
          />
          <View style={styles.confirmActions}>
            <Pressable style={styles.confirmCancel} disabled={busy} onPress={onClose}>
              <Text style={styles.confirmCancelText}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[styles.deleteOk, (!canDelete || busy) && { opacity: 0.45 }]}
              disabled={!canDelete || busy}
              onPress={() => void deleteAccount()}
            >
              {busy ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.confirmOkText}>Eliminar</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  layer: { flex: 1 },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.62)",
  },
  drawer: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(13,13,15,0.98)",
    borderLeftWidth: 1,
    borderLeftColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 16,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 44,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  headLabel: {
    color: colors.primary,
    fontFamily: fonts.display,
    fontSize: 13,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  body: { flex: 1 },
  bodyContent: { paddingVertical: 16, gap: 10 },
  profile: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 6 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  avatarImg: { width: 56, height: 56 },
  identity: { flex: 1, minWidth: 0, gap: 6 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: {
    flexShrink: 1,
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 18,
    letterSpacing: -0.3,
  },
  planRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  planLabel: {
    color: "rgba(255,255,255,0.55)",
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
  },
  pill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  pillText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 0.4,
  },
  outlineBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
  },
  outlineText: {
    color: colors.text,
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
  },
  teleport: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  teleportText: {
    flex: 1,
    color: "rgba(255,255,255,0.78)",
    fontFamily: fonts.body,
    fontSize: 14,
  },
  teleportGear: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  boost: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  boostActive: {
    borderColor: "rgba(214,255,75,0.35)",
    backgroundColor: "rgba(214,255,75,0.08)",
  },
  boostCopy: { flex: 1, minWidth: 0 },
  boostTitle: {
    color: colors.text,
    fontFamily: fonts.bodyBold,
    fontSize: 15,
  },
  boostSub: {
    color: "rgba(255,255,255,0.55)",
    fontFamily: fonts.body,
    fontSize: 12,
  },
  boostAction: {
    color: colors.primary,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  links: { gap: 4, marginTop: 4 },
  link: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  linkText: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
  },
  logout: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 48,
    marginTop: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  logoutText: {
    color: "#ff8f8f",
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
  },
  footer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.08)",
    gap: 4,
  },
  footerCopy: {
    color: colors.textFaint,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  footerLink: {
    color: colors.primary,
    fontFamily: fonts.bodySemiBold,
  },
  confirmLayer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  confirmBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.62)",
  },
  confirmCard: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 18,
    padding: 20,
    backgroundColor: "#161618",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    gap: 10,
  },
  confirmIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  confirmTitle: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 22,
    letterSpacing: -0.4,
  },
  confirmBody: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
  },
  confirmActions: { flexDirection: "row", gap: 10, marginTop: 6 },
  confirmCancel: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmCancelText: {
    color: colors.text,
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
  },
  confirmOk: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmOkText: {
    color: colors.onPrimary,
    fontFamily: fonts.bodyBold,
    fontSize: 15,
  },
  deleteInput: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    paddingHorizontal: 12,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 15,
  },
  deleteOk: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
  },
});

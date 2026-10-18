import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { prepareUploadUri } from "../../lib/localFile";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ALL_VENUE_CITIES,
  MAX_IDENTITY_VERIFICATION_FILE_BYTES,
  PREMIUM_PLANS,
  REPORT_REASON_LABELS,
  type AuthUser,
  type BlockedUser,
  type MyReportListItem,
  type PaginationMeta,
  type PremiumPlanId,
} from "@nocta/shared";
import type { RootStackParamList } from "../../navigation/types";
import { NoctaImage } from "../NoctaImage";
import { NoctaWordmark } from "../NoctaWordmark";
import { useToast } from "../ToastProvider";
import { api, ApiError, getToken, initTokenStore } from "../../lib/api";
import { colors, fonts, radii, spacing } from "../../theme/tokens";

type SettingKey =
  | "autoAcceptFollowRequests"
  | "showActivityToFollowers"
  | "rogueMode"
  | "teleportMode"
  | "discoverDisabled";

type LocalImage = {
  uri: string;
  mimeType: string;
  fileName: string;
};

type Props = {
  visible: boolean;
  user: AuthUser;
  onClose: () => void;
  onUserUpdated: (user: AuthUser) => void;
  onOpenPremium: (planId?: PremiumPlanId) => void;
  onDeleteAccount: () => void;
  /** Solo el bloque de Teleport, abierto desde el menú lateral. */
  focus?: "teleport";
};

const PLAN_PILL: Record<
  PremiumPlanId,
  { label: string; bg: string; color: string; border: string }
> = {
  nocta_2am: {
    label: "2 AM",
    bg: "rgba(214,255,75,0.18)",
    color: "#d6ff4b",
    border: "rgba(214,255,75,0.45)",
  },
  nocta_4am: {
    label: "4 AM",
    bg: "rgba(77,166,255,0.18)",
    color: "#7ec4ff",
    border: "rgba(77,166,255,0.45)",
  },
  nocta_6am: {
    label: "6 AM",
    bg: "rgba(167,112,255,0.18)",
    color: "#c4a0ff",
    border: "rgba(167,112,255,0.45)",
  },
};

const MAX_MB = Math.round(MAX_IDENTITY_VERIFICATION_FILE_BYTES / (1024 * 1024));
const PAGE_SIZE = 20;

type VenueCity = (typeof ALL_VENUE_CITIES)[number];

const CITIES_BY_COUNTRY = ALL_VENUE_CITIES.reduce(
  (acc, city) => {
    if (!city?.country) return acc;
    const list = acc[city.country] ?? [];
    list.push(city);
    acc[city.country] = list;
    return acc;
  },
  {} as Record<string, VenueCity[]>
);

function guessMime(uri: string, mimeType?: string | null) {
  if (mimeType && mimeType.startsWith("image/")) return mimeType;
  const lower = uri.toLowerCase();
  if (lower.includes(".png")) return "image/png";
  if (lower.includes(".webp")) return "image/webp";
  return "image/jpeg";
}

function toFileUri(uri: string, ext: string) {
  return prepareUploadUri(uri, ext);
}

async function uploadIdentityVerification(opts: {
  document: LocalImage;
  selfie: LocalImage;
}): Promise<{ user: AuthUser }> {
  await initTokenStore();
  const token = getToken();
  if (!token) throw new ApiError("Sesión expirada", 401, "UNAUTHORIZED");

  const docExt = opts.document.mimeType.includes("png")
    ? "png"
    : opts.document.mimeType.includes("webp")
      ? "webp"
      : "jpg";
  const selfieExt = opts.selfie.mimeType.includes("png")
    ? "png"
    : opts.selfie.mimeType.includes("webp")
      ? "webp"
      : "jpg";

  const documentUri = await toFileUri(opts.document.uri, docExt);
  const selfieUri = await toFileUri(opts.selfie.uri, selfieExt);

  const form = new FormData();
  form.append("documentFront", {
    uri: documentUri,
    name: opts.document.fileName || `document.${docExt}`,
    type: opts.document.mimeType,
  } as unknown as Blob);
  form.append("selfieWithDocument", {
    uri: selfieUri,
    name: opts.selfie.fileName || `selfie.${selfieExt}`,
    type: opts.selfie.mimeType,
  } as unknown as Blob);

  return api<{ user: AuthUser }>("/api/me/identity-verification", {
    method: "POST",
    body: form,
  });
}

export function ProfileSettingsSheet({
  visible,
  user,
  onClose,
  onUserUpdated,
  onOpenPremium,
  onDeleteAccount,
  focus,
}: Props) {
  const toast = useToast();
  const insets = useSafeAreaInsets();

  const [autoAccept, setAutoAccept] = useState(user.autoAcceptFollowRequests);
  const [showActivity, setShowActivity] = useState(user.showActivityToFollowers);
  const [rogueMode, setRogueMode] = useState(Boolean(user.rogueMode));
  const [teleportMode, setTeleportMode] = useState(Boolean(user.teleportMode));
  const [discoverDisabled, setDiscoverDisabled] = useState(
    Boolean(user.discoverDisabled)
  );
  const [busyKey, setBusyKey] = useState<SettingKey | null>(null);

  const [documentFront, setDocumentFront] = useState<LocalImage | null>(null);
  const [selfie, setSelfie] = useState<LocalImage | null>(null);
  const [verifyBusy, setVerifyBusy] = useState(false);

  const [teleportCountry, setTeleportCountry] = useState<string>(
    user.teleportCity?.country ?? "Uruguay"
  );
  const [teleportBusy, setTeleportBusy] = useState(false);

  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [blockedOpen, setBlockedOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [reports, setReports] = useState<MyReportListItem[]>([]);
  const [reportsPage, setReportsPage] = useState(1);
  const [reportsPagination, setReportsPagination] =
    useState<PaginationMeta | null>(null);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [blockedPage, setBlockedPage] = useState(1);
  const [blockedPagination, setBlockedPagination] =
    useState<PaginationMeta | null>(null);
  const [blockedLoading, setBlockedLoading] = useState(false);
  const [unblockBusyId, setUnblockBusyId] = useState<string | null>(null);

  const verificationStatus = user.identityVerification?.status ?? "none";
  const countries = useMemo(() => Object.keys(CITIES_BY_COUNTRY), []);
  const countryCities = CITIES_BY_COUNTRY[teleportCountry] ?? [];

  useEffect(() => {
    if (!visible) return;
    setAutoAccept(user.autoAcceptFollowRequests);
    setShowActivity(user.showActivityToFollowers);
    setRogueMode(Boolean(user.rogueMode));
    setTeleportMode(Boolean(user.teleportMode));
    setDiscoverDisabled(Boolean(user.discoverDisabled));
    if (user.teleportCity?.country) {
      setTeleportCountry(user.teleportCity.country);
    }
    setDocumentFront(null);
    setSelfie(null);
    setBlockedOpen(false);
    setReportsOpen(false);
  }, [
    visible,
    user.autoAcceptFollowRequests,
    user.showActivityToFollowers,
    user.rogueMode,
    user.teleportMode,
    user.discoverDisabled,
    user.teleportCity?.country,
  ]);

  const loadBlocked = useCallback(
    async (page: number, append: boolean) => {
      setBlockedLoading(true);
      try {
        const response = await api<{
          users: BlockedUser[];
          pagination: PaginationMeta;
        }>(`/api/me/blocked-users?page=${page}&limit=${PAGE_SIZE}`);
        setBlockedUsers((current) =>
          append ? [...current, ...response.users] : response.users
        );
        setBlockedPagination(response.pagination);
        setBlockedPage(page);
      } catch (err) {
        toast.error(
          err instanceof ApiError
            ? err.message
            : "No se pudieron cargar los usuarios bloqueados"
        );
      } finally {
        setBlockedLoading(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    if (!blockedOpen) return;
    void loadBlocked(1, false);
  }, [blockedOpen, loadBlocked]);

  const loadReports = useCallback(
    async (page: number, append: boolean) => {
      setReportsLoading(true);
      try {
        const response = await api<{
          reports: MyReportListItem[];
          pagination: PaginationMeta;
        }>(`/api/me/reports?page=${page}&limit=${PAGE_SIZE}`);
        setReports((current) =>
          append ? [...current, ...response.reports] : response.reports
        );
        setReportsPagination(response.pagination);
        setReportsPage(page);
      } catch (err) {
        toast.error(
          err instanceof ApiError
            ? err.message
            : "No se pudieron cargar tus denuncias"
        );
      } finally {
        setReportsLoading(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    if (!reportsOpen) return;
    void loadReports(1, false);
  }, [reportsOpen, loadReports]);

  function openReport(reportId: string) {
    setReportsOpen(false);
    onClose();
    navigation.navigate("ReportResolution", { reportId });
  }

  async function patchSetting(key: SettingKey, value: boolean) {
    setBusyKey(key);
    try {
      const response = await api<{ user: AuthUser }>("/api/me/settings", {
        method: "PATCH",
        body: JSON.stringify({ [key]: value }),
      });
      onUserUpdated(response.user);
      toast.success("Configuración guardada");
    } catch (err) {
      if (key === "autoAcceptFollowRequests") setAutoAccept(!value);
      else if (key === "showActivityToFollowers") setShowActivity(!value);
      else if (key === "rogueMode") setRogueMode(!value);
      else if (key === "teleportMode") setTeleportMode(!value);
      else if (key === "discoverDisabled") setDiscoverDisabled(!value);
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo guardar"
      );
    } finally {
      setBusyKey(null);
    }
  }

  async function pickImage(setter: (img: LocalImage | null) => void) {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
      allowsMultipleSelection: false,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (
      asset.fileSize &&
      asset.fileSize > MAX_IDENTITY_VERIFICATION_FILE_BYTES
    ) {
      toast.error(`Máximo ${MAX_MB} MB`);
      return;
    }
    const mime = guessMime(asset.uri, asset.mimeType);
    if (!["image/jpeg", "image/png", "image/webp"].includes(mime)) {
      toast.error("Usá JPG, PNG o WebP");
      return;
    }
    setter({
      uri: asset.uri,
      mimeType: mime,
      fileName: asset.fileName ?? `photo.${mime.split("/")[1] ?? "jpg"}`,
    });
  }

  async function submitVerification() {
    if (!documentFront) {
      toast.error("Elegí la foto del documento");
      return;
    }
    if (!selfie) {
      toast.error("Elegí la selfie con el documento");
      return;
    }
    setVerifyBusy(true);
    try {
      const response = await uploadIdentityVerification({
        document: documentFront,
        selfie,
      });
      onUserUpdated(response.user);
      setDocumentFront(null);
      setSelfie(null);
      toast.success("Solicitud enviada. La revisaremos pronto.");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo enviar"
      );
    } finally {
      setVerifyBusy(false);
    }
  }

  async function saveTeleportCity(city: VenueCity) {
    setTeleportBusy(true);
    try {
      const response = await api<{ user: AuthUser }>(
        "/api/me/teleport-location",
        {
          method: "PUT",
          body: JSON.stringify({ lat: city.lat, lng: city.lng }),
        }
      );
      onUserUpdated(response.user);
      toast.success(
        response.user.teleportCity
          ? `Explorando ${response.user.teleportCity.city}, ${response.user.teleportCity.country}`
          : "Ubicación Teleport guardada"
      );
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "No se pudo guardar la ubicación"
      );
    } finally {
      setTeleportBusy(false);
    }
  }

  async function unblock(userRow: BlockedUser) {
    if (unblockBusyId) return;
    setUnblockBusyId(userRow.id);
    try {
      await api(`/api/me/blocked-users/${userRow.id}`, { method: "DELETE" });
      setBlockedUsers((current) =>
        current.filter((item) => item.id !== userRow.id)
      );
      toast.success(`${userRow.name} fue desbloqueado`);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo desbloquear"
      );
    } finally {
      setUnblockBusyId(null);
    }
  }

  function togglePremiumSetting(
    key: "rogueMode" | "teleportMode",
    next: boolean,
    setLocal: (v: boolean) => void
  ) {
    if (next && !user.premium) {
      onOpenPremium();
      return;
    }
    setLocal(next);
    void patchSetting(key, next);
  }

  const teleportControls = (
    <>
      <SettingsSwitch
        label="Modo Teleport"
        hint="Explorá Espacios de otra ciudad sin usar tu GPS"
        premium
        value={teleportMode}
        disabled={busyKey === "teleportMode"}
        onChange={(next) =>
          togglePremiumSetting("teleportMode", next, setTeleportMode)
        }
      />

      {teleportMode && user.premium ? (
        <View
          style={[
            styles.teleportPanel,
            (busyKey === "teleportMode" || teleportBusy) && {
              opacity: 0.7,
            },
          ]}
        >
          <View style={styles.teleportGroup}>
            <Text style={styles.teleportGroupLabel}>Países</Text>
            <View style={styles.countryRow}>
              {countries.map((country) => {
                const active = teleportCountry === country;
                return (
                  <Pressable
                    key={country}
                    onPress={() => setTeleportCountry(country)}
                    style={[
                      styles.countryChip,
                      active && styles.countryChipActive,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text
                      style={[
                        styles.countryChipText,
                        active && styles.countryChipTextActive,
                      ]}
                    >
                      {country}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View style={styles.teleportGroup}>
            <Text style={styles.teleportGroupLabel}>Ciudades</Text>
            <View style={styles.cityChips}>
              {countryCities.map((city) => {
                if (!city?.country) return null;
                const active =
                  user.teleportCity?.city === city.label &&
                  user.teleportCity?.country === city.country;
                return (
                  <Pressable
                    key={`${city.country}-${city.id}`}
                    disabled={teleportBusy}
                    onPress={() => void saveTeleportCity(city)}
                    style={[
                      styles.cityChip,
                      active && styles.cityChipActive,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text
                      style={[
                        styles.cityChipText,
                        active && styles.cityChipTextActive,
                      ]}
                    >
                      {city.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          {user.teleportCity ? (
            <Text style={styles.teleportActive}>
              Vas a explorar:{" "}
              <Text style={styles.teleportActiveStrong}>
                {user.teleportCity?.city}, {user.teleportCity?.country}
              </Text>
            </Text>
          ) : (
            <Text style={styles.hint}>
              Elegí una ciudad para activar Teleport.
            </Text>
          )}
        </View>
      ) : null}
    </>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View
        style={[
          styles.sheet,
          {
            paddingTop: Math.max(insets.top, spacing.sm),
            paddingBottom: Math.max(insets.bottom, spacing.sm),
          },
        ]}
      >
        <View style={styles.sheetHead}>
          <Text style={styles.sheetTitle}>
            {focus === "teleport" ? "Teleport" : "Configuración"}
          </Text>
          <Pressable
            onPress={onClose}
            accessibilityLabel="Cerrar"
            hitSlop={8}
            style={styles.closeBtn}
          >
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.sheetBody}
          keyboardShouldPersistTaps="handled"
        >
          {focus === "teleport" ? (
            <View style={styles.section}>{teleportControls}</View>
          ) : (
          <>
          <View style={styles.section}>
            <Text style={styles.sectionEyebrow}>Nocta Premium</Text>
            <View style={styles.planGrid}>
              {PREMIUM_PLANS.map((plan) => {
                const pill = PLAN_PILL[plan.id];
                const isCurrent =
                  user.premium && user.premiumPlanId === plan.id;
                const disabled = plan.comingSoon;
                return (
                  <Pressable
                    key={plan.id}
                    disabled={disabled}
                    onPress={() => {
                      if (disabled) return;
                      onOpenPremium(plan.id);
                    }}
                    style={({ pressed }) => [
                      styles.planCard,
                      isCurrent && styles.planCardCurrent,
                      disabled && { opacity: 0.45 },
                      pressed && !disabled && { opacity: 0.9 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={
                      isCurrent
                        ? `${plan.name}, tu plan actual`
                        : `Ver catálogo de ${plan.name}`
                    }
                  >
                    <NoctaWordmark size={15} />
                    <View
                      style={[
                        styles.planPill,
                        {
                          backgroundColor: pill.bg,
                          borderColor: pill.border,
                        },
                      ]}
                    >
                      <Text style={[styles.planPillText, { color: pill.color }]}>
                        {pill.label}
                      </Text>
                    </View>
                    <Text style={styles.planTagline} numberOfLines={2}>
                      {plan.tagline}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionEyebrow}>Verificación</Text>
            <Text style={styles.sectionCopy}>
              Subí la parte frontal de tu DNI o la página de datos de tu
              pasaporte, y una selfie sosteniendo el mismo documento. Un
              administrador de Nocta revisará tu solicitud.
            </Text>

            {verificationStatus === "approved" || user.identityVerified ? (
              <View style={styles.verifiedRow}>
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={colors.primary}
                />
                <Text style={styles.verifiedText}>Cuenta verificada</Text>
              </View>
            ) : verificationStatus === "pending" ? (
              <Text style={styles.sectionCopy}>
                Solicitud en revisión. Te avisamos cuando haya una respuesta.
              </Text>
            ) : (
              <View style={styles.verifyForm}>
                {verificationStatus === "rejected" &&
                user.identityVerification?.rejectionReason ? (
                  <Text style={styles.rejectText}>
                    No aprobada: {user.identityVerification.rejectionReason}
                  </Text>
                ) : null}

                <View style={styles.verifyUploads}>
                  <VerifySlot
                    label="Frente del DNI / pasaporte"
                    emptyLabel="Documento"
                    emptyIcon="card-outline"
                    image={documentFront}
                    disabled={verifyBusy}
                    onPick={() => void pickImage(setDocumentFront)}
                    onClear={() => setDocumentFront(null)}
                  />
                  <VerifySlot
                    label="Selfie con el documento"
                    emptyLabel="Selfie"
                    emptyIcon="camera-outline"
                    image={selfie}
                    disabled={verifyBusy}
                    onPick={() => void pickImage(setSelfie)}
                    onClear={() => setSelfie(null)}
                  />
                </View>
                <Text style={styles.hint}>
                  Máximo {MAX_MB} MB por archivo · JPG, PNG o WebP
                </Text>
                <Pressable
                  disabled={verifyBusy}
                  onPress={() => void submitVerification()}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    (verifyBusy || pressed) && {
                      opacity: verifyBusy ? 0.55 : 0.9,
                    },
                  ]}
                >
                  <Text style={styles.primaryBtnText}>
                    {verifyBusy ? "Enviando…" : "Enviar para verificar"}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionEyebrow}>Privacidad y seguridad</Text>

            <SettingsSwitch
              label="Aceptar automáticamente las solicitudes de seguimiento"
              value={autoAccept}
              disabled={busyKey === "autoAcceptFollowRequests"}
              onChange={(next) => {
                setAutoAccept(next);
                void patchSetting("autoAcceptFollowRequests", next);
              }}
            />
            <SettingsSwitch
              label="Que quienes me siguen vean mi actividad"
              value={showActivity}
              disabled={busyKey === "showActivityToFollowers"}
              onChange={(next) => {
                setShowActivity(next);
                void patchSetting("showActivityToFollowers", next);
              }}
            />
            <SettingsSwitch
              label="Modo pícaro"
              hint="Solo te ven en Discover las personas a las que les diste like"
              premium
              value={rogueMode}
              disabled={busyKey === "rogueMode"}
              onChange={(next) =>
                togglePremiumSetting("rogueMode", next, setRogueMode)
              }
            />
            {teleportControls}

            <Pressable
              onPress={() => setBlockedOpen(true)}
              style={({ pressed }) => [
                styles.linkRow,
                pressed && { opacity: 0.9 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Usuarios bloqueados"
            >
              <Ionicons
                name="ban-outline"
                size={20}
                color={colors.primary}
              />
              <View style={styles.linkCopy}>
                <Text style={styles.linkTitle}>Usuarios bloqueados</Text>
                <Text style={styles.linkHint}>
                  Consultá y administrá tus bloqueos
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={colors.textMuted}
              />
            </Pressable>

            <Pressable
              onPress={() => setReportsOpen(true)}
              style={({ pressed }) => [
                styles.linkRow,
                pressed && { opacity: 0.9 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Mis denuncias"
            >
              <Ionicons
                name="flag-outline"
                size={20}
                color={colors.primary}
              />
              <View style={styles.linkCopy}>
                <Text style={styles.linkTitle}>Mis denuncias</Text>
                <Text style={styles.linkHint}>
                  El estado de las denuncias que enviaste
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={colors.textMuted}
              />
            </Pressable>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionEyebrow}>Discover</Text>
            <SettingsSwitch
              label="Desactivar Discover"
              hint="No podrás publicarte en ningún Espacio"
              value={discoverDisabled}
              disabled={busyKey === "discoverDisabled"}
              onChange={(next) => {
                setDiscoverDisabled(next);
                void patchSetting("discoverDisabled", next);
              }}
            />
          </View>

          <Pressable
            onPress={onDeleteAccount}
            style={({ pressed }) => [
              styles.deleteAccountBtn,
              pressed && { opacity: 0.9 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Eliminar cuenta"
          >
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
            <Text style={styles.deleteAccountText}>Eliminar cuenta</Text>
          </Pressable>
          </>
          )}
        </ScrollView>
      </View>

      <Modal
        visible={blockedOpen}
        animationType="slide"
        onRequestClose={() => setBlockedOpen(false)}
      >
        <View
          style={[
            styles.sheet,
            {
              paddingTop: Math.max(insets.top, spacing.sm),
              paddingBottom: Math.max(insets.bottom, spacing.sm),
            },
          ]}
        >
          <View style={styles.sheetHead}>
            <Pressable
              onPress={() => setBlockedOpen(false)}
              hitSlop={8}
              style={styles.backBtn}
              accessibilityLabel="Volver"
            >
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.blockedEyebrow}>Privacidad y seguridad</Text>
              <Text style={styles.sheetTitle}>Usuarios bloqueados</Text>
            </View>
          </View>
          <ScrollView contentContainerStyle={styles.sheetBody}>
            {blockedLoading && blockedPage === 1 ? (
              <ActivityIndicator color={colors.primary} />
            ) : blockedUsers.length === 0 ? (
              <View style={styles.blockedEmpty}>
                <Ionicons
                  name="person-outline"
                  size={28}
                  color={colors.textFaint}
                />
                <Text style={styles.linkTitle}>No bloqueaste a nadie</Text>
                <Text style={styles.hint}>
                  Los perfiles que bloquees aparecerán en esta lista.
                </Text>
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                {blockedUsers.map((row) => (
                  <View key={row.id} style={styles.blockedRow}>
                    {row.photo ? (
                      <NoctaImage
                        src={row.photo}
                        variant="thumb"
                        style={styles.blockedAvatar}
                        contentFit="cover"
                      />
                    ) : (
                      <View
                        style={[styles.blockedAvatar, styles.blockedAvatarEmpty]}
                      >
                        <Ionicons
                          name="person"
                          size={18}
                          color={colors.textFaint}
                        />
                      </View>
                    )}
                    <Text style={styles.blockedName} numberOfLines={1}>
                      {row.name}
                    </Text>
                    <Pressable
                      disabled={unblockBusyId === row.id}
                      onPress={() => void unblock(row)}
                      style={[
                        styles.unblockBtn,
                        unblockBusyId === row.id && { opacity: 0.5 },
                      ]}
                    >
                      <Text style={styles.unblockText}>Desbloquear</Text>
                    </Pressable>
                  </View>
                ))}
                {blockedPagination?.hasMore ? (
                  <Pressable
                    disabled={blockedLoading}
                    onPress={() => void loadBlocked(blockedPage + 1, true)}
                    style={styles.moreBtn}
                  >
                    <Text style={styles.moreBtnText}>
                      {blockedLoading ? "Cargando…" : "Ver más"}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={reportsOpen}
        animationType="slide"
        onRequestClose={() => setReportsOpen(false)}
      >
        <View
          style={[
            styles.sheet,
            {
              paddingTop: Math.max(insets.top, spacing.sm),
              paddingBottom: Math.max(insets.bottom, spacing.sm),
            },
          ]}
        >
          <View style={styles.sheetHead}>
            <Pressable
              onPress={() => setReportsOpen(false)}
              hitSlop={8}
              style={styles.backBtn}
              accessibilityLabel="Volver"
            >
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.blockedEyebrow}>Privacidad y seguridad</Text>
              <Text style={styles.sheetTitle}>Mis denuncias</Text>
            </View>
          </View>
          <ScrollView contentContainerStyle={styles.sheetBody}>
            {reportsLoading && reportsPage === 1 ? (
              <ActivityIndicator color={colors.primary} />
            ) : reports.length === 0 ? (
              <View style={styles.blockedEmpty}>
                <Ionicons
                  name="flag-outline"
                  size={28}
                  color={colors.textFaint}
                />
                <Text style={styles.linkTitle}>Todavía no denunciaste</Text>
                <Text style={styles.hint}>
                  Cuando denuncies un perfil o una conversación, va a aparecer
                  acá.
                </Text>
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                {reports.map((row) => {
                  const tone = reportTone(row);
                  return (
                    <Pressable
                      key={row.id}
                      onPress={() => openReport(row.id)}
                      style={({ pressed }) => [
                        styles.reportRow,
                        pressed && { opacity: 0.9 },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Denuncia a ${row.reportedName}, ${tone.label}`}
                    >
                      <View style={styles.linkCopy}>
                        <Text style={styles.blockedName} numberOfLines={1}>
                          {row.reportedName}
                        </Text>
                        <Text style={styles.linkHint} numberOfLines={1}>
                          {REPORT_REASON_LABELS[row.reason]} ·{" "}
                          {reportWhen(row.createdAt)}
                        </Text>
                      </View>
                      <Text style={[styles.reportStatus, tone.style]}>
                        {tone.label}
                      </Text>
                    </Pressable>
                  );
                })}
                {reportsPagination?.hasMore ? (
                  <Pressable
                    disabled={reportsLoading}
                    onPress={() => void loadReports(reportsPage + 1, true)}
                    style={styles.moreBtn}
                  >
                    <Text style={styles.moreBtnText}>
                      {reportsLoading ? "Cargando…" : "Ver más"}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    </Modal>
  );
}

function reportWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-UY");
}

function reportTone(row: MyReportListItem): {
  label: string;
  style: { color: string };
} {
  if (row.resolutionAction === "suspend") {
    return { label: "Con medidas", style: { color: colors.primary } };
  }
  if (row.resolutionAction === "dismiss" || row.status === "dismissed") {
    return { label: "Descartada", style: { color: colors.warning } };
  }
  return { label: "En revisión", style: { color: colors.textMuted } };
}

function SettingsSwitch({
  label,
  hint,
  premium,
  value,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  premium?: boolean;
  value: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <View style={styles.switchRow}>
      <Switch
        value={value}
        disabled={disabled}
        onValueChange={onChange}
        trackColor={{ false: colors.elevated, true: colors.primaryDim }}
        thumbColor={value ? colors.primary : colors.textMuted}
      />
      <View style={styles.switchCopy}>
        <View style={styles.switchTitleRow}>
          <Text style={styles.switchLabel}>{label}</Text>
          {premium ? (
            <Ionicons name="diamond" size={14} color="#40e0d0" />
          ) : null}
        </View>
        {hint ? <Text style={styles.switchHint}>{hint}</Text> : null}
      </View>
    </View>
  );
}

function VerifySlot({
  label,
  emptyLabel,
  emptyIcon,
  image,
  disabled,
  onPick,
  onClear,
}: {
  label: string;
  emptyLabel: string;
  emptyIcon: keyof typeof Ionicons.glyphMap;
  image: LocalImage | null;
  disabled?: boolean;
  onPick: () => void;
  onClear: () => void;
}) {
  return (
    <View style={styles.verifySlot}>
      {image ? (
        <View style={styles.verifyThumb}>
          <Image source={{ uri: image.uri }} style={styles.verifyThumbImg} />
          <Pressable
            disabled={disabled}
            onPress={onClear}
            style={styles.verifyRemove}
            accessibilityLabel={`Quitar ${emptyLabel.toLowerCase()}`}
          >
            <Ionicons name="close" size={16} color="#fff" />
          </Pressable>
        </View>
      ) : (
        <Pressable
          disabled={disabled}
          onPress={onPick}
          style={({ pressed }) => [
            styles.verifyAdd,
            pressed && { opacity: 0.9 },
            disabled && { opacity: 0.5 },
          ]}
        >
          <Ionicons name={emptyIcon} size={22} color={colors.primary} />
          <Text style={styles.verifyAddText}>{emptyLabel}</Text>
        </Pressable>
      )}
      <Text style={styles.verifySlotLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  sheetHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  sheetTitle: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 22,
    letterSpacing: -0.03 * 22,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.elevated,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.elevated,
  },
  sheetBody: {
    padding: spacing.md,
    gap: spacing.lg,
    paddingBottom: spacing.xl,
  },
  section: {
    gap: 10,
  },
  sectionEyebrow: {
    color: colors.textMuted,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  sectionCopy: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
  },
  planGrid: {
    flexDirection: "row",
    gap: 8,
  },
  planCard: {
    flex: 1,
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
  },
  planCardCurrent: {
    borderColor: "rgba(214,255,75,0.55)",
    backgroundColor: "rgba(214,255,75,0.08)",
  },
  planPill: {
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  planPillText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
  },
  planTagline: {
    color: "rgba(255,255,255,0.55)",
    fontFamily: fonts.body,
    fontSize: 11,
    textAlign: "center",
    lineHeight: 14,
  },
  verifiedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  verifiedText: {
    color: colors.text,
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
  },
  verifyForm: {
    gap: 10,
  },
  rejectText: {
    color: colors.danger,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  verifyUploads: {
    flexDirection: "row",
    gap: 10,
  },
  verifySlot: {
    flex: 1,
    gap: 6,
  },
  verifySlotLabel: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 14,
  },
  verifyThumb: {
    aspectRatio: 2,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
  },
  verifyThumbImg: {
    width: "100%",
    height: "100%",
  },
  verifyRemove: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
  },
  verifyAdd: {
    aspectRatio: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(214,255,75,0.45)",
    backgroundColor: "rgba(214,255,75,0.06)",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  verifyAddText: {
    color: colors.text,
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
  },
  hint: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
  },
  primaryBtn: {
    minHeight: 46,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  primaryBtnText: {
    color: colors.onPrimary,
    fontFamily: fonts.bodyBold,
    fontSize: 15,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  switchCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  switchTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  switchLabel: {
    color: colors.text,
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
  },
  switchHint: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 16,
  },
  teleportPanel: {
    gap: 10,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
  },
  teleportGroup: {
    gap: 8,
  },
  teleportGroupLabel: {
    color: colors.textFaint,
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  countryRow: {
    flexDirection: "row",
    gap: 8,
  },
  countryChip: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.elevated,
  },
  countryChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  countryChipText: {
    color: colors.text,
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
  },
  countryChipTextActive: {
    color: colors.onPrimary,
    fontFamily: fonts.bodyBold,
  },
  cityChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  cityChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.elevated,
  },
  cityChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryDim,
  },
  cityChipText: {
    color: colors.textMuted,
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
  },
  cityChipTextActive: {
    color: colors.primary,
    fontFamily: fonts.bodyBold,
  },
  teleportActive: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  teleportActiveStrong: {
    color: colors.text,
    fontFamily: fonts.bodySemiBold,
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
  },
  linkCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  linkTitle: {
    color: colors.text,
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
  },
  linkHint: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  deleteAccountBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(255,107,107,0.45)",
    backgroundColor: "rgba(255,107,107,0.08)",
  },
  deleteAccountText: {
    color: colors.danger,
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
  },
  blockedEyebrow: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    marginBottom: 2,
  },
  blockedEmpty: {
    alignItems: "center",
    gap: 8,
    paddingVertical: spacing.xl,
  },
  blockedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  blockedAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.elevated,
  },
  blockedAvatarEmpty: {
    alignItems: "center",
    justifyContent: "center",
  },
  blockedName: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
  },
  reportRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  reportStatus: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
  },
  unblockBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(242,240,235,0.35)",
  },
  unblockText: {
    color: colors.text,
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
  },
  moreBtn: {
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  moreBtnText: {
    color: colors.text,
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
  },
});

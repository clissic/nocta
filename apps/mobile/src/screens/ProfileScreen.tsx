import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  DRINKING_LABELS,
  EDUCATION_LEVEL_LABELS,
  FITNESS_LABELS,
  GENDER_LABELS,
  INTEREST_CATEGORIES,
  INTEREST_LABELS,
  LANGUAGE_LABELS,
  LOOKING_FOR_LABELS,
  MAX_PHOTOS,
  PETS_LABELS,
  SEXUAL_ORIENTATION_LABELS,
  SOCIAL_NETWORKS,
  SOCIAL_NETWORK_LABELS,
  VENUE_PHOTO_FALLBACK,
  VENUE_TYPE_LABELS,
  WORK_STATUS_LABELS,
  ZODIAC_INSIGHTS,
  ZODIAC_LABELS,
  venueCoverSrc,
  type AuthUser,
  type Drinking,
  type EducationLevel,
  type Fitness,
  type FollowRequestItem,
  type Gender,
  type Interest,
  type Language,
  type LookingFor,
  type Pets,
  type PremiumPlanId,
  type Presence,
  type PromoPurchase,
  type SexualOrientation,
  type SocialNetwork,
  type UserProfile,
  type Venue,
  type WorkStatus,
  type ZodiacSign,
} from "@nocta/shared";
import { useAuth } from "../auth/AuthContext";
import { LiveDot } from "../components/LiveDot";
import { ProfileMyReviews } from "../components/profile/ProfileMyReviews";
import { NoctaImage } from "../components/NoctaImage";
import { FollowRequestsSheet } from "../components/profile/FollowRequestsSheet";
import {
  ProfileConnectionsSheet,
  type ProfileConnectionsMode,
} from "../components/profile/ProfileConnectionsSheet";
import { ProfileSettingsSheet } from "../components/profile/ProfileSettingsSheet";
import { LogoutConfirm } from "../components/shell/LogoutConfirm";
import { useToast } from "../components/ToastProvider";
import { Muted, Screen } from "../components/ui";
import { ApiError, api } from "../lib/api";
import { colors, fonts, radii, spacing } from "../theme/tokens";
import type { MainTabParamList, RootStackParamList } from "../navigation/types";

const LOOKING_FOR_ICONS: Record<LookingFor, keyof typeof Ionicons.glyphMap> = {
  citas: "cafe-outline",
  relacion: "heart-outline",
  encuentros_casuales: "flash-outline",
  amigos: "people-outline",
  networking: "briefcase-outline",
};

const SOCIAL_ICONS: Record<SocialNetwork, keyof typeof Ionicons.glyphMap> = {
  instagram: "logo-instagram",
  tiktok: "logo-tiktok",
  x: "logo-twitter",
  facebook: "logo-facebook",
  linkedin: "logo-linkedin",
};

function calcAge(birthDate?: string) {
  if (!birthDate) return null;
  const born = new Date(birthDate);
  if (Number.isNaN(born.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  const m = now.getMonth() - born.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < born.getDate())) age -= 1;
  return age;
}

function formatLivesIn(profile: UserProfile) {
  const country = profile.livesIn?.country?.trim();
  const city = profile.livesIn?.city?.trim();
  if (!country || !city) return undefined;
  return `${country}, ${city}`;
}

function socialUrl(network: SocialNetwork, handle: string) {
  const clean = handle.replace(/^@/, "").trim();
  if (!clean) return null;
  switch (network) {
    case "instagram":
      return `https://instagram.com/${clean}`;
    case "tiktok":
      return `https://www.tiktok.com/@${clean}`;
    case "x":
      return `https://x.com/${clean}`;
    case "facebook":
      return `https://facebook.com/${clean}`;
    case "linkedin":
      return `https://www.linkedin.com/in/${clean}`;
    default:
      return null;
  }
}

export function ProfileScreen() {
  const { user, setUser, logout, refresh } = useAuth();
  const toast = useToast();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const tabNavigation =
    useNavigation<BottomTabNavigationProp<MainTabParamList, "Profile">>();
  const route = useRoute<RouteProp<MainTabParamList, "Profile">>();
  const profile = user?.profile;

  const [presences, setPresences] = useState<Presence[]>([]);
  const [ownedVenues, setOwnedVenues] = useState<Venue[]>([]);
  const [promoPurchases, setPromoPurchases] = useState<PromoPurchase[]>([]);
  const [followRequests, setFollowRequests] = useState<FollowRequestItem[]>([]);
  const [requestBusyId, setRequestBusyId] = useState<string | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [connectionsMode, setConnectionsMode] =
    useState<ProfileConnectionsMode | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [followRequestsOpen, setFollowRequestsOpen] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);

  useEffect(() => {
    const focus = route.params?.focus;
    if (!focus) return;
    if (focus === "settings") {
      void refresh();
      setSettingsOpen(true);
    } else if (focus === "requests") {
      setFollowRequestsOpen(true);
    }
    tabNavigation.setParams({ focus: undefined });
  }, [refresh, route.params?.focus, tabNavigation]);

  useEffect(() => {
    void api<{
      presence: Presence | null;
      presences?: Presence[];
    }>("/api/presence/me")
      .then((r) =>
        setPresences(r.presences ?? (r.presence ? [r.presence] : []))
      )
      .catch(() => setPresences([]));
    void api<{ venues: Venue[] }>("/api/me/venues/owned")
      .then((r) => setOwnedVenues(r.venues ?? []))
      .catch(() => setOwnedVenues([]));
    void api<{ purchases: PromoPurchase[] }>("/api/me/promo-purchases")
      .then((r) => setPromoPurchases(r.purchases ?? []))
      .catch(() => setPromoPurchases([]));
    void api<{ requests: FollowRequestItem[] }>("/api/me/follow-requests")
      .then((r) => setFollowRequests(r.requests ?? []))
      .catch(() => setFollowRequests([]));
  }, []);

  const age = useMemo(
    () => (profile?.birthDate ? calcAge(profile.birthDate) : null),
    [profile?.birthDate]
  );

  const lookingFor = useMemo(
    () =>
      (profile?.lookingFor ?? []).filter(
        (value): value is LookingFor => value in LOOKING_FOR_LABELS
      ),
    [profile?.lookingFor]
  );

  const interestGroups = useMemo(() => {
    const selected = new Set(profile?.interests ?? []);
    return INTEREST_CATEGORIES.map((category) => ({
      id: category.id,
      label: category.label,
      interests: category.interests.filter((interest) => selected.has(interest)),
    })).filter((category) => category.interests.length > 0);
  }, [profile?.interests]);

  const languages = useMemo(
    () =>
      (profile?.languages ?? []).filter(
        (value): value is Language => value in LANGUAGE_LABELS
      ),
    [profile?.languages]
  );

  async function respondFollowRequest(
    requestId: string,
    action: "accept" | "reject"
  ) {
    setRequestBusyId(requestId);
    try {
      await api(`/api/me/follow-requests/${requestId}/${action}`, {
        method: "POST",
      });
      setFollowRequests((prev) => prev.filter((r) => r.id !== requestId));
      if (action === "accept" && user) {
        setUser({
          ...user,
          followersCount: (user.followersCount ?? 0) + 1,
        });
      }
      toast.success(
        action === "accept" ? "Solicitud aceptada" : "Solicitud rechazada"
      );
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo responder"
      );
    } finally {
      setRequestBusyId(null);
    }
  }

  function handleConnectionRemoved(mode: ProfileConnectionsMode) {
    if (!user) return;
    setUser({
      ...user,
      followersCount:
        mode === "followers"
          ? Math.max(0, (user.followersCount ?? 0) - 1)
          : user.followersCount,
      followingUsersCount:
        mode === "following"
          ? Math.max(0, (user.followingUsersCount ?? 0) - 1)
          : user.followingUsersCount,
      followingVenuesCount:
        mode === "venues"
          ? Math.max(0, (user.followingVenuesCount ?? 0) - 1)
          : user.followingVenuesCount,
    });
  }

  if (!profile || !user) {
    return (
      <Screen safeTop={false} style={{ paddingTop: spacing.md }}>
        <Muted>Sin perfil.</Muted>
      </Screen>
    );
  }

  const photos = (profile.photos ?? []).filter(Boolean);
  const photoSlots = Array.from(
    { length: MAX_PHOTOS },
    (_, index) => photos[index] ?? null
  );
  const hero = photoSlots[0];
  const gallerySlots = photoSlots.slice(1);
  const galleryFilled = gallerySlots.filter(Boolean).length;
  /** Filas de 3 → grilla 3×3 fija (parity web `.profile-gallery`). */
  const galleryRows: (string | null)[][] = [];
  for (let i = 0; i < gallerySlots.length; i += 3) {
    galleryRows.push(gallerySlots.slice(i, i + 3));
  }
  const meta = [age, profile.heightCm ? `${profile.heightCm} cm` : null]
    .filter(Boolean)
    .join(" · ");
  const validPromoCount = promoPurchases.filter((p) => p.status === "valid")
    .length;
  const locationLabel = formatLivesIn(profile);
  const hasWork =
    profile.workStatus ||
    profile.jobTitle ||
    profile.company ||
    profile.studiedAt;

  return (
    <Screen padded={false} safeTop={false}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          {hero ? (
            <NoctaImage src={hero} style={styles.heroImg} contentFit="cover" />
          ) : (
            <Pressable
              style={[styles.heroImg, styles.heroEmpty]}
              onPress={() =>
                navigation.navigate("Onboarding", { edit: true, step: 5 })
              }
              accessibilityRole="button"
              accessibilityLabel="Agregar foto de perfil"
            >
              <Ionicons name="person-outline" size={28} color={colors.textFaint} />
              <Text style={styles.heroEmptyText}>Foto de perfil</Text>
            </Pressable>
          )}
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.88)"]}
            style={styles.heroFade}
            pointerEvents="none"
          />
          <View style={styles.heroCaption}>
            <View style={styles.nameRow}>
              <View style={styles.nameBlock}>
                <View style={styles.nameLine}>
                  <Text style={styles.name} numberOfLines={2}>
                    {profile.name}
                  </Text>
                  {user.identityVerified ? (
                    <Ionicons
                      name="checkmark-circle"
                      size={18}
                      color={colors.primary}
                    />
                  ) : null}
                </View>
                {meta ? <Text style={styles.meta}>{meta}</Text> : null}
              </View>
              <View style={styles.actions}>
                <ActionBtn
                  icon="settings-outline"
                  label="Configuración"
                  onPress={() => setSettingsOpen(true)}
                />
                <ActionBtn
                  icon="person-add-outline"
                  label="Solicitudes de seguimiento"
                  onPress={() => setFollowRequestsOpen(true)}
                  badge={followRequests.length}
                />
                <ActionBtn
                  icon="pencil-outline"
                  label="Editar perfil"
                  onPress={() =>
                    navigation.navigate("Onboarding", { edit: true })
                  }
                />
                <ActionBtn
                  icon="log-out-outline"
                  label="Cerrar sesión"
                  danger
                  onPress={() => setLogoutOpen(true)}
                />
              </View>
            </View>
          </View>
        </View>

        <View style={styles.galleryAccordion}>
          <Pressable
            onPress={() => setGalleryOpen((open) => !open)}
            style={[
              styles.galleryToggle,
              galleryOpen && styles.galleryToggleOpen,
            ]}
            accessibilityRole="button"
            accessibilityState={{ expanded: galleryOpen }}
          >
            <View style={styles.galleryToggleCopy}>
              <Ionicons name="images-outline" size={18} color={colors.primary} />
              <Text style={styles.galleryToggleLabel}>Más fotos</Text>
              <Text style={styles.galleryToggleCount}>
                {galleryFilled}/{gallerySlots.length}
              </Text>
            </View>
            <Ionicons
              name={galleryOpen ? "chevron-up" : "chevron-down"}
              size={18}
              color={colors.textMuted}
            />
          </Pressable>
          {galleryOpen ? (
            <View style={styles.galleryPanel}>
              <View style={styles.galleryGrid}>
                {galleryRows.map((row, rowIndex) => (
                  <View key={`gallery-row-${rowIndex}`} style={styles.galleryRow}>
                    {row.map((src, colIndex) => {
                      const photoNumber = rowIndex * 3 + colIndex + 2;
                      if (src) {
                        return (
                          <NoctaImage
                            key={src}
                            src={src}
                            variant="thumb"
                            style={styles.galleryThumb}
                            contentFit="cover"
                          />
                        );
                      }
                      return (
                        <Pressable
                          key={`placeholder-${photoNumber}`}
                          style={[styles.galleryThumb, styles.galleryPlaceholder]}
                          onPress={() =>
                            navigation.navigate("Onboarding", {
                              edit: true,
                              step: 5,
                            })
                          }
                          accessibilityRole="button"
                          accessibilityLabel={`Agregar foto ${photoNumber}`}
                        >
                          <Ionicons
                            name="image-outline"
                            size={20}
                            color={colors.textFaint}
                          />
                          <Text style={styles.galleryPlaceholderText}>
                            Foto {photoNumber}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
              </View>
              <Text style={styles.galleryNote}>
                Podés subir hasta 10 imágenes; cada una mostrará información
                diferente relativa a tu perfil.
              </Text>
            </View>
          ) : null}
        </View>

        <ProfileMyReviews
          onOpenVenue={(venueId) =>
            navigation.navigate("VenueDetail", { venueId })
          }
        />

        <View style={styles.info}>
          <View style={styles.status}>
            {presences.length > 0 ? (
              <View style={styles.statusRow}>
                <LiveDot />
                <Text style={styles.statusText}>
                  Visible en{" "}
                  {presences.map((row, index) => (
                    <Text key={row.id}>
                      {index > 0
                        ? index === presences.length - 1
                          ? " y "
                          : ", "
                        : null}
                      <Text style={styles.statusStrong}>
                        {row.venue?.name ?? "Espacio"}
                      </Text>
                    </Text>
                  ))}
                </Text>
              </View>
            ) : (
              <Text style={styles.statusMuted}>
                Perfil oculto — no publicado
              </Text>
            )}
          </View>

          <View style={styles.counts}>
            <CountBtn
              value={user.followersCount ?? 0}
              label={
                (user.followersCount ?? 0) === 1 ? "seguidor" : "seguidores"
              }
              onPress={() => setConnectionsMode("followers")}
            />
            <CountBtn
              value={user.followingUsersCount ?? 0}
              label="seguidos"
              onPress={() => setConnectionsMode("following")}
            />
            <CountBtn
              value={user.followingVenuesCount ?? 0}
              label={
                (user.followingVenuesCount ?? 0) === 1 ? "espacio" : "espacios"
              }
              onPress={() => setConnectionsMode("venues")}
            />
          </View>

          <SocialRow profile={profile} />

          <Section title="Busca">
            {lookingFor.length ? (
              <View style={styles.lookingGrid}>
                {lookingFor.map((value) => (
                  <View key={value} style={styles.lookingItem}>
                    <Ionicons
                      name={LOOKING_FOR_ICONS[value]}
                      size={18}
                      color={colors.primary}
                    />
                    <Text style={styles.lookingText}>
                      {LOOKING_FOR_LABELS[value]}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.valueMuted}>—</Text>
            )}
          </Section>

          {profile.gender || profile.interestedIn?.length ? (
            <Section title="Identidad">
              <Text style={styles.value}>
                {profile.gender
                  ? GENDER_LABELS[profile.gender as Gender] ?? profile.gender
                  : "—"}
                {profile.interestedIn?.length
                  ? ` · Interesa: ${profile.interestedIn
                      .map((g) => GENDER_LABELS[g as Gender] ?? g)
                      .join(", ")}`
                  : ""}
              </Text>
            </Section>
          ) : null}

          {profile.bio ? (
            <Section title="Sobre mí">
              <Text style={styles.bio}>{profile.bio}</Text>
            </Section>
          ) : null}

          {locationLabel ? (
            <Section title="Vive en">
              <Text style={styles.value}>{locationLabel}</Text>
            </Section>
          ) : null}

          {profile.sexualOrientation ? (
            <Section title="Orientación sexual">
              <Text style={styles.value}>
                {SEXUAL_ORIENTATION_LABELS[
                  profile.sexualOrientation as SexualOrientation
                ] ?? profile.sexualOrientation}
              </Text>
            </Section>
          ) : null}

          {profile.zodiac ? (
            <Section title="Zodíaco">
              <Text style={styles.value}>
                {ZODIAC_LABELS[profile.zodiac as ZodiacSign]}
              </Text>
              <Text style={styles.valueMuted}>
                {ZODIAC_INSIGHTS[profile.zodiac as ZodiacSign].traits}
              </Text>
              <Text style={styles.valueMuted}>
                Especialmente compatible con{" "}
                {ZODIAC_INSIGHTS[profile.zodiac as ZodiacSign].compatibleWith
                  .map((sign) => ZODIAC_LABELS[sign])
                  .join(" y ")}
              </Text>
            </Section>
          ) : null}

          {profile.educationLevel ? (
            <Section title="Nivel educativo">
              <Text style={styles.value}>
                {EDUCATION_LEVEL_LABELS[
                  profile.educationLevel as EducationLevel
                ] ?? profile.educationLevel}
              </Text>
            </Section>
          ) : null}

          {profile.pets ? (
            <Section title="Mascotas">
              <Text style={styles.value}>
                {PETS_LABELS[profile.pets as Pets] ?? profile.pets}
              </Text>
            </Section>
          ) : null}

          {profile.drinking ? (
            <Section title="Bebidas">
              <Text style={styles.value}>
                {DRINKING_LABELS[profile.drinking as Drinking] ??
                  profile.drinking}
              </Text>
            </Section>
          ) : null}

          {profile.fitness ? (
            <Section title="Fitness">
              <Text style={styles.value}>
                {FITNESS_LABELS[profile.fitness as Fitness] ?? profile.fitness}
              </Text>
            </Section>
          ) : null}

          {hasWork ? (
            <Section title="Trabajo">
              {profile.workStatus ? (
                <Text style={styles.value}>
                  {WORK_STATUS_LABELS[profile.workStatus as WorkStatus] ??
                    profile.workStatus}
                </Text>
              ) : null}
              {profile.jobTitle ? (
                <Text style={styles.value}>
                  <Text style={styles.valueLabel}>Puesto: </Text>
                  {profile.jobTitle}
                </Text>
              ) : null}
              {profile.company ? (
                <Text style={styles.value}>
                  <Text style={styles.valueLabel}>Compañía: </Text>
                  {profile.company}
                </Text>
              ) : null}
              {profile.studiedAt ? (
                <Text style={styles.value}>
                  <Text style={styles.valueLabel}>Estudió en: </Text>
                  {profile.studiedAt}
                </Text>
              ) : null}
            </Section>
          ) : null}

          {interestGroups.length > 0 ? (
            <Section title="Gustos">
              {interestGroups.map((category) => (
                <View key={category.id} style={styles.interestCat}>
                  <Text style={styles.interestCatTitle}>{category.label}</Text>
                  <View style={styles.chips}>
                    {category.interests.map((interest) => (
                      <View key={interest} style={styles.chip}>
                        <Text style={styles.chipText}>
                          {INTEREST_LABELS[interest as Interest] ?? interest}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </Section>
          ) : null}

          {languages.length > 0 ? (
            <Section title="Idiomas">
              <View style={styles.chips}>
                {languages.map((language) => (
                  <View key={language} style={styles.chip}>
                    <Text style={styles.chipText}>
                      {LANGUAGE_LABELS[language]}
                    </Text>
                  </View>
                ))}
              </View>
            </Section>
          ) : null}

          <Section title="Mis promos">
            <Pressable
              style={styles.promosEntry}
              onPress={() => navigation.navigate("MyPromos")}
            >
              <View style={styles.promosIcon}>
                <Ionicons name="qr-code-outline" size={20} color={colors.primary} />
              </View>
              <View style={styles.promosCopy}>
                <Text style={styles.promosTitle}>Ver códigos QR</Text>
                <Text style={styles.promosSub}>
                  {promoPurchases.length === 0
                    ? "Todavía no compraste ninguna"
                    : validPromoCount === 1
                      ? "1 promo vigente"
                      : validPromoCount > 1
                        ? `${validPromoCount} promos vigentes`
                        : `${promoPurchases.length} ${
                            promoPurchases.length === 1 ? "promo" : "promos"
                          } en tu historial`}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={colors.textMuted}
              />
            </Pressable>
          </Section>

          {ownedVenues.length > 0 ? (
            <Section title="Mis espacios">
              <View style={styles.ownedList}>
                {ownedVenues.map((v) => (
                  <Pressable
                    key={v.id}
                    style={styles.ownedCard}
                    onPress={() =>
                      navigation.navigate("VenueManage", { venueId: v.id })
                    }
                  >
                    <NoctaImage
                      src={venueCoverSrc(v)}
                      fallbackSrc={VENUE_PHOTO_FALLBACK}
                      variant="thumb"
                      style={styles.ownedThumb}
                      contentFit="cover"
                    />
                    <View style={styles.ownedCopy}>
                      <Text style={styles.ownedName} numberOfLines={1}>
                        {v.name}
                      </Text>
                      <Text style={styles.ownedType}>
                        {VENUE_TYPE_LABELS[v.type]}
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={colors.textMuted}
                    />
                  </Pressable>
                ))}
              </View>
            </Section>
          ) : null}

          <View style={styles.spaceCta}>
            <Text style={styles.spaceCtaTitle}>
              ¿Eres administrador de un espacio?
            </Text>
            <Pressable
              style={styles.spaceCtaBtn}
              onPress={() => navigation.navigate("VenueRequest")}
            >
              <Text style={styles.spaceCtaBtnText}>Registrar espacio</Text>
            </Pressable>
          </View>

          <Text style={styles.email}>{user.email}</Text>
        </View>
      </ScrollView>

      <FollowRequestsSheet
        visible={followRequestsOpen}
        requests={followRequests}
        busyRequestId={requestBusyId}
        onClose={() => setFollowRequestsOpen(false)}
        onRespond={respondFollowRequest}
      />
      <ProfileConnectionsSheet
        mode={connectionsMode}
        onClose={() => setConnectionsMode(null)}
        onRemoved={handleConnectionRemoved}
        onOpenVenue={(venueId) => {
          setConnectionsMode(null);
          navigation.navigate("VenueDetail", { venueId });
        }}
      />
      <ProfileSettingsSheet
        visible={settingsOpen}
        user={user}
        onClose={() => setSettingsOpen(false)}
        onUserUpdated={setUser}
        onOpenPremium={(planId?: PremiumPlanId) => {
          setSettingsOpen(false);
          navigation.navigate("Premium", planId ? { planId } : undefined);
        }}
        onDeleteAccount={() => {
          setSettingsOpen(false);
          setDeleteAccountOpen(true);
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
      <DeleteAccountSheet
        visible={deleteAccountOpen}
        onClose={() => setDeleteAccountOpen(false)}
        onDeleted={() => {
          setDeleteAccountOpen(false);
          logout();
        }}
      />
    </Screen>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.label}>{title}</Text>
      {children}
    </View>
  );
}

function ActionBtn({
  icon,
  label,
  onPress,
  badge = 0,
  danger = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  badge?: number;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.actionBtn,
        danger && styles.actionBtnDanger,
        pressed && { opacity: 0.85 },
      ]}
    >
      <Ionicons
        name={icon}
        size={18}
        color={danger ? colors.danger : colors.text}
      />
      {badge > 0 ? (
        <View style={styles.actionBadge}>
          <Text style={styles.actionBadgeText}>
            {badge > 99 ? "99+" : badge}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function CountBtn({
  value,
  label,
  onPress,
}: {
  value: number;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.countBtn,
        pressed && styles.countBtnPressed,
      ]}
    >
      <Text style={styles.countValue}>{value}</Text>
      <Text style={styles.countLabel}>{label}</Text>
    </Pressable>
  );
}

function SocialRow({ profile }: { profile: UserProfile }) {
  return (
    <View style={styles.socialRow} accessibilityLabel="Redes sociales">
      {SOCIAL_NETWORKS.map((network) => {
        const handle = profile.socials?.[network]?.trim();
        const active = Boolean(handle);
        const href = active ? socialUrl(network, handle!) : null;
        return (
          <Pressable
            key={network}
            disabled={!href}
            onPress={() => {
              if (href) void Linking.openURL(href);
            }}
            style={[
              styles.socialIcon,
              active ? styles.socialIconActive : styles.socialIconDisabled,
            ]}
            accessibilityLabel={
              active
                ? `${SOCIAL_NETWORK_LABELS[network]}: @${handle!.replace(/^@/, "")}`
                : `${SOCIAL_NETWORK_LABELS[network]} no cargada`
            }
          >
            <Ionicons
              name={SOCIAL_ICONS[network]}
              size={20}
              color={active ? colors.text : colors.textFaint}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

function DeleteAccountSheet({
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
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.deleteLayer}>
        <Pressable style={styles.deleteBackdrop} onPress={busy ? undefined : onClose} />
        <View style={styles.deleteDialog}>
          <View style={styles.deleteIcon}>
            <Ionicons name="trash-outline" size={28} color={colors.danger} />
          </View>
          <Text style={styles.deleteTitle}>Eliminar cuenta</Text>
          <Text style={styles.deleteDesc}>
            Tu cuenta se programará para eliminar. Tendrás 30 días para
            recuperarla iniciando sesión.
          </Text>
          <Text style={styles.deleteHint}>
            Escribí <Text style={styles.deleteHintStrong}>Eliminar</Text> para
            confirmar
          </Text>
          <TextInput
            value={confirmation}
            onChangeText={setConfirmation}
            placeholder="Eliminar"
            placeholderTextColor={colors.textFaint}
            editable={!busy}
            style={styles.deleteInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={styles.deleteActions}>
            <Pressable
              disabled={busy}
              onPress={onClose}
              style={styles.deleteCancel}
            >
              <Text style={styles.deleteCancelText}>Cancelar</Text>
            </Pressable>
            <Pressable
              disabled={!canDelete || busy}
              onPress={() => void deleteAccount()}
              style={[
                styles.deleteConfirm,
                (!canDelete || busy) && { opacity: 0.45 },
              ]}
            >
              {busy ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.deleteConfirmText}>Eliminar</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.md,
  },
  hero: {
    width: "100%",
    height: 270,
    backgroundColor: colors.panel,
    position: "relative",
  },
  heroImg: {
    ...StyleSheet.absoluteFill,
    width: "100%",
    height: "100%",
  },
  heroEmpty: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(242,240,235,0.22)",
    borderStyle: "dashed",
    backgroundColor: colors.panel,
  },
  heroEmptyText: {
    color: colors.textFaint,
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
  },
  heroFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "45%",
  },
  heroCaption: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    justifyContent: "flex-end",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  nameBlock: {
    flex: 1,
    minWidth: 0,
  },
  nameLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  name: {
    color: "#fff",
    fontFamily: fonts.display,
    fontSize: 24,
    letterSpacing: -0.03 * 24,
  },
  meta: {
    marginTop: 4,
    color: "rgba(255,255,255,0.7)",
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "nowrap",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.45)",
    backgroundColor: "rgba(10,10,11,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnDanger: {
    borderColor: "rgba(255,107,107,0.7)",
  },
  actionBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "#101012",
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBadgeText: {
    color: "#fff",
    fontFamily: fonts.bodyBold,
    fontSize: 10,
  },
  galleryAccordion: {
    paddingHorizontal: 10,
    paddingTop: 8,
  },
  galleryToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(242,240,235,0.14)",
    borderRadius: radii.md,
    backgroundColor: "rgba(242,240,235,0.04)",
  },
  galleryToggleOpen: {
    borderColor: "rgba(214,255,75,0.28)",
    backgroundColor: "rgba(214,255,75,0.06)",
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  galleryToggleCopy: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  galleryToggleLabel: {
    color: colors.text,
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
  },
  galleryToggleCount: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  galleryPanel: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: "rgba(214,255,75,0.28)",
    borderBottomLeftRadius: radii.md,
    borderBottomRightRadius: radii.md,
    backgroundColor: "rgba(10,10,11,0.35)",
    padding: spacing.md,
    gap: 10,
  },
  galleryGrid: {
    width: "100%",
    gap: 8,
  },
  galleryRow: {
    flexDirection: "row",
    width: "100%",
    gap: 8,
  },
  galleryThumb: {
    flex: 1,
    aspectRatio: 4 / 3,
    borderRadius: 10,
    backgroundColor: colors.elevated,
    overflow: "hidden",
  },
  galleryPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(242,240,235,0.22)",
    backgroundColor: "rgba(242,240,235,0.03)",
  },
  galleryPlaceholderText: {
    color: colors.textFaint,
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
  },
  galleryNote: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  info: {
    padding: spacing.md,
    gap: spacing.md,
  },
  status: {
    alignSelf: "stretch",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
  },
  statusText: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
  },
  statusStrong: {
    fontFamily: fonts.bodySemiBold,
  },
  statusMuted: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  counts: {
    flexDirection: "row",
    gap: 8,
  },
  countBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    minHeight: 54,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: "rgba(242,240,235,0.12)",
    borderRadius: 14,
    backgroundColor: "rgba(242,240,235,0.04)",
  },
  countBtnPressed: {
    borderColor: "rgba(214,255,75,0.35)",
    backgroundColor: "rgba(214,255,75,0.08)",
  },
  countValue: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 20,
    letterSpacing: -0.02 * 20,
  },
  countLabel: {
    color: colors.textMuted,
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    textAlign: "center",
  },
  socialRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  socialIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  socialIconActive: {
    borderColor: "rgba(242,240,235,0.16)",
    backgroundColor: "rgba(242,240,235,0.04)",
  },
  socialIconDisabled: {
    borderColor: "rgba(242,240,235,0.08)",
    backgroundColor: "transparent",
    opacity: 0.45,
  },
  section: {
    gap: spacing.sm,
  },
  label: {
    color: colors.textMuted,
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  value: {
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
  },
  valueMuted: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
  },
  valueLabel: {
    color: colors.textMuted,
    fontFamily: fonts.bodyMedium,
  },
  bio: {
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
  },
  lookingGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  lookingItem: {
    flexGrow: 1,
    flexBasis: "30%",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
  },
  lookingText: {
    color: colors.text,
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    textAlign: "center",
  },
  interestCat: {
    gap: 6,
    marginBottom: spacing.sm,
  },
  interestCatTitle: {
    color: colors.text,
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    backgroundColor: colors.elevated,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipText: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  promosEntry: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
  },
  promosIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    backgroundColor: colors.primaryDim,
    alignItems: "center",
    justifyContent: "center",
  },
  promosCopy: {
    flex: 1,
    minWidth: 0,
  },
  promosTitle: {
    color: colors.text,
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
  },
  promosSub: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: 2,
  },
  ownedList: {
    gap: 8,
  },
  ownedCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 8,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
  },
  ownedThumb: {
    width: 56,
    height: 56,
    borderRadius: radii.sm,
    backgroundColor: colors.elevated,
  },
  ownedCopy: {
    flex: 1,
    minWidth: 0,
  },
  ownedName: {
    color: colors.text,
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
  },
  ownedType: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: 2,
  },
  spaceCta: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  spaceCtaTitle: {
    color: colors.text,
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
  },
  spaceCtaBtn: {
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 16,
  },
  spaceCtaBtnText: {
    color: colors.onPrimary,
    fontFamily: fonts.bodyBold,
    fontSize: 16,
  },
  email: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 13,
    marginTop: spacing.sm,
  },
  deleteLayer: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg,
  },
  deleteBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.66)",
  },
  deleteDialog: {
    backgroundColor: colors.panel,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  deleteIcon: {
    alignSelf: "center",
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,107,107,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  deleteTitle: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 22,
    letterSpacing: -0.03 * 22,
    textAlign: "center",
  },
  deleteDesc: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  deleteHint: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 13,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  deleteHintStrong: {
    color: colors.text,
    fontFamily: fonts.bodyBold,
  },
  deleteInput: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 15,
    backgroundColor: colors.elevated,
  },
  deleteActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: spacing.md,
  },
  deleteCancel: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  deleteCancelText: {
    color: colors.text,
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
  },
  deleteConfirm: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: radii.md,
    backgroundColor: colors.danger,
    minHeight: 44,
  },
  deleteConfirmText: {
    color: "#fff",
    fontFamily: fonts.bodyBold,
    fontSize: 15,
  },
});

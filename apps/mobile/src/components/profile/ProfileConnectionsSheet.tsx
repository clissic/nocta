import { useEffect, useState } from "react";
import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  SOCIAL_NETWORKS,
  SOCIAL_NETWORK_LABELS,
  VENUE_PHOTO_FALLBACK,
  venueCoverSrc,
  type FollowListUser,
  type FollowRequestProfile,
  type SocialNetwork,
  type Venue,
} from "@nocta/shared";
import { NoctaImage } from "../NoctaImage";
import { NoctaLoading } from "../NoctaLoading";
import { useToast } from "../ToastProvider";
import { api, ApiError } from "../../lib/api";
import { colors, fonts, radii, spacing } from "../../theme/tokens";

export type ProfileConnectionsMode = "followers" | "following" | "venues";

const CONNECTIONS_PAGE_SIZE = 10;

type Props = {
  mode: ProfileConnectionsMode | null;
  onClose: () => void;
  onRemoved: (mode: ProfileConnectionsMode) => void;
  onOpenVenue: (venueId: string) => void;
};

type PublicUserResponse = {
  id: string;
  name: string;
  age: number;
  photo?: string;
  heightCm?: number;
  livesIn?: FollowRequestProfile["livesIn"];
  socials?: FollowRequestProfile["socials"];
};

const SOCIAL_ICONS: Record<SocialNetwork, keyof typeof Ionicons.glyphMap> = {
  instagram: "logo-instagram",
  tiktok: "logo-tiktok",
  x: "logo-twitter",
  facebook: "logo-facebook",
  linkedin: "logo-linkedin",
};

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
  }
}

function connectionsPath(mode: ProfileConnectionsMode, search: string) {
  const params = new URLSearchParams({
    limit: String(CONNECTIONS_PAGE_SIZE),
  });
  const q = search.trim();
  if (q) params.set("q", q);
  if (mode === "followers") return `/api/me/followers?${params}`;
  params.set("type", mode === "venues" ? "venue" : "user");
  return `/api/me/following?${params}`;
}

function titleFor(mode: ProfileConnectionsMode) {
  if (mode === "followers") return "Seguidores";
  if (mode === "following") return "Seguidos";
  return "Espacios";
}

export function ProfileConnectionsSheet({
  mode,
  onClose,
  onRemoved,
  onOpenVenue,
}: Props) {
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [users, setUsers] = useState<FollowListUser[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [reducedProfile, setReducedProfile] =
    useState<FollowRequestProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    if (!mode) return;
    setQuery("");
    setSubmittedQuery("");
    setSelectedUserId(null);
    setReducedProfile(null);
  }, [mode]);

  useEffect(() => {
    if (!mode) return;
    setLoading(true);
    setUsers([]);
    setVenues([]);
    const path = connectionsPath(mode, submittedQuery);
    const load =
      mode === "followers"
        ? api<{ users: FollowListUser[] }>(path).then((response) =>
            setUsers(response.users ?? [])
          )
        : api<{ users: FollowListUser[]; venues: Venue[] }>(path).then(
            (response) => {
              if (mode === "venues") setVenues(response.venues ?? []);
              else setUsers(response.users ?? []);
            }
          );
    void load
      .catch(() => toast.error("No se pudo cargar la lista"))
      .finally(() => setLoading(false));
  }, [mode, submittedQuery, toast]);

  function closeProfile() {
    setSelectedUserId(null);
    setReducedProfile(null);
    setProfileLoading(false);
  }

  async function openReducedProfile(user: FollowListUser) {
    setSelectedUserId(user.id);
    setReducedProfile(null);
    setProfileLoading(true);
    try {
      const response = await api<{ user: PublicUserResponse }>(
        `/api/users/${user.id}`
      );
      const u = response.user;
      setReducedProfile({
        id: u.id,
        name: u.name,
        age: u.age,
        photo: u.photo,
        heightCm: u.heightCm,
        livesIn: u.livesIn,
        socials: u.socials,
      });
    } catch (err) {
      closeProfile();
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo cargar el perfil"
      );
    } finally {
      setProfileLoading(false);
    }
  }

  async function removeUser(user: FollowListUser) {
    if (!mode || mode === "venues") return;
    setBusyId(user.id);
    try {
      const endpoint =
        mode === "followers"
          ? `/api/me/followers/${user.id}`
          : `/api/users/${user.id}/follow`;
      await api(endpoint, { method: "DELETE" });
      setUsers((current) => current.filter((item) => item.id !== user.id));
      onRemoved(mode);
      toast.success(
        mode === "followers" ? "Seguidor eliminado" : "Dejaste de seguir"
      );
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo actualizar"
      );
    } finally {
      setBusyId(null);
    }
  }

  async function removeVenue(venue: Venue) {
    setBusyId(venue.id);
    try {
      await api(`/api/venues/${venue.id}/follow`, { method: "DELETE" });
      setVenues((current) => current.filter((item) => item.id !== venue.id));
      onRemoved("venues");
      toast.success("Dejaste de seguir el espacio");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo actualizar"
      );
    } finally {
      setBusyId(null);
    }
  }

  if (!mode) return null;

  const title = titleFor(mode);
  const emptyCopy = submittedQuery
    ? "No hay resultados para esa búsqueda."
    : mode === "followers"
      ? "Todavía no tenés seguidores."
      : mode === "following"
        ? "Todavía no seguís a nadie."
        : "Todavía no seguís espacios.";
  const isVenues = mode === "venues";
  const listEmpty = isVenues ? venues.length === 0 : users.length === 0;

  return (
    <Modal
      visible
      animationType="slide"
      onRequestClose={() => {
        if (selectedUserId) closeProfile();
        else onClose();
      }}
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
          <Text style={styles.sheetTitle}>{title}</Text>
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
          <View style={styles.searchRow}>
            <Pressable
              onPress={() => setSubmittedQuery(query.trim())}
              style={styles.searchSubmit}
              accessibilityLabel="Buscar por nombre"
            >
              <Ionicons name="search" size={18} color={colors.text} />
            </Pressable>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={`Buscar en ${title.toLocaleLowerCase("es")}…`}
              placeholderTextColor={colors.textFaint}
              style={styles.searchInput}
              returnKeyType="search"
              onSubmitEditing={() => setSubmittedQuery(query.trim())}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Buscar por nombre"
            />
            {query ? (
              <Pressable
                onPress={() => {
                  setQuery("");
                  setSubmittedQuery("");
                }}
                style={styles.searchClear}
                accessibilityLabel="Limpiar búsqueda"
              >
                <Ionicons name="close" size={16} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>

          {loading ? (
            <NoctaLoading variant="inline" label="Cargando" />
          ) : listEmpty ? (
            <Text style={styles.empty}>{emptyCopy}</Text>
          ) : isVenues ? (
            <View style={styles.list}>
              {venues.map((venue) => (
                <View key={venue.id} style={styles.item}>
                  <Pressable
                    style={styles.user}
                    onPress={() => {
                      onClose();
                      onOpenVenue(venue.id);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Abrir ${venue.name}`}
                  >
                    <NoctaImage
                      src={venueCoverSrc(venue)}
                      fallbackSrc={VENUE_PHOTO_FALLBACK}
                      variant="thumb"
                      style={styles.avatar}
                      contentFit="cover"
                    />
                    <View style={styles.userCopy}>
                      <Text style={styles.linkName} numberOfLines={1}>
                        {venue.name}
                      </Text>
                      {venue.city || venue.address ? (
                        <Text style={styles.meta} numberOfLines={1}>
                          {venue.city || venue.address}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                  <Pressable
                    disabled={busyId === venue.id}
                    onPress={() => void removeVenue(venue)}
                    style={[
                      styles.removeBtn,
                      busyId === venue.id && { opacity: 0.45 },
                    ]}
                    accessibilityLabel={`Dejar de seguir ${venue.name}`}
                  >
                    <Ionicons name="remove" size={18} color={colors.textMuted} />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.list}>
              {users.map((user) => {
                const initial = user.name.slice(0, 1).toUpperCase();
                return (
                  <View key={user.id} style={styles.item}>
                    <View style={styles.user}>
                      {user.photo ? (
                        <NoctaImage
                          src={user.photo}
                          variant="thumb"
                          style={styles.avatar}
                          contentFit="cover"
                        />
                      ) : (
                        <View style={[styles.avatar, styles.avatarFallback]}>
                          <Text style={styles.avatarInitial}>{initial}</Text>
                        </View>
                      )}
                      <View style={styles.userCopy}>
                        <Pressable
                          onPress={() => void openReducedProfile(user)}
                          accessibilityRole="button"
                          accessibilityLabel={`Ver perfil de ${user.name}`}
                        >
                          <Text style={styles.name} numberOfLines={1}>
                            {user.name}
                            <Text style={styles.age}> · {user.age}</Text>
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                    <Pressable
                      disabled={busyId === user.id}
                      onPress={() => void removeUser(user)}
                      style={[
                        styles.removeBtn,
                        busyId === user.id && { opacity: 0.45 },
                      ]}
                      accessibilityLabel={
                        mode === "followers"
                          ? `Eliminar a ${user.name} de tus seguidores`
                          : `Dejar de seguir a ${user.name}`
                      }
                    >
                      <Ionicons
                        name={
                          mode === "followers"
                            ? "person-remove-outline"
                            : "person-remove-outline"
                        }
                        size={18}
                        color={colors.textMuted}
                      />
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </View>

      <Modal
        visible={selectedUserId != null}
        transparent
        animationType="fade"
        onRequestClose={closeProfile}
      >
        <View style={styles.profileLayer}>
          <Pressable
            style={styles.profileBackdrop}
            onPress={closeProfile}
            accessibilityLabel="Cerrar perfil"
          />
          <View
            style={[
              styles.profileDialog,
              { paddingBottom: Math.max(insets.bottom, spacing.md) },
            ]}
          >
            <View style={styles.profileHead}>
              <Text style={styles.profileTitle}>Perfil</Text>
              <Pressable
                onPress={closeProfile}
                accessibilityLabel="Cerrar perfil"
                hitSlop={8}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={20} color={colors.text} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.profileBody}>
              {profileLoading || !reducedProfile ? (
                <NoctaLoading variant="inline" label="Cargando perfil" />
              ) : (
                <>
                  {reducedProfile.photo ? (
                    <NoctaImage
                      src={reducedProfile.photo}
                      variant="large"
                      style={styles.profilePhoto}
                      contentFit="cover"
                    />
                  ) : (
                    <View
                      style={[styles.profilePhoto, styles.profilePhotoEmpty]}
                    >
                      <Text style={styles.profilePhotoInitial}>
                        {reducedProfile.name.slice(0, 1).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.profileCopy}>
                    <Text style={styles.profileName}>
                      {reducedProfile.name}
                      <Text style={styles.profileMeta}>
                        {" "}
                        · {reducedProfile.age}
                      </Text>
                    </Text>
                    {reducedProfile.heightCm ? (
                      <Text style={styles.profileMeta}>
                        {reducedProfile.heightCm} cm
                      </Text>
                    ) : null}
                    {reducedProfile.livesIn ? (
                      <Text style={styles.profileMeta}>
                        {reducedProfile.livesIn.country},{" "}
                        {reducedProfile.livesIn.city}
                      </Text>
                    ) : null}
                  </View>
                  {SOCIAL_NETWORKS.some((network) =>
                    Boolean(reducedProfile.socials?.[network]?.trim())
                  ) ? (
                    <View style={styles.socials}>
                      {SOCIAL_NETWORKS.map((network) => {
                        const handle =
                          reducedProfile.socials?.[network]?.trim();
                        const href = handle
                          ? socialUrl(network, handle)
                          : null;
                        if (!href || !handle) return null;
                        const label = SOCIAL_NETWORK_LABELS[network];
                        const clean = handle.replace(/^@/, "");
                        return (
                          <Pressable
                            key={network}
                            onPress={() => void Linking.openURL(href)}
                            style={styles.socialBtn}
                            accessibilityRole="link"
                            accessibilityLabel={`${label}: @${clean}`}
                          >
                            <Ionicons
                              name={SOCIAL_ICONS[network]}
                              size={20}
                              color={colors.primary}
                            />
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : null}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Modal>
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
  sheetBody: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.panel,
    overflow: "hidden",
  },
  searchSubmit: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.border,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 12,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 15,
    paddingVertical: 10,
  },
  searchClear: {
    width: 40,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  list: {
    gap: 0,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minHeight: 56,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  user: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.elevated,
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryDim,
  },
  avatarInitial: {
    color: colors.primary,
    fontFamily: fonts.bodyBold,
    fontSize: 16,
  },
  userCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  name: {
    color: colors.text,
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
  },
  linkName: {
    color: colors.text,
    fontFamily: fonts.bodyBold,
    fontSize: 15,
  },
  age: {
    color: colors.textMuted,
    fontFamily: fonts.bodyMedium,
  },
  meta: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  removeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  profileLayer: {
    flex: 1,
    justifyContent: "flex-end",
  },
  profileBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.66)",
  },
  profileDialog: {
    backgroundColor: "#101012",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: "rgba(255,255,255,0.1)",
    maxHeight: "88%",
    overflow: "hidden",
  },
  profileHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  profileTitle: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 18,
    letterSpacing: -0.03 * 18,
  },
  profileBody: {
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  profilePhoto: {
    width: 220,
    height: 220,
    borderRadius: 18,
    backgroundColor: colors.elevated,
  },
  profilePhotoEmpty: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryDim,
  },
  profilePhotoInitial: {
    color: colors.primary,
    fontFamily: fonts.display,
    fontSize: 64,
  },
  profileCopy: {
    alignItems: "center",
    gap: 4,
  },
  profileName: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 22,
    letterSpacing: -0.03 * 22,
    textAlign: "center",
  },
  profileMeta: {
    color: colors.textMuted,
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    textAlign: "center",
  },
  socials: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
    marginTop: 4,
  },
  socialBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: "rgba(214,255,75,0.35)",
    backgroundColor: "rgba(214,255,75,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
});

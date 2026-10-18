import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  FlatList,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { CompositeNavigationProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { LinearGradient } from "expo-linear-gradient";
import {
  VENUE_TYPES,
  VENUE_TYPE_LABELS,
  VENUES_PAGE_SIZE,
  VENUE_PHOTO_FALLBACK,
  venueCoverSrc,
  type PaginatedVenuesResponse,
  type Presence,
  type Venue,
  type VenueType,
} from "@nocta/shared";
import { useAuth } from "../auth/AuthContext";
import { LiveDot } from "../components/LiveDot";
import { NoctaImage } from "../components/NoctaImage";
import {
  Button,
  Chip,
  LoadingBlock,
  Muted,
  Screen,
} from "../components/ui";
import { api, ApiError } from "../lib/api";
import {
  resolveEffectiveVenueCity,
  type EffectiveVenueCity,
} from "../lib/venueCity";
import { colors, fonts, radii, spacing } from "../theme/tokens";
import type { MainTabParamList, RootStackParamList } from "../navigation/types";

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, "Venues">,
  NativeStackNavigationProp<RootStackParamList>
>;

type TypeFilter = "all" | VenueType;

const TYPE_FILTERS: { id: TypeFilter; label: string }[] = [
  { id: "all", label: "Todos" },
  ...VENUE_TYPES.map((type) => ({
    id: type as TypeFilter,
    label: VENUE_TYPE_LABELS[type],
  })),
];

function formatUntil(endsAt?: string | null) {
  if (!endsAt) return "permanente";
  return `hasta ${new Date(endsAt).toLocaleString("es-AR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })}`;
}

export function VenuesScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const [venueCity, setVenueCity] = useState<EffectiveVenueCity | null>(null);
  const [locStatus, setLocStatus] = useState<"loading" | "ready" | "denied">(
    "loading"
  );
  const [locReason, setLocReason] = useState<
    "gps" | "settings" | "unavailable" | "teleport"
  >("gps");
  const awaitingSettings = useRef(false);
  const [locBusy, setLocBusy] = useState(false);

  const [venues, setVenues] = useState<Venue[]>([]);
  const [presences, setPresences] = useState<Presence[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  const liveVenueIds = useMemo(
    () =>
      new Set(
        presences
          .map((row) => row.venueId ?? row.venue?.id)
          .filter((id): id is string => Boolean(id))
      ),
    [presences]
  );

  const loadGenRef = useRef(0);

  const loadPresences = useCallback(async () => {
    try {
      const presenceRes = await api<{
        presence: Presence | null;
        presences: Presence[];
      }>("/api/presence/me");
      setPresences(
        presenceRes.presences ??
          (presenceRes.presence ? [presenceRes.presence] : [])
      );
    } catch {
      /* strip opcional */
    }
  }, []);

  const load = useCallback(
    async (nextPage: number, append: boolean) => {
      const gen = ++loadGenRef.current;
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError("");
      try {
        const country = venueCity?.country;
        const cityName = venueCity?.city;
        if (!country || !cityName) return;
        const params = new URLSearchParams({
          page: String(nextPage),
          limit: String(VENUES_PAGE_SIZE),
          country,
          city: cityName,
        });
        if (typeFilter !== "all") params.set("type", typeFilter);
        const q = submittedQuery.trim();
        if (q) params.set("q", q);

        const venuesRes = await api<PaginatedVenuesResponse>(
          `/api/venues?${params}`
        );
        if (gen !== loadGenRef.current) return;
        setVenues((prev) =>
          append ? [...prev, ...venuesRes.venues] : venuesRes.venues
        );
        setHasMore(venuesRes.pagination.hasMore);
        setTotal(venuesRes.pagination.total);
        setPage(venuesRes.pagination.page);
      } catch (err) {
        if (gen !== loadGenRef.current) return;
        setError(
          err instanceof ApiError
            ? err.message
            : "No se pudieron cargar los Espacios"
        );
      } finally {
        if (gen === loadGenRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [venueCity, typeFilter, submittedQuery]
  );

  const locationKey = `${user?.id ?? ""}:${user?.premium ? 1 : 0}:${user?.teleportMode ? 1 : 0}:${user?.teleportCity?.country ?? ""}:${user?.teleportCity?.city ?? ""}`;

  const resolveCity = useCallback(
    async (forceGps = false) => {
      setLocBusy(true);
      setLocStatus("loading");
      try {
        const city = await resolveEffectiveVenueCity(user, { forceGps });
        setVenueCity(city);
        setLocStatus("ready");
        setError("");
      } catch (err) {
        const code = err instanceof Error ? err.message : "";
        if (code === "TELEPORT_NEEDS_CITY") {
          setLocReason("teleport");
          setError("");
        } else if (code === "GPS_SETTINGS") {
          setLocReason("settings");
          setError(
            Constants.executionEnvironment === "storeClient"
              ? "El permiso quedó bloqueado en Expo Go. En los ajustes del teléfono, entrá en Expo Go y activá la ubicación."
              : "Nocta no tiene permiso de ubicación. Activalo en los ajustes del teléfono."
          );
        } else if (code === "GPS_DENIED") {
          setLocReason("gps");
          setError("No se concedió el permiso de ubicación.");
        } else if (code === "GPS_UNAVAILABLE") {
          setLocReason("unavailable");
          setError(
            "El permiso está concedido, pero el GPS del teléfono no respondió. Activalo e intentá de nuevo."
          );
        } else if (code === "NO_NEARBY_CITY") {
          setLocReason("gps");
          setError("No encontramos una ciudad cercana para tu ubicación.");
        } else {
          setLocReason("gps");
          setError(
            err instanceof ApiError
              ? err.message
              : "No se pudo obtener tu ubicación."
          );
        }
        setLocStatus("denied");
      } finally {
        setLocBusy(false);
      }
    },
    [user]
  );

  useEffect(() => {
    // locationKey resume cuando cambia Teleport o la sesión, sin re-pedir GPS en cada render.
    void resolveCity(false).catch(() => {
      setLocReason("gps");
      setLocStatus("denied");
      setError("No se pudo obtener tu ubicación.");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationKey]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active" || !awaitingSettings.current) return;
      awaitingSettings.current = false;
      void resolveCity(true);
    });
    return () => sub.remove();
  }, [resolveCity]);

  useEffect(() => {
    void loadPresences();
  }, [loadPresences]);

  function openLocationSettings() {
    awaitingSettings.current = true;
    void Linking.openSettings();
  }

  const loadRef = useRef(load);
  loadRef.current = load;
  // Deps explícitas de filtro/ciudad — evita loops si cambia la identidad de `load`.
  useEffect(() => {
    if (locStatus !== "ready" || !venueCity) return;
    void loadRef.current(1, false);
  }, [
    locStatus,
    venueCity,
    typeFilter,
    submittedQuery,
  ]);

  function submitSearch() {
    setSubmittedQuery(query.trim());
  }

  if (locStatus === "loading" && !venueCity) {
    return <LoadingBlock label="Buscando tu ciudad…" />;
  }

  if (locStatus === "denied" || !venueCity) {
    return (
      <Screen padded={false} safeTop={false} style={styles.screen}>
        <View style={styles.locationGate}>
          <Text style={styles.locationTitle}>
            {locReason === "teleport"
              ? "Elegí una ciudad Teleport"
              : locReason === "settings"
                ? "Activá la ubicación"
                : locReason === "unavailable"
                  ? "No pudimos leer tu ubicación"
                  : "Necesitamos tu ubicación"}
          </Text>
          <Muted style={styles.locationCopy}>
            {locReason === "teleport"
              ? "Tenés el modo Teleport activado, pero todavía no elegiste una ciudad. Abrí Configuración y marcá el destino."
              : error ||
                "Para mostrarte Espacios, Nocta usa tu ubicación y te asigna la ciudad registrada más cercana."}
          </Muted>
          {locReason === "teleport" ? (
            <Button
              label="Ir a configuración"
              onPress={() =>
                navigation.navigate("Profile", { focus: "settings" })
              }
            />
          ) : locReason === "settings" ? (
            <Button label="Abrir ajustes" onPress={openLocationSettings} />
          ) : (
            <Button
              label={locBusy ? "Esperando…" : "Permitir ubicación"}
              loading={locBusy}
              onPress={() => void resolveCity(true)}
            />
          )}
          {locReason === "teleport" ? (
            <Button
              label="Reintentar"
              variant="outline"
              loading={locBusy}
              onPress={() => void resolveCity(false)}
            />
          ) : user?.premium ? (
            <Muted style={styles.locationHint}>
              ¿Preferís explorar otra ciudad? Activá Modo Teleport desde
              Configuración en tu perfil.
            </Muted>
          ) : null}
          {locReason === "unavailable" ? (
            <Button
              label="Abrir ajustes"
              variant="outline"
              onPress={openLocationSettings}
            />
          ) : null}
          {locReason === "gps" || locReason === "settings" ? (
            <Button
              label="Ir a mi perfil"
              variant="outline"
              onPress={() => navigation.navigate("Profile")}
            />
          ) : null}
        </View>
      </Screen>
    );
  }

  if (loading && venues.length === 0) {
    return <LoadingBlock label="Cargando Espacios…" />;
  }

  return (
    <Screen padded={false} safeTop={false} style={styles.screen}>
      <FlatList
        data={venues}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        onEndReached={() => {
          if (hasMore && !loadingMore) void load(page + 1, true);
        }}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>¿A dónde vas?</Text>
            <Muted style={styles.subtitle}>
              Explorando {venueCity?.city}, {venueCity?.country}
              {venueCity?.source === "teleport" ? " · Teleport" : ""}. Publicate
              en un espacio y descubrí quién más va.
            </Muted>

            <View style={styles.searchRow}>
              <Pressable
                onPress={submitSearch}
                style={styles.searchBtn}
                accessibilityLabel="Buscar espacios"
              >
                <Ionicons name="search" size={18} color={colors.text} />
              </Pressable>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Buscar por nombre, barrio…"
                placeholderTextColor={colors.textMuted}
                style={styles.searchInput}
                returnKeyType="search"
                onSubmitEditing={submitSearch}
              />
              {query ? (
                <Pressable
                  onPress={() => {
                    setQuery("");
                    setSubmittedQuery("");
                  }}
                  style={styles.clearBtn}
                  accessibilityLabel="Limpiar búsqueda"
                >
                  <Ionicons name="close" size={18} color={colors.textMuted} />
                </Pressable>
              ) : null}
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filtersRow}
            >
              {TYPE_FILTERS.map((f) => (
                <Chip
                  key={f.id}
                  label={f.label}
                  active={typeFilter === f.id}
                  onPress={() => setTypeFilter(f.id)}
                />
              ))}
            </ScrollView>

            {presences.length > 0 ? (
              <View style={styles.presenceStrip}>
                {presences.map((row) => {
                  const name = row.venue?.name || "Espacio";
                  return (
                    <View key={row.id} style={styles.presenceSlot}>
                      <View style={styles.presenceLeft}>
                        <LiveDot />
                        <Text style={styles.presenceLabel}>Publicado</Text>
                        <Text style={styles.presenceName} numberOfLines={1}>
                          {name}
                        </Text>
                        <Text style={styles.presenceUntil} numberOfLines={1}>
                          {formatUntil(row.endsAt)}
                        </Text>
                      </View>
                      <Pressable
                        style={styles.discoverMini}
                        onPress={() =>
                          (
                            navigation as unknown as {
                              navigate: (
                                screen: string,
                                params?: object
                              ) => void;
                            }
                          ).navigate("Discover", { venueId: row.venueId })
                        }
                        accessibilityLabel={`Discover en ${name}`}
                      >
                        <Ionicons
                          name="flame"
                          size={16}
                          color={colors.onPrimary}
                        />
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Muted style={styles.hint}>
                Publicate en un Espacio para entrar a Discover.
              </Muted>
            )}

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        }
        renderItem={({ item }) => (
          <VenueCard
            venue={item}
            isLive={liveVenueIds.has(item.id)}
            onPress={() =>
              navigation.navigate("VenueDetail", { venueId: item.id })
            }
          />
        )}
        ListEmptyComponent={
          <Muted style={styles.empty}>
            Todavía no hay espacios
            {submittedQuery || typeFilter !== "all" ? " con ese filtro." : "."}
          </Muted>
        }
        ListFooterComponent={
          venues.length > 0 ? (
            <Muted style={styles.footer}>
              {loadingMore
                ? "Cargando más…"
                : hasMore
                  ? `Mostrando ${venues.length} de ${total}`
                  : `${total} espacio${total === 1 ? "" : "s"}`}
            </Muted>
          ) : null
        }
      />
    </Screen>
  );
}

function VenueCard({
  venue,
  isLive,
  onPress,
}: {
  venue: Venue;
  isLive: boolean;
  onPress: () => void;
}) {
  const spyCount = venue.livePublishedCount;
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.94 }]}
      onPress={onPress}
    >
      <View style={styles.media}>
        <NoctaImage
          src={venueCoverSrc(venue)}
          fallbackSrc={VENUE_PHOTO_FALLBACK}
          variant="medium"
          style={styles.cover}
          contentFit="cover"
        />
        <LinearGradient
          pointerEvents="none"
          colors={[
            "rgba(0,0,0,0.05)",
            "rgba(0,0,0,0.55)",
            colors.canvas,
          ]}
          locations={[0.2, 0.58, 1]}
          style={styles.fade}
        />
        {isLive ? (
          <View style={styles.liveBadge}>
            <LiveDot />
            <Text style={styles.liveBadgeText}>Ahora</Text>
          </View>
        ) : null}
        {typeof spyCount === "number" ? (
          <View style={styles.spyBadge}>
            <Ionicons name="binoculars" size={12} color={colors.primary} />
            <Text style={styles.spyText}>{spyCount}</Text>
          </View>
        ) : null}
        <View style={styles.caption}>
          <Text style={styles.type}>{VENUE_TYPE_LABELS[venue.type]}</Text>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {venue.name}
            </Text>
            {venue.ownerId ? (
              <Ionicons
                name="checkmark-circle"
                size={16}
                color={colors.primary}
              />
            ) : null}
          </View>
          {venue.address ? (
            <Text style={styles.meta} numberOfLines={1}>
              {venue.address}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { paddingBottom: 0 },
  locationGate: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  locationTitle: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 26,
    letterSpacing: -0.03 * 26,
  },
  locationCopy: {
    marginBottom: spacing.xs,
  },
  locationHint: {
    textAlign: "center",
  },
  list: {
    paddingTop: spacing.md,
    paddingBottom: 110,
    paddingHorizontal: spacing.md,
  },
  header: {
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 26,
    letterSpacing: -0.03 * 26,
  },
  subtitle: {
    marginBottom: spacing.xs,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(242,240,235,0.28)",
    borderRadius: 14,
    backgroundColor: colors.elevated,
    overflow: "hidden",
  },
  searchBtn: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.border,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 15,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  clearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  filtersRow: {
    gap: spacing.sm,
    paddingVertical: 2,
  },
  hint: { marginBottom: 2 },
  presenceStrip: {
    gap: 8,
    marginTop: 2,
  },
  presenceSlot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  presenceLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
  },
  presenceLabel: {
    color: colors.primary,
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    flexShrink: 0,
  },
  presenceName: {
    color: colors.text,
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    flexShrink: 1,
    minWidth: 0,
  },
  presenceUntil: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    flexShrink: 1,
    minWidth: 0,
  },
  discoverMini: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: colors.canvas,
    marginBottom: 14,
  },
  media: {
    position: "relative",
    width: "100%",
    aspectRatio: 16 / 10,
    backgroundColor: colors.panel,
    overflow: "hidden",
    borderRadius: 16,
  },
  cover: {
    ...StyleSheet.absoluteFill,
    width: "100%",
    height: "100%",
  },
  fade: {
    ...StyleSheet.absoluteFill,
  },
  liveBadge: {
    position: "absolute",
    top: 11,
    left: 11,
    zIndex: 3,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: "rgba(10,10,11,0.62)",
  },
  liveBadgeText: {
    color: "#fff",
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  spyBadge: {
    position: "absolute",
    top: 11,
    right: 11,
    zIndex: 3,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: "rgba(10,10,11,0.72)",
    borderWidth: 1,
    borderColor: "rgba(214,255,75,0.28)",
  },
  spyText: {
    color: colors.primary,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
  },
  caption: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    paddingTop: spacing.sm,
    gap: 2,
  },
  type: {
    color: "rgba(214,255,75,0.92)",
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  name: {
    flexShrink: 1,
    color: "#fff",
    fontFamily: fonts.display,
    fontSize: 18,
    letterSpacing: -0.03 * 18,
    lineHeight: 22,
  },
  meta: {
    color: "rgba(242,240,235,0.72)",
    fontFamily: fonts.body,
    fontSize: 13,
  },
  error: {
    color: colors.danger,
    fontFamily: fonts.body,
  },
  empty: {
    paddingTop: spacing.lg,
  },
  footer: {
    textAlign: "center",
    paddingVertical: spacing.md,
  },
});

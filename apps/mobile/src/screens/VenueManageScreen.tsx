import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import {
  MAX_PHOTO_UPLOAD_BYTES,
  VENUE_PHOTO_FALLBACK,
  VENUE_TYPE_LABELS,
  timezoneFromCountry,
  todayInTimeZone,
  venueCoverSrc,
  type Promotion,
  type Venue,
  type VenueNews,
} from "@nocta/shared";
import { useAuth } from "../auth/AuthContext";
import { NoctaImage } from "../components/NoctaImage";
import { NoctaLoading } from "../components/NoctaLoading";
import { useToast } from "../components/ToastProvider";
import { DateField, Screen } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { appendLocalFile } from "../lib/localFile";
import { colors, fonts, radii, spacing } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "VenueManage">;

type LocalImage = {
  uri: string;
  name: string;
  mimeType: string;
};

const PHOTO_LIMIT_MB = Math.round(MAX_PHOTO_UPLOAD_BYTES / (1024 * 1024));

function formatDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("es-UY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatValidityRange(from?: string, until?: string) {
  const start = formatDate(from);
  const end = formatDate(until);
  if (start && end) return `${start} – ${end}`;
  if (end) return `Hasta ${end}`;
  if (start) return `Desde ${start}`;
  return null;
}

function formatPriceUyu(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency: "UYU",
    maximumFractionDigits: 0,
  }).format(value);
}

function mimeFromAsset(mimeType?: string | null, fileName?: string | null) {
  const mime = mimeType?.toLowerCase() ?? "";
  if (mime.startsWith("image/")) return mime === "image/jpg" ? "image/jpeg" : mime;
  const name = (fileName ?? "").toLowerCase();
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  return "";
}

export function VenueManageScreen({ navigation, route }: Props) {
  const { venueId } = route.params;
  const { user } = useAuth();
  const toast = useToast();
  const userTimeZone = timezoneFromCountry(user?.profile?.livesIn?.country);

  const [venue, setVenue] = useState<Venue | null>(null);
  const [news, setNews] = useState<VenueNews[]>([]);
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [paymentHelpOpen, setPaymentHelpOpen] = useState(false);

  const [newsTitle, setNewsTitle] = useState("");
  const [newsBody, setNewsBody] = useState("");
  const [newsPhoto, setNewsPhoto] = useState<LocalImage | null>(null);
  const [promoTitle, setPromoTitle] = useState("");
  const [promoDescription, setPromoDescription] = useState("");
  const [promoPrice, setPromoPrice] = useState("");
  const [promoValidFrom, setPromoValidFrom] = useState(() =>
    todayInTimeZone(userTimeZone)
  );
  const [promoValidUntil, setPromoValidUntil] = useState("");
  const [newsListOpen, setNewsListOpen] = useState(false);
  const [promoListOpen, setPromoListOpen] = useState(false);
  const [newsQuery, setNewsQuery] = useState("");
  const [submittedNewsQuery, setSubmittedNewsQuery] = useState("");
  const [promoQuery, setPromoQuery] = useState("");
  const [submittedPromoQuery, setSubmittedPromoQuery] = useState("");

  const filteredNews = useMemo(() => {
    const q = submittedNewsQuery.toLowerCase();
    if (!q) return news;
    return news.filter((item) =>
      `${item.title} ${item.body}`.toLowerCase().includes(q)
    );
  }, [news, submittedNewsQuery]);

  const filteredPromos = useMemo(() => {
    const q = submittedPromoQuery.toLowerCase();
    if (!q) return promos;
    return promos.filter((item) =>
      `${item.title} ${item.description}`.toLowerCase().includes(q)
    );
  }, [promos, submittedPromoQuery]);

  const load = useCallback(async () => {
    setMissing(false);
    try {
      const venueRes = await api<{ venue: Venue }>(`/api/venues/${venueId}/manage`);
      const nextVenue = venueRes.venue;
      const isOwner = nextVenue.ownerId === user?.id;
      const isAdmin = user?.role === "admin";
      if (!isOwner && !isAdmin) {
        toast.error("No tenés permiso para administrar este Espacio");
        navigation.goBack();
        return;
      }
      setVenue(nextVenue);
      const [newsRes, promoRes] = await Promise.all([
        api<{ news: VenueNews[] }>(`/api/venues/${venueId}/news`),
        api<{ promotions: Promotion[] }>(`/api/venues/${venueId}/promotions`),
      ]);
      setNews(newsRes.news);
      setPromos(promoRes.promotions);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        toast.error("No tenés permiso para administrar este Espacio");
        navigation.goBack();
        return;
      }
      if (err instanceof ApiError && err.status === 404) {
        setVenue(null);
        setMissing(true);
        return;
      }
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo cargar el espacio"
      );
    } finally {
      setLoading(false);
    }
  }, [navigation, toast, user?.id, user?.role, venueId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  async function pickNewsPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > MAX_PHOTO_UPLOAD_BYTES) {
      toast.error(`La imagen supera los ${PHOTO_LIMIT_MB} MB`);
      return;
    }
    const mimeType = mimeFromAsset(asset.mimeType, asset.fileName);
    if (!mimeType) {
      toast.error("Elegí una imagen válida");
      return;
    }
    setNewsPhoto({
      uri: asset.uri,
      name: asset.fileName || "noticia.jpg",
      mimeType,
    });
  }

  async function createNews() {
    if (!newsTitle.trim() || !newsBody.trim()) {
      toast.error("Completá el título y el texto de la noticia");
      return;
    }
    if (newsTitle.trim().length < 2 || newsBody.trim().length < 2) {
      toast.error("El título y el texto tienen que tener al menos 2 caracteres");
      return;
    }
    if (!newsPhoto) {
      toast.error("Subí una imagen para la noticia");
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.append("title", newsTitle.trim());
      form.append("body", newsBody.trim());
      await appendLocalFile(form, "photo", newsPhoto);
      const res = await api<{ news: VenueNews }>(`/api/venues/${venueId}/news`, {
        method: "POST",
        body: form,
      });
      setNews((prev) => [res.news, ...prev]);
      setNewsTitle("");
      setNewsBody("");
      setNewsPhoto(null);
      setNewsListOpen(true);
      toast.success("Noticia publicada");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo crear la noticia"
      );
    } finally {
      setBusy(false);
    }
  }

  async function toggleNews(item: VenueNews) {
    try {
      const res = await api<{ news: VenueNews }>(
        `/api/venues/${venueId}/news/${item.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ active: !item.active }),
        }
      );
      setNews((prev) => prev.map((n) => (n.id === item.id ? res.news : n)));
      toast.success(res.news.active ? "Noticia activa" : "Noticia ocultada");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo actualizar"
      );
    }
  }

  async function createPromo() {
    if (!promoTitle.trim() || !promoDescription.trim()) {
      toast.error("Completá el título y el detalle de la promo");
      return;
    }
    if (promoTitle.trim().length < 2 || promoDescription.trim().length < 2) {
      toast.error("El título y el detalle tienen que tener al menos 2 caracteres");
      return;
    }
    const priceUyu = Number(promoPrice);
    if (!Number.isFinite(priceUyu) || priceUyu < 0) {
      toast.error("Indicá un precio válido en UYU");
      return;
    }
    if (!promoValidFrom || !promoValidUntil) {
      toast.error("Indicá el período de validez");
      return;
    }
    if (promoValidUntil < promoValidFrom) {
      toast.error("La fecha de fin no puede ser anterior al inicio");
      return;
    }
    setBusy(true);
    try {
      const res = await api<{ promotion: Promotion }>(
        `/api/venues/${venueId}/promotions`,
        {
          method: "POST",
          body: JSON.stringify({
            title: promoTitle.trim(),
            description: promoDescription.trim(),
            priceUyu,
            validFrom: promoValidFrom,
            validUntil: promoValidUntil,
          }),
        }
      );
      setPromos((prev) => [res.promotion, ...prev]);
      setPromoTitle("");
      setPromoDescription("");
      setPromoPrice("");
      setPromoValidFrom(todayInTimeZone(userTimeZone));
      setPromoValidUntil("");
      setPromoListOpen(true);
      toast.success("Promoción creada");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo crear la promo"
      );
    } finally {
      setBusy(false);
    }
  }

  async function togglePromo(item: Promotion) {
    try {
      const res = await api<{ promotion: Promotion }>(
        `/api/venues/${venueId}/promotions/${item.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ active: !item.active }),
        }
      );
      setPromos((prev) =>
        prev.map((p) => (p.id === item.id ? res.promotion : p))
      );
      toast.success(
        res.promotion.active ? "Promoción activa" : "Promoción ocultada"
      );
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo actualizar"
      );
    }
  }

  if (loading && !venue) {
    return (
      <Screen safeTop={false}>
        <NoctaLoading />
      </Screen>
    );
  }

  if (!venue) {
    return (
      <Screen safeTop={false} style={styles.screen}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backLink}>
          <Text style={styles.backLinkText}>← Perfil</Text>
        </Pressable>
        <Text style={styles.muted}>
          {missing ? "Espacio no encontrado." : "No se pudo cargar el Espacio."}
        </Text>
      </Screen>
    );
  }

  const followers = venue.followersCount ?? 0;
  const untilMin = promoValidFrom
    ? new Date(`${promoValidFrom}T12:00:00`)
    : undefined;

  return (
    <Screen safeTop={false} style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scroll}
      >
        <Pressable onPress={() => navigation.goBack()} style={styles.backLink}>
          <Text style={styles.backLinkText}>← Perfil</Text>
        </Pressable>

        <View style={styles.head}>
          <NoctaImage
            src={venueCoverSrc(venue)}
            fallbackSrc={VENUE_PHOTO_FALLBACK}
            variant="thumb"
            style={styles.thumb}
            contentFit="cover"
          />
          <View style={styles.headCopy}>
            <View style={styles.titleRow}>
              <Text style={styles.title} numberOfLines={2}>
                {venue.name}
              </Text>
              <Text style={[styles.status, venue.active ? styles.statusOn : styles.statusOff]}>
                {venue.active ? "Activo" : "Inactivo"}
              </Text>
            </View>
            <Text style={styles.meta}>
              {VENUE_TYPE_LABELS[venue.type]} · {venue.city}
            </Text>
            <Text style={styles.muted}>{venue.address}</Text>
            <Pressable
              onPress={() => navigation.navigate("VenueDetail", { venueId: venue.id })}
            >
              <Text style={styles.publicLink}>Ver ficha pública</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.overviewActions}>
          <View style={styles.followers}>
            <Ionicons name="people" size={18} color={colors.primary} />
            <Text style={styles.followersText}>
              <Text style={styles.followersCount}>{followers}</Text>
              {followers === 1 ? " seguidor" : " seguidores"}
            </Text>
          </View>
          <Pressable
            style={styles.editBtn}
            onPress={() => navigation.navigate("VenueEdit", { venueId: venue.id })}
          >
            <Ionicons name="pencil" size={16} color={colors.onPrimary} />
            <Text style={styles.editBtnText}>Editar información</Text>
          </Pressable>
        </View>

        <Text style={venue.description ? styles.body : styles.muted}>
          {venue.description || "Sin descripción."}
        </Text>

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Noticias</Text>
            <Text style={styles.muted}>{news.length}</Text>
          </View>
          <TextInput
            style={styles.input}
            placeholder="Título"
            placeholderTextColor={colors.textFaint}
            value={newsTitle}
            onChangeText={setNewsTitle}
            maxLength={120}
          />
          <TextInput
            style={[styles.input, styles.area]}
            placeholder="Qué querés contar…"
            placeholderTextColor={colors.textFaint}
            value={newsBody}
            onChangeText={setNewsBody}
            maxLength={4000}
            multiline
            textAlignVertical="top"
          />
          {newsPhoto ? (
            <View style={styles.photoPreview}>
              <NoctaImage src={newsPhoto.uri} style={styles.photo} contentFit="cover" />
              <View style={styles.photoActions}>
                <Pressable style={styles.outlineBtn} onPress={() => void pickNewsPhoto()}>
                  <Text style={styles.outlineBtnText}>Cambiar</Text>
                </Pressable>
                <Pressable style={styles.outlineBtn} onPress={() => setNewsPhoto(null)}>
                  <Text style={styles.outlineBtnText}>Quitar</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable style={styles.upload} onPress={() => void pickNewsPhoto()}>
              <Ionicons name="image-outline" size={20} color={colors.primary} />
              <Text style={styles.uploadText}>Imagen de la noticia</Text>
            </Pressable>
          )}
          <Pressable
            style={[styles.primaryBtn, busy && styles.disabled]}
            disabled={busy}
            onPress={() => void createNews()}
          >
            <Text style={styles.primaryBtnText}>Publicar noticia</Text>
          </Pressable>
          <Accordion
            label="Publicadas"
            count={news.length}
            open={newsListOpen}
            onToggle={() => setNewsListOpen((open) => !open)}
          >
            {news.length === 0 ? (
              <Text style={styles.muted}>Todavía no hay noticias.</Text>
            ) : (
              <>
                <SearchRow
                  value={newsQuery}
                  onChange={setNewsQuery}
                  onSearch={() => setSubmittedNewsQuery(newsQuery.trim())}
                  label="Buscar noticias"
                />
                {filteredNews.length === 0 ? (
                  <Text style={styles.muted}>
                    Ninguna noticia coincide con “{submittedNewsQuery}”.
                  </Text>
                ) : (
                  filteredNews.map((item) => (
                    <View key={item.id} style={styles.item}>
                      {item.photos[0] ? (
                        <NoctaImage
                          src={item.photos[0]}
                          variant="thumb"
                          style={styles.itemThumb}
                          contentFit="cover"
                        />
                      ) : null}
                      <View style={styles.itemCopy}>
                        <View style={styles.itemTitleRow}>
                          <Text style={styles.itemTitle} numberOfLines={1}>
                            {item.title}
                          </Text>
                          {!item.active ? <Text style={styles.pill}>Oculta</Text> : null}
                        </View>
                        <Text style={styles.itemBody}>{item.body}</Text>
                        <Text style={styles.muted}>
                          {formatDate(item.publishedAt) ?? "Sin fecha"}
                        </Text>
                      </View>
                      <Pressable style={styles.outlineBtn} onPress={() => void toggleNews(item)}>
                        <Text style={styles.outlineBtnText}>
                          {item.active ? "Ocultar" : "Activar"}
                        </Text>
                      </Pressable>
                    </View>
                  ))
                )}
              </>
            )}
          </Accordion>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Promociones</Text>
            <Text style={styles.muted}>{promos.length}</Text>
          </View>
          <TextInput
            style={styles.input}
            placeholder="Título"
            placeholderTextColor={colors.textFaint}
            value={promoTitle}
            onChangeText={setPromoTitle}
            maxLength={120}
          />
          <View style={styles.priceRow}>
            <Text style={styles.pricePrefix}>UYU</Text>
            <TextInput
              style={[styles.input, styles.priceInput]}
              placeholder="Precio"
              placeholderTextColor={colors.textFaint}
              value={promoPrice}
              onChangeText={setPromoPrice}
              keyboardType="number-pad"
            />
          </View>
          <TextInput
            style={[styles.input, styles.areaSm]}
            placeholder="Detalle de la promo…"
            placeholderTextColor={colors.textFaint}
            value={promoDescription}
            onChangeText={setPromoDescription}
            maxLength={500}
            multiline
            textAlignVertical="top"
          />
          <DateField
            value={promoValidFrom}
            onChange={setPromoValidFrom}
            placeholder="Válida desde"
          />
          <DateField
            value={promoValidUntil}
            onChange={setPromoValidUntil}
            placeholder="Válida hasta"
            minimumDate={untilMin}
          />
          <Pressable
            style={[styles.primaryBtn, busy && styles.disabled]}
            disabled={busy}
            onPress={() => void createPromo()}
          >
            <Text style={styles.primaryBtnText}>Crear promoción</Text>
          </Pressable>
          <Accordion
            label="Publicadas"
            count={promos.length}
            open={promoListOpen}
            onToggle={() => setPromoListOpen((open) => !open)}
          >
            {promos.length === 0 ? (
              <Text style={styles.muted}>Todavía no hay promociones.</Text>
            ) : (
              <>
                <SearchRow
                  value={promoQuery}
                  onChange={setPromoQuery}
                  onSearch={() => setSubmittedPromoQuery(promoQuery.trim())}
                  label="Buscar promociones"
                />
                {filteredPromos.length === 0 ? (
                  <Text style={styles.muted}>
                    Ninguna promoción coincide con “{submittedPromoQuery}”.
                  </Text>
                ) : (
                  filteredPromos.map((item) => {
                    const validity = formatValidityRange(item.validFrom, item.validUntil);
                    const expired =
                      !!item.validUntil &&
                      new Date(item.validUntil).getTime() < Date.now();
                    const price = formatPriceUyu(item.priceUyu);
                    return (
                      <View key={item.id} style={styles.item}>
                        <View style={styles.itemCopy}>
                          <View style={styles.itemTitleRow}>
                            <Text style={styles.itemTitle} numberOfLines={1}>
                              {item.title}
                            </Text>
                            {!item.active ? <Text style={styles.pill}>Oculta</Text> : null}
                            {item.active && expired ? (
                              <Text style={styles.pill}>Vencida</Text>
                            ) : null}
                          </View>
                          <Text style={styles.itemBody}>{item.description}</Text>
                          {price ? <Text style={styles.price}>{price}</Text> : null}
                          {validity ? <Text style={styles.muted}>{validity}</Text> : null}
                        </View>
                        <Pressable
                          style={styles.outlineBtn}
                          onPress={() => void togglePromo(item)}
                        >
                          <Text style={styles.outlineBtnText}>
                            {item.active ? "Ocultar" : "Activar"}
                          </Text>
                        </Pressable>
                      </View>
                    );
                  })
                )}
              </>
            )}
          </Accordion>
        </View>

        <View style={styles.payments}>
          <View style={styles.paymentsCopy}>
            <Ionicons name="wallet-outline" size={22} color={colors.primary} />
            <View style={styles.itemCopy}>
              <View style={styles.itemTitleRow}>
                <Text style={styles.sectionTitle}>Cuenta de Mercado Pago</Text>
                <Pressable
                  onPress={() => setPaymentHelpOpen((open) => !open)}
                  accessibilityLabel="¿Para qué se usa la cuenta de Mercado Pago?"
                  hitSlop={8}
                >
                  <Ionicons
                    name="help-circle-outline"
                    size={18}
                    color={colors.textMuted}
                  />
                </Pressable>
              </View>
              <Text style={styles.muted}>
                Vinculá la cuenta donde querés recibir los pagos de este Espacio.
              </Text>
              {paymentHelpOpen ? (
                <Text style={styles.help}>
                  La cuenta se utilizará para recibir el dinero de entradas,
                  promociones y otros cobros realizados desde Nocta.
                </Text>
              ) : null}
            </View>
          </View>
          <Pressable
            style={styles.editBtn}
            onPress={() =>
              toast.info(
                "La vinculación segura con Mercado Pago estará disponible próximamente"
              )
            }
          >
            <Ionicons name="link" size={16} color={colors.onPrimary} />
            <Text style={styles.editBtnText}>Configurar cuenta</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}

function Accordion({
  label,
  count,
  open,
  onToggle,
  children,
}: {
  label: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <View style={styles.accordion}>
      <Pressable style={styles.accordionToggle} onPress={onToggle}>
        <Text style={styles.accordionLabel}>
          {label}
          <Text style={styles.muted}> · {count}</Text>
        </Text>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={16}
          color={colors.textMuted}
        />
      </Pressable>
      {open ? <View style={styles.accordionBody}>{children}</View> : null}
    </View>
  );
}

function SearchRow({
  value,
  onChange,
  onSearch,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  onSearch: () => void;
  label: string;
}) {
  return (
    <View style={styles.searchRow}>
      <TextInput
        style={[styles.input, styles.searchInput]}
        value={value}
        onChangeText={onChange}
        placeholder="Buscar por palabras clave…"
        placeholderTextColor={colors.textFaint}
        accessibilityLabel={label}
        onSubmitEditing={onSearch}
        returnKeyType="search"
      />
      <Pressable style={styles.searchBtn} onPress={onSearch}>
        <Text style={styles.searchBtnText}>Buscar</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { paddingTop: spacing.sm },
  scroll: { paddingBottom: spacing.xl, gap: spacing.md },
  backLink: { alignSelf: "flex-start" },
  backLinkText: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 14 },
  head: { flexDirection: "row", gap: spacing.sm },
  thumb: { width: 80, height: 80, borderRadius: radii.md },
  headCopy: { flex: 1, gap: 2 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  title: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 22,
    letterSpacing: -0.3,
  },
  status: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
    overflow: "hidden",
  },
  statusOn: { color: colors.onPrimary, backgroundColor: colors.primary },
  statusOff: { color: colors.textMuted, backgroundColor: colors.elevated },
  meta: { color: colors.text, fontFamily: fonts.bodyMedium, fontSize: 13 },
  muted: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  publicLink: { color: colors.primary, fontFamily: fonts.bodySemiBold, fontSize: 13, marginTop: 2 },
  overviewActions: { gap: spacing.sm },
  followers: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  followersText: { color: colors.text, fontFamily: fonts.body, fontSize: 14 },
  followersCount: { fontFamily: fonts.bodyBold },
  editBtn: {
    minHeight: 44,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 14,
  },
  editBtnText: { color: colors.onPrimary, fontFamily: fonts.bodyBold, fontSize: 15 },
  body: { color: colors.text, fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  section: { gap: spacing.sm, paddingTop: spacing.sm },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { color: colors.text, fontFamily: fonts.display, fontSize: 20, letterSpacing: -0.3 },
  input: {
    backgroundColor: colors.elevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  area: { minHeight: 96 },
  areaSm: { minHeight: 72 },
  upload: {
    minHeight: 72,
    borderRadius: radii.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(214,255,75,0.45)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  uploadText: { color: colors.text, fontFamily: fonts.bodySemiBold, fontSize: 14 },
  photoPreview: { gap: spacing.sm },
  photo: { width: "100%", height: 180, borderRadius: radii.md },
  photoActions: { flexDirection: "row", gap: spacing.sm },
  primaryBtn: {
    alignSelf: "flex-start",
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: { color: colors.onPrimary, fontFamily: fonts.bodyBold, fontSize: 14 },
  outlineBtn: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  outlineBtnText: { color: colors.text, fontFamily: fonts.bodySemiBold, fontSize: 13 },
  disabled: { opacity: 0.5 },
  accordion: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginTop: spacing.xs,
  },
  accordionToggle: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  accordionLabel: { color: colors.text, fontFamily: fonts.bodySemiBold, fontSize: 15 },
  accordionBody: { gap: spacing.sm, paddingBottom: spacing.sm },
  searchRow: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
  searchInput: { flex: 1 },
  searchBtn: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBtnText: { color: colors.onPrimary, fontFamily: fonts.bodyBold, fontSize: 14 },
  item: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start",
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  itemThumb: { width: 56, height: 56, borderRadius: 10 },
  itemCopy: { flex: 1, gap: 2 },
  itemTitleRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  itemTitle: { color: colors.text, fontFamily: fonts.bodyBold, fontSize: 15, flexShrink: 1 },
  itemBody: { color: colors.text, fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  pill: {
    color: colors.textMuted,
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: 6,
    paddingVertical: 1,
    overflow: "hidden",
  },
  priceRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  pricePrefix: { color: colors.textMuted, fontFamily: fonts.bodyBold, fontSize: 14 },
  priceInput: { flex: 1 },
  price: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: 14 },
  payments: { gap: spacing.sm, paddingTop: spacing.sm },
  paymentsCopy: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  help: { color: colors.text, fontFamily: fonts.body, fontSize: 13, lineHeight: 18, marginTop: 4 },
});

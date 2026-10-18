import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import {
  DEFAULT_URUGUAY_CITY,
  DEFAULT_VENUE_COUNTRY,
  DISPLAY_ADDRESS_HINT,
  ENABLED_VENUE_COUNTRIES,
  MAX_PHOTO_UPLOAD_BYTES,
  VENUE_TYPE_LABELS,
  VENUE_TYPES,
  venueCoverSrc,
  type AppCity,
  type Venue,
  type VenueType,
} from "@nocta/shared";
import { LocationPickerMap, type MapCoords } from "../components/LocationPickerMap";
import { NoctaImage } from "../components/NoctaImage";
import { NoctaLoading } from "../components/NoctaLoading";
import { useToast } from "../components/ToastProvider";
import { Screen } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { appendLocalFile } from "../lib/localFile";
import { colors, fonts, radii, spacing } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "VenueEdit">;
type Picker = "type" | "country" | "city" | null;

type LocalImage = {
  uri: string;
  name: string;
  mimeType: string;
};

const PHOTO_LIMIT_MB = Math.round(MAX_PHOTO_UPLOAD_BYTES / (1024 * 1024));

function mimeFromAsset(mimeType?: string | null, fileName?: string | null) {
  const mime = mimeType?.toLowerCase() ?? "";
  if (mime === "image/jpg" || mime === "image/jpeg") return "image/jpeg";
  if (mime === "image/png" || mime === "image/webp") return mime;
  const name = (fileName ?? "").toLowerCase();
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  return "";
}

function imageSize(uri: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });
}

export function VenueEditScreen({ navigation, route }: Props) {
  const { venueId } = route.params;
  const toast = useToast();
  const [venue, setVenue] = useState<Venue | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [geoBusy, setGeoBusy] = useState(false);
  const [error, setError] = useState("");
  const [picker, setPicker] = useState<Picker>(null);

  const [name, setName] = useState("");
  const [type, setType] = useState<VenueType>("boliche");
  const [country, setCountry] = useState<string>(DEFAULT_VENUE_COUNTRY);
  const [city, setCity] = useState<string>(DEFAULT_URUGUAY_CITY.label);
  const [cities, setCities] = useState<AppCity[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(true);
  const [location, setLocation] = useState<MapCoords | null>(null);
  const [geocodedAddress, setGeocodedAddress] = useState("");
  const [displayAddress, setDisplayAddress] = useState("");
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<LocalImage | null>(null);

  useEffect(() => {
    let alive = true;
    void api<{ venue: Venue }>(`/api/venues/${venueId}/manage`)
      .then(({ venue: loaded }) => {
        if (!alive) return;
        setVenue(loaded);
        setName(loaded.name);
        setType(loaded.type);
        setCountry(loaded.country || DEFAULT_VENUE_COUNTRY);
        setCity(loaded.city || DEFAULT_URUGUAY_CITY.label);
        setLocation(loaded.location ?? null);
        setGeocodedAddress(loaded.address);
        setDisplayAddress(loaded.address);
        setDescription(loaded.description ?? "");
      })
      .catch((caught) => {
        if (!alive) return;
        const message =
          caught instanceof ApiError
            ? caught.message
            : "No se pudo cargar el Espacio";
        setError(message);
        if (caught instanceof ApiError && caught.status === 403) {
          toast.error("No tenés permiso para editar este Espacio");
          navigation.goBack();
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [navigation, toast, venueId]);

  useEffect(() => {
    let alive = true;
    setCitiesLoading(true);
    void api<{ cities: AppCity[] }>(
      `/api/cities?country=${encodeURIComponent(country)}&active=true`
    )
      .then((res) => {
        if (!alive) return;
        const next = res.cities ?? [];
        const preserve =
          venue && country === (venue.country || DEFAULT_VENUE_COUNTRY)
            ? venue.city
            : "";
        const options =
          preserve &&
          !next.some((item) => item.name.toLowerCase() === preserve.toLowerCase())
            ? [
                ...next,
                {
                  id: `preserved:${preserve}`,
                  country,
                  name: preserve,
                  lat: 0,
                  lng: 0,
                  active: false,
                } satisfies AppCity,
              ]
            : next;
        setCities(options);
        setCity((current) => {
          const match = options.some(
            (item) => item.name.toLowerCase() === current.toLowerCase()
          );
          return match ? current : options[0]?.name ?? current;
        });
      })
      .catch(() => {
        if (alive) setCities([]);
      })
      .finally(() => {
        if (alive) setCitiesLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [country, venue]);

  const cityCenter = useMemo(() => {
    const found = cities.find(
      (candidate) => candidate.name.toLowerCase() === city.toLowerCase()
    );
    if (found && found.lat !== 0 && found.lng !== 0) {
      return { lat: found.lat, lng: found.lng };
    }
    if (location) return location;
    return { lat: DEFAULT_URUGUAY_CITY.lat, lng: DEFAULT_URUGUAY_CITY.lng };
  }, [cities, city, location]);

  async function reverseFromPin(coords: MapCoords) {
    setLocation(coords);
    setGeoBusy(true);
    setError("");
    try {
      const data = await api<{ address: string }>(
        `/api/venues/geocode/reverse?lat=${coords.lat}&lng=${coords.lng}`
      );
      setGeocodedAddress(data.address);
      if (!displayAddress.trim()) setDisplayAddress(data.address);
    } catch (caught) {
      setGeocodedAddress("");
      setError(
        caught instanceof ApiError
          ? caught.message
          : "No se pudo obtener la dirección del mapa"
      );
    } finally {
      setGeoBusy(false);
    }
  }

  function changeCountry(next: string) {
    setCountry(next);
    setLocation(null);
    setGeocodedAddress("");
  }

  function changeCity(next: string) {
    setCity(next);
    setLocation(null);
    setGeocodedAddress("");
  }

  async function changePhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.9,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const mimeType = mimeFromAsset(asset.mimeType, asset.fileName);
    if (!mimeType) {
      setError("Usá JPEG, PNG o WebP");
      return;
    }
    if (asset.fileSize && asset.fileSize > MAX_PHOTO_UPLOAD_BYTES) {
      setError(`La imagen supera los ${PHOTO_LIMIT_MB} MB`);
      return;
    }
    try {
      const size = await imageSize(asset.uri);
      if (size.width < 32 || size.height < 32) {
        setError("La imagen es demasiado pequeña");
        return;
      }
    } catch {
      setError("No se pudo leer la imagen");
      return;
    }
    setPhoto({
      uri: asset.uri,
      name: asset.fileName || "portada.jpg",
      mimeType,
    });
    setError("");
  }

  async function submit() {
    if (!location) {
      setError("Marcá la ubicación del Espacio en el mapa");
      return;
    }
    if (name.trim().length < 2) {
      setError("Completá el nombre del Espacio");
      return;
    }
    if (displayAddress.trim().length < 5) {
      setError("Completá la dirección para mostrar");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("name", name.trim());
      form.append("type", type);
      form.append("country", country);
      form.append("city", city);
      form.append("address", displayAddress.trim());
      form.append("description", description.trim());
      form.append("location", JSON.stringify(location));
      if (photo) await appendLocalFile(form, "photo", photo);
      await api<{ venue: Venue }>(`/api/venues/${venueId}/manage`, {
        method: "PATCH",
        body: form,
      });
      toast.success("Información del Espacio actualizada");
      navigation.goBack();
    } catch (caught) {
      const message =
        caught instanceof ApiError
          ? caught.message
          : "No se pudo actualizar el Espacio";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  const pickerOptions =
    picker === "type"
      ? VENUE_TYPES.map((value) => ({ id: value, label: VENUE_TYPE_LABELS[value] }))
      : picker === "country"
        ? ENABLED_VENUE_COUNTRIES.map((value) => ({ id: value, label: value }))
        : picker === "city"
          ? cities.map((item) => ({ id: item.name, label: item.name }))
          : [];

  if (loading) {
    return (
      <Screen safeTop={false}>
        <NoctaLoading />
      </Screen>
    );
  }

  if (!venue) {
    return (
      <Screen safeTop={false} style={styles.screen}>
        <Text style={styles.error}>{error || "Espacio no encontrado"}</Text>
        <Pressable style={styles.outlineBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.outlineBtnText}>Volver al perfil</Text>
        </Pressable>
      </Screen>
    );
  }

  return (
    <Screen safeTop={false} style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scroll}
      >
        <Pressable onPress={() => navigation.goBack()} style={styles.backLink}>
          <Text style={styles.backLinkText}>← Administrar Espacio</Text>
        </Pressable>
        <Text style={styles.title}>Editar información</Text>
        <Text style={styles.lead}>
          Actualizá los datos que se muestran en la ficha pública del Espacio.
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Section title="Datos del Espacio">
          <Field label="Nombre">
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              maxLength={120}
            />
          </Field>
          <SelectRow
            label="Tipo"
            value={VENUE_TYPE_LABELS[type]}
            onPress={() => setPicker("type")}
          />
          <SelectRow label="País" value={country} onPress={() => setPicker("country")} />
          <SelectRow label="Ciudad" value={city} onPress={() => setPicker("city")} />
        </Section>

        <Section
          title="Ubicación"
          copy="Si cambiás el país o la ciudad, volvé a marcar el punto en el mapa."
        >
          <LocationPickerMap
            center={cityCenter}
            value={location}
            onPick={(coords) => void reverseFromPin(coords)}
          />
          <Field label="Dirección detectada">
            <TextInput
              style={[styles.input, styles.inputDisabled]}
              editable={false}
              value={
                geoBusy
                  ? "Buscando dirección…"
                  : geocodedAddress || "Tocá el mapa para detectar la dirección"
              }
            />
          </Field>
          <Field label="Dirección para mostrar">
            <TextInput
              style={styles.input}
              value={displayAddress}
              onChangeText={setDisplayAddress}
              maxLength={200}
            />
            <Text style={styles.hint}>{DISPLAY_ADDRESS_HINT}</Text>
          </Field>
          <Field label="Portada">
            <NoctaImage
              src={photo?.uri ?? venueCoverSrc(venue)}
              style={styles.cover}
              contentFit="cover"
            />
            <View style={styles.photoActions}>
              <Pressable style={styles.outlineBtn} onPress={() => void changePhoto()}>
                <Text style={styles.outlineBtnText}>
                  {photo ? "Cambiar portada" : "Reemplazar portada"}
                </Text>
              </Pressable>
              {photo ? (
                <Pressable style={styles.outlineBtn} onPress={() => setPhoto(null)}>
                  <Text style={styles.outlineBtnText}>Quitar</Text>
                </Pressable>
              ) : null}
            </View>
          </Field>
        </Section>

        <Section title="Más detalles">
          <Field label="Descripción (opcional)">
            <TextInput
              style={[styles.input, styles.area]}
              value={description}
              onChangeText={setDescription}
              placeholder="Ambientación, música, horarios, cómo se vive la noche…"
              placeholderTextColor={colors.textFaint}
              maxLength={1000}
              multiline
              textAlignVertical="top"
            />
          </Field>
        </Section>

        <Pressable
          style={[styles.primaryBtn, (busy || geoBusy || citiesLoading) && styles.disabled]}
          disabled={busy || geoBusy || citiesLoading}
          onPress={() => void submit()}
        >
          <Text style={styles.primaryBtnText}>
            {busy ? "Guardando…" : "Guardar cambios"}
          </Text>
        </Pressable>
        <Pressable style={styles.outlineBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.outlineBtnText}>Cancelar</Text>
        </Pressable>
      </ScrollView>

      <Modal
        visible={picker != null}
        transparent
        animationType="fade"
        onRequestClose={() => setPicker(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setPicker(null)}>
          <View style={styles.modalCard}>
            <ScrollView>
              {pickerOptions.map((option) => (
                <Pressable
                  key={option.id}
                  style={styles.modalOption}
                  onPress={() => {
                    if (picker === "type") setType(option.id as VenueType);
                    if (picker === "country") changeCountry(option.id);
                    if (picker === "city") changeCity(option.id);
                    setPicker(null);
                  }}
                >
                  <Text style={styles.modalOptionText}>{option.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </Screen>
  );
}

function Section({
  title,
  copy,
  children,
}: {
  title: string;
  copy?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {copy ? <Text style={styles.lead}>{copy}</Text> : null}
      {children}
    </View>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function SelectRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <Field label={label}>
      <Pressable style={styles.select} onPress={onPress}>
        <Text style={styles.selectValue}>{value}</Text>
        <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
      </Pressable>
    </Field>
  );
}

const styles = StyleSheet.create({
  screen: { paddingTop: spacing.sm },
  scroll: { paddingBottom: spacing.xl, gap: spacing.md },
  backLink: { alignSelf: "flex-start" },
  backLinkText: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 14 },
  title: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 28,
    letterSpacing: -0.4,
  },
  lead: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  error: { color: colors.danger, fontFamily: fonts.body, fontSize: 14 },
  section: { gap: spacing.sm },
  sectionTitle: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 20,
    letterSpacing: -0.3,
  },
  field: { gap: 6 },
  fieldLabel: { color: colors.textMuted, fontFamily: fonts.bodySemiBold, fontSize: 13 },
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
  inputDisabled: { color: colors.textMuted },
  area: { minHeight: 110 },
  hint: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 12, lineHeight: 17 },
  select: {
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.elevated,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  selectValue: { flex: 1, color: colors.text, fontFamily: fonts.body, fontSize: 16 },
  cover: { width: "100%", height: 180, borderRadius: radii.md },
  photoActions: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  primaryBtn: {
    minHeight: 48,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: { color: colors.onPrimary, fontFamily: fonts.bodyBold, fontSize: 16 },
  outlineBtn: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  outlineBtnText: { color: colors.text, fontFamily: fonts.bodySemiBold, fontSize: 15 },
  disabled: { opacity: 0.5 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "flex-end",
    padding: spacing.md,
  },
  modalCard: {
    maxHeight: "70%",
    backgroundColor: colors.panel,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  modalOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  modalOptionText: { color: colors.text, fontFamily: fonts.body, fontSize: 16 },
});

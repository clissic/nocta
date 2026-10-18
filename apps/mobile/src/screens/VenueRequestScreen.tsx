import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
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
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { prepareUploadUri } from "../lib/localFile";
import {
  DEFAULT_URUGUAY_CITY,
  DEFAULT_VENUE_COUNTRY,
  DISPLAY_ADDRESS_HINT,
  ENABLED_VENUE_COUNTRIES,
  MAX_VENUE_CLAIM_FILE_BYTES,
  MAX_VENUE_CLAIM_FILES,
  VENUE_CLAIM_FILE_EXTENSIONS,
  VENUE_CLAIM_FILE_MIME_TYPES,
  VENUE_PHOTO_FALLBACK,
  VENUE_TYPE_LABELS,
  VENUE_TYPES,
  venueCoverSrc,
  type AppCity,
  type Venue,
  type VenueRequest,
  type VenueType,
} from "@nocta/shared";
import { LocationPickerMap, type MapCoords } from "../components/LocationPickerMap";
import { NoctaImage } from "../components/NoctaImage";
import { NoctaLoading } from "../components/NoctaLoading";
import { useToast } from "../components/ToastProvider";
import { Screen } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { colors, fonts, radii, spacing } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "VenueRequest">;
type Tab = "create" | "claim";
type Picker = "type" | "country" | "city" | null;

type EvidenceFile = {
  uri: string;
  name: string;
  mimeType: string;
  size: number;
};

const STATUS_LABEL: Record<VenueRequest["status"], string> = {
  pending: "Pendiente",
  approved: "Aprobada",
  rejected: "Rechazada",
};

function mimeFromName(name: string, given?: string | null) {
  const normalized = given?.toLowerCase() ?? "";
  if (
    (VENUE_CLAIM_FILE_MIME_TYPES as readonly string[]).includes(normalized)
  ) {
    return normalized;
  }
  const ext = name.slice(name.lastIndexOf(".")).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  return "";
}

function validateEvidence(files: EvidenceFile[]) {
  if (files.length < 1 || files.length > MAX_VENUE_CLAIM_FILES) {
    return `Subí entre 1 y ${MAX_VENUE_CLAIM_FILES} comprobantes`;
  }
  for (const file of files) {
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    const mimeOk = (VENUE_CLAIM_FILE_MIME_TYPES as readonly string[]).includes(
      file.mimeType
    );
    const extOk = (VENUE_CLAIM_FILE_EXTENSIONS as readonly string[]).includes(ext);
    if (!mimeOk || !extOk) {
      return "Los comprobantes deben ser PDF, JPG, PNG o WebP";
    }
    if (file.size > MAX_VENUE_CLAIM_FILE_BYTES) {
      return `Cada comprobante puede pesar hasta ${Math.round(
        MAX_VENUE_CLAIM_FILE_BYTES / (1024 * 1024)
      )} MB`;
    }
  }
  return null;
}

function fileUri(uri: string, name: string) {
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".") + 1) : "jpg";
  return prepareUploadUri(uri, ext);
}

async function appendEvidence(form: FormData, files: EvidenceFile[]) {
  for (const file of files) {
    const uri = await fileUri(file.uri, file.name);
    form.append("evidenceFiles", {
      uri,
      name: file.name,
      type: file.mimeType,
    } as unknown as Blob);
  }
}

export function VenueRequestScreen({ navigation }: Props) {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("create");
  const [mine, setMine] = useState<VenueRequest[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [geoBusy, setGeoBusy] = useState(false);
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
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [wantsToManage, setWantsToManage] = useState(false);
  const [managementMessage, setManagementMessage] = useState("");
  const [evidenceFiles, setEvidenceFiles] = useState<EvidenceFile[]>([]);

  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [claimVenues, setClaimVenues] = useState<Venue[]>([]);
  const [claimLoading, setClaimLoading] = useState(false);
  const [selected, setSelected] = useState<Venue | null>(null);
  const [claimMessage, setClaimMessage] = useState("");
  const [claimFiles, setClaimFiles] = useState<EvidenceFile[]>([]);

  const forwardAbortRef = useRef<AbortController | null>(null);
  const forwardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const automaticDisplayAddressRef = useRef("");

  const cityCenter = useMemo(() => {
    const found = cities.find(
      (candidate) => candidate.name.toLowerCase() === city.toLowerCase()
    );
    return found
      ? { lat: found.lat, lng: found.lng }
      : { lat: DEFAULT_URUGUAY_CITY.lat, lng: DEFAULT_URUGUAY_CITY.lng };
  }, [cities, city]);

  async function loadMine() {
    const data = await api<{ requests: VenueRequest[] }>("/api/venues/requests/mine");
    setMine(data.requests);
  }

  useEffect(() => {
    void loadMine().catch(() => setMine([]));
  }, []);

  useEffect(() => {
    let alive = true;
    setCitiesLoading(true);
    void api<{ cities: AppCity[] }>(
      `/api/cities?country=${encodeURIComponent(country)}&active=true`
    )
      .then((res) => {
        if (!alive) return;
        const next = res.cities ?? [];
        setCities(next);
        setCity((current) => {
          const match = next.some(
            (item) => item.name.toLowerCase() === current.toLowerCase()
          );
          return match ? current : next[0]?.name ?? current;
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
  }, [country]);

  useEffect(() => {
    setLocation(null);
    setGeocodedAddress("");
  }, [country, city]);

  useEffect(() => {
    const address = displayAddress.trim();
    if (tab !== "create" || address.length < 5 || address === automaticDisplayAddressRef.current) {
      if (address === automaticDisplayAddressRef.current) {
        automaticDisplayAddressRef.current = "";
      }
      return;
    }
    let controller: AbortController | null = null;
    const timer = setTimeout(() => {
      forwardTimerRef.current = null;
      controller = new AbortController();
      forwardAbortRef.current = controller;
      setGeoBusy(true);
      setError("");
      const params = new URLSearchParams({ address, city, country });
      void api<{ address: string; location: MapCoords }>(
        `/api/venues/geocode/search?${params}`,
        { signal: controller.signal }
      )
        .then((data) => {
          if (controller?.signal.aborted) return;
          setLocation(data.location);
          setGeocodedAddress(data.address);
        })
        .catch((err) => {
          if (controller?.signal.aborted) return;
          setLocation(null);
          setGeocodedAddress("");
          setError(
            err instanceof ApiError
              ? err.message
              : "No se pudo buscar la dirección en el mapa"
          );
        })
        .finally(() => {
          if (!controller?.signal.aborted) setGeoBusy(false);
        });
    }, 3000);
    forwardTimerRef.current = timer;
    return () => {
      clearTimeout(timer);
      controller?.abort();
    };
  }, [tab, city, country, displayAddress]);

  useEffect(() => {
    if (tab !== "claim") return;
    const controller = new AbortController();
    setClaimLoading(true);
    void api<{ venues: Venue[] }>(
      `/api/venues/claimable?q=${encodeURIComponent(submittedQuery)}&limit=20`,
      { signal: controller.signal }
    )
      .then((res) => setClaimVenues(res.venues ?? []))
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(
          err instanceof ApiError ? err.message : "No se pudieron cargar los Espacios"
        );
      })
      .finally(() => setClaimLoading(false));
    return () => controller.abort();
  }, [tab, submittedQuery]);

  async function reverseFromPin(coords: MapCoords) {
    if (forwardTimerRef.current) {
      clearTimeout(forwardTimerRef.current);
      forwardTimerRef.current = null;
    }
    forwardAbortRef.current?.abort();
    forwardAbortRef.current = null;
    setLocation(coords);
    setGeoBusy(true);
    setError("");
    try {
      const data = await api<{ address: string }>(
        `/api/venues/geocode/reverse?lat=${coords.lat}&lng=${coords.lng}`
      );
      setGeocodedAddress(data.address);
      if (!displayAddress.trim()) {
        automaticDisplayAddressRef.current = data.address;
        setDisplayAddress(data.address);
      }
    } catch (err) {
      setGeocodedAddress("");
      setError(
        err instanceof ApiError
          ? err.message
          : "No se pudo obtener la dirección del mapa"
      );
    } finally {
      setGeoBusy(false);
    }
  }

  async function pickEvidence(current: EvidenceFile[], onChange: (files: EvidenceFile[]) => void) {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const next = [...current];
    for (const asset of result.assets) {
      const fileName = asset.name || "comprobante";
      const mimeType = mimeFromName(fileName, asset.mimeType);
      let size = asset.size ?? 0;
      if (!size) {
        const info = await FileSystem.getInfoAsync(asset.uri);
        if (info.exists && typeof info.size === "number") size = info.size;
      }
      const candidate: EvidenceFile = {
        uri: asset.uri,
        name: fileName,
        mimeType,
        size,
      };
      const duplicate = next.some(
        (file) => file.name === candidate.name && file.size === candidate.size
      );
      if (!duplicate) next.push(candidate);
    }
    if (next.length > MAX_VENUE_CLAIM_FILES) {
      setError(`Podés subir hasta ${MAX_VENUE_CLAIM_FILES} comprobantes`);
      return;
    }
    const validation = validateEvidence(next);
    if (validation) {
      setError(validation);
      return;
    }
    onChange(next);
    setError("");
  }

  function resetCreate() {
    setName("");
    setType("boliche");
    setCountry(DEFAULT_VENUE_COUNTRY);
    setCity(DEFAULT_URUGUAY_CITY.label);
    setLocation(null);
    setGeocodedAddress("");
    setDisplayAddress("");
    setDescription("");
    setContactEmail("");
    setContactPhone("");
    setWantsToManage(false);
    setManagementMessage("");
    setEvidenceFiles([]);
  }

  async function submitCreate() {
    setError("");
    if (!name.trim() || name.trim().length < 2) {
      setError("Completá el nombre del Espacio");
      return;
    }
    if (!location || !geocodedAddress.trim()) {
      setError("Marcá la ubicación del espacio en el mapa");
      return;
    }
    if (displayAddress.trim().length < 5) {
      setError("Completá la dirección para mostrar");
      return;
    }
    if (wantsToManage) {
      const evidenceError = validateEvidence(evidenceFiles);
      if (evidenceError) {
        setError(evidenceError);
        return;
      }
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.append("name", name.trim());
      form.append("type", type);
      form.append("country", country);
      form.append("city", city);
      form.append("address", displayAddress.trim());
      form.append("geocodedAddress", geocodedAddress.trim());
      form.append("location", JSON.stringify(location));
      if (description.trim()) form.append("description", description.trim());
      if (contactEmail.trim()) form.append("contactEmail", contactEmail.trim());
      if (contactPhone.trim()) form.append("contactPhone", contactPhone.trim());
      form.append("wantsToManage", String(wantsToManage));
      if (wantsToManage && managementMessage.trim()) {
        form.append("managementMessage", managementMessage.trim());
      }
      if (wantsToManage) await appendEvidence(form, evidenceFiles);
      await api("/api/venues/requests", { method: "POST", body: form });
      resetCreate();
      toast.success(
        "¡Listo! Recibimos tu solicitud. Te avisamos cuando revisemos el espacio."
      );
      navigation.goBack();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo enviar la solicitud"
      );
    } finally {
      setBusy(false);
    }
  }

  async function submitClaim() {
    setError("");
    if (!selected) {
      setError("Elegí el Espacio que querés administrar");
      return;
    }
    const validationError = validateEvidence(claimFiles);
    if (validationError) {
      setError(validationError);
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.append("venueId", selected.id);
      if (claimMessage.trim()) form.append("message", claimMessage.trim());
      await appendEvidence(form, claimFiles);
      await api("/api/venues/claims", { method: "POST", body: form });
      setSelected(null);
      setClaimMessage("");
      setClaimFiles([]);
      toast.success("Recibimos tu reclamación. Te avisaremos cuando la revisemos.");
      await loadMine();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo enviar la reclamación"
      );
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
        <View style={styles.tabs}>
          <TabButton
            label="Registrar espacio"
            active={tab === "create"}
            onPress={() => {
              setTab("create");
              setError("");
            }}
          />
          <TabButton
            label="Reclamar espacio"
            active={tab === "claim"}
            onPress={() => {
              setTab("claim");
              setError("");
            }}
          />
        </View>
        <Text style={styles.lead}>
          {tab === "create"
            ? "Contanos qué Espacio falta y marcá dónde está en el mapa. La portada la carga el equipo de Nocta al publicar. También podés solicitar ser su Organizador."
            : "Elegí un Espacio existente y acreditá que estás habilitado para administrarlo. El equipo de Nocta revisará la documentación."}
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {tab === "create" ? (
          <View style={styles.form}>
            <Section title="Datos del espacio">
              <Field label="Nombre">
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Ej. Club Nocta"
                  placeholderTextColor={colors.textFaint}
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
              copy="Elegí la ciudad y tocá el mapa donde está tu espacio."
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
                  onChangeText={(value) => {
                    automaticDisplayAddressRef.current = "";
                    setDisplayAddress(value);
                    setGeocodedAddress("");
                    setLocation(null);
                  }}
                  placeholder="Av. 18 de Julio 1234, esquina Ejido"
                  placeholderTextColor={colors.textFaint}
                  maxLength={200}
                />
                <Text style={styles.hint}>{DISPLAY_ADDRESS_HINT}</Text>
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

            <Section
              title="Contacto (solo para Nocta)"
              copy="Opcional. No se muestra en el perfil público del Espacio; solo lo usa el equipo para coordinar la publicación."
            >
              <Field label="Email">
                <TextInput
                  style={styles.input}
                  value={contactEmail}
                  onChangeText={setContactEmail}
                  placeholder="hola@tuespacio.com"
                  placeholderTextColor={colors.textFaint}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </Field>
              <Field label="Teléfono">
                <TextInput
                  style={styles.input}
                  value={contactPhone}
                  onChangeText={setContactPhone}
                  placeholder="+598 99 123 456"
                  placeholderTextColor={colors.textFaint}
                  keyboardType="phone-pad"
                  maxLength={40}
                />
              </Field>
            </Section>

            <Section
              title="Administración"
              copy="¿Querés ser Organizador de este Espacio en Nocta?"
            >
              <Choice
                selected={!wantsToManage}
                title="No, solo sugerirlo"
                body="El Espacio quedará disponible sin Organizador."
                onPress={() => setWantsToManage(false)}
              />
              <Choice
                selected={wantsToManage}
                title="Sí, quiero administrarlo"
                body="Deberás acreditar tu vínculo con el Espacio."
                onPress={() => setWantsToManage(true)}
              />
              {wantsToManage ? (
                <EvidenceBlock
                  message={managementMessage}
                  onMessageChange={setManagementMessage}
                  files={evidenceFiles}
                  onAdd={() => void pickEvidence(evidenceFiles, setEvidenceFiles)}
                  onRemove={(index) =>
                    setEvidenceFiles((prev) => prev.filter((_, i) => i !== index))
                  }
                />
              ) : null}
            </Section>

            <Pressable
              style={[
                styles.primaryBtn,
                (busy || geoBusy || citiesLoading) && styles.disabled,
              ]}
              disabled={busy || geoBusy || citiesLoading}
              onPress={() => void submitCreate()}
            >
              <Text style={styles.primaryBtnText}>
                {busy ? "Enviando…" : "Enviar solicitud"}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.form}>
            <Section
              title="Elegí el Espacio"
              copy="Solo aparecen Espacios que todavía no tienen Organizador en Nocta."
            >
              <Field label="Buscar por nombre o dirección">
                <View style={styles.searchRow}>
                  <TextInput
                    style={[styles.input, styles.searchInput]}
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Ej. Zoba Club"
                    placeholderTextColor={colors.textFaint}
                    onSubmitEditing={() => setSubmittedQuery(query.trim())}
                    returnKeyType="search"
                  />
                  <Pressable
                    style={styles.searchBtn}
                    onPress={() => setSubmittedQuery(query.trim())}
                  >
                    <Text style={styles.searchBtnText}>Buscar</Text>
                  </Pressable>
                </View>
              </Field>
              {claimLoading ? (
                <NoctaLoading variant="block" />
              ) : claimVenues.length === 0 ? (
                <Text style={styles.muted}>No encontramos Espacios disponibles.</Text>
              ) : (
                claimVenues.map((venue) => {
                  const active = selected?.id === venue.id;
                  return (
                    <Pressable
                      key={venue.id}
                      style={[styles.venueOption, active && styles.venueOptionOn]}
                      onPress={() => setSelected(venue)}
                    >
                      <NoctaImage
                        src={venueCoverSrc(venue)}
                        fallbackSrc={VENUE_PHOTO_FALLBACK}
                        variant="thumb"
                        style={styles.venueThumb}
                        contentFit="cover"
                      />
                      <View style={styles.venueCopy}>
                        <Text style={styles.venueName} numberOfLines={1}>
                          {venue.name}
                        </Text>
                        <Text style={styles.muted} numberOfLines={1}>
                          {venue.address} · {venue.city}
                        </Text>
                      </View>
                      <Ionicons
                        name={active ? "checkmark-circle" : "ellipse-outline"}
                        size={20}
                        color={active ? colors.primary : colors.textMuted}
                      />
                    </Pressable>
                  );
                })
              )}
            </Section>
            <Section
              title="Acreditación"
              copy="Adjuntá documentación que demuestre que sos responsable o estás habilitado para administrar el Espacio. Los archivos son privados y solo puede verlos el equipo de Nocta."
            >
              <EvidenceBlock
                message={claimMessage}
                onMessageChange={setClaimMessage}
                files={claimFiles}
                onAdd={() => void pickEvidence(claimFiles, setClaimFiles)}
                onRemove={(index) =>
                  setClaimFiles((prev) => prev.filter((_, i) => i !== index))
                }
              />
            </Section>
            <Pressable
              style={[styles.primaryBtn, (busy || claimLoading) && styles.disabled]}
              disabled={busy || claimLoading}
              onPress={() => void submitClaim()}
            >
              <Text style={styles.primaryBtnText}>
                {busy ? "Enviando…" : "Enviar reclamación"}
              </Text>
            </Pressable>
          </View>
        )}

        <Section title="Mis solicitudes">
          {mine.length === 0 ? (
            <Text style={styles.muted}>Todavía no enviaste ninguna.</Text>
          ) : (
            mine.map((item) => (
              <View key={item.id} style={styles.mineItem}>
                <View style={styles.venueCopy}>
                  <Text style={styles.venueName}>{item.name}</Text>
                  <Text style={styles.muted}>
                    {item.requestType === "claim"
                      ? "Reclamación"
                      : item.wantsToManage
                        ? "Alta con administración"
                        : "Sugerencia"}
                    {" · "}
                    {VENUE_TYPE_LABELS[item.type]} · {STATUS_LABEL[item.status]} ·{" "}
                    {item.country}, {item.city}
                  </Text>
                  {item.adminNote ? (
                    <Text style={styles.note}>Nota: {item.adminNote}</Text>
                  ) : null}
                </View>
                {item.photos[0] ? (
                  <NoctaImage
                    src={item.photos[0]}
                    variant="thumb"
                    style={styles.venueThumb}
                    contentFit="cover"
                  />
                ) : null}
              </View>
            ))
          )}
        </Section>
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
                    if (picker === "country") setCountry(option.id);
                    if (picker === "city") setCity(option.id);
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

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.tab, active && styles.tabOn]}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.tabText, active && styles.tabTextOn]}>{label}</Text>
    </Pressable>
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
      {copy ? <Text style={styles.muted}>{copy}</Text> : null}
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

function Choice({
  selected,
  title,
  body,
  onPress,
}: {
  selected: boolean;
  title: string;
  body: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.choice, selected && styles.choiceOn]}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      <Ionicons
        name={selected ? "checkmark-circle" : "ellipse-outline"}
        size={20}
        color={selected ? colors.primary : colors.textMuted}
      />
      <View style={styles.venueCopy}>
        <Text style={styles.venueName}>{title}</Text>
        <Text style={styles.muted}>{body}</Text>
      </View>
    </Pressable>
  );
}

function EvidenceBlock({
  message,
  onMessageChange,
  files,
  onAdd,
  onRemove,
}: {
  message: string;
  onMessageChange: (value: string) => void;
  files: EvidenceFile[];
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  return (
    <View style={styles.evidence}>
      <Field label="Información adicional (opcional)">
        <TextInput
          style={[styles.input, styles.area]}
          value={message}
          onChangeText={onMessageChange}
          placeholder="Contanos cuál es tu vínculo con el Espacio…"
          placeholderTextColor={colors.textFaint}
          maxLength={1000}
          multiline
          textAlignVertical="top"
        />
      </Field>
      <View style={styles.evidenceHead}>
        <Text style={styles.fieldLabel}>Comprobantes</Text>
        <Text style={styles.muted}>
          {files.length} / {MAX_VENUE_CLAIM_FILES}
        </Text>
      </View>
      {files.map((file, index) => (
        <View key={`${file.name}-${file.size}-${index}`} style={styles.fileRow}>
          <Ionicons
            name={file.mimeType === "application/pdf" ? "document-text-outline" : "image-outline"}
            size={18}
            color={colors.primary}
          />
          <Text style={styles.fileName} numberOfLines={1}>
            {file.name}
          </Text>
          <Pressable onPress={() => onRemove(index)} accessibilityLabel={`Quitar ${file.name}`}>
            <Ionicons name="close" size={18} color={colors.textMuted} />
          </Pressable>
        </View>
      ))}
      <Pressable style={styles.outlineBtn} onPress={onAdd}>
        <Text style={styles.outlineBtnText}>Agregar comprobante</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { paddingTop: spacing.sm },
  scroll: { paddingBottom: spacing.xl, gap: spacing.md },
  backLink: { alignSelf: "flex-start" },
  backLinkText: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  tabs: { flexDirection: "row", gap: spacing.sm },
  tab: {
    flex: 1,
    minHeight: 40,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  tabOn: {
    backgroundColor: colors.primaryDim,
    borderColor: "rgba(214,255,75,0.55)",
  },
  tabText: {
    color: colors.textMuted,
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    textAlign: "center",
  },
  tabTextOn: { color: colors.primary },
  lead: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
  },
  error: {
    color: colors.danger,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  form: { gap: spacing.lg },
  section: { gap: spacing.sm },
  sectionTitle: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 20,
    letterSpacing: -0.3,
  },
  field: { gap: 6 },
  fieldLabel: {
    color: colors.textMuted,
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
  },
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
  hint: {
    color: colors.textFaint,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
  },
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
  selectValue: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 16,
  },
  choice: {
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  choiceOn: {
    borderColor: "rgba(214,255,75,0.55)",
    backgroundColor: colors.primaryDim,
  },
  evidence: { gap: spacing.sm },
  evidenceHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 6,
  },
  fileName: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  primaryBtn: {
    minHeight: 48,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: colors.onPrimary,
    fontFamily: fonts.bodyBold,
    fontSize: 16,
  },
  outlineBtn: {
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  outlineBtnText: {
    color: colors.text,
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
  },
  disabled: { opacity: 0.5 },
  muted: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
  },
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
  searchBtnText: {
    color: colors.onPrimary,
    fontFamily: fonts.bodyBold,
    fontSize: 14,
  },
  venueOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  venueOptionOn: {
    borderColor: "rgba(214,255,75,0.55)",
    backgroundColor: colors.primaryDim,
  },
  venueThumb: { width: 48, height: 48, borderRadius: 10 },
  venueCopy: { flex: 1, gap: 2 },
  venueName: {
    color: colors.text,
    fontFamily: fonts.bodyBold,
    fontSize: 15,
  },
  mineItem: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  note: {
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 13,
    marginTop: 4,
  },
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
  modalOptionText: {
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 16,
  },
});

import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Defs, Ellipse, RadialGradient, Stop } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  DRINKING,
  DRINKING_LABELS,
  EDUCATION_LEVELS,
  EDUCATION_LEVEL_LABELS,
  FITNESS,
  FITNESS_LABELS,
  GENDERS,
  GENDER_LABELS,
  INTEREST_CATEGORIES,
  INTEREST_LABELS,
  LANGUAGES,
  LANGUAGE_LABELS,
  LOOKING_FOR,
  LOOKING_FOR_LABELS,
  MAX_AGE,
  MAX_PHOTO_UPLOAD_BYTES,
  MAX_PHOTOS,
  MIN_AGE,
  MIN_PHOTOS,
  PETS,
  PETS_LABELS,
  PREMIUM_PLANS,
  premiumDashboardFeatureItems,
  premiumFromPriceNote,
  premiumPeriodPriceUsd,
  PROFILE_COUNTRIES,
  SEXUAL_ORIENTATIONS,
  SEXUAL_ORIENTATION_LABELS,
  SOCIAL_NETWORKS,
  SOCIAL_NETWORK_LABELS,
  URUGUAY_CITIES,
  WORK_STATUS,
  WORK_STATUS_LABELS,
  ZODIAC_SIGNS,
  ZODIAC_LABELS,
  type AuthUser,
  type PremiumPlanId,
  type Drinking,
  type EducationLevel,
  type Fitness,
  type Gender,
  type Interest,
  type Language,
  type LookingFor,
  type Pets,
  type ProfileSocials,
  type SexualOrientation,
  type SocialNetwork,
  type WorkStatus,
  type ZodiacSign,
} from "@nocta/shared";
import { useAuth } from "../auth/AuthContext";
import { prepareUploadUri } from "../lib/localFile";
import { NoctaImage } from "../components/NoctaImage";
import { useToast } from "../components/ToastProvider";
import { DateField, Field } from "../components/ui";
import { api, ApiError, uploadProfilePhoto } from "../lib/api";
import { colors, fonts, radii, spacing } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/types";

const STEPS = [
  {
    title: "Sobre vos",
    subtitle: "Datos, identidad y dónde vivís",
    icon: "person-outline" as const,
  },
  {
    title: "Estilo de vida",
    subtitle: "Orientación, idiomas y más",
    icon: "heart-outline" as const,
  },
  {
    title: "Trabajo",
    subtitle: "Puesto, compañía y estudios",
    icon: "briefcase-outline" as const,
  },
  {
    title: "Qué buscás",
    subtitle: "Intención y gustos",
    icon: "sparkles-outline" as const,
  },
  {
    title: "Tus fotos",
    subtitle: "Elegí las fotos de tu perfil",
    icon: "images-outline" as const,
  },
  {
    title: "Planazos",
    subtitle: "Elegí un plan Premium o seguí gratis",
    icon: "diamond-outline" as const,
  },
] as const;

const PHOTOS_STEP = 4;
const PLANAZOS_STEP = 5;

const PLAN_LOOK: Record<
  string,
  {
    hour: string;
    accent: string;
    wash: string;
    border: string;
  }
> = {
  nocta_2am: {
    hour: "2 AM",
    accent: "#d6ff4b",
    wash: "#171b0c",
    border: "rgba(214,255,75,0.55)",
  },
  nocta_4am: {
    hour: "4 AM",
    accent: "#7ec4ff",
    wash: "#0e1620",
    border: "rgba(77,166,255,0.62)",
  },
  nocta_6am: {
    hour: "6 AM",
    accent: "#c4a0ff",
    wash: "#161222",
    border: "rgba(167,112,255,0.75)",
  },
};

const PLAN_CARD_GAP = 12;

const LOOKING_FOR_ICONS: Record<LookingFor, keyof typeof Ionicons.glyphMap> = {
  citas: "cafe-outline",
  relacion: "heart-outline",
  encuentros_casuales: "flash-outline",
  amigos: "people-outline",
  networking: "briefcase-outline",
};

type LocalPhoto = {
  id: string;
  uri: string;
  mimeType?: string;
  fileName?: string;
  /** URL ya persistida en el servidor (sin re-subir). */
  uploadedUrl?: string;
};

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function emptySocials(): ProfileSocials {
  return {};
}

function ageFrom(value: string) {
  const birth = new Date(value);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const month = today.getMonth() - birth.getMonth();
  if (month < 0 || (month === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function dateForAge(age: number) {
  const date = new Date();
  date.setFullYear(date.getFullYear() - age);
  return date.toISOString().slice(0, 10);
}

function maxBirthDate(minAge: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setFullYear(date.getFullYear() - minAge);
  return date;
}

const MIN_BIRTH_DATE = new Date(
  new Date().getFullYear() - MAX_AGE,
  0,
  1
);
const MAX_BIRTH_DATE = maxBirthDate(MIN_AGE);

function guessMime(uri: string, mimeType?: string) {
  if (mimeType && mimeType.startsWith("image/")) return mimeType;
  const lower = uri.toLowerCase();
  if (lower.includes(".png")) return "image/png";
  if (lower.includes(".webp")) return "image/webp";
  if (lower.includes(".heic") || lower.includes(".heif")) return "image/heic";
  return "image/jpeg";
}

function toggleInList<T>(list: T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value];
}

function ChipRow<T extends string>({
  values,
  selected,
  labels,
  onToggle,
}: {
  values: readonly T[];
  selected: readonly T[];
  labels: Record<T, string>;
  onToggle: (value: T) => void;
}) {
  return (
    <View style={styles.chips}>
      {values.map((value) => {
        const active = selected.includes(value);
        return (
          <Pressable
            key={value}
            onPress={() => onToggle(value)}
            style={[styles.chip, active && styles.chipActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>
              {labels[value]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function SingleChipRow<T extends string>({
  values,
  selected,
  labels,
  onSelect,
}: {
  values: readonly T[];
  selected: T | "";
  labels: Record<T, string>;
  onSelect: (value: T | "") => void;
}) {
  return (
    <View style={styles.chips}>
      {values.map((value) => {
        const active = selected === value;
        return (
          <Pressable
            key={value}
            onPress={() => onSelect(active ? "" : value)}
            style={[styles.chip, active && styles.chipActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>
              {labels[value]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function PlanazosDeck({
  onOpen,
}: {
  onOpen: (planId: PremiumPlanId) => void;
}) {
  const [listW, setListW] = useState(0);
  const [listH, setListH] = useState(0);
  const [openFeature, setOpenFeature] = useState<string | null>(null);
  const cardW = listW > 0 ? Math.round(listW * 0.86) : 300;
  const side = Math.max(0, (listW - cardW) / 2);

  return (
    <View style={styles.planazosDeck}>
      <View style={styles.planHint}>
        <Ionicons name="chevron-back" size={16} color={colors.textMuted} />
        <Text style={styles.planHintText}>Deslizá entre los planes</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </View>
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        disableIntervalMomentum
        snapToAlignment="start"
        snapToOffsets={PREMIUM_PLANS.map(
          (_, index) => index * (cardW + PLAN_CARD_GAP)
        )}
        style={styles.planazosScroller}
        contentContainerStyle={{
          paddingHorizontal: side,
          alignItems: "stretch",
        }}
        onLayout={(event) => {
          const nextW = Math.round(event.nativeEvent.layout.width);
          const nextH = Math.round(event.nativeEvent.layout.height);
          setListW((prev) => (prev === nextW ? prev : nextW));
          setListH((prev) => (prev === nextH ? prev : nextH));
        }}
      >
        {PREMIUM_PLANS.map((plan, index) => {
          const look = PLAN_LOOK[plan.id] ?? PLAN_LOOK.nocta_2am!;
          const monthly = premiumPeriodPriceUsd(12, plan.id) / 12;
          const monthlyLabel = Number.isInteger(monthly)
            ? String(monthly)
            : (Math.round(monthly * 100) / 100).toFixed(2).replace(/\.?0+$/, "");
          const priceNote = premiumFromPriceNote(12);
          const features = premiumDashboardFeatureItems(plan.id);
          return (
            <Pressable
              key={plan.id}
              onPress={() => onOpen(plan.id)}
              style={({ pressed }) => [
                styles.planCard,
                {
                  width: cardW,
                  height: listH > 0 ? listH : undefined,
                  marginRight:
                    index === PREMIUM_PLANS.length - 1 ? 0 : PLAN_CARD_GAP,
                  backgroundColor: look.wash,
                  borderColor: look.border,
                  borderWidth: plan.id === "nocta_6am" ? 1.5 : 1,
                },
                pressed && { opacity: 0.92 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Ver ${plan.name}, desde USD ${monthlyLabel} por mes, ${priceNote.toLowerCase()}`}
            >
              <View style={styles.planGlowWrap}>
                <Svg
                  width={240}
                  height={108}
                  style={styles.planGlowSvg}
                  pointerEvents="none"
                >
                  <Defs>
                    <RadialGradient
                      id={`plan-glow-${plan.id}`}
                      cx="50%"
                      cy="50%"
                      rx="50%"
                      ry="50%"
                    >
                      <Stop
                        offset="0%"
                        stopColor={look.accent}
                        stopOpacity={0.85}
                      />
                      <Stop
                        offset="42%"
                        stopColor={look.accent}
                        stopOpacity={0.28}
                      />
                      <Stop
                        offset="100%"
                        stopColor={look.accent}
                        stopOpacity={0}
                      />
                    </RadialGradient>
                  </Defs>
                  <Ellipse
                    cx={120}
                    cy={54}
                    rx={120}
                    ry={54}
                    fill={`url(#plan-glow-${plan.id})`}
                  />
                </Svg>
                <View
                  style={[
                    styles.planMark,
                    {
                      backgroundColor: look.accent,
                      borderColor: look.accent,
                    },
                  ]}
                >
                  <Text style={[styles.planMarkText, { color: look.wash }]}>
                    {look.hour}
                  </Text>
                </View>
              </View>
              <View style={styles.planBody}>
                <View style={styles.planTop}>
                  <Text style={styles.planName}>{plan.name}</Text>
                  <Text style={styles.planTagline}>“{plan.tagline}”</Text>
                </View>
                <View style={styles.planFeatures}>
                  {features.map((feature) => {
                    const openKey = `${plan.id}:${feature.id}`;
                    const open = openFeature === openKey;
                    return (
                      <View key={feature.id}>
                        <View style={styles.planFeatureRow}>
                          <Text
                            style={{
                              color: feature.included
                                ? look.accent
                                : colors.textFaint,
                              fontSize: 15,
                              lineHeight: 20,
                            }}
                          >
                            {feature.included ? "✓" : "–"}
                          </Text>
                          <Text
                            numberOfLines={1}
                            style={[
                              styles.planFeature,
                              !feature.included &&
                                !open &&
                                styles.planFeatureOff,
                              open && { color: look.accent },
                            ]}
                          >
                            {feature.label}
                          </Text>
                          <Pressable
                            hitSlop={10}
                            onPress={() =>
                              setOpenFeature((prev) =>
                                prev === openKey ? null : openKey
                              )
                            }
                            style={styles.planInfoBtn}
                            accessibilityRole="button"
                            accessibilityLabel={`Qué es ${feature.label}`}
                          >
                            <Ionicons
                              name="information-circle-outline"
                              size={13}
                              color={colors.textFaint}
                            />
                          </Pressable>
                        </View>
                        {open ? (
                          <Text style={styles.planFeatureInfo}>
                            {feature.description}
                          </Text>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
                <View style={styles.planFooter}>
                  <View>
                    <Text style={[styles.planPrice, { color: look.accent }]}>
                      Desde USD {monthlyLabel}/mes
                    </Text>
                    <Text style={styles.planPriceNote}>{priceNote}</Text>
                  </View>
                  <View
                    style={[styles.planCta, { backgroundColor: look.accent }]}
                  >
                    <Text style={styles.planCtaText}>Ver plan</Text>
                  </View>
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function OnboardingScreen() {
  const { user, setUser, setPlanazosOffer, setPendingOpenPremium } = useAuth();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "Onboarding">>();
  const editing = Boolean(route.params?.edit);
  const profile = user?.profile;

  const initialStep = (() => {
    const raw = route.params?.step;
    if (raw == null || !Number.isFinite(raw)) return 0;
    return Math.min(STEPS.length - 1, Math.max(0, Math.floor(raw) - 1));
  })();

  const [step, setStep] = useState(initialStep);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState(profile?.name ?? "");
  const [birthDate, setBirthDate] = useState(
    profile?.birthDate?.slice(0, 10) ?? ""
  );
  const [height, setHeight] = useState(profile?.heightCm?.toString() ?? "");
  const [gender, setGender] = useState<Gender | "">(
    (profile?.gender as Gender | undefined) ?? ""
  );
  const [interestedIn, setInterestedIn] = useState<Gender[]>(
    (profile?.interestedIn as Gender[] | undefined) ?? []
  );
  const [lookingFor, setLookingFor] = useState<LookingFor | "">(
    (profile?.lookingFor?.[0] as LookingFor | undefined) ?? ""
  );
  const [interests, setInterests] = useState<Interest[]>(
    profile?.interests ?? []
  );
  const [workStatus, setWorkStatus] = useState<WorkStatus | "">(
    profile?.workStatus ?? ""
  );
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [country, setCountry] = useState(
    profile?.livesIn?.country ?? "Uruguay"
  );
  const [city, setCity] = useState(profile?.livesIn?.city ?? "");
  const [sexualOrientation, setSexualOrientation] = useState<
    SexualOrientation | ""
  >(profile?.sexualOrientation ?? "");
  const [languages, setLanguages] = useState<Language[]>(
    profile?.languages ?? []
  );
  const [zodiac, setZodiac] = useState<ZodiacSign | "">(profile?.zodiac ?? "");
  const [educationLevel, setEducationLevel] = useState<EducationLevel | "">(
    profile?.educationLevel ?? ""
  );
  const [pets, setPets] = useState<Pets | "">(profile?.pets ?? "");
  const [drinking, setDrinking] = useState<Drinking | "">(
    profile?.drinking ?? ""
  );
  const [fitness, setFitness] = useState<Fitness | "">(profile?.fitness ?? "");
  const [socials, setSocials] = useState<ProfileSocials>(
    profile?.socials ?? emptySocials()
  );
  const [jobTitle, setJobTitle] = useState(profile?.jobTitle ?? "");
  const [company, setCompany] = useState(profile?.company ?? "");
  const [studiedAt, setStudiedAt] = useState(profile?.studiedAt ?? "");
  const [photos, setPhotos] = useState<LocalPhoto[]>(() =>
    (profile?.photos ?? [])
      .filter((url) => url?.trim())
      .map((url) => ({
        id: newId(),
        uri: url,
        uploadedUrl: url,
      }))
  );

  const uruguayCityLabels: string[] = useMemo(
    () => URUGUAY_CITIES.map((item) => item.label),
    []
  );
  const isUruguay = country === "Uruguay";
  const cityIsListed = uruguayCityLabels.includes(city);
  const current = STEPS[step]!;
  const progress = ((step + 1) / STEPS.length) * 100;

  function setSocial(network: SocialNetwork, value: string) {
    setSocials((currentSocials) => {
      const next = { ...currentSocials };
      const trimmed = value.trim();
      if (trimmed) next[network] = trimmed;
      else delete next[network];
      return next;
    });
  }

  function validate(currentStep: number) {
    if (currentStep === 0) {
      if (name.trim().length < 2) return "Ingresá tu nombre";
      const age = ageFrom(birthDate);
      if (age == null) return "Ingresá una fecha válida";
      if (age < MIN_AGE) return `Debés tener al menos ${MIN_AGE} años`;
      if (age > MAX_AGE) return "Fecha fuera de rango";
      if (height && (Number(height) < 100 || Number(height) > 250)) {
        return "La altura debe estar entre 100 y 250 cm";
      }
      if (!gender || !interestedIn.length) {
        return "Completá género y a quiénes te interesa conocer";
      }
      if (!country.trim() || !city.trim()) {
        return "Completá país y ciudad";
      }
    }
    if (currentStep === 3 && (!lookingFor || !interests.length)) {
      return "Elegí al menos una opción en cada grupo";
    }
    if (currentStep === 4 && photos.length < MIN_PHOTOS) {
      return `Necesitás al menos ${MIN_PHOTOS} foto`;
    }
    return "";
  }

  function next() {
    const message = validate(step);
    if (message) {
      toast.error(message);
      return;
    }
    setStep((value) => value + 1);
  }

  async function pickPhotos() {
    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) {
      toast.info(`Máximo ${MAX_PHOTOS} fotos`);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.85,
    });
    if (result.canceled) return;
    const nextPhotos: LocalPhoto[] = [];
    for (const asset of result.assets) {
      if (asset.fileSize && asset.fileSize > MAX_PHOTO_UPLOAD_BYTES) {
        toast.error("Una foto supera los 10 MB");
        continue;
      }
      const mimeType = asset.mimeType ?? undefined;
      const ext =
        mimeType === "image/png"
          ? "png"
          : mimeType === "image/webp"
            ? "webp"
            : "jpg";
      let uri = asset.uri;
      try {
        uri = await prepareUploadUri(uri, ext);
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : "No se pudo leer una foto. Elegila de nuevo."
        );
        continue;
      }
      nextPhotos.push({
        id: newId(),
        uri,
        mimeType,
        fileName: asset.fileName ?? undefined,
      });
    }
    setPhotos((prev) => [...prev, ...nextPhotos].slice(0, MAX_PHOTOS));
  }

  function movePhoto(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= photos.length) return;
    setPhotos((prev) => {
      const nextList = [...prev];
      const a = nextList[index]!;
      const b = nextList[target]!;
      nextList[index] = b;
      nextList[target] = a;
      return nextList;
    });
  }

  async function save() {
    const message = validate(PHOTOS_STEP);
    if (message) {
      toast.error(message);
      return;
    }
    setBusy(true);
    try {
      const existing = photos.filter((photo) => photo.uploadedUrl);
      const fresh = photos.filter((photo) => !photo.uploadedUrl);
      let response = await api<{ user: AuthUser }>("/api/profile", {
        method: "PUT",
        body: JSON.stringify({
          name: name.trim(),
          birthDate,
          heightCm: height ? Number(height) : undefined,
          gender,
          interestedIn,
          lookingFor: lookingFor ? [lookingFor] : [],
          interests,
          workStatus: workStatus || undefined,
          bio: bio.trim() || undefined,
          livesIn: {
            country: country.trim(),
            city: city.trim(),
          },
          sexualOrientation: sexualOrientation || undefined,
          languages,
          zodiac: zodiac || undefined,
          educationLevel: educationLevel || undefined,
          pets: pets || undefined,
          drinking: drinking || undefined,
          fitness: fitness || undefined,
          socials: Object.fromEntries(
            SOCIAL_NETWORKS.map((network) => [
              network,
              socials[network]?.trim() || undefined,
            ]).filter(([, value]) => Boolean(value))
          ),
          jobTitle: jobTitle.trim() || undefined,
          company: company.trim() || undefined,
          studiedAt: studiedAt.trim() || undefined,
          photos: existing.map((photo) => photo.uploadedUrl!),
        }),
      });

      for (const photo of fresh) {
        response = await uploadProfilePhoto({
          uri: photo.uri,
          mimeType: guessMime(photo.uri, photo.mimeType),
          fileName: photo.fileName,
        });
      }

      if (!editing) {
        setPlanazosOffer(true);
      }
      setStep(PLANAZOS_STEP);
      setUser(response.user);
      toast.success(editing ? "Cambios guardados" : "Perfil listo");
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "No se pudo guardar el perfil"
      );
    } finally {
      setBusy(false);
    }
  }

  function finishOnboarding() {
    setPlanazosOffer(false);
    if (editing) {
      if (navigation.canGoBack()) navigation.goBack();
      else navigation.navigate("Main");
    }
  }

  function openPremiumFromPlanazos(planId: PremiumPlanId) {
    if (editing) {
      setPlanazosOffer(false);
      navigation.navigate("Premium", { planId });
    } else {
      setPendingOpenPremium(planId);
      setPlanazosOffer(false);
    }
  }

  return (
    <View
      style={[
        styles.shell,
        {
          paddingTop: Math.max(insets.top, spacing.sm),
          paddingBottom: Math.max(insets.bottom, spacing.sm),
        },
      ]}
    >
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>
      <Text style={styles.stepMeta}>
        Paso {step + 1} de {STEPS.length}
      </Text>
      <View style={styles.heading}>
        <View style={styles.headingIcon}>
          <Ionicons name={current.icon} size={20} color={colors.primary} />
        </View>
        <View style={styles.headingCopy}>
          <Text style={styles.headingTitle}>{current.title}</Text>
          <Text style={styles.headingSubtitle}>{current.subtitle}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          step === PLANAZOS_STEP && styles.planazosScroll,
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {step === 0 ? (
          <View style={styles.section}>
            <Text style={styles.fieldLabel}>Nombre</Text>
            <Field
              placeholder="Tu nombre"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />

            <View style={styles.row2}>
              <View style={styles.flex1}>
                <Text style={styles.fieldLabel}>Fecha de nacimiento</Text>
                <DateField
                  placeholder="Fecha de nacimiento"
                  value={birthDate}
                  onChange={setBirthDate}
                  minimumDate={MIN_BIRTH_DATE}
                  maximumDate={MAX_BIRTH_DATE}
                />
              </View>
              <View style={styles.flex1}>
                <Text style={styles.fieldLabel}>Altura (cm)</Text>
                <Field
                  placeholder="Opcional"
                  value={height}
                  onChangeText={setHeight}
                  keyboardType="number-pad"
                />
              </View>
            </View>

            <Text style={styles.sectionTitle}>Identidad</Text>
            <Text style={styles.fieldLabel}>Género</Text>
            <ChipRow
              values={GENDERS}
              selected={gender ? [gender] : []}
              labels={GENDER_LABELS}
              onToggle={(value) => setGender(value)}
            />
            <Text style={styles.fieldLabel}>Me interesan</Text>
            <ChipRow
              values={GENDERS}
              selected={interestedIn}
              labels={GENDER_LABELS}
              onToggle={(value) =>
                setInterestedIn((prev) => toggleInList(prev, value))
              }
            />

            <Text style={styles.sectionTitle}>Dónde vivís</Text>
            <Text style={styles.hint}>
              Solo país y ciudad. Las fechas de promociones usan la zona horaria
              de tu país (Uruguay = GMT-3).
            </Text>
            <Text style={styles.fieldLabel}>País</Text>
            <ChipRow
              values={PROFILE_COUNTRIES}
              selected={[country as (typeof PROFILE_COUNTRIES)[number]]}
              labels={Object.fromEntries(
                PROFILE_COUNTRIES.map((c) => [c, c])
              ) as Record<(typeof PROFILE_COUNTRIES)[number], string>}
              onToggle={(value) => {
                setCountry(value);
                if (value === "Uruguay" && !uruguayCityLabels.includes(city)) {
                  setCity("");
                }
              }}
            />
            <Text style={styles.fieldLabel}>Ciudad</Text>
            {isUruguay ? (
              <ChipRow
                values={uruguayCityLabels}
                selected={cityIsListed ? [city] : []}
                labels={Object.fromEntries(
                  uruguayCityLabels.map((c) => [c, c])
                )}
                onToggle={(value) => setCity(value)}
              />
            ) : (
              <Field
                placeholder="Ej. Buenos Aires"
                value={city}
                onChangeText={setCity}
              />
            )}
            {country.trim() && city.trim() ? (
              <Text style={styles.hint}>
                Se mostrará como{" "}
                <Text style={styles.hintStrong}>
                  {country.trim()}, {city.trim()}
                </Text>
              </Text>
            ) : null}

            <Text style={styles.fieldLabel}>Descripción (opcional)</Text>
            <Field
              placeholder="Algo de mí…"
              value={bio}
              onChangeText={(text) => setBio(text.slice(0, 500))}
              multiline
              style={styles.textarea}
            />
          </View>
        ) : null}

        {step === 1 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Orientación sexual</Text>
            <SingleChipRow
              values={SEXUAL_ORIENTATIONS}
              selected={sexualOrientation}
              labels={SEXUAL_ORIENTATION_LABELS}
              onSelect={setSexualOrientation}
            />
            <Text style={styles.sectionTitle}>Idiomas</Text>
            <ChipRow
              values={LANGUAGES}
              selected={languages}
              labels={LANGUAGE_LABELS}
              onToggle={(value) =>
                setLanguages((prev) => toggleInList(prev, value))
              }
            />
            <Text style={styles.sectionTitle}>Zodíaco</Text>
            <SingleChipRow
              values={ZODIAC_SIGNS}
              selected={zodiac}
              labels={ZODIAC_LABELS}
              onSelect={setZodiac}
            />
            <Text style={styles.sectionTitle}>Nivel educativo</Text>
            <SingleChipRow
              values={EDUCATION_LEVELS}
              selected={educationLevel}
              labels={EDUCATION_LEVEL_LABELS}
              onSelect={setEducationLevel}
            />
            <Text style={styles.sectionTitle}>Mascotas</Text>
            <SingleChipRow
              values={PETS}
              selected={pets}
              labels={PETS_LABELS}
              onSelect={setPets}
            />
            <Text style={styles.sectionTitle}>Bebidas</Text>
            <SingleChipRow
              values={DRINKING}
              selected={drinking}
              labels={DRINKING_LABELS}
              onSelect={setDrinking}
            />
            <Text style={styles.sectionTitle}>Fitness</Text>
            <SingleChipRow
              values={FITNESS}
              selected={fitness}
              labels={FITNESS_LABELS}
              onSelect={setFitness}
            />
            <Text style={styles.sectionTitle}>Redes sociales</Text>
            {SOCIAL_NETWORKS.map((network) => (
              <View key={network} style={styles.socialField}>
                <Text style={styles.fieldLabel}>
                  {SOCIAL_NETWORK_LABELS[network]}
                </Text>
                <Field
                  placeholder={`usuario de ${SOCIAL_NETWORK_LABELS[network]}`}
                  value={socials[network] ?? ""}
                  onChangeText={(text) => setSocial(network, text)}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            ))}
          </View>
        ) : null}

        {step === 2 ? (
          <View style={styles.section}>
            <Text style={styles.fieldLabel}>Situación laboral</Text>
            <SingleChipRow
              values={WORK_STATUS}
              selected={workStatus}
              labels={WORK_STATUS_LABELS}
              onSelect={setWorkStatus}
            />
            <Text style={styles.fieldLabel}>Puesto</Text>
            <Field
              placeholder="Ej. Diseñador/a"
              value={jobTitle}
              onChangeText={setJobTitle}
            />
            <Text style={styles.fieldLabel}>Compañía</Text>
            <Field
              placeholder="Ej. Nocta"
              value={company}
              onChangeText={setCompany}
            />
            <Text style={styles.fieldLabel}>Dónde estudió</Text>
            <Field
              placeholder="Ej. Universidad / instituto"
              value={studiedAt}
              onChangeText={setStudiedAt}
            />
          </View>
        ) : null}

        {step === 3 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>¿Qué estás buscando?</Text>
            <View style={styles.lookingGrid}>
              {LOOKING_FOR.map((value) => {
                const active = lookingFor === value;
                return (
                  <Pressable
                    key={value}
                    onPress={() => setLookingFor(value)}
                    style={[
                      styles.lookingOption,
                      active && styles.lookingOptionActive,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Ionicons
                      name={LOOKING_FOR_ICONS[value]}
                      size={22}
                      color={active ? colors.onPrimary : colors.primary}
                    />
                    <Text
                      style={[
                        styles.lookingOptionText,
                        active && styles.lookingOptionTextActive,
                      ]}
                    >
                      {LOOKING_FOR_LABELS[value]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.sectionTitle, { marginTop: spacing.md }]}>
              Gustos
            </Text>
            {INTEREST_CATEGORIES.map((category) => (
              <View key={category.id} style={styles.interestCategory}>
                <Text style={styles.interestCategoryTitle}>
                  {category.label}
                </Text>
                <ChipRow
                  values={category.interests}
                  selected={interests}
                  labels={INTEREST_LABELS}
                  onToggle={(value) =>
                    setInterests((prev) =>
                      toggleInList(prev, value as Interest)
                    )
                  }
                />
              </View>
            ))}
          </View>
        ) : null}

        {step === PHOTOS_STEP ? (
          <View style={styles.section}>
            <Pressable
              onPress={() => void pickPhotos()}
              style={({ pressed }) => [
                styles.dropzone,
                pressed && { opacity: 0.9 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Subí tus fotos"
            >
              <Ionicons
                name="cloud-upload-outline"
                size={28}
                color={colors.primary}
              />
              <Text style={styles.dropzoneTitle}>Subí tus fotos</Text>
              <Text style={styles.dropzoneHint}>
                Desde tu teléfono · máximo 10 MB
              </Text>
            </Pressable>

            <View style={styles.photoGrid}>
              {photos.map((photo, index) => (
                <View key={photo.id} style={styles.photoCard}>
                  <NoctaImage
                    src={photo.uploadedUrl || photo.uri}
                    variant="medium"
                    style={styles.photo}
                    contentFit="cover"
                  />
                  {index === 0 ? (
                    <View style={styles.photoBadge}>
                      <Text style={styles.photoBadgeText}>Perfil</Text>
                    </View>
                  ) : null}
                  <View style={styles.photoControls}>
                    <Pressable
                      onPress={() => movePhoto(index, -1)}
                      style={styles.photoControlBtn}
                      hitSlop={6}
                    >
                      <Text style={styles.photoControlText}>‹</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => movePhoto(index, 1)}
                      style={styles.photoControlBtn}
                      hitSlop={6}
                    >
                      <Text style={styles.photoControlText}>›</Text>
                    </Pressable>
                    <Pressable
                      onPress={() =>
                        setPhotos((prev) =>
                          prev.filter((item) => item.id !== photo.id)
                        )
                      }
                      style={styles.photoControlBtn}
                      hitSlop={6}
                    >
                      <Text style={styles.photoControlText}>×</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {step === PLANAZOS_STEP ? (
          <PlanazosDeck onOpen={openPremiumFromPlanazos} />
        ) : null}
      </ScrollView>

      <View style={styles.nav}>
        {step > 0 ? (
          <Pressable
            onPress={() => {
              if (step === PLANAZOS_STEP) {
                setStep(PHOTOS_STEP);
                return;
              }
              setStep((value) => value - 1);
            }}
            style={({ pressed }) => [
              styles.navGhost,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.navGhostText}>Atrás</Text>
          </Pressable>
        ) : (
          <View style={styles.navSpacer} />
        )}

        {step === PLANAZOS_STEP ? (
          <Pressable
            onPress={finishOnboarding}
            style={({ pressed }) => [
              styles.navGhost,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.navGhostText}>Omitir</Text>
          </Pressable>
        ) : step === PHOTOS_STEP ? (
          <Pressable
            disabled={busy}
            onPress={() => void save()}
            style={({ pressed }) => [
              styles.navPrimary,
              (busy || pressed) && { opacity: busy ? 0.55 : 0.9 },
            ]}
          >
            <Text style={styles.navPrimaryText}>
              {busy
                ? "Guardando…"
                : editing
                  ? "Guardar cambios"
                  : "Guardar y Continuar"}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={next}
            style={({ pressed }) => [
              styles.navPrimary,
              pressed && { opacity: 0.9 },
            ]}
          >
            <Text style={styles.navPrimaryText}>Siguiente</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: colors.canvas,
    paddingHorizontal: spacing.md,
  },
  progressTrack: {
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: "rgba(242,240,235,0.12)",
    overflow: "hidden",
    marginBottom: spacing.sm,
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
  },
  stepMeta: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 13,
    marginBottom: spacing.sm,
  },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  headingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryDim,
  },
  headingCopy: { flex: 1 },
  headingTitle: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 24,
    letterSpacing: -0.03 * 24,
  },
  headingSubtitle: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 13,
    marginTop: 2,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: spacing.lg },
  section: { gap: spacing.sm },
  sectionTitle: {
    color: colors.text,
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    marginTop: spacing.sm,
  },
  fieldLabel: {
    color: colors.text,
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    marginTop: 4,
  },
  hint: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 18,
  },
  hintStrong: {
    color: colors.text,
    fontFamily: fonts.bodySemiBold,
  },
  row2: { flexDirection: "row", gap: spacing.sm },
  flex1: { flex: 1 },
  textarea: {
    minHeight: 100,
    textAlignVertical: "top",
    paddingTop: 12,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.elevated,
  },
  chipActive: {
    backgroundColor: colors.primaryDim,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.textMuted,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
  },
  chipTextActive: {
    color: colors.primary,
    fontFamily: fonts.bodyBold,
  },
  socialField: { gap: 4 },
  lookingGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  lookingOption: {
    width: "31%",
    minHeight: 88,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.elevated,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 6,
    paddingVertical: 10,
  },
  lookingOptionActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  lookingOptionText: {
    color: colors.text,
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    textAlign: "center",
  },
  lookingOptionTextActive: {
    color: colors.onPrimary,
  },
  interestCategory: {
    gap: 8,
    marginBottom: spacing.sm,
  },
  interestCategoryTitle: {
    color: colors.textMuted,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  dropzone: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(214,255,75,0.45)",
    borderRadius: radii.lg,
    backgroundColor: "rgba(214,255,75,0.06)",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  dropzoneTitle: {
    color: colors.text,
    fontFamily: fonts.bodyBold,
    fontSize: 16,
  },
  dropzoneHint: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: spacing.sm,
  },
  photoCard: {
    width: "47%",
    aspectRatio: 1,
    borderRadius: radii.md,
    overflow: "hidden",
    backgroundColor: colors.elevated,
  },
  photo: { width: "100%", height: "100%" },
  photoBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  photoBadgeText: {
    color: colors.onPrimary,
    fontFamily: fonts.bodyBold,
    fontSize: 11,
  },
  photoControls: {
    position: "absolute",
    right: 6,
    bottom: 6,
    flexDirection: "row",
    gap: 4,
  },
  photoControlBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
  },
  photoControlText: {
    color: "#fff",
    fontSize: 16,
    lineHeight: 18,
    fontFamily: fonts.bodyBold,
  },
  planazosScroll: {
    flexGrow: 1,
  },
  planazosDeck: {
    flex: 1,
    marginHorizontal: -spacing.md,
  },
  planHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingBottom: spacing.sm,
  },
  planHintText: {
    color: colors.textMuted,
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    letterSpacing: 0.2,
  },
  planazosScroller: {
    flex: 1,
  },
  planCard: {
    borderWidth: 1,
    borderRadius: radii.lg,
    overflow: "hidden",
  },
  planGlowWrap: {
    height: 112,
    alignItems: "center",
    justifyContent: "center",
  },
  planGlowSvg: {
    position: "absolute",
  },
  planBody: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 8,
  },
  planFeatures: { flex: 1, justifyContent: "space-evenly" },
  planFeatureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  planFeature: {
    flexShrink: 1,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 20,
  },
  planFeatureOff: {
    color: colors.textFaint,
  },
  planInfoBtn: {
    opacity: 0.4,
  },
  planFeatureInfo: {
    marginLeft: 16,
    marginTop: 2,
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 16,
  },
  planMark: {
    borderWidth: 1.5,
    borderRadius: radii.pill,
    paddingHorizontal: 18,
    paddingVertical: 6,
    backgroundColor: "transparent",
  },
  planMarkText: {
    fontFamily: fonts.display,
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -0.03 * 34,
  },
  planTop: { gap: 2, alignItems: "center", alignSelf: "stretch" },
  planName: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: -0.03 * 24,
    textAlign: "center",
    alignSelf: "stretch",
  },
  planTagline: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 18,
    fontStyle: "italic",
    textAlign: "center",
    alignSelf: "stretch",
    transform: [{ skewX: "-8deg" }],
  },
  planFooter: { gap: 8 },
  planPrice: {
    fontFamily: fonts.display,
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: -0.03 * 20,
  },
  planPriceNote: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
  },
  planCta: {
    minHeight: 44,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  planCtaText: {
    color: colors.onPrimary,
    fontFamily: fonts.bodyBold,
    fontSize: 16,
  },
  nav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  navSpacer: { width: 88 },
  navGhost: {
    minHeight: 46,
    minWidth: 88,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(242,240,235,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  navGhostText: {
    color: colors.text,
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
  },
  navPrimary: {
    flex: 1,
    minHeight: 46,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  navPrimaryText: {
    color: colors.onPrimary,
    fontFamily: fonts.bodyBold,
    fontSize: 15,
  },
});

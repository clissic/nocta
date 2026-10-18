import type { ReactNode } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import {
  DRINKING_LABELS,
  EDUCATION_LEVEL_LABELS,
  FITNESS_LABELS,
  GENDER_LABELS,
  INTEREST_CATEGORIES,
  INTEREST_LABELS,
  LANGUAGE_LABELS,
  LOOKING_FOR_LABELS,
  PETS_LABELS,
  SEXUAL_ORIENTATION_LABELS,
  WORK_STATUS_LABELS,
  ZODIAC_INSIGHTS,
  ZODIAC_LABELS,
  type DiscoverCard,
  type Drinking,
  type EducationLevel,
  type Fitness,
  type Gender,
  type Interest,
  type Language,
  type LookingFor,
  type Pets,
  type SexualOrientation,
  type WorkStatus,
  type ZodiacSign,
} from "@nocta/shared";
import { NoctaImage } from "../NoctaImage";
import { colors, fonts, radii, spacing } from "../../theme/tokens";
import {
  DiscoverSafetyDialog,
  type DiscoverSafetyAction,
} from "./DiscoverSafetyDialog";

type Props = {
  card: DiscoverCard | null;
  photoIndex: number;
  visible: boolean;
  onClose: () => void;
  onPhotoIndexChange: (index: number) => void;
  onBlock: () => void;
  onReport: () => void;
  safetyAction: DiscoverSafetyAction | null;
  safetyBusy?: boolean;
  onSafetyClose: () => void;
  onSafetyConfirm: () => void;
  actions?: ReactNode;
};

export function DiscoverProfileSheet({
  card,
  photoIndex,
  visible,
  onClose,
  onPhotoIndexChange,
  onBlock,
  onReport,
  safetyAction,
  safetyBusy = false,
  onSafetyClose,
  onSafetyConfirm,
  actions,
}: Props) {
  const insets = useSafeAreaInsets();
  const profile = card?.profile;
  const age = card?.age;
  if (!card || !profile || age == null) return null;
  const photos = (profile.photos ?? []).filter(Boolean);
  const active = photos[photoIndex] ?? photos[0];
  const lookingFor = (profile.lookingFor ?? []).filter(
    (v): v is LookingFor => v in LOOKING_FOR_LABELS
  );
  const interestGroups = INTEREST_CATEGORIES.map((category) => ({
    id: category.id,
    label: category.label,
    interests: category.interests.filter((interest) =>
      (profile.interests ?? []).includes(interest)
    ),
  })).filter((c) => c.interests.length > 0);
  const livesCountry = profile.livesIn?.country?.trim();
  const livesCity = profile.livesIn?.city?.trim();
  const locationLabel =
    livesCountry && livesCity ? `${livesCountry}, ${livesCity}` : null;
  const languages = (profile.languages ?? []).filter(
    (value): value is Language => value in LANGUAGE_LABELS
  );
  const hasWork = Boolean(
    profile.workStatus || profile.jobTitle || profile.company || profile.studiedAt
  );
  const zodiac = profile.zodiac as ZodiacSign | undefined;
  const zodiacInsight = zodiac ? ZODIAC_INSIGHTS[zodiac] : null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
    >
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.hero}>
            {active ? (
              <NoctaImage src={active} style={styles.heroImg} contentFit="cover" />
            ) : (
              <View style={[styles.heroImg, styles.heroEmpty]} />
            )}
            {photos.length > 1 ? (
              <View style={styles.segments}>
                {photos.map((_, i) => (
                  <View
                    key={i}
                    style={[styles.segment, i === photoIndex && styles.segmentOn]}
                  />
                ))}
              </View>
            ) : null}
            <View style={styles.photoHits}>
              <Pressable
                style={styles.photoHit}
                onPress={() =>
                  onPhotoIndexChange(
                    photoIndex <= 0 ? photos.length - 1 : photoIndex - 1
                  )
                }
              />
              <Pressable
                style={styles.photoHit}
                onPress={() =>
                  onPhotoIndexChange(
                    photoIndex >= photos.length - 1 ? 0 : photoIndex + 1
                  )
                }
              />
            </View>
            <LinearGradient
              colors={[
                "transparent",
                "rgba(10,10,11,0.35)",
                "rgba(10,10,11,0.85)",
              ]}
              locations={[0, 0.45, 1]}
              style={styles.heroFade}
              pointerEvents="none"
            />
            <View style={styles.heroCaption}>
              <Text style={styles.heroTitle}>
                {profile.name}, {age}
              </Text>
              <Pressable
                onPress={onClose}
                accessibilityLabel="Cerrar perfil ampliado"
                style={styles.collapseBtn}
              >
                <Ionicons name="chevron-down" size={22} color={colors.text} />
              </Pressable>
            </View>
          </View>

          <View style={styles.info}>
            {lookingFor.length > 0 ? (
              <Section title="Busca">
                <View style={styles.lookingRow}>
                  {lookingFor.map((value) => (
                    <View key={value} style={styles.lookingItem}>
                      <Text style={styles.lookingText}>
                        {LOOKING_FOR_LABELS[value]}
                      </Text>
                    </View>
                  ))}
                </View>
              </Section>
            ) : null}

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

            {zodiac && zodiacInsight ? (
              <Section title="Zodíaco">
                <Text style={styles.value}>{ZODIAC_LABELS[zodiac]}</Text>
                <Text style={styles.valueMuted}>{zodiacInsight.traits}</Text>
                <Text style={styles.valueMuted}>
                  Especialmente compatible con{" "}
                  {zodiacInsight.compatibleWith
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

            {profile.heightCm != null ? (
              <Section title="Altura">
                <Text style={styles.value}>{profile.heightCm} cm</Text>
              </Section>
            ) : null}

            {card.identityVerified ? (
              <View style={styles.verified}>
                <Ionicons
                  name="shield-checkmark"
                  size={16}
                  color={colors.primary}
                />
                <Text style={styles.verifiedText}>Identidad verificada</Text>
              </View>
            ) : null}

            <View style={styles.safetyRow}>
              <Pressable
                onPress={onBlock}
                style={styles.safetyBtn}
                accessibilityLabel="Bloquear perfil"
              >
                <Ionicons name="ban-outline" size={18} color={colors.warning} />
                <Text style={styles.safetyLabel}>Bloquear</Text>
              </Pressable>
              <Pressable
                onPress={onReport}
                style={[styles.safetyBtn, styles.safetyBtnDanger]}
                accessibilityLabel="Denunciar perfil"
              >
                <Ionicons name="flag-outline" size={18} color="#ff6374" />
                <Text style={[styles.safetyLabel, styles.safetyLabelDanger]}>
                  Denunciar
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
        {actions ? (
          <View
            style={[
              styles.actionsDock,
              { paddingBottom: Math.max(insets.bottom, spacing.sm) },
            ]}
          >
            {actions}
          </View>
        ) : null}
        {safetyAction ? (
          <DiscoverSafetyDialog
            action={safetyAction}
            personName={profile.name}
            busy={safetyBusy}
            onClose={onSafetyClose}
            onConfirm={onSafetyConfirm}
          />
        ) : null}
      </View>
    </Modal>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.label}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  scroll: {
    paddingBottom: spacing.lg,
  },
  actionsDock: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.canvas,
  },
  hero: {
    height: 420,
    backgroundColor: colors.elevated,
  },
  heroImg: {
    ...StyleSheet.absoluteFill,
    width: "100%",
    height: "100%",
  },
  heroEmpty: {
    backgroundColor: colors.elevated,
  },
  segments: {
    position: "absolute",
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    flexDirection: "row",
    gap: 4,
    zIndex: 3,
  },
  segment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  segmentOn: {
    backgroundColor: colors.text,
  },
  photoHits: {
    ...StyleSheet.absoluteFill,
    flexDirection: "row",
    zIndex: 2,
  },
  photoHit: { flex: 1 },
  heroFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 160,
  },
  heroCaption: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    zIndex: 4,
  },
  heroTitle: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 28,
    letterSpacing: -0.03 * 28,
  },
  collapseBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  info: {
    padding: spacing.md,
    gap: spacing.md,
  },
  section: { gap: spacing.sm },
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
    fontFamily: fonts.bodySemiBold,
  },
  bio: {
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
  },
  lookingRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  lookingItem: {
    backgroundColor: colors.panel,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  lookingText: {
    color: colors.text,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
  },
  interestCat: { gap: 6, marginBottom: spacing.sm },
  interestCatTitle: {
    color: colors.text,
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
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
  verified: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing.sm,
  },
  verifiedText: {
    color: colors.primary,
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
  },
  safetyRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(242,240,235,0.12)",
  },
  safetyBtn: {
    flex: 1,
    height: 46,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "rgba(242,240,235,0.2)",
    backgroundColor: "rgba(242,240,235,0.05)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  safetyLabel: {
    color: colors.warning,
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
  },
  safetyLabelDanger: {
    color: "#ff6374",
  },
  safetyBtnDanger: {
    borderColor: "rgba(255,99,116,0.42)",
    backgroundColor: "rgba(255,99,116,0.08)",
  },
});

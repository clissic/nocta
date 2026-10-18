import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  VENUE_PHOTO_FALLBACK,
  VENUE_TYPE_LABELS,
  venueCoverSrc,
  type Presence,
} from "@nocta/shared";
import { NoctaImage } from "../NoctaImage";
import { colors, fonts, spacing, tabBar } from "../../theme/tokens";

type Props = {
  presences: Presence[];
  maxPresences: number;
  bottomInset: number;
  onSelect: (venueId: string) => void;
};

/** Selector de Espacio con Clone — parity web `.discover-venue-picker` (mobile). */
export function DiscoverVenuePicker({
  presences,
  maxPresences,
  bottomInset,
  onSelect,
}: Props) {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: Math.max(bottomInset, 10) + tabBar.height + spacing.md },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.copy}>
        <View style={styles.eyebrowRow}>
          <Ionicons name="people" size={14} color={colors.primary} />
          <Text style={styles.eyebrow}>Clone</Text>
        </View>
        <Text style={styles.title}>Elegí un Espacio</Text>
        <Text style={styles.subtitle}>
          Estás publicado en {presences.length} de {maxPresences}. Tocá uno
          para entrar a su Discover.
        </Text>
      </View>

      <View style={styles.grid}>
        {presences.map((row) => {
          const venue = row.venue;
          const name = venue?.name ?? "Espacio";
          const typeLabel = venue?.type ? VENUE_TYPE_LABELS[venue.type] : null;
          return (
            <Pressable
              key={row.id}
              onPress={() => onSelect(row.venueId)}
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.94 }]}
              accessibilityRole="button"
              accessibilityLabel={`Abrir Discover en ${name}`}
            >
              <View style={styles.media}>
                {venue ? (
                  <NoctaImage
                    src={venueCoverSrc(venue)}
                    fallbackSrc={VENUE_PHOTO_FALLBACK}
                    variant="medium"
                    style={styles.cover}
                    contentFit="cover"
                  />
                ) : (
                  <View style={styles.fallback}>
                    <Ionicons
                      name="location-outline"
                      size={28}
                      color={colors.textFaint}
                    />
                  </View>
                )}
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
                <View style={styles.caption}>
                  {typeLabel ? (
                    <Text style={styles.type}>{typeLabel}</Text>
                  ) : null}
                  <View style={styles.nameRow}>
                    <Text style={styles.name} numberOfLines={1}>
                      {name}
                    </Text>
                    {venue?.ownerId ? (
                      <Ionicons
                        name="checkmark-circle"
                        size={16}
                        color={colors.primary}
                      />
                    ) : null}
                  </View>
                  {venue?.address ? (
                    <Text style={styles.address} numberOfLines={1}>
                      {venue.address}
                    </Text>
                  ) : null}
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    gap: 20,
  },
  copy: {
    width: "100%",
    maxWidth: 416,
    alignItems: "center",
    gap: 6,
  },
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  eyebrow: {
    color: colors.primary,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    letterSpacing: 2.2,
    textTransform: "uppercase",
  },
  title: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 28,
    letterSpacing: -0.03 * 28,
    textAlign: "center",
  },
  subtitle: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  grid: {
    width: "100%",
    maxWidth: 416,
    gap: 14,
  },
  card: {
    width: "100%",
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: colors.canvas,
  },
  media: {
    width: "100%",
    aspectRatio: 4 / 3,
    backgroundColor: colors.panel,
  },
  cover: {
    ...StyleSheet.absoluteFill,
    width: "100%",
    height: "100%",
  },
  fallback: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(242,240,235,0.06)",
  },
  fade: {
    ...StyleSheet.absoluteFill,
  },
  caption: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
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
  address: {
    color: "rgba(242,240,235,0.72)",
    fontFamily: fonts.body,
    fontSize: 13,
  },
});

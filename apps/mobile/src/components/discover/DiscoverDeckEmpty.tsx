import { useEffect } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radii, spacing } from "../../theme/tokens";

type Props = {
  venueName?: string;
  onReload: () => void;
  onExploreVenues: () => void;
};

function Orbit({ size, delayMs }: { size: number; delayMs: number }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delayMs,
      withRepeat(
        withTiming(1, {
          duration: 3600,
          easing: Easing.out(Easing.ease),
        }),
        -1,
        false
      )
    );
  }, [delayMs, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value < 0.35 ? progress.value / 0.35 : 1 - progress.value,
    transform: [{ scale: 0.68 + progress.value * 0.44 }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.orbit,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          marginLeft: -size / 2,
          marginTop: -size / 2,
        },
        style,
      ]}
    />
  );
}

function FloatDot({
  style,
  size,
  delayMs,
  duration,
}: {
  style: object;
  size: number;
  delayMs: number;
  duration: number;
}) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withDelay(
      delayMs,
      withRepeat(
        withSequence(
          withTiming(1, {
            duration: duration / 2,
            easing: Easing.inOut(Easing.ease),
          }),
          withTiming(0, {
            duration: duration / 2,
            easing: Easing.inOut(Easing.ease),
          })
        ),
        -1,
        false
      )
    );
  }, [delayMs, duration, t]);

  const anim = useAnimatedStyle(() => ({
    opacity: 0.55 + t.value * 0.45,
    transform: [{ translateY: -t.value * 10 }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.dot,
        style,
        { width: size, height: size, borderRadius: size / 2 },
        anim,
      ]}
    />
  );
}

/** Deck de Discover agotado — parity web `.discover-deck-empty`. */
export function DiscoverDeckEmpty({
  venueName,
  onReload,
  onExploreVenues,
}: Props) {
  const { width, height } = useWindowDimensions();
  const compact = height < 820;
  const visualSize = compact
    ? Math.min(132, width * 0.34)
    : Math.min(180, Math.max(140, width * 0.4));
  const coreSize = 77;
  const place = venueName?.trim() || "este Espacio";
  const float = useSharedValue(0);

  useEffect(() => {
    float.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, [float]);

  const coreStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -float.value * 7 }],
  }));

  return (
    <View style={styles.page}>
      <View
        style={[styles.visual, { width: visualSize, height: visualSize }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Orbit size={visualSize * 0.72} delayMs={0} />
        <Orbit size={visualSize * 0.9} delayMs={1200} />
        <FloatDot
          style={{ top: "13%", right: "20%" }}
          size={9}
          delayMs={0}
          duration={2800}
        />
        <FloatDot
          style={{ bottom: "18%", left: "13%" }}
          size={6}
          delayMs={700}
          duration={3400}
        />
        <FloatDot
          style={{ right: "3%", bottom: "29%" }}
          size={5}
          delayMs={1100}
          duration={3100}
        />
        <Animated.View
          style={[
            styles.core,
            {
              width: coreSize,
              height: coreSize,
              borderRadius: coreSize / 2,
            },
            coreStyle,
          ]}
        >
          <Ionicons name="checkmark-done" size={32} color={colors.onPrimary} />
        </Animated.View>
      </View>

      <View style={styles.copy}>
        <Text style={styles.eyebrow}>Deck completo</Text>
        <Text style={styles.title}>Ya viste a todos por ahora</Text>
        <Text style={styles.body}>
          Recorriste todos los perfiles disponibles en{" "}
          <Text style={styles.venue}>{place}</Text>. Volvé más tarde: la noche
          siempre suma gente nueva.
        </Text>

        <View style={styles.actions}>
          <Pressable
            onPress={onReload}
            style={({ pressed }) => [
              styles.btnPrimary,
              pressed && { opacity: 0.9 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Volver a revisar"
          >
            <Ionicons name="refresh" size={18} color={colors.onPrimary} />
            <Text style={styles.btnPrimaryText}>Volver a revisar</Text>
          </Pressable>
          <Pressable
            onPress={onExploreVenues}
            style={({ pressed }) => [
              styles.btnOutline,
              pressed && { opacity: 0.9 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Explorar espacios"
          >
            <Ionicons name="location-outline" size={18} color={colors.text} />
            <Text style={styles.btnOutlineText}>Explorar espacios</Text>
          </Pressable>
        </View>

        <Text style={styles.note}>
          Solo aparecen personas publicadas en el mismo Espacio que vos.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  visual: {
    alignItems: "center",
    justifyContent: "center",
  },
  orbit: {
    position: "absolute",
    left: "50%",
    top: "50%",
    borderWidth: 1,
    borderColor: "rgba(214,255,75,0.22)",
  },
  core: {
    zIndex: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  dot: {
    position: "absolute",
    zIndex: 1,
    backgroundColor: colors.primary,
  },
  copy: {
    width: "100%",
    maxWidth: 420,
    alignItems: "center",
    gap: spacing.sm,
  },
  eyebrow: {
    color: colors.primary,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    letterSpacing: 2.2,
    textTransform: "uppercase",
    marginBottom: 0,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 28,
    letterSpacing: -0.03 * 28,
    textAlign: "center",
    lineHeight: 34,
  },
  body: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 24,
    textAlign: "center",
    maxWidth: 340,
    marginTop: 0,
  },
  venue: {
    color: colors.textMuted,
    fontFamily: fonts.bodyBold,
  },
  actions: {
    width: "100%",
    gap: 8,
    marginTop: spacing.sm,
  },
  btnPrimary: {
    minHeight: 46,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: spacing.md,
  },
  btnPrimaryText: {
    color: colors.onPrimary,
    fontFamily: fonts.bodyBold,
    fontSize: 16,
  },
  btnOutline: {
    minHeight: 46,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(242,240,235,0.35)",
    backgroundColor: "transparent",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: spacing.md,
  },
  btnOutlineText: {
    color: colors.text,
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
  },
  note: {
    marginTop: 4,
    color: "rgba(242,240,235,0.42)",
    fontFamily: fonts.body,
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
});

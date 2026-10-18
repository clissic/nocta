import { useEffect } from "react";
import {
  Image,
  Pressable,
  ScrollView,
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts, radii, spacing, tabBar } from "../../theme/tokens";

type Props = {
  onExploreVenues: () => void;
  onOpenProfile: () => void;
};

function Orbit({
  size,
  delayMs,
}: {
  size: number;
  delayMs: number;
}) {
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
          withTiming(1, { duration: duration / 2, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: duration / 2, easing: Easing.inOut(Easing.ease) })
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

/** Empty Discover sin presencia — parity web `.discover-empty-page`. */
export function DiscoverEmptyPresence({
  onExploreVenues,
  onOpenProfile,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const compact = height < 820;
  const visualSize = compact
    ? Math.min(148, width * 0.38)
    : Math.min(190, Math.max(150, width * 0.44));
  const coreSize = 76;
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
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.page,
        {
          paddingTop: spacing.md,
          paddingBottom: Math.max(insets.bottom, 10) + tabBar.height + spacing.md,
        },
      ]}
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
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
          <Image
            source={require("../../../assets/nocta-logo-negro-nobg.png")}
            style={styles.coreLogo}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
        </Animated.View>
      </View>

      <View style={styles.copy}>
        <Text style={styles.eyebrow}>Discover</Text>
        <Text style={styles.title}>La noche empieza en un Espacio</Text>
        <Text style={styles.body}>
          Publicá tu perfil para descubrir a las personas que están saliendo en
          el mismo lugar que vos.
        </Text>

        <View style={styles.actions}>
          <Pressable
            onPress={onExploreVenues}
            style={({ pressed }) => [
              styles.btnPrimary,
              pressed && { opacity: 0.9 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Explorar espacios"
          >
            <Ionicons name="location" size={18} color={colors.onPrimary} />
            <Text style={styles.btnPrimaryText}>Explorar espacios</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.onPrimary} />
          </Pressable>

          <Pressable
            onPress={onOpenProfile}
            style={({ pressed }) => [
              styles.btnOutline,
              pressed && { opacity: 0.9 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Ver mi perfil"
          >
            <Ionicons name="person-outline" size={18} color={colors.text} />
            <Text style={styles.btnOutlineText}>Ver mi perfil</Text>
          </Pressable>
        </View>

        <Text style={styles.note}>
          Tu perfil permanece oculto hasta que decidas publicarte.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.canvas },
  page: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.canvas,
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
    shadowColor: colors.primary,
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  coreLogo: {
    width: 38,
    height: 38,
  },
  dot: {
    position: "absolute",
    zIndex: 1,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.7,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
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
    marginBottom: 4,
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
    marginTop: 4,
  },
  actions: {
    width: "100%",
    gap: 10,
    marginTop: spacing.md,
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
    marginTop: spacing.sm,
    color: "rgba(242,240,235,0.42)",
    fontFamily: fonts.body,
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
});

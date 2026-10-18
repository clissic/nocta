import { useEffect } from "react";
import {
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
  onOpenDiscover: () => void;
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

/** Empty Likes — parity web `.likes-empty-page`. */
export function LikesEmptyPresence({
  onOpenDiscover,
  onExploreVenues,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const compact = height < 820;
  const visualSize = compact
    ? Math.min(148, width * 0.38)
    : Math.min(190, Math.max(150, width * 0.44));
  const coreSize = 68;
  const float = useSharedValue(0);
  const beat = useSharedValue(0);

  useEffect(() => {
    float.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
    beat.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 260, easing: Easing.out(Easing.ease) }),
        withTiming(0, { duration: 200, easing: Easing.in(Easing.ease) }),
        withTiming(0.7, { duration: 220, easing: Easing.out(Easing.ease) }),
        withTiming(0, { duration: 200, easing: Easing.in(Easing.ease) }),
        withTiming(0, { duration: 720 })
      ),
      -1,
      false
    );
  }, [beat, float]);

  const coreStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -float.value * 7 }],
  }));

  const heartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + beat.value * 0.16 }],
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
          <Animated.View style={heartStyle}>
            <Ionicons name="heart" size={28} color={colors.onPrimary} />
          </Animated.View>
        </Animated.View>
      </View>

      <View style={styles.copy}>
        <Text style={styles.eyebrow}>Likes</Text>
        <Text style={styles.title}>Todavía nadie te dio like</Text>
        <Text style={styles.body}>
          Cuando alguien del mismo Espacio te dé like, aparece acá para que
          puedas responder.
        </Text>

        <View style={styles.actions}>
          <Pressable
            onPress={onOpenDiscover}
            style={({ pressed }) => [
              styles.btnPrimary,
              pressed && { opacity: 0.9 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Ir al Discover"
          >
            <Ionicons name="flame" size={18} color={colors.onPrimary} />
            <Text style={styles.btnPrimaryText}>Ir al Discover</Text>
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
            <Text style={styles.btnOutlineText}>Explorar espacios</Text>
          </Pressable>
        </View>
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
    zIndex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  copy: {
    width: "100%",
    maxWidth: 384,
    alignItems: "center",
    gap: spacing.sm,
  },
  eyebrow: {
    color: colors.primary,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 2,
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
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  btnOutlineText: {
    color: colors.text,
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
  },
});

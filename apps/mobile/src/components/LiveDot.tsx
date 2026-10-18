import { useEffect } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

const DOT = 9;
const RING = 15;
const BOX = 28;

/** Punto “en vivo” — parity web `.live-dot` (rojo + pulso). */
export function LiveDot({ style }: { style?: StyleProp<ViewStyle> }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 1600, easing: Easing.out(Easing.ease) }),
      -1,
      false
    );
  }, [progress]);

  const haloStyle = useAnimatedStyle(() => {
    const t = Math.min(progress.value / 0.7, 1);
    return {
      opacity: 0.55 * (1 - t),
      transform: [{ scale: 1 + t * 1.8 }],
    };
  });

  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.9 * (1 - progress.value),
    transform: [{ scale: 0.7 + progress.value * 1.1 }],
  }));

  return (
    <View
      style={[styles.wrap, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
    >
      <Animated.View style={[styles.halo, haloStyle]} />
      <Animated.View style={[styles.ring, ringStyle]} />
      <View style={styles.core} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: BOX,
    height: BOX,
    margin: (DOT - BOX) / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  halo: {
    position: "absolute",
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: "rgba(255,59,59,0.55)",
  },
  ring: {
    position: "absolute",
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: 1,
    borderColor: "rgba(255,59,59,0.55)",
  },
  core: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: "#ff3b3b",
    zIndex: 1,
  },
});

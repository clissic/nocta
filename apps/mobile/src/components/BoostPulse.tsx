import { useEffect, type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

type Props = {
  active?: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Halo lima del Boost activo — parity web `boost-neon-pulse` (1,65s). */
export function BoostPulse({ active = true, children, style }: Props) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      progress.value = 0;
      return;
    }
    progress.value = withRepeat(
      withTiming(1, { duration: 1650, easing: Easing.inOut(Easing.ease) }),
      -1,
      false
    );
  }, [active, progress]);

  const glowStyle = useAnimatedStyle(() => {
    const t =
      progress.value <= 0.5 ? progress.value * 2 : (1 - progress.value) * 2;
    return { opacity: 0.22 + t * 0.4 };
  });

  const ringStyle = useAnimatedStyle(() => {
    const t =
      progress.value <= 0.5 ? progress.value * 2 : (1 - progress.value) * 2;
    return {
      opacity: 0.55 * (1 - t),
      transform: [{ scale: 1 + t * 0.28 }],
    };
  });

  return (
    <View style={[styles.host, style]} pointerEvents="box-none">
      {active ? (
        <>
          <Animated.View pointerEvents="none" style={[styles.glow, glowStyle]} />
          <Animated.View pointerEvents="none" style={[styles.ring, ringStyle]} />
        </>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "relative",
    overflow: "visible",
  },
  glow: {
    ...StyleSheet.absoluteFill,
    borderRadius: 999,
    backgroundColor: "rgba(214,255,75,0.28)",
  },
  ring: {
    ...StyleSheet.absoluteFill,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(214,255,75,0.55)",
  },
});

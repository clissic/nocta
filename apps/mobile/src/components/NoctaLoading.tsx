import { useEffect } from "react";
import { Image, StyleSheet, Text, View, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { colors, fonts, spacing } from "../theme/tokens";

type Variant = "screen" | "block" | "inline";

type Props = {
  variant?: Variant;
  /** Solo accesibilidad; el visual es siempre “☾argando…”. */
  label?: string;
  style?: ViewStyle;
  /**
   * `light` = texto claro (fondos oscuros).
   * `dark` = texto oscuro (p. ej. botón primary lima `#d6ff4b`).
   */
  tone?: "light" | "dark";
  /** Sin minHeight/padding extra — para meterse en un botón sin cambiar su tamaño. */
  compact?: boolean;
};

const WORD_SIZE: Record<Variant, number> = {
  screen: 42,
  block: 30,
  inline: 18,
};

function PulseRing({
  size,
  delayMs,
  borderColor,
}: {
  size: number;
  delayMs: number;
  borderColor: string;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delayMs,
      withRepeat(
        withTiming(1, {
          duration: 2400,
          easing: Easing.out(Easing.ease),
        }),
        -1,
        false
      )
    );
  }, [delayMs, progress]);

  const style = useAnimatedStyle(() => {
    const t = progress.value;
    // t = 0 (también durante el delay) queda invisible, para que la luna
    // se vea sola antes de que el anillo se abra.
    let opacity = 0;
    if (t <= 0.12) {
      opacity = (t / 0.12) * 0.72;
    } else if (t <= 0.75) {
      opacity = 0.72 + (0.12 - 0.72) * ((t - 0.12) / (0.75 - 0.12));
    } else {
      opacity = 0.12 * (1 - (t - 0.75) / 0.25);
    }
    return {
      opacity,
      transform: [{ scale: 0.42 + t * (1.38 - 0.42) }],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ring,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          marginLeft: -size / 2,
          marginTop: -size / 2,
          borderColor,
        },
        style,
      ]}
    />
  );
}

function LoadingDot({
  fontSize,
  delayMs,
  color,
}: {
  fontSize: number;
  delayMs: number;
  color: string;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delayMs,
      withRepeat(
        withTiming(1, {
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
        }),
        -1,
        false
      )
    );
  }, [delayMs, progress]);

  const style = useAnimatedStyle(() => {
    // 0–40%: up to 1 · 40–80%: down to 0.2 · 80–100%: hold 0.2
    const t = progress.value;
    let opacity = 0.2;
    if (t < 0.4) {
      opacity = 0.2 + (t / 0.4) * 0.8;
    } else if (t < 0.8) {
      opacity = 1 - ((t - 0.4) / 0.4) * 0.8;
    }
    return { opacity };
  });

  return (
    <Animated.Text
      style={[
        styles.dot,
        {
          color,
          fontSize,
          lineHeight: fontSize,
          letterSpacing: 0.02 * fontSize,
        },
        style,
      ]}
    >
      .
    </Animated.Text>
  );
}

/** Parity web `.nocta-loading`: luna limaneon + “argando…” con anillos y dots animados. */
export function NoctaLoading({
  variant = "screen",
  label = "Cargando",
  style,
  tone = "light",
  compact = false,
}: Props) {
  const hero = variant === "screen" && !compact;
  const fontSize = compact ? 15 : hero ? 22 : WORD_SIZE[variant];
  const moon = hero ? 84 : fontSize * 0.86;
  const moonSlotW = hero ? moon : fontSize * 1.02;
  const moonSlotH = hero ? moon : fontSize;
  const ringsBox = hero ? moon * 2.05 : fontSize * (compact ? 2.1 : 2.55);
  const ringSize = ringsBox * 0.76; // inset ~12% → usable diameter
  const onLime = tone === "dark";
  const textColor = onLime ? colors.onPrimary : "#fff";
  // Luna limaneon desaparece sobre el botón primary; usar luna negra.
  const moonSource = onLime
    ? require("../../assets/nocta-logo-negro-nobg.png")
    : require("../../assets/nocta-logo-limaneon-nobg.png");
  const ringColor = onLime
    ? "rgba(17,17,17,0.45)"
    : "rgba(214,255,75,0.55)";

  return (
    <View
      style={[
        styles.base,
        variant === "screen" && !compact && styles.screen,
        variant === "block" && !compact && styles.block,
        variant === "inline" && !compact && styles.inline,
        compact && styles.compact,
        style,
      ]}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
    >
      <View style={styles.word}>
        <View
          style={[
            styles.moonSlot,
            {
              width: moonSlotW,
              height: moonSlotH,
              marginLeft: hero ? -4 : -0.04 * fontSize,
              marginRight: hero ? 2 : 0.02 * fontSize,
            },
          ]}
        >
          <View
            style={[
              styles.rings,
              {
                width: ringsBox,
                height: ringsBox,
                marginLeft: -ringsBox / 2,
                marginTop: -ringsBox / 2,
              },
            ]}
            pointerEvents="none"
          >
            <PulseRing size={ringSize} delayMs={0} borderColor={ringColor} />
            <PulseRing size={ringSize} delayMs={800} borderColor={ringColor} />
            <PulseRing size={ringSize} delayMs={1600} borderColor={ringColor} />
          </View>
          <Image
            source={moonSource}
            style={{
              width: moon,
              height: moon,
              shadowColor: onLime ? "#000" : colors.primary,
              shadowOpacity: onLime ? 0.15 : 0.35,
              shadowRadius: compact ? 4 : 8,
              shadowOffset: { width: 0, height: 0 },
            }}
            resizeMode="contain"
          />
        </View>

        <Text
          style={[
            styles.rest,
            {
              color: textColor,
              fontSize,
              lineHeight: fontSize,
              letterSpacing: -0.03 * fontSize,
            },
          ]}
        >
          argando
        </Text>

        <View style={styles.dots}>
          <LoadingDot fontSize={fontSize} delayMs={0} color={textColor} />
          <LoadingDot fontSize={fontSize} delayMs={200} color={textColor} />
          <LoadingDot fontSize={fontSize} delayMs={400} color={textColor} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  screen: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  block: {
    minHeight: 192,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  inline: {
    minHeight: 72,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  compact: {
    width: undefined,
    minHeight: 0,
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  word: {
    flexDirection: "row",
    alignItems: "center",
  },
  moonSlot: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  rings: {
    position: "absolute",
    left: "50%",
    top: "50%",
    zIndex: 0,
  },
  ring: {
    position: "absolute",
    left: "50%",
    top: "50%",
    borderWidth: 1.5,
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  rest: {
    fontFamily: fonts.display,
  },
  dots: {
    flexDirection: "row",
    marginLeft: 1,
  },
  dot: {
    fontFamily: fonts.display,
  },
});

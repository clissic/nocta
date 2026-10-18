import { useEffect } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { NoctaImage } from "../NoctaImage";
import { HeartshotIcon } from "./HeartshotIcon";
import { colors, fonts, radii, spacing } from "../../theme/tokens";

export const SWIPE_THRESHOLD = 110;
const STAMP_START = 24;

export type SwipeExit = "like" | "pass" | "heartshot";

/**
 * Una sola intención dominante: evita stamps LIKE/NOPE + Heartshot a la vez
 * en gestos diagonales (arriba + inclinación).
 */
function dominantIntent(
  x: number,
  y: number,
  allowHeartshot: boolean
): SwipeExit | null {
  "worklet";
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  if (allowHeartshot && y < -STAMP_START && ay >= ax * 0.9) {
    return "heartshot";
  }
  if (x > STAMP_START) return "like";
  if (x < -STAMP_START) return "pass";
  return null;
}

export type CardDetail = {
  icon?: keyof typeof Ionicons.glyphMap;
  label?: string;
  body?: string;
  cta?: string;
};

type Props = {
  photo?: string | null;
  photosCount?: number;
  photoIndex?: number;
  title: string;
  subtitle?: string;
  eyebrow?: string;
  detail?: CardDetail | null;
  isAd?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  onSwipe: (direction: SwipeExit) => void;
  onExpand?: () => void;
  onPhotoStep?: (delta: -1 | 1) => void;
  /** Programa una salida animada desde botones (like / pass / heartshot). */
  programmedExit?: SwipeExit | null;
  /** Espacio inferior del nombre para que no quede bajo los botones de la carta. */
  metaBottom?: number;
};

function CardGradient() {
  return (
    <LinearGradient
      pointerEvents="none"
      colors={[
        "transparent",
        "rgba(0,0,0,0.15)",
        "rgba(0,0,0,0.45)",
        "rgba(0,0,0,0.78)",
        "rgba(0,0,0,0.92)",
      ]}
      locations={[0, 0.28, 0.52, 0.78, 1]}
      style={styles.gradient}
    />
  );
}

export function SwipeCard({
  photo,
  photosCount = 1,
  photoIndex = 0,
  title,
  subtitle,
  eyebrow,
  detail,
  isAd,
  disabled,
  style,
  onSwipe,
  onExpand,
  onPhotoStep,
  programmedExit,
  metaBottom,
}: Props) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const exiting = useSharedValue(0);

  const notifySwipe = (dir: SwipeExit) => {
    onSwipe(dir);
  };

  const flyOut = (dir: SwipeExit) => {
    "worklet";
    if (exiting.value) return;
    exiting.value = 1;
    const toX = dir === "like" ? 520 : dir === "pass" ? -520 : 0;
    const toY =
      dir === "heartshot" ? -640 : dir === "like" || dir === "pass" ? 48 : 0;
    tx.value = withTiming(toX, { duration: 260 });
    ty.value = withTiming(toY, { duration: 260 }, (done) => {
      if (done) runOnJS(notifySwipe)(dir);
    });
  };

  useEffect(() => {
    if (!programmedExit || disabled) return;
    const dir = programmedExit;
    exiting.value = 1;
    const toX = dir === "like" ? 520 : dir === "pass" ? -520 : 0;
    const toY =
      dir === "heartshot" ? -640 : dir === "like" || dir === "pass" ? 48 : 0;
    tx.value = withTiming(toX, { duration: 260 });
    ty.value = withTiming(toY, { duration: 260 }, (done) => {
      if (done) runOnJS(notifySwipe)(dir);
    });
    // Intentional: animate once per programmedExit change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programmedExit, disabled]);

  const pan = Gesture.Pan()
    .enabled(!disabled && !programmedExit)
    .activeOffsetX([-12, 12])
    .activeOffsetY([-12, 12])
    .onUpdate((e) => {
      if (exiting.value) return;
      tx.value = e.translationX;
      ty.value = e.translationY * 0.85;
    })
    .onEnd((e) => {
      if (exiting.value) return;
      const x = e.translationX;
      const y = e.translationY;
      const intent = dominantIntent(x, y, !isAd);
      const commit =
        intent === "heartshot"
          ? Math.abs(y) >= SWIPE_THRESHOLD
          : intent === "like" || intent === "pass"
            ? Math.abs(x) >= SWIPE_THRESHOLD
            : false;
      if (intent && commit) {
        flyOut(intent);
        return;
      }
      tx.value = withSpring(0, { damping: 16, stiffness: 200 });
      ty.value = withSpring(0, { damping: 16, stiffness: 200 });
    });

  const cardStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      tx.value,
      [-240, 0, 240],
      [-16, 0, 16],
      Extrapolation.CLAMP
    );
    return {
      transform: [
        { translateX: tx.value },
        { translateY: ty.value },
        { rotate: `${rotate}deg` },
      ],
    };
  });

  const likeStampStyle = useAnimatedStyle(() => {
    const intent = dominantIntent(tx.value, ty.value, !isAd);
    if (intent !== "like") {
      return { opacity: 0, transform: [{ scale: 0.85 }] };
    }
    return {
      opacity: interpolate(
        tx.value,
        [STAMP_START, SWIPE_THRESHOLD],
        [0, 1],
        Extrapolation.CLAMP
      ),
      transform: [
        {
          scale: interpolate(
            tx.value,
            [STAMP_START, SWIPE_THRESHOLD],
            [0.85, 1],
            Extrapolation.CLAMP
          ),
        },
      ],
    };
  });

  const passStampStyle = useAnimatedStyle(() => {
    const intent = dominantIntent(tx.value, ty.value, !isAd);
    if (intent !== "pass") {
      return { opacity: 0, transform: [{ scale: 0.85 }] };
    }
    return {
      opacity: interpolate(
        tx.value,
        [-SWIPE_THRESHOLD, -STAMP_START],
        [1, 0],
        Extrapolation.CLAMP
      ),
      transform: [
        {
          scale: interpolate(
            tx.value,
            [-SWIPE_THRESHOLD, -STAMP_START],
            [1, 0.85],
            Extrapolation.CLAMP
          ),
        },
      ],
    };
  });

  const heartStampStyle = useAnimatedStyle(() => {
    const intent = dominantIntent(tx.value, ty.value, !isAd);
    if (intent !== "heartshot") {
      return { opacity: 0, transform: [{ scale: 0.85 }] };
    }
    return {
      opacity: interpolate(
        ty.value,
        [-SWIPE_THRESHOLD, -STAMP_START],
        [1, 0],
        Extrapolation.CLAMP
      ),
      transform: [
        {
          scale: interpolate(
            ty.value,
            [-SWIPE_THRESHOLD, -STAMP_START],
            [1, 0.85],
            Extrapolation.CLAMP
          ),
        },
      ],
    };
  });

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.card, style, cardStyle]}>
        {photo ? (
          <NoctaImage src={photo} style={styles.photo} contentFit="cover" />
        ) : (
          <View style={[styles.photo, styles.photoFallback]} />
        )}
        <CardGradient />

        {!isAd && photosCount > 1 ? (
          <View style={styles.segments} pointerEvents="none">
            {Array.from({ length: photosCount }).map((_, i) => (
              <View
                key={i}
                style={[styles.segment, i === photoIndex && styles.segmentOn]}
              />
            ))}
          </View>
        ) : null}

        {!isAd && onPhotoStep && photosCount > 1 ? (
          <View style={styles.photoHits} pointerEvents="box-none">
            <Pressable
              style={styles.photoHit}
              onPress={() => onPhotoStep(-1)}
              accessibilityLabel="Foto anterior"
            />
            <Pressable
              style={styles.photoHit}
              onPress={() => onPhotoStep(1)}
              accessibilityLabel="Foto siguiente"
            />
          </View>
        ) : null}

        <Animated.View
          style={[styles.stamp, styles.stampLike, likeStampStyle]}
          pointerEvents="none"
        >
          <Ionicons name="heart" size={64} color={colors.primary} />
        </Animated.View>
        <Animated.View
          style={[styles.stamp, styles.stampPass, passStampStyle]}
          pointerEvents="none"
        >
          <Ionicons name="close" size={72} color={colors.danger} />
        </Animated.View>
        {!isAd ? (
          <Animated.View
            style={[styles.stamp, styles.stampHeart, heartStampStyle]}
            pointerEvents="none"
          >
            <HeartshotIcon size={64} color="#c4b5fd" />
          </Animated.View>
        ) : null}

        <View
          style={[
            styles.meta,
            metaBottom != null && { paddingBottom: metaBottom },
          ]}
        >
          <View style={styles.metaHeading}>
            <View style={styles.metaTextCol}>
              {eyebrow ? (
                <Text style={styles.eyebrow} numberOfLines={1}>
                  {eyebrow}
                </Text>
              ) : null}
              <Text style={styles.title} numberOfLines={2}>
                {title}
              </Text>
              {subtitle ? (
                <Text style={styles.subtitle} numberOfLines={2}>
                  {subtitle}
                </Text>
              ) : null}
              {detail?.label ? (
                <View style={styles.extraLabel}>
                  {detail.icon ? (
                    <Ionicons
                      name={detail.icon}
                      size={13}
                      color={colors.textMuted}
                    />
                  ) : null}
                  <Text style={styles.extraLabelText}>{detail.label}</Text>
                </View>
              ) : null}
              {detail?.body ? (
                <Text style={styles.extraBody} numberOfLines={4}>
                  {detail.body}
                </Text>
              ) : null}
              {detail?.cta ? (
                <Text style={styles.extraCta}>{detail.cta}</Text>
              ) : null}
            </View>
            {!isAd && onExpand ? (
              <Pressable
                onPress={onExpand}
                accessibilityLabel="Ver perfil ampliado"
                style={styles.expandBtn}
              >
                <Ionicons name="chevron-up" size={22} color={colors.text} />
              </Pressable>
            ) : null}
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

/** Carta de fondo (siguiente perfil) sin gestos. */
export function SwipeCardBack({
  photo,
  title,
  style,
}: {
  photo?: string | null;
  title: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.card, styles.cardBack, style]}>
      {photo ? (
        <NoctaImage src={photo} style={styles.photo} contentFit="cover" />
      ) : (
        <View style={[styles.photo, styles.photoFallback]} />
      )}
      <CardGradient />
      <View style={styles.meta}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...StyleSheet.absoluteFill,
    borderRadius: radii.xl,
    overflow: "hidden",
    backgroundColor: colors.panel,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  cardBack: {
    transform: [{ scale: 0.96 }],
    opacity: 0.92,
  },
  photo: {
    ...StyleSheet.absoluteFill,
    width: "100%",
    height: "100%",
  },
  photoFallback: {
    backgroundColor: colors.elevated,
  },
  photoHits: {
    ...StyleSheet.absoluteFill,
    flexDirection: "row",
    zIndex: 3,
  },
  photoHit: {
    flex: 1,
  },
  segments: {
    position: "absolute",
    top: spacing.sm,
    left: spacing.sm,
    right: spacing.sm,
    flexDirection: "row",
    gap: 4,
    zIndex: 4,
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
  gradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "55%",
  },
  stamp: {
    position: "absolute",
    top: "16%",
    zIndex: 5,
  },
  stampLike: {
    left: "10%",
    transform: [{ rotate: "-12deg" }],
  },
  stampPass: {
    right: "10%",
    transform: [{ rotate: "12deg" }],
  },
  stampHeart: {
    left: 0,
    right: 0,
    top: "18%",
    alignItems: "center",
  },
  meta: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
    zIndex: 6,
  },
  metaHeading: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
  },
  metaTextCol: {
    flex: 1,
    gap: 4,
  },
  expandBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  eyebrow: {
    color: colors.primary,
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 28,
    letterSpacing: -0.03 * 28,
  },
  subtitle: {
    color: "rgba(242,240,235,0.85)",
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
  },
  extraLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  extraLabelText: {
    color: colors.textMuted,
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    letterSpacing: 0.2,
  },
  extraBody: {
    color: "rgba(242,240,235,0.9)",
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 19,
  },
  extraCta: {
    marginTop: 6,
    color: "rgba(255,255,255,0.85)",
    fontFamily: fonts.body,
    fontSize: 13,
  },
});

import { useEffect } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts, radii, spacing } from "../theme/tokens";
import { NoctaWordmark } from "./NoctaWordmark";

export type AuthVariant = "login" | "register" | "verify" | "forgot" | "reset";

const CONTENT: Record<
  AuthVariant,
  {
    eyebrow: string;
    title: string;
    venue: string;
    status: string;
    left: string;
    right: string;
    link: string;
  }
> = {
  login: {
    eyebrow: "Esta noche",
    title: "Tu próxima conexión está más cerca.",
    venue: "Mona Club",
    status: "32 personas ahora",
    left: "L",
    right: "M",
    link: "Mismo Espacio",
  },
  register: {
    eyebrow: "Tu perfil, tus reglas",
    title: "Mostrate solo cuando salís.",
    venue: "Perfil privado",
    status: "Oculto hasta publicar",
    left: "V",
    right: "S",
    link: "Conexiones reales",
  },
  verify: {
    eyebrow: "Un paso más",
    title: "Confirmá que sos vos.",
    venue: "Código enviado",
    status: "Seguro · 15 minutos",
    left: "N",
    right: "✓",
    link: "Cuenta protegida",
  },
  forgot: {
    eyebrow: "Recuperá el acceso",
    title: "Te mandamos un link seguro.",
    venue: "Email de recuperación",
    status: "Válido · 15 minutos",
    left: "R",
    right: "K",
    link: "Solo vos",
  },
  reset: {
    eyebrow: "Nueva clave",
    title: "Elegí una contraseña fuerte.",
    venue: "Restablecer acceso",
    status: "Listo para entrar",
    left: "N",
    right: "✓",
    link: "Cuenta protegida",
  },
};

/** Login / register / forgot: sin escena, panel centrado + wordmark. */
function isCenteredAuth(variant: AuthVariant) {
  return (
    variant === "login" || variant === "register" || variant === "forgot"
  );
}

/** Respiración continua (escena register/verify/reset). */
function breatheLoop(delayMs = 0) {
  return withDelay(
    delayMs,
    withRepeat(
      withTiming(1, {
        duration: 3200,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true
    )
  );
}

function AuthScene({ variant }: { variant: AuthVariant }) {
  const c = CONTENT[variant];
  const ringA = useSharedValue(0);
  const ringB = useSharedValue(0);
  const linkOp = useSharedValue(0);
  const float = useSharedValue(0);
  const glow = useSharedValue(0);

  useEffect(() => {
    ringA.value = withRepeat(
      withTiming(1, { duration: 3600, easing: Easing.out(Easing.ease) }),
      -1,
      false
    );
    ringB.value = withDelay(
      1800,
      withRepeat(
        withTiming(1, { duration: 3600, easing: Easing.out(Easing.ease) }),
        -1,
        false
      )
    );
    linkOp.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1400 }),
        withTiming(0, { duration: 1400 })
      ),
      -1,
      false
    );
    float.value = breatheLoop(0);
    glow.value = breatheLoop(1100);
  }, [ringA, ringB, linkOp, float, glow]);

  const ringOneStyle = useAnimatedStyle(() => ({
    opacity: ringA.value < 0.35 ? ringA.value / 0.35 : 1 - (ringA.value - 0.35) / 0.65,
    transform: [{ scale: 0.65 + ringA.value * 0.6 }],
  }));
  const ringTwoStyle = useAnimatedStyle(() => ({
    opacity: ringB.value < 0.35 ? ringB.value / 0.35 : 1 - (ringB.value - 0.35) / 0.65,
    transform: [{ scale: 0.65 + ringB.value * 0.6 }],
  }));
  const linkStyle = useAnimatedStyle(() => ({
    opacity: 0.25 + linkOp.value * 0.55,
  }));
  const coreStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -float.value * 6 }],
  }));
  const leftStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: float.value * 4 },
      { translateY: -float.value * 5 },
    ],
  }));
  const rightStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: -float.value * 4 },
      { translateY: float.value * 5 },
    ],
  }));
  const glowOneStyle = useAnimatedStyle(() => ({
    opacity: 0.45 + glow.value * 0.45,
    transform: [{ scale: 0.92 + glow.value * 0.12 }],
  }));
  const glowTwoStyle = useAnimatedStyle(() => ({
    opacity: 0.4 + (1 - glow.value) * 0.4,
    transform: [{ scale: 0.92 + (1 - glow.value) * 0.12 }],
  }));

  return (
    <View style={styles.scene} pointerEvents="none">
      <Animated.View style={[styles.ambientGlow, styles.ambientGlowOne, glowOneStyle]} />
      <Animated.View style={[styles.ambientGlow, styles.ambientGlowTwo, glowTwoStyle]} />

      <View style={styles.sceneCopy}>
        <Text style={styles.eyebrow}>{c.eyebrow}</Text>
        <Text style={styles.sceneTitle}>{c.title}</Text>
      </View>

      <View style={styles.network}>
        <Animated.View style={[styles.ring, styles.ringOne, ringOneStyle]} />
        <Animated.View style={[styles.ring, styles.ringTwo, ringTwoStyle]} />
        <Animated.View style={[styles.linkLine, linkStyle]} />
        <Animated.View style={[styles.avatar, styles.avatarLeft, leftStyle]}>
          <Text style={styles.avatarText}>{c.left}</Text>
        </Animated.View>
        <Animated.View style={[styles.core, coreStyle]}>
          {variant === "login" ? (
            <Image
              source={require("../../assets/nocta-logo-limaneon-nobg.png")}
              style={styles.coreMoon}
              resizeMode="contain"
            />
          ) : (
            <Text style={styles.coreLetter}>N</Text>
          )}
        </Animated.View>
        <Animated.View style={[styles.avatar, styles.avatarRight, rightStyle]}>
          <Text style={styles.avatarText}>{c.right}</Text>
        </Animated.View>
      </View>

      <Text style={styles.connection}>{c.link}</Text>

      <View style={styles.venueSignal}>
        <View style={styles.venuePulse} />
        <View>
          <Text style={styles.venueName}>{c.venue}</Text>
          <Text style={styles.venueStatus}>{c.status}</Text>
        </View>
      </View>
    </View>
  );
}

type ShellProps = {
  variant: AuthVariant;
  children: React.ReactNode;
  /** Wordmark grande encima del formulario (login/forgot). */
  showBrand?: boolean;
  tagline?: string;
};

/**
 * Shell de auth alineado a web mobile:
 * - login / forgot → panel centrado, sin escena, wordmark con glow
 * - register / verify / reset → escena animada + panel inferior
 */
export function AuthShell({
  variant,
  children,
  showBrand,
  tagline,
}: ShellProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const centered = isCenteredAuth(variant);
  const brand = showBrand ?? centered;
  // web mobile login: clamp(3.5rem, 17vw, 5rem) → 56–80px
  const loginSize = Math.round(Math.min(80, Math.max(56, width * 0.17)));
  const forgotSize = Math.round(Math.min(64, Math.max(48, width * 0.14)));

  if (centered) {
    // Mismo wordmark grande en login y register; forgot un poco menor
    const heroBrand = variant === "login" || variant === "register";
    const wordmarkSize = heroBrand ? loginSize : forgotSize;
    return (
      <View
        style={[
          styles.shell,
          {
            paddingTop: insets.top,
            paddingBottom: Math.max(insets.bottom, spacing.md),
          },
        ]}
      >
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.centeredScroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {brand ? (
              <View
                style={[styles.brandBlock, heroBrand && styles.brandBlockLogin]}
              >
                <NoctaWordmark
                  size={wordmarkSize}
                  style={styles.brandCenter}
                />
                {tagline ? (
                  <Text
                    style={[styles.tagline, heroBrand && styles.taglineLogin]}
                  >
                    {tagline}
                  </Text>
                ) : null}
              </View>
            ) : null}
            <View style={styles.centeredForm}>{children}</View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  }

  return (
    <View style={[styles.shell, { paddingTop: insets.top }]}>
      <AuthScene variant={variant} />
      <View
        style={[
          styles.bottomPanel,
          { paddingBottom: Math.max(insets.bottom, spacing.lg) },
        ]}
      >
        {brand ? (
          <View style={styles.brandBlockCompact}>
            <NoctaWordmark size={32} style={styles.brandCenter} />
          </View>
        ) : null}
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.sceneFormScroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  flex: { flex: 1 },
  /** Brand + form centrados en el viewport; scrollea si no entra. */
  centeredScroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  centeredForm: {
    width: "100%",
  },
  sceneFormScroll: {
    flexGrow: 1,
    paddingBottom: spacing.md,
  },
  brandBlock: {
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  brandBlockLogin: {
    marginBottom: spacing.xl,
  },
  brandBlockCompact: {
    marginBottom: spacing.md,
  },
  brandCenter: { alignSelf: "center" },
  tagline: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 320,
    marginTop: spacing.sm,
  },
  taglineLogin: {
    // web: .auth-tagline { margin-bottom: 2rem } + text-secondary
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 340,
  },
  scene: {
    minHeight: 250,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    overflow: "hidden",
  },
  ambientGlow: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
  },
  ambientGlowOne: {
    top: -48,
    left: -56,
    backgroundColor: "rgba(214,255,75,0.18)",
  },
  ambientGlowTwo: {
    top: 36,
    right: -64,
    backgroundColor: "rgba(77,104,255,0.18)",
  },
  sceneCopy: {
    maxWidth: 300,
    zIndex: 1,
  },
  eyebrow: {
    color: colors.primary,
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    marginBottom: spacing.xs,
  },
  sceneTitle: {
    color: "rgba(242,240,235,0.94)",
    fontFamily: fonts.display,
    fontSize: 22,
    letterSpacing: -0.03 * 22,
    lineHeight: 26,
  },
  network: {
    height: 100,
    marginTop: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
    borderWidth: 1,
    borderColor: "rgba(214,255,75,0.22)",
    borderRadius: 999,
  },
  ringOne: { width: 102, height: 102 },
  ringTwo: { width: 144, height: 144 },
  linkLine: {
    position: "absolute",
    width: "55%",
    height: 1,
    backgroundColor: colors.primary,
  },
  avatar: {
    position: "absolute",
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.elevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLeft: { left: "12%" },
  avatarRight: { right: "12%" },
  avatarText: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 14,
    fontWeight: "800",
  },
  core: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.primaryDim,
    alignItems: "center",
    justifyContent: "center",
  },
  coreMoon: { width: 32, height: 32 },
  coreLetter: {
    color: colors.primary,
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "800",
  },
  connection: {
    marginTop: spacing.xs,
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 13,
    textAlign: "center",
  },
  venueSignal: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    alignSelf: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: "rgba(18,18,20,0.72)",
    borderWidth: 1,
    borderColor: colors.border,
  },
  venuePulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  venueName: {
    color: colors.text,
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
  },
  venueStatus: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 11,
  },
  bottomPanel: {
    flex: 1,
    backgroundColor: "rgba(10,10,11,0.92)",
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
});

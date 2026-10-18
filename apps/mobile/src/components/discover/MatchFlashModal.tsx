import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NoctaImage } from "../NoctaImage";
import { Button } from "../ui";
import { colors, fonts, radii, spacing } from "../../theme/tokens";

type Props = {
  visible: boolean;
  name?: string;
  photo?: string | null;
  venueName?: string | null;
  onClose: () => void;
  onOpenChat: () => void;
};

function MatchRing({ delayMs }: { delayMs: number }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delayMs),
        Animated.timing(progress, {
          toValue: 1,
          duration: 1800,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [delayMs, progress]);

  const scale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.55, 1.55],
  });
  const opacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.7, 0],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ring,
        { opacity, transform: [{ scale }] },
      ]}
    />
  );
}

export function MatchFlashModal({
  visible,
  name,
  photo,
  venueName,
  onClose,
  onOpenChat,
}: Props) {
  const panel = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      panel.setValue(0);
      return;
    }
    Animated.timing(panel, {
      toValue: 1,
      duration: 550,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: true,
    }).start();
  }, [visible, panel]);

  const panelStyle = {
    opacity: panel,
    transform: [
      {
        scale: panel.interpolate({
          inputRange: [0, 1],
          outputRange: [0.92, 1],
        }),
      },
      {
        translateY: panel.interpolate({
          inputRange: [0, 1],
          outputRange: [12, 0],
        }),
      },
    ],
  };

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          style={styles.dismiss}
          onPress={onClose}
          accessibilityLabel="Cerrar"
        />
        <Animated.View style={[styles.panel, panelStyle]}>
          <View style={styles.burst}>
            <View style={styles.rings} pointerEvents="none">
              <MatchRing delayMs={0} />
              <MatchRing delayMs={450} />
              <MatchRing delayMs={900} />
            </View>
            <View style={styles.photoWrap}>
              {photo ? (
                <NoctaImage
                  src={photo}
                  variant="thumb"
                  style={styles.photo}
                  contentFit="cover"
                />
              ) : (
                <Ionicons name="heart" size={34} color={colors.primary} />
              )}
            </View>
          </View>

          <Text style={styles.kicker}>¡Es un match!</Text>
          <Text style={styles.title}>{name}</Text>
          <Text style={styles.sub}>
            Ambos se gustaron en {venueName?.trim() || "el espacio"}.
          </Text>

          <View style={styles.actions}>
            <Button label="Ir al chat" onPress={onOpenChat} style={styles.actionBtn} />
            <Button
              label="Seguir descubriendo"
              variant="outline"
              onPress={onClose}
              style={[styles.actionBtn, styles.actionOutline]}
            />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const PHOTO = 68;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
    backgroundColor: "#000",
  },
  dismiss: {
    ...StyleSheet.absoluteFillObject,
  },
  panel: {
    width: "100%",
    maxWidth: 352,
    alignItems: "center",
    zIndex: 1,
  },
  burst: {
    width: 120,
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
  },
  rings: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 0,
  },
  ring: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "rgba(214,255,75,0.45)",
  },
  photoWrap: {
    width: PHOTO,
    height: PHOTO,
    borderRadius: PHOTO / 2,
    overflow: "hidden",
    zIndex: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.elevated,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  photo: {
    width: "100%",
    height: "100%",
  },
  kicker: {
    marginBottom: 6,
    fontFamily: fonts.display,
    fontSize: 13,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: colors.primary,
    textAlign: "center",
  },
  title: {
    marginBottom: 6,
    fontFamily: fonts.display,
    fontSize: 30,
    letterSpacing: -0.03 * 30,
    lineHeight: 34,
    color: colors.text,
    textAlign: "center",
  },
  sub: {
    marginBottom: 22,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 21,
    color: colors.textMuted,
    textAlign: "center",
  },
  actions: {
    width: "100%",
    gap: 9,
  },
  actionBtn: {
    marginTop: 0,
    width: "100%",
    borderRadius: radii.md,
  },
  actionOutline: {
    borderColor: "rgba(242,240,235,0.28)",
  },
});

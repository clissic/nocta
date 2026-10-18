import {
  Image,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { colors, fonts } from "../theme/tokens";

type Props = {
  style?: StyleProp<ViewStyle>;
  /** Tamaño de las letras (em ≈ px). Luna = 0.86em como en web. */
  size?: number;
  /** @deprecated Sin efecto; se mantiene por compatibilidad de call sites. */
  moonGlow?: boolean;
};

/**
 * Wordmark tipográfico de marca: `no` + luna limaneon + `ta`.
 * Syne ExtraBold vía archivo de fuente (sin fontWeight — en Android
 * fontWeight + familia custom suele caer al sans del sistema).
 */
export function NoctaWordmark({ style, size = 36 }: Props) {
  const moon = Math.round(size * 0.86);
  return (
    <View
      style={[styles.row, style]}
      accessible
      accessibilityLabel="Nocta"
    >
      <Text
        style={[styles.letter, { fontSize: size, letterSpacing: -0.03 * size }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        no
      </Text>
      <Image
        source={require("../../assets/nocta-logo-limaneon-nobg.png")}
        style={{
          width: moon,
          height: moon,
          marginLeft: -size * 0.05,
          marginRight: -size * 0.02,
        }}
        resizeMode="contain"
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      <Text
        style={[styles.letter, { fontSize: size, letterSpacing: -0.03 * size }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        ta
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  letter: {
    color: colors.text,
    fontFamily: fonts.display,
    includeFontPadding: false,
  },
});

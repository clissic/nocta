import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { create } from "qrcode";
import Svg, { Rect } from "react-native-svg";
import { colors, fonts } from "../../theme/tokens";

type Props = {
  payload: string;
  size?: number;
};

const QUIET = 2;

export function PromoQrCode({ payload, size = 240 }: Props) {
  const matrix = useMemo(() => {
    try {
      return create(payload, { errorCorrectionLevel: "M" }).modules;
    } catch {
      return null;
    }
  }, [payload]);

  if (!matrix) {
    return (
      <Text style={styles.fallback}>
        No se pudo generar el QR. Mostrá este código en puerta: {payload}
      </Text>
    );
  }

  const total = matrix.size + QUIET * 2;
  const cell = size / total;
  const dark: Array<{ x: number; y: number }> = [];
  for (let row = 0; row < matrix.size; row += 1) {
    for (let col = 0; col < matrix.size; col += 1) {
      if (matrix.get(row, col)) {
        dark.push({
          x: (col + QUIET) * cell,
          y: (row + QUIET) * cell,
        });
      }
    }
  }

  return (
    <View style={[styles.frame, { width: size, height: size }]}>
      <Svg width={size} height={size} accessibilityLabel="Código QR de la promoción">
        <Rect x={0} y={0} width={size} height={size} fill="#ffffff" />
        {dark.map((dot, index) => (
          <Rect
            key={index}
            x={dot.x}
            y={dot.y}
            width={cell}
            height={cell}
            fill="#0a0a0b"
          />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#ffffff",
  },
  fallback: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
  },
});

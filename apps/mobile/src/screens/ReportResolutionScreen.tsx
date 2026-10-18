import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import {
  REPORT_REASON_LABELS,
  SUSPENSION_DURATION_LABELS,
  type MyReportResolution,
} from "@nocta/shared";
import { NoctaLoading } from "../components/NoctaLoading";
import { Screen } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { colors, fonts, radii, spacing } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "ReportResolution">;

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("es-UY");
}

export function ReportResolutionScreen({ navigation, route }: Props) {
  const { reportId } = route.params;
  const [report, setReport] = useState<MyReportResolution | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void api<{ report: MyReportResolution }>(`/api/me/reports/${reportId}`)
      .then((response) => {
        if (!alive) return;
        setReport(response.report);
        setError("");
      })
      .catch((err) => {
        if (!alive) return;
        setReport(null);
        setError(
          err instanceof ApiError
            ? err.message
            : "No se pudo cargar el resultado de la denuncia"
        );
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [reportId]);

  const resolution = report?.resolution;
  const resultTone =
    resolution?.action === "dismiss"
      ? "dismiss"
      : resolution?.action === "suspend"
        ? "suspend"
        : "open";

  return (
    <Screen safeTop={false} style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.back}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Volver"
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>Moderación</Text>
          <Text style={styles.title}>Resultado de tu denuncia</Text>
        </View>
      </View>

      {loading ? (
        <NoctaLoading variant="block" />
      ) : error || !report ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error || "Denuncia no encontrada"}</Text>
          <Pressable style={styles.outlineBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.outlineBtnText}>Volver</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          <View style={styles.card}>
            <Meta label="Motivo original" value={REPORT_REASON_LABELS[report.reason]} />
            <Meta
              label="Origen"
              value={report.source === "match" ? "Conversación" : "Perfil"}
            />
            <Meta label="Enviada" value={formatWhen(report.createdAt)} />

            <View
              style={[
                styles.result,
                resultTone === "dismiss" && styles.resultDismiss,
                resultTone === "suspend" && styles.resultSuspend,
              ]}
            >
              <Ionicons
                name={
                  resultTone === "dismiss"
                    ? "close-circle-outline"
                    : resultTone === "suspend"
                      ? "shield-checkmark-outline"
                      : "hourglass-outline"
                }
                size={22}
                color={
                  resultTone === "dismiss"
                    ? colors.warning
                    : resultTone === "suspend"
                      ? colors.primary
                      : colors.textMuted
                }
              />
              <View style={styles.resultCopy}>
                <Text
                  style={[
                    styles.resultTitle,
                    resultTone === "dismiss" && { color: colors.warning },
                    resultTone === "suspend" && { color: colors.primary },
                  ]}
                >
                  {resultTone === "dismiss"
                    ? "Denuncia descartada"
                    : resultTone === "suspend"
                      ? "Se tomaron medidas"
                      : "En revisión"}
                </Text>
                <Text style={styles.resultBody}>
                  {resultTone === "dismiss"
                    ? "Un administrador revisó tu denuncia y decidió descartarla."
                    : resultTone === "suspend"
                      ? "Un administrador revisó tu denuncia y aplicó una sanción."
                      : "Todavía no hay una resolución registrada para esta denuncia."}
                </Text>
              </View>
            </View>

            {resolution?.reason ? (
              <View style={styles.reason}>
                <Text style={styles.metaLabel}>Explicación</Text>
                <Text style={styles.reasonText}>{resolution.reason}</Text>
              </View>
            ) : null}

            {resolution?.action === "suspend" && resolution.duration != null ? (
              <Meta
                label="Duración aplicada"
                value={SUSPENSION_DURATION_LABELS[resolution.duration]}
              />
            ) : null}

            {resolution ? (
              <Meta label="Resuelta" value={formatWhen(resolution.resolvedAt)} />
            ) : null}
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.meta}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { paddingTop: spacing.md },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerCopy: { flex: 1 },
  eyebrow: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 24,
    letterSpacing: -0.03 * 24,
  },
  scroll: { paddingBottom: spacing.xl },
  card: {
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  meta: { gap: 2 },
  metaLabel: {
    color: colors.textMuted,
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  metaValue: {
    color: colors.text,
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
  },
  result: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  resultDismiss: {
    borderColor: "rgba(240,192,64,0.35)",
    backgroundColor: "rgba(240,192,64,0.08)",
  },
  resultSuspend: {
    borderColor: "rgba(214,255,75,0.35)",
    backgroundColor: "rgba(214,255,75,0.08)",
  },
  resultCopy: { flex: 1, gap: 4 },
  resultTitle: {
    color: colors.text,
    fontFamily: fonts.bodyBold,
    fontSize: 15,
  },
  resultBody: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
  },
  reason: {
    gap: 4,
    padding: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  reasonText: {
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
  },
  errorBox: { gap: spacing.md, paddingTop: spacing.lg },
  errorText: {
    color: colors.danger,
    fontFamily: fonts.body,
    fontSize: 15,
  },
  outlineBtn: {
    alignSelf: "flex-start",
    minHeight: 42,
    paddingHorizontal: 16,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  outlineBtnText: {
    color: colors.text,
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
  },
});

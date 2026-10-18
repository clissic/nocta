import { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import {
  REPORT_REASONS,
  REPORT_REASON_LABELS,
  type ReportReason,
} from "@nocta/shared";
import { NoctaImage } from "../components/NoctaImage";
import { NoctaLoading } from "../components/NoctaLoading";
import { useToast } from "../components/ToastProvider";
import { Screen } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { colors, fonts, radii, spacing } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "UserReport">;

type ReportedUser = {
  id: string;
  name: string;
  photo?: string;
};

export function UserReportScreen({ navigation, route }: Props) {
  const { userId } = route.params;
  const toast = useToast();
  const [reportedUser, setReportedUser] = useState<ReportedUser | null>(null);
  const [reason, setReason] = useState<ReportReason | "">("");
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void api<{ user: ReportedUser }>(`/api/users/${userId}`)
      .then((response) => {
        if (alive) setReportedUser(response.user);
      })
      .catch((err) => {
        if (!alive) return;
        setLoadError(
          err instanceof ApiError ? err.message : "No se pudo cargar el perfil"
        );
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [userId]);

  async function submitReport() {
    if (!reason || busy) return;
    setBusy(true);
    try {
      await api(`/api/users/${userId}/report`, {
        method: "POST",
        body: JSON.stringify({
          reason,
          details: details.trim() || undefined,
        }),
      });
      toast.success("Denuncia enviada");
      navigation.goBack();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo enviar la denuncia"
      );
      setBusy(false);
    }
  }

  return (
    <Screen safeTop={false} style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.back}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Volver a Discover"
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>Seguridad</Text>
          <Text style={styles.title}>Denunciar perfil</Text>
        </View>
      </View>

      {loading ? (
        <NoctaLoading variant="block" />
      ) : loadError || !reportedUser ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>
            {loadError || "Usuario no encontrado"}
          </Text>
          <Pressable
            style={styles.outlineBtn}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.outlineBtnText}>Volver a Discover</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.person}>
            {reportedUser.photo ? (
              <NoctaImage
                src={reportedUser.photo}
                variant="thumb"
                style={styles.avatar}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.avatar, styles.avatarEmpty]}>
                <Text style={styles.avatarLetter}>
                  {reportedUser.name.slice(0, 1).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.personCopy}>
              <Text style={styles.personHint}>Vas a denunciar a</Text>
              <Text style={styles.personName} numberOfLines={1}>
                {reportedUser.name}
              </Text>
            </View>
          </View>

          <Text style={styles.legend}>¿Cuál es el motivo?</Text>
          <View style={styles.reasons}>
            {REPORT_REASONS.map((value) => {
              const selected = reason === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => setReason(value)}
                  style={[styles.reason, selected && styles.reasonOn]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                >
                  <Ionicons
                    name={selected ? "radio-button-on" : "radio-button-off"}
                    size={18}
                    color={selected ? colors.primary : colors.textMuted}
                  />
                  <Text style={[styles.reasonText, selected && styles.reasonTextOn]}>
                    {REPORT_REASON_LABELS[value]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.legend}>Contanos qué pasó (opcional)</Text>
          <TextInput
            style={styles.input}
            multiline
            maxLength={1000}
            value={details}
            placeholder="Agregá información que ayude a revisar la denuncia"
            placeholderTextColor={colors.textFaint}
            onChangeText={setDetails}
            textAlignVertical="top"
          />
          <Text style={styles.count}>{details.length}/1000</Text>
          <Text style={styles.note}>
            La persona denunciada no sabrá quién realizó la denuncia.
          </Text>
          <Pressable
            disabled={!reason || busy}
            onPress={() => void submitReport()}
            style={({ pressed }) => [
              styles.submit,
              (!reason || busy || pressed) && { opacity: !reason || busy ? 0.45 : 0.9 },
            ]}
          >
            <Text style={styles.submitText}>
              {busy ? "Enviando…" : "Enviar denuncia"}
            </Text>
          </Pressable>
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingTop: spacing.md,
  },
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
    fontSize: 26,
    letterSpacing: -0.03 * 26,
  },
  scroll: {
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  errorBox: {
    gap: spacing.md,
    paddingTop: spacing.lg,
  },
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
  person: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarEmpty: {
    backgroundColor: colors.elevated,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: {
    color: colors.text,
    fontFamily: fonts.bodyBold,
    fontSize: 18,
  },
  personCopy: { flex: 1 },
  personHint: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  personName: {
    color: colors.text,
    fontFamily: fonts.bodyBold,
    fontSize: 16,
  },
  legend: {
    color: colors.text,
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    marginTop: spacing.sm,
  },
  reasons: { gap: 8 },
  reason: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
  },
  reasonOn: {
    borderColor: "rgba(214,255,75,0.55)",
    backgroundColor: colors.primaryDim,
  },
  reasonText: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 15,
  },
  reasonTextOn: {
    color: colors.text,
    fontFamily: fonts.bodySemiBold,
  },
  input: {
    minHeight: 120,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 15,
    padding: 12,
  },
  count: {
    color: colors.textFaint,
    fontFamily: fonts.body,
    fontSize: 12,
    alignSelf: "flex-end",
  },
  note: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
  },
  submit: {
    minHeight: 48,
    borderRadius: radii.md,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.sm,
  },
  submitText: {
    color: "#fff",
    fontFamily: fonts.bodyBold,
    fontSize: 16,
  },
});

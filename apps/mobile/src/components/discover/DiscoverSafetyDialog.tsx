import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radii, spacing } from "../../theme/tokens";

export type DiscoverSafetyAction = "block" | "report";

type Props = {
  action: DiscoverSafetyAction;
  personName: string;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

const COPY: Record<
  DiscoverSafetyAction,
  { title: string; description: (name: string) => string; confirm: string }
> = {
  block: {
    title: "Bloquear perfil",
    description: (name) => `¿Querés bloquear a ${name}?`,
    confirm: "Bloquear",
  },
  report: {
    title: "Denunciar perfil",
    description: (name) => `¿Querés denunciar a ${name}?`,
    confirm: "Continuar",
  },
};

export function DiscoverSafetyDialog({
  action,
  personName,
  busy = false,
  onClose,
  onConfirm,
}: Props) {
  const copy = COPY[action];
  const icon = action === "block" ? "ban-outline" : "flag-outline";

  return (
    <View style={styles.layer}>
      <Pressable
        style={styles.backdrop}
        disabled={busy}
        onPress={onClose}
        accessibilityLabel="Cerrar"
      />
      <View style={styles.dialog} accessibilityRole="alert">
        <View style={styles.icon}>
          <Ionicons name={icon} size={26} color={colors.danger} />
        </View>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.body}>{copy.description(personName)}</Text>
        {action === "block" ? (
          <Text style={styles.note}>
            No volverán a verse en perfiles, conexiones ni Discover.
          </Text>
        ) : null}
        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [
              styles.cancel,
              (busy || pressed) && { opacity: busy ? 0.45 : 0.85 },
            ]}
            disabled={busy}
            onPress={onClose}
          >
            <Text style={styles.cancelText}>Cancelar</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.confirm,
              (busy || pressed) && { opacity: busy ? 0.7 : 0.9 },
            ]}
            disabled={busy}
            onPress={onConfirm}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.confirmText}>{copy.confirm}</Text>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFill,
    zIndex: 20,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.md,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.8)",
  },
  dialog: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: colors.panel,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(255,107,107,0.35)",
    padding: spacing.lg,
    gap: spacing.sm,
    alignItems: "center",
  },
  icon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,107,107,0.12)",
    marginBottom: spacing.xs,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 22,
    letterSpacing: -0.4,
    textAlign: "center",
  },
  body: {
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  note: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
    alignSelf: "stretch",
  },
  cancel: {
    flex: 1,
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    color: colors.text,
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
  },
  confirm: {
    flex: 1,
    minHeight: 44,
    borderRadius: radii.md,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmText: {
    color: "#fff",
    fontFamily: fonts.bodyBold,
    fontSize: 15,
  },
});

import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts, radii, spacing } from "../theme/tokens";
import { NoctaLoading } from "./NoctaLoading";

function parseIsoDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y!, (m ?? 1) - 1, d ?? 1);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== y ||
    date.getMonth() !== (m ?? 1) - 1 ||
    date.getDate() !== d
  ) {
    return null;
  }
  return date;
}

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDisplayDate(value: string): string {
  const date = parseIsoDate(value);
  if (!date) return value;
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${d}/${m}/${date.getFullYear()}`;
}

/** Selector nativo de fecha (sin teclado de texto). Guarda YYYY-MM-DD. */
export function DateField({
  value,
  onChange,
  placeholder = "Fecha",
  maximumDate,
  minimumDate,
}: {
  value: string;
  onChange: (isoDate: string) => void;
  placeholder?: string;
  maximumDate?: Date;
  minimumDate?: Date;
}) {
  const [open, setOpen] = useState(false);
  const selected = parseIsoDate(value) ?? maximumDate ?? new Date();

  function commit(date: Date) {
    onChange(toIsoDate(date));
  }

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={placeholder}
        style={({ pressed }) => [
          styles.input,
          styles.dateField,
          pressed && { opacity: 0.9 },
        ]}
      >
        <Text style={value ? styles.dateValue : styles.datePlaceholder}>
          {value ? formatDisplayDate(value) : placeholder}
        </Text>
        <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
      </Pressable>

      {Platform.OS === "android" && open ? (
        <DateTimePicker
          value={selected}
          mode="date"
          display="default"
          maximumDate={maximumDate}
          minimumDate={minimumDate}
          onValueChange={(_event, date) => {
            setOpen(false);
            commit(date);
          }}
          onDismiss={() => setOpen(false)}
        />
      ) : null}

      {Platform.OS === "ios" ? (
        <Modal
          visible={open}
          transparent
          animationType="slide"
          onRequestClose={() => setOpen(false)}
        >
          <View style={styles.dateModalRoot}>
            <Pressable
              style={styles.dateModalBackdrop}
              onPress={() => setOpen(false)}
            />
            <View style={styles.dateModalSheet}>
              <View style={styles.dateModalHead}>
                <Text style={styles.dateModalTitle}>{placeholder}</Text>
                <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                  <Text style={styles.dateModalDone}>Listo</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={selected}
                mode="date"
                display="spinner"
                themeVariant="dark"
                maximumDate={maximumDate}
                minimumDate={minimumDate}
                onValueChange={(_event, date) => commit(date)}
                style={{ alignSelf: "stretch" }}
              />
            </View>
          </View>
        </Modal>
      ) : null}
    </>
  );
}

export function Screen({
  children,
  style,
  padded = true,
  safeTop = true,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  padded?: boolean;
  safeTop?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.screen,
        padded && styles.screenPadded,
        safeTop && { paddingTop: Math.max(insets.top, spacing.md) },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Title({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: TextStyle;
}) {
  return <Text style={[styles.title, style]}>{children}</Text>;
}

export function Muted({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: TextStyle;
}) {
  return <Text style={[styles.muted, style]}>{children}</Text>;
}

export function Body({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: TextStyle;
}) {
  return <Text style={[styles.body, style]}>{children}</Text>;
}

export function Field(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={colors.textMuted}
      {...props}
      style={[styles.input, props.style]}
    />
  );
}

export function Chip({
  label,
  onPress,
  active,
}: {
  label: string;
  onPress?: () => void;
  active?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        active && styles.chipActive,
        pressed && { opacity: 0.85 },
      ]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {body ? <Text style={styles.muted}>{body}</Text> : null}
      {action}
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled,
  loading,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "ghost" | "danger" | "outline";
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}) {
  const isPrimary = variant === "primary";
  const isDanger = variant === "danger";
  const isOutline = variant === "outline" || variant === "ghost";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={({ pressed }) => [
        styles.btn,
        isPrimary && styles.btnPrimary,
        isOutline && styles.btnGhost,
        isDanger && styles.btnDanger,
        disabled && !loading && styles.btnDisabled,
        loading && styles.btnLoading,
        pressed && !loading && isPrimary && { backgroundColor: colors.primaryHover },
        pressed && !loading && !isPrimary && { opacity: 0.85 },
        style,
      ]}
    >
      {/* Label siempre en layout para no cambiar el tamaño del botón. */}
      <Text
        style={[
          styles.btnText,
          isPrimary && styles.btnTextPrimary,
          isDanger && styles.btnTextDanger,
          loading && styles.btnTextHidden,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {loading ? (
        <View style={styles.btnLoadingOverlay} pointerEvents="none">
          <ActivityIndicator
            size="small"
            color={isPrimary ? colors.onPrimary : colors.text}
          />
        </View>
      ) : null}
    </Pressable>
  );
}

export function LoadingBlock({ label = "Cargando…" }: { label?: string }) {
  return <NoctaLoading variant="screen" label={label} />;
}

export function ScreenHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        <Text style={styles.headerTitle}>{title}</Text>
        {subtitle ? <Text style={styles.muted}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  screenPadded: {
    paddingHorizontal: spacing.md,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 28,
    letterSpacing: -0.03 * 28,
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  headerTitle: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 26,
    letterSpacing: -0.03 * 26,
  },
  body: {
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
  },
  muted: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
  },
  input: {
    backgroundColor: colors.elevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    color: colors.text,
    fontFamily: fonts.body,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: spacing.sm,
  },
  dateField: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  dateValue: {
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 16,
  },
  datePlaceholder: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 16,
  },
  dateModalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  dateModalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  dateModalSheet: {
    backgroundColor: colors.panel,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  dateModalHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  dateModalTitle: {
    color: colors.text,
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
  },
  dateModalDone: {
    color: colors.primary,
    fontFamily: fonts.bodyBold,
    fontSize: 16,
  },
  chip: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.elevated,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryDim,
  },
  chipText: {
    color: colors.textMuted,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
  },
  chipTextActive: {
    color: colors.primary,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
    gap: spacing.sm,
  },
  emptyTitle: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 22,
    letterSpacing: -0.03 * 22,
    textAlign: "center",
  },
  btn: {
    position: "relative",
    borderRadius: radii.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.sm,
    minHeight: 48,
    overflow: "hidden",
  },
  btnPrimary: {
    backgroundColor: colors.primary,
  },
  btnGhost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnDanger: {
    backgroundColor: "rgba(255,107,107,0.12)",
    borderWidth: 1,
    borderColor: colors.danger,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnLoading: {
    opacity: 1,
  },
  btnText: {
    color: colors.text,
    fontFamily: fonts.bodyBold,
    fontSize: 16,
  },
  btnTextPrimary: {
    color: colors.onPrimary,
  },
  btnTextDanger: {
    color: colors.danger,
  },
  btnTextHidden: {
    opacity: 0,
  },
  btnLoadingOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
});

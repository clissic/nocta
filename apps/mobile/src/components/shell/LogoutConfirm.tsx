import { useEffect, useRef, useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../theme/tokens";

export function LogoutConfirm({
  visible,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [shown, setShown] = useState(visible);
  const actionRef = useRef<"confirm" | "cancel" | null>(null);
  const onConfirmRef = useRef(onConfirm);
  const onCancelRef = useRef(onCancel);
  onConfirmRef.current = onConfirm;
  onCancelRef.current = onCancel;

  useEffect(() => {
    if (visible) {
      actionRef.current = null;
      setShown(true);
      return;
    }
    if (!actionRef.current) setShown(false);
  }, [visible]);

  function finish() {
    const action = actionRef.current;
    if (!action) return;
    actionRef.current = null;
    if (action === "confirm") onConfirmRef.current();
    else onCancelRef.current();
  }

  useEffect(() => {
    if (shown || !actionRef.current) return;
    const delay = Platform.OS === "ios" ? 450 : 280;
    const timer = setTimeout(finish, delay);
    return () => clearTimeout(timer);
  }, [shown]);

  function choose(action: "confirm" | "cancel") {
    actionRef.current = action;
    setShown(false);
  }

  return (
    <Modal
      visible={visible && shown}
      transparent
      animationType="fade"
      onRequestClose={() => choose("cancel")}
      onDismiss={finish}
      statusBarTranslucent
    >
      <View style={styles.layer}>
        <Pressable
          style={styles.backdrop}
          onPress={() => choose("cancel")}
          accessibilityLabel="Cancelar cierre de sesión"
        />
        <View
          style={styles.card}
          accessibilityRole="alert"
          accessibilityLabel="¿Cerrar sesión?"
        >
          <View style={styles.icon}>
            <Ionicons name="log-out-outline" size={26} color={colors.text} />
          </View>
          <Text style={styles.title}>¿Cerrar sesión?</Text>
          <Text style={styles.body}>
            Tendrás que volver a ingresar tus datos para acceder a Nocta.
          </Text>
          <View style={styles.actions}>
            <Pressable style={styles.cancel} onPress={() => choose("cancel")}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </Pressable>
            <Pressable style={styles.ok} onPress={() => choose("confirm")}>
              <Text style={styles.okText}>Cerrar sesión</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  layer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.62)",
  },
  card: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 18,
    padding: 20,
    backgroundColor: "#161618",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    gap: 10,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  title: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 22,
    letterSpacing: -0.4,
  },
  body: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
  },
  actions: { flexDirection: "row", gap: 10, marginTop: 6 },
  cancel: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
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
  ok: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  okText: {
    color: colors.onPrimary,
    fontFamily: fonts.bodyBold,
    fontSize: 15,
  },
});

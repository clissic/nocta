import { useState } from "react";
import { StyleSheet, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuth } from "../../auth/AuthContext";
import { AuthShell } from "../../components/AuthAtmosphere";
import { useToast } from "../../components/ToastProvider";
import { Button, Field, Muted, Title } from "../../components/ui";
import { ApiError } from "../../lib/api";
import { spacing } from "../../theme/tokens";
import type { AuthStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<AuthStackParamList, "VerifyEmail">;

export function VerifyEmailScreen({ route }: Props) {
  const { user, verifyEmail, resendVerification, logout } = useAuth();
  const toast = useToast();
  const email = route.params?.email || user?.email || "";
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function onVerify() {
    setBusy(true);
    try {
      await verifyEmail(code.trim(), email);
      toast.success("Email verificado");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Código inválido");
    } finally {
      setBusy(false);
    }
  }

  async function onResend() {
    try {
      await resendVerification(email);
      toast.info("Código reenviado");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo reenviar");
    }
  }

  return (
    <AuthShell variant="verify">
      <View style={styles.form}>
        <Title>Verificá tu email</Title>
        <Muted>
          Ingresá el código de 6 dígitos enviado a {email || "tu correo"}.
        </Muted>
        <Field
          keyboardType="number-pad"
          maxLength={6}
          placeholder="000000"
          value={code}
          onChangeText={setCode}
          style={styles.gap}
        />
        <Button label="Confirmar" onPress={onVerify} loading={busy} />
        <Button label="Reenviar código" variant="ghost" onPress={onResend} />
        <Button label="Salir" variant="ghost" onPress={logout} />
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.sm, paddingBottom: spacing.md },
  gap: { marginTop: spacing.sm },
});

import { useState } from "react";
import { StyleSheet, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { PASSWORD_HINT } from "@nocta/shared";
import { AuthShell } from "../../components/AuthAtmosphere";
import { useToast } from "../../components/ToastProvider";
import { Button, Field, Muted, Title } from "../../components/ui";
import { api, ApiError } from "../../lib/api";
import { spacing } from "../../theme/tokens";
import type { AuthStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<AuthStackParamList, "ResetPassword">;

export function ResetPasswordScreen({ navigation, route }: Props) {
  const toast = useToast();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    setBusy(true);
    try {
      await api("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token: route.params.token, password }),
      });
      toast.success("Contraseña actualizada");
      navigation.navigate("Login");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Link inválido");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell variant="reset">
      <View style={styles.form}>
        <Title>Nueva contraseña</Title>
        <Muted>{PASSWORD_HINT}</Muted>
        <Field
          secureTextEntry
          placeholder="Nueva contraseña"
          value={password}
          onChangeText={setPassword}
          style={styles.gap}
        />
        <Button label="Guardar" onPress={onSubmit} loading={busy} />
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.sm, paddingBottom: spacing.md },
  gap: { marginTop: spacing.sm },
});

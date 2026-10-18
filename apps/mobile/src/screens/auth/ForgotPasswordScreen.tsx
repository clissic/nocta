import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AuthShell } from "../../components/AuthAtmosphere";
import { useToast } from "../../components/ToastProvider";
import { Button, Field } from "../../components/ui";
import { api, ApiError } from "../../lib/api";
import { turnstileEnabled } from "../../components/TurnstileField";
import { colors, fonts, spacing } from "../../theme/tokens";
import type { AuthStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<AuthStackParamList, "ForgotPassword">;

export function ForgotPasswordScreen({ navigation }: Props) {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit() {
    if (turnstileEnabled()) {
      navigation.navigate("HumanCheck", {
        kind: "forgot",
        email: email.trim(),
      });
      return;
    }
    setBusy(true);
    try {
      await api("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), client: "mobile" }),
      });
      setSent(true);
      toast.success("Si la cuenta existe, te enviamos un email");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo enviar el email"
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      variant="forgot"
      tagline="Ingresá el email de tu cuenta y te mandamos un link para restablecer la contraseña."
    >
      <View style={styles.form}>
        {sent ? (
          <>
            <Text style={styles.sentBody}>
              Si existe una cuenta con{" "}
              <Text style={styles.sentEmail}>{email.trim()}</Text>, vas a
              recibir un email con el link. Revisá también spam.
            </Text>
            <Button
              label="Volver al login"
              onPress={() => navigation.navigate("Login")}
            />
            <Button
              label="Usar otro email"
              variant="ghost"
              disabled={busy}
              onPress={() => setSent(false)}
            />
          </>
        ) : (
          <>
            <Field
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              editable={!busy}
              autoFocus
            />
            <Button
              label={busy ? "Enviando…" : "Enviar link"}
              onPress={() => void onSubmit()}
              loading={busy}
            />
          </>
        )}

        <Pressable
          onPress={() => navigation.navigate("Login")}
          style={styles.link}
        >
          <Text style={styles.linkText}>Volver al login</Text>
        </Pressable>
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.sm,
  },
  sentBody: {
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  sentEmail: {
    fontFamily: fonts.bodySemiBold,
    color: colors.primary,
  },
  link: {
    alignItems: "center",
    marginTop: spacing.md,
  },
  linkText: {
    color: colors.primary,
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
  },
});

import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuth } from "../../auth/AuthContext";
import { AuthShell } from "../../components/AuthAtmosphere";
import { TurnstileField } from "../../components/TurnstileField";
import { useToast } from "../../components/ToastProvider";
import { api, ApiError, getSuspensionNotice } from "../../lib/api";
import type { AuthStackParamList } from "../../navigation/types";
import { colors, fonts, spacing } from "../../theme/tokens";

type Props = NativeStackScreenProps<AuthStackParamList, "HumanCheck">;

const HINT = {
  login: "Para entrar a tu cuenta.",
  register: "Para crear tu cuenta.",
  forgot: "Para enviarte el link de recupero.",
} as const;

export function HumanCheckScreen({ navigation, route }: Props) {
  const request = route.params;
  const { login, register } = useAuth();
  const toast = useToast();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [turnstileKey, setTurnstileKey] = useState(0);
  const started = useRef(false);

  function fail(message: string) {
    started.current = false;
    setBusy(false);
    setError(message);
    setTurnstileKey((current) => current + 1);
  }

  async function onToken(token: string) {
    if (!token || started.current) return;
    started.current = true;
    setError("");
    setBusy(true);
    try {
      if (request.kind === "login") {
        await login(request.email, request.password, token);
        return;
      }
      if (request.kind === "register") {
        await register(request.email, request.password, {
          name: request.name,
          marketingEmailsOptIn: request.marketingEmailsOptIn,
          turnstileToken: token,
        });
        toast.success("Cuenta creada. Verificá tu email.");
        return;
      }
      await api("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({
          email: request.email,
          client: "mobile",
          turnstileToken: token,
        }),
      });
      setSent(true);
      toast.success("Si la cuenta existe, te enviamos un email");
    } catch (err) {
      if (request.kind === "login") {
        const suspension = getSuspensionNotice();
        if (suspension) {
          toast.error(
            suspension.code === "ACCOUNT_PERMANENTLY_SUSPENDED"
              ? "Cuenta suspendida permanentemente"
              : "Cuenta suspendida temporalmente"
          );
          navigation.goBack();
          return;
        }
        if (err instanceof ApiError && err.code === "EMAIL_NOT_VERIFIED") {
          const pending =
            typeof err.data.email === "string" ? err.data.email : request.email;
          navigation.navigate("VerifyEmail", { email: pending });
          return;
        }
      }
      fail(err instanceof ApiError ? err.message : "No se pudo continuar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell variant="login">
      {sent && request.kind === "forgot" ? (
        <>
          <Text style={styles.body}>
            Si existe una cuenta con {request.email}, vas a recibir un email con
            el link. Revisá también spam.
          </Text>
          <Pressable onPress={() => navigation.navigate("Login")}>
            <Text style={styles.link}>Volver al login</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.title}>Confirmá que sos una persona</Text>
          <Text style={styles.hint}>{HINT[request.kind]}</Text>
          <TurnstileField
            resetKey={turnstileKey}
            onToken={(token) => void onToken(token)}
            onError={() =>
              fail("No pudimos verificar que seas una persona. Probá de nuevo.")
            }
          />
          {busy ? <Text style={styles.hint}>Un momento…</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable onPress={() => navigation.goBack()} disabled={busy}>
            <Text style={styles.link}>Volver</Text>
          </Pressable>
        </>
      )}
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.text,
    fontFamily: fonts.bodySemiBold,
    fontSize: 22,
    textAlign: "center",
  },
  hint: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 15,
    textAlign: "center",
    marginTop: spacing.xs,
  },
  body: {
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 16,
    textAlign: "center",
    lineHeight: 22,
  },
  error: {
    color: colors.danger,
    fontFamily: fonts.body,
    fontSize: 14,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  link: {
    color: colors.textMuted,
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    textAlign: "center",
    marginTop: spacing.md,
  },
});

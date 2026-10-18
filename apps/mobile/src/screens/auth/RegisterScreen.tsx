import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  isStrongPassword,
  PASSWORD_HINT,
  PASSWORD_RULES,
} from "@nocta/shared";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../auth/AuthContext";
import { AuthShell } from "../../components/AuthAtmosphere";
import { useToast } from "../../components/ToastProvider";
import { Button, Field } from "../../components/ui";
import { ApiError } from "../../lib/api";
import { turnstileEnabled } from "../../components/TurnstileField";
import { colors, fonts, spacing } from "../../theme/tokens";
import type { AuthStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<AuthStackParamList, "Register">;

export function RegisterScreen({ navigation }: Props) {
  const { register } = useAuth();
  const toast = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptMarketing, setAcceptMarketing] = useState(false);
  const [busy, setBusy] = useState(false);

  const ruleStatus = useMemo(
    () =>
      PASSWORD_RULES.map((rule) => ({
        id: rule.id,
        label: rule.label,
        met: rule.test(password),
      })),
    [password]
  );

  const passwordsMatch =
    confirmPassword.length > 0 && password === confirmPassword;

  async function onSubmit() {
    if (!name.trim()) {
      toast.error("Ingresá tu nombre");
      return;
    }
    if (!isStrongPassword(password)) {
      toast.error(PASSWORD_HINT);
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    if (!acceptTerms) {
      toast.error("Tenés que aceptar los términos para crear la cuenta");
      return;
    }
    if (turnstileEnabled()) {
      navigation.navigate("HumanCheck", {
        kind: "register",
        email: email.trim(),
        password,
        name: name.trim(),
        marketingEmailsOptIn: acceptMarketing,
      });
      return;
    }

    setBusy(true);
    try {
      await register(email.trim(), password, {
        name: name.trim(),
        marketingEmailsOptIn: acceptMarketing,
      });
      toast.success("Cuenta creada. Verificá tu email.");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo registrar"
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      variant="register"
      tagline="Creá tu cuenta. El perfil queda oculto hasta que te publiques."
    >
      <View style={styles.form}>
        <Field
          placeholder="Nombre"
          autoComplete="name"
          value={name}
          onChangeText={setName}
          maxLength={80}
          editable={!busy}
        />
        <Field
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          editable={!busy}
        />
        <Field
          secureTextEntry
          autoComplete="new-password"
          placeholder="Contraseña"
          value={password}
          onChangeText={setPassword}
          editable={!busy}
        />

        <View style={styles.rules}>
          {ruleStatus.map((rule) => (
            <View key={rule.id} style={styles.ruleRow}>
              <Ionicons
                name={rule.met ? "checkmark-circle" : "ellipse-outline"}
                size={16}
                color={rule.met ? colors.primary : colors.textFaint}
              />
              <Text style={[styles.ruleText, rule.met && styles.ruleTextMet]}>
                {rule.label}
              </Text>
            </View>
          ))}
        </View>

        <Field
          secureTextEntry
          autoComplete="new-password"
          placeholder="Confirmar contraseña"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          editable={!busy}
          style={
            confirmPassword.length > 0 && !passwordsMatch
              ? styles.inputInvalid
              : undefined
          }
        />
        {confirmPassword.length > 0 && !passwordsMatch ? (
          <Text style={styles.error}>Las contraseñas no coinciden</Text>
        ) : null}

        <View style={styles.checkRow}>
          <Pressable
            onPress={() => setAcceptTerms((v) => !v)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: acceptTerms }}
          >
            <Ionicons
              name={acceptTerms ? "checkbox" : "square-outline"}
              size={22}
              color={acceptTerms ? colors.primary : colors.textMuted}
            />
          </Pressable>
          <Text style={styles.checkLabel}>
            Acepto los{" "}
            <Text
              style={styles.linkAccent}
              onPress={() => navigation.navigate("Terms")}
            >
              Términos y Condiciones
            </Text>{" "}
            de Nocta
          </Text>
        </View>
        <CheckRow
          checked={acceptMarketing}
          onToggle={() => setAcceptMarketing((v) => !v)}
          label="Quiero recibir promociones y novedades de Nocta por email"
        />

        <Button
          label={busy ? "Creando…" : "Crear cuenta"}
          onPress={() => void onSubmit()}
          loading={busy}
        />

        <Pressable
          onPress={() => navigation.navigate("Login")}
          style={styles.link}
          disabled={busy}
        >
          <Text style={styles.linkMuted}>
            ¿Ya tenés cuenta?{" "}
            <Text style={styles.linkAccent}>Iniciá sesión</Text>
          </Text>
        </Pressable>
      </View>
    </AuthShell>
  );
}

function CheckRow({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <Pressable onPress={onToggle} style={styles.checkRow}>
      <Ionicons
        name={checked ? "checkbox" : "square-outline"}
        size={22}
        color={checked ? colors.primary : colors.textMuted}
      />
      <Text style={styles.checkLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.sm,
  },
  rules: {
    gap: 4,
    marginBottom: spacing.xs,
  },
  ruleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  ruleText: {
    color: colors.textFaint,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  ruleTextMet: {
    color: colors.textMuted,
  },
  inputInvalid: {
    borderColor: colors.danger,
  },
  error: {
    color: colors.danger,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  checkLabel: {
    flex: 1,
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
  },
  link: {
    alignItems: "center",
    marginTop: spacing.md,
  },
  linkMuted: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  linkAccent: {
    color: colors.primary,
    fontFamily: fonts.bodySemiBold,
  },
});

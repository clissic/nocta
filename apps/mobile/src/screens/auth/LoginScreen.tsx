import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../../auth/AuthContext";
import { AuthShell } from "../../components/AuthAtmosphere";
import { useToast } from "../../components/ToastProvider";
import { Button, Chip, Field } from "../../components/ui";
import { ApiError, getSuspensionNotice } from "../../lib/api";
import { turnstileEnabled } from "../../components/TurnstileField";
import { startOAuth } from "../../lib/oauth";
import { colors, fonts, radii, spacing } from "../../theme/tokens";
import type { AuthStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;

const DEMOS = [
  { label: "Sofía", email: "sofia@nocta.app", password: "Demo1234!" },
  { label: "Mateo", email: "mateo@nocta.app", password: "Demo1234!" },
  { label: "Valentina", email: "valentina@nocta.app", password: "Demo1234!" },
  { label: "Admin", email: "admin@nocta.app", password: "Admin1234!" },
];

export function LoginScreen({ navigation }: Props) {
  const { login, applyToken } = useAuth();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  async function finishLogin(nextEmail: string, nextPassword: string, token: string) {
    setBusy(true);
    try {
      await login(nextEmail.trim(), nextPassword, token);
    } catch (err) {
      const suspension = getSuspensionNotice();
      if (suspension) {
        toast.error(
          suspension.code === "ACCOUNT_PERMANENTLY_SUSPENDED"
            ? "Cuenta suspendida permanentemente"
            : "Cuenta suspendida temporalmente"
        );
      } else {
        toast.error(
          err instanceof ApiError ? err.message : "No se pudo iniciar sesión"
        );
      }
    } finally {
      setBusy(false);
    }
  }

  async function doLogin(nextEmail: string, nextPassword: string) {
    if (turnstileEnabled()) {
      navigation.navigate("HumanCheck", {
        kind: "login",
        email: nextEmail.trim(),
        password: nextPassword,
      });
      return;
    }
    await finishLogin(nextEmail, nextPassword, "");
  }

  async function onGoogle() {
    setBusy(true);
    try {
      const result = await startOAuth("google");
      if (result.type === "cancel") return;
      if (result.type === "error") {
        toast.error(result.message);
        return;
      }
      await applyToken(result.token);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo iniciar con Google"
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      variant="login"
      tagline="Publicate donde vas. Matcheá con quien está en el mismo lugar."
    >
      <View style={styles.form}>
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
          autoComplete="password"
          placeholder="Contraseña"
          value={password}
          onChangeText={setPassword}
          editable={!busy}
        />
        <Button
          label={busy ? "Entrando…" : "Entrar"}
          onPress={() => void doLogin(email, password)}
          loading={busy}
        />

        <Pressable
          onPress={() => navigation.navigate("ForgotPassword")}
          style={styles.link}
          disabled={busy}
        >
          <Text style={styles.linkMuted}>¿Olvidaste tu contraseña?</Text>
        </Pressable>

        <View style={styles.socialRow}>
          <SocialBtn
            kind="ion"
            icon="logo-google"
            label="Continuar con Google"
            disabled={busy}
            onPress={() => void onGoogle()}
          />
          <SocialBtn
            kind="ion"
            icon="logo-apple"
            label="Continuar con Apple"
            disabled={busy}
            soon
            onPress={() =>
              toast.info("Sign in with Apple se implementará próximamente")
            }
          />
          <SocialBtn
            kind="mci"
            icon="microsoft"
            label="Continuar con Microsoft"
            disabled={busy}
            soon
            onPress={() =>
              toast.info("Microsoft se implementará próximamente")
            }
          />
        </View>

        <Pressable
          onPress={() => navigation.navigate("Register")}
          style={styles.link}
          disabled={busy}
        >
          <Text style={styles.linkMuted}>
            ¿No tenés cuenta?{" "}
            <Text style={styles.linkAccent}>Registrate</Text>
          </Text>
        </Pressable>

        <Text style={styles.demoTitle}>Demo</Text>
        <View style={styles.demoRow}>
          {DEMOS.map((demo) => (
            <Chip
              key={demo.email}
              label={demo.label}
              onPress={() => {
                if (busy) return;
                setEmail(demo.email);
                setPassword(demo.password);
                void doLogin(demo.email, demo.password);
              }}
            />
          ))}
        </View>
      </View>
    </AuthShell>
  );
}

function SocialBtn({
  kind,
  icon,
  label,
  onPress,
  disabled,
  soon,
}: {
  kind: "ion" | "mci";
  icon: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  soon?: boolean;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.socialBtn,
        soon && styles.socialSoon,
        pressed && { opacity: 0.85 },
      ]}
    >
      {kind === "ion" ? (
        <Ionicons
          name={icon as keyof typeof Ionicons.glyphMap}
          size={22}
          color={colors.text}
        />
      ) : (
        <MaterialCommunityIcons
          name={icon as keyof typeof MaterialCommunityIcons.glyphMap}
          size={22}
          color={colors.text}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.sm,
  },
  link: {
    alignItems: "center",
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
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
  socialRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.md,
    marginVertical: spacing.md,
  },
  socialBtn: {
    width: 52,
    height: 52,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "rgba(242,240,235,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  socialSoon: {
    opacity: 0.55,
  },
  demoTitle: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 13,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  demoRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
});

import { StyleSheet } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { Button, Muted, Screen, Title } from "../components/ui";
import { spacing } from "../theme/tokens";

export function PendingDeletionScreen() {
  const { logout, user } = useAuth();
  return (
    <Screen style={styles.center}>
      <Title>Cuenta en proceso de borrado</Title>
      <Muted>
        {user?.email
          ? `La cuenta ${user.email} tiene una eliminación solicitada.`
          : "Tu cuenta tiene una eliminación solicitada."}{" "}
        Podés cancelarla desde la web o contactar soporte.
      </Muted>
      <Button label="Salir" onPress={logout} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { justifyContent: "center", gap: spacing.md },
});

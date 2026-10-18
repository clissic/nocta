import { useEffect } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuth } from "../../auth/AuthContext";
import { useToast } from "../../components/ToastProvider";
import { LoadingBlock } from "../../components/ui";
import { ApiError } from "../../lib/api";
import type { AuthStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<AuthStackParamList, "AuthCallback">;

export function AuthCallbackScreen({ route, navigation }: Props) {
  const { applyToken } = useAuth();
  const toast = useToast();
  const token = route.params?.token;

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!token) {
        toast.error("Login incompleto");
        navigation.replace("Login");
        return;
      }
      try {
        await applyToken(token);
      } catch (err) {
        if (!alive) return;
        toast.error(err instanceof ApiError ? err.message : "No se pudo iniciar sesión");
        navigation.replace("Login");
      }
    })();
    return () => {
      alive = false;
    };
  }, [applyToken, navigation, toast, token]);

  return <LoadingBlock label="Entrando…" />;
}

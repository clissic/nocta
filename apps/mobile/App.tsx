import { useEffect, useState } from "react";
import { View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts, Syne_800ExtraBold } from "@expo-google-fonts/syne";
import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
} from "@expo-google-fonts/outfit";
import { AuthProvider } from "./src/auth/AuthContext";
import { ToastProvider } from "./src/components/ToastProvider";
import { NoctaLoading } from "./src/components/NoctaLoading";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { initTokenStore } from "./src/lib/api";
import { colors } from "./src/theme/tokens";

export default function App() {
  const [fontsLoaded] = useFonts({
    Syne_800ExtraBold,
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
  });
  const [tokenReady, setTokenReady] = useState(false);
  /** No bloquear la app si la fuente tarda o falla (emulador / red). */
  const [fontWaitDone, setFontWaitDone] = useState(false);

  useEffect(() => {
    void initTokenStore().finally(() => setTokenReady(true));
  }, []);

  useEffect(() => {
    if (fontsLoaded) {
      setFontWaitDone(true);
      return;
    }
    const t = setTimeout(() => setFontWaitDone(true), 2500);
    return () => clearTimeout(t);
  }, [fontsLoaded]);

  if (!tokenReady || !fontWaitDone) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.canvas }}>
        <NoctaLoading variant="screen" label="Nocta…" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.canvas }}>
      <SafeAreaProvider>
        <AuthProvider>
          <ToastProvider>
            <StatusBar style="light" />
            <RootNavigator />
          </ToastProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

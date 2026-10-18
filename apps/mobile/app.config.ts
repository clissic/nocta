import { existsSync } from "node:fs";
import path from "node:path";
import type { ExpoConfig, ConfigContext } from "expo/config";

const APP_SCHEME = "nocta";
// En el builder, EAS inyecta GOOGLE_SERVICES_JSON (archivo secreto).
// En local se usa google-services.json si está en disco.
const googleServicesFromEnv = process.env.GOOGLE_SERVICES_JSON;
const localGoogleServices = path.join(__dirname, "google-services.json");
const googleServicesFile =
  googleServicesFromEnv ??
  (existsSync(localGoogleServices) ? "./google-services.json" : undefined);

export default ({ config }: ConfigContext): ExpoConfig => {
  const expoConfig: ExpoConfig = {
    ...config,
    name: "Nocta",
    slug: "nocta",
    version: "0.1.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "dark",
    scheme: APP_SCHEME,
    ios: {
      supportsTablet: true,
      bundleIdentifier: "app.nocta.mobile",
    },
    android: {
      package: "app.nocta.mobile",
      ...(googleServicesFile ? { googleServicesFile } : {}),
      adaptiveIcon: {
        backgroundColor: "#0a0a0b",
        foregroundImage: "./assets/android-icon-foreground.png",
        backgroundImage: "./assets/android-icon-background.png",
        monochromeImage: "./assets/android-icon-monochrome.png",
      },
      intentFilters: [
        {
          action: "VIEW",
          autoVerify: true,
          data: [{ scheme: APP_SCHEME }],
          category: ["BROWSABLE", "DEFAULT"],
        },
      ],
    },
    plugins: [
      "expo-secure-store",
      "expo-font",
      "expo-image",
      "expo-web-browser",
      "@react-native-community/datetimepicker",
      [
        "expo-splash-screen",
        {
          image: "./assets/splash-icon.png",
          resizeMode: "contain",
          backgroundColor: "#0a0a0b",
        },
      ],
      [
        "expo-image-picker",
        {
          photosPermission:
            "Nocta necesita acceso a tus fotos para el perfil.",
        },
      ],
      [
        "expo-location",
        {
          locationWhenInUsePermission:
            "Nocta usa tu ubicación para mostrarte Espacios de la ciudad más cercana.",
        },
      ],
      [
        "expo-notifications",
        {
          icon: "./assets/icon.png",
          color: "#d6ff4b",
          defaultChannel: "default",
        },
      ],
    ],
    extra: {
      // Id real de @clissic/nocta. Tiene que estar fijo: EAS no escribe
      // app.config.ts dinámico y no ve EAS_PROJECT_ID del .env.
      // Un UUID inventado hace que Expo Go pida login y robe el stdin de Metro.
      eas: { projectId: "49230155-22fc-48ae-abf2-d81333188fe2" },
      apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:4000",
    },
    // Evita crawler on-demand de Metro que hace readlink y rompe en Windows
    // con OneDrive / reparse points bajo Documents.
    experiments: {
      onDemandFilesystem: false,
    },
  };
  return expoConfig;
};

import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import type { AdDetail } from "@nocta/shared";
import { NoctaImage } from "../components/NoctaImage";
import { NoctaLoading } from "../components/NoctaLoading";
import { useToast } from "../components/ToastProvider";
import { Screen } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { colors, fonts, radii, spacing } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Ad">;

function isExternal(url: string) {
  return url.startsWith("http://") || url.startsWith("https://");
}

export function AdScreen({ navigation, route }: Props) {
  const { adId } = route.params;
  const toast = useToast();
  const { height } = useWindowDimensions();
  const [ad, setAd] = useState<AdDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    void api<{ ad: AdDetail }>(`/api/ads/${adId}`)
      .then((res) => {
        if (alive) setAd(res.ad);
      })
      .catch((err) => {
        if (!alive) return;
        setError(
          err instanceof ApiError ? err.message : "No se pudo cargar el anuncio"
        );
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [adId]);

  function openCta(url: string) {
    if (isExternal(url)) {
      void WebBrowser.openBrowserAsync(url);
      return;
    }
    const path = url.startsWith("/") ? url : `/${url}`;
    const venue = path.match(/^\/venues\/([^/?#]+)/);
    if (venue) {
      navigation.navigate("VenueDetail", {
        venueId: decodeURIComponent(venue[1]),
      });
      return;
    }
    if (path === "/venues" || path.startsWith("/venues?")) {
      navigation.navigate("Main", { screen: "Venues" });
      return;
    }
    if (path.startsWith("/premium")) {
      navigation.navigate("Premium");
      return;
    }
    if (path.startsWith("/profile/promos")) {
      navigation.navigate("MyPromos");
      return;
    }
    if (path.startsWith("/profile")) {
      navigation.navigate("Main", { screen: "Profile" });
      return;
    }
    if (path.startsWith("/matches")) {
      navigation.navigate("Main", { screen: "Matches" });
      return;
    }
    if (path.startsWith("/likes")) {
      navigation.navigate("Main", { screen: "Likes" });
      return;
    }
    if (path.startsWith("/discover")) {
      navigation.goBack();
      return;
    }
    toast.info("Este enlace se abre en la web");
  }

  const heroHeight = Math.min(height * 0.62, 560);

  return (
    <Screen safeTop={false} style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.back}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Volver a Discover"
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        {ad ? (
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow} numberOfLines={1}>
              Anuncio{ad.sponsorName ? ` · ${ad.sponsorName}` : ""}
            </Text>
            <Text style={styles.title} numberOfLines={2}>
              {ad.title}
            </Text>
          </View>
        ) : (
          <Text style={styles.title}>Anuncio</Text>
        )}
      </View>

      {loading ? (
        <NoctaLoading variant="block" />
      ) : error || !ad ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error || "Anuncio no encontrado"}</Text>
          <Pressable style={styles.outlineBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.outlineBtnText}>Volver a Discover</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          <NoctaImage
            src={ad.imageUrl}
            variant="medium"
            style={[styles.hero, { height: heroHeight }]}
            contentFit="cover"
          />
          {ad.subtitle || ad.body ? (
            <View style={styles.copy}>
              {ad.subtitle ? <Text style={styles.subtitle}>{ad.subtitle}</Text> : null}
              {ad.body ? <Text style={styles.body}>{ad.body}</Text> : null}
            </View>
          ) : null}
          <Pressable
            style={styles.primaryBtn}
            onPress={() => openCta(ad.ctaUrl)}
            accessibilityRole="button"
          >
            <Text style={styles.primaryBtnText}>{ad.ctaLabel || "Ver más"}</Text>
            {isExternal(ad.ctaUrl) ? (
              <Ionicons name="open-outline" size={16} color={colors.onPrimary} />
            ) : null}
          </Pressable>
          <Pressable style={styles.outlineBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.outlineBtnText}>Seguir descubriendo</Text>
          </Pressable>
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingTop: spacing.md },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerCopy: { flex: 1 },
  eyebrow: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 26,
    letterSpacing: -0.03 * 26,
  },
  scroll: { paddingBottom: spacing.xl, gap: spacing.md },
  hero: {
    width: "100%",
    borderRadius: radii.lg,
    backgroundColor: colors.elevated,
  },
  copy: { gap: spacing.sm },
  subtitle: {
    color: colors.text,
    fontFamily: fonts.bodyMedium,
    fontSize: 18,
    lineHeight: 24,
  },
  body: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
  },
  primaryBtn: {
    minHeight: 48,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
  },
  primaryBtnText: {
    color: colors.onPrimary,
    fontFamily: fonts.bodyBold,
    fontSize: 16,
  },
  outlineBtn: {
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  outlineBtnText: {
    color: colors.text,
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
  },
  errorBox: { gap: spacing.md, paddingTop: spacing.lg },
  errorText: {
    color: colors.danger,
    fontFamily: fonts.body,
    fontSize: 15,
  },
});

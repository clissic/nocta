import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import {
  PROMO_PURCHASE_STATUS_LABELS,
  VENUE_PHOTO_FALLBACK,
  type PromoPurchase,
  type PromoPurchaseStatus,
} from "@nocta/shared";
import { NoctaImage } from "../components/NoctaImage";
import { NoctaLoading } from "../components/NoctaLoading";
import { PromoQrCode } from "../components/promos/PromoQrCode";
import { useToast } from "../components/ToastProvider";
import { Screen } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { colors, fonts, radii, spacing } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "MyPromos">;

function formatPrice(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency: "UYU",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("es-UY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const STATUS_COLOR: Record<PromoPurchaseStatus, string> = {
  valid: colors.primary,
  redeemed: colors.textMuted,
  expired: colors.danger,
  refunded: colors.warning,
};

function PurchaseMeta({ item }: { item: PromoPurchase }) {
  const price = formatPrice(item.priceUyu);
  const until = formatDate(item.validUntil);
  return (
    <View style={styles.meta}>
      <Text style={styles.itemTitle} numberOfLines={1}>
        {item.title}
      </Text>
      <Text style={styles.itemSub} numberOfLines={1}>
        {item.venueName ?? "Espacio"}
        {price ? ` · ${price}` : ""}
      </Text>
      <Text style={[styles.status, { color: STATUS_COLOR[item.status] }]}>
        {PROMO_PURCHASE_STATUS_LABELS[item.status]}
        {until ? ` · hasta ${until}` : ""}
      </Text>
    </View>
  );
}

export function MyPromosScreen({ navigation }: Props) {
  const toast = useToast();
  const [purchases, setPurchases] = useState<PromoPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void api<{ purchases: PromoPurchase[] }>("/api/me/promo-purchases")
      .then((res) => {
        if (!alive) return;
        setPurchases(res.purchases);
        const firstValid = res.purchases.find((item) => item.status === "valid");
        setSelectedId(firstValid?.id ?? res.purchases[0]?.id ?? null);
      })
      .catch((err) => {
        if (!alive) return;
        setPurchases([]);
        toast.error(
          err instanceof ApiError ? err.message : "No se pudieron cargar las promos"
        );
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [toast]);

  const validCount = purchases.filter((item) => item.status === "valid").length;

  return (
    <Screen safeTop={false} style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backLink}
          accessibilityRole="button"
        >
          <Text style={styles.backLinkText}>← Perfil</Text>
        </Pressable>

        <View style={styles.head}>
          <Text style={styles.title}>Mis promos</Text>
          <Text style={styles.subtitle}>
            Acá están los códigos QR de las promociones que compraste.
          </Text>
          {!loading && purchases.length > 0 ? (
            <Text style={styles.count}>
              <Text style={styles.countStrong}>{validCount}</Text>
              {validCount === 1 ? " vigente" : " vigentes"}
              {purchases.length !== validCount
                ? ` · ${purchases.length} en total`
                : ""}
            </Text>
          ) : null}
        </View>

        {loading ? (
          <NoctaLoading variant="block" />
        ) : purchases.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="qr-code-outline" size={28} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>Todavía no tenés promos</Text>
            <Text style={styles.emptyBody}>
              Cuando compres una promoción en un Espacio, tu QR va a aparecer acá
              para mostrarlo en puerta.
            </Text>
            <Pressable
              style={styles.primaryBtn}
              onPress={() => navigation.navigate("Main", { screen: "Venues" })}
            >
              <Text style={styles.primaryBtnText}>Explorar espacios</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.list}>
            {purchases.map((item) => {
              const open = selectedId === item.id;
              return (
                <View key={item.id} style={styles.item}>
                  <Pressable
                    style={styles.toggle}
                    onPress={() => setSelectedId(open ? null : item.id)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: open }}
                  >
                    {item.venuePhoto ? (
                      <NoctaImage
                        src={item.venuePhoto}
                        fallbackSrc={VENUE_PHOTO_FALLBACK}
                        variant="thumb"
                        style={styles.thumb}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={[styles.thumb, styles.thumbEmpty]} />
                    )}
                    <PurchaseMeta item={item} />
                    <Ionicons
                      name={open ? "chevron-up" : "chevron-down"}
                      size={18}
                      color={colors.textMuted}
                    />
                  </Pressable>
                  {open ? (
                    <View style={styles.panel}>
                      {item.status === "valid" ? (
                        <>
                          <PromoQrCode payload={item.qrPayload} />
                          <Text style={styles.hint}>
                            Mostrá este código en el Espacio para canjear la promo.
                          </Text>
                        </>
                      ) : (
                        <Text style={styles.hint}>
                          Esta promo ya no se puede canjear (
                          {PROMO_PURCHASE_STATUS_LABELS[item.status].toLowerCase()}
                          ).
                        </Text>
                      )}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingTop: spacing.sm },
  scroll: { paddingBottom: spacing.xl, gap: spacing.md },
  backLink: { alignSelf: "flex-start", paddingVertical: 4 },
  backLinkText: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  head: { gap: 4 },
  title: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 28,
    letterSpacing: -0.03 * 28,
  },
  subtitle: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
  },
  count: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 14,
    marginTop: 4,
  },
  countStrong: {
    color: colors.text,
    fontFamily: fonts.bodyBold,
  },
  empty: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryDim,
    marginBottom: spacing.xs,
  },
  emptyTitle: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 20,
    letterSpacing: -0.3,
    textAlign: "center",
  },
  emptyBody: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  primaryBtn: {
    marginTop: spacing.sm,
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: colors.onPrimary,
    fontFamily: fonts.bodyBold,
    fontSize: 15,
  },
  list: { gap: spacing.sm },
  item: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    overflow: "hidden",
  },
  toggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 10,
  },
  thumbEmpty: { backgroundColor: colors.elevated },
  meta: { flex: 1, gap: 2 },
  itemTitle: {
    color: colors.text,
    fontFamily: fonts.bodyBold,
    fontSize: 15,
  },
  itemSub: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  status: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
  },
  panel: {
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  hint: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
});

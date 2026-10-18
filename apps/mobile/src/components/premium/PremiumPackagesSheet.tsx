import { useEffect, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  PREMIUM_PERIOD_MONTHS,
  getPremiumPlan,
  isPremiumPlanDowngrade,
  monthlyBoostAllowance,
  monthlyHeartshotAllowance,
  premiumDashboardFeatureItems,
  premiumCheapestMonthlyUsd,
  premiumFromPriceNote,
  premiumPeriodSavingsPercent,
  type PremiumPeriodMonths,
  type PremiumPlanId,
} from "@nocta/shared";
import { useAuth } from "../../auth/AuthContext";
import { NoctaWordmark } from "../NoctaWordmark";
import { useToast } from "../ToastProvider";
import { api, ApiError } from "../../lib/api";
import { colors, fonts, radii, spacing } from "../../theme/tokens";

type PlanPeriod = {
  months: PremiumPeriodMonths;
  priceUsd: number;
  label: string;
};

type PlanCatalogItem = {
  id: PremiumPlanId | string;
  name: string;
  tagline: string;
  comingSoon: boolean;
  periods: PlanPeriod[];
};

const PLAN_HOUR: Record<string, string> = {
  nocta_2am: "2 AM",
  nocta_4am: "4 AM",
  nocta_6am: "6 AM",
};

const PLAN_PILL: Record<
  string,
  { bg: string; color: string; border: string }
> = {
  nocta_2am: {
    bg: "rgba(214,255,75,0.18)",
    color: "#d6ff4b",
    border: "rgba(214,255,75,0.45)",
  },
  nocta_4am: {
    bg: "rgba(77,166,255,0.18)",
    color: "#7ec4ff",
    border: "rgba(77,166,255,0.45)",
  },
  nocta_6am: {
    bg: "rgba(167,112,255,0.18)",
    color: "#c4a0ff",
    border: "rgba(167,112,255,0.45)",
  },
};

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Plan preseleccionado (p. ej. desde Configuración). */
  initialPlanId?: PremiumPlanId;
  onCheckoutDone?: () => void;
};

function planCardFeatures(planId: string, comingSoon: boolean) {
  if (comingSoon) {
    return [{ id: "soon", label: "Próximamente", included: false }];
  }
  const dash = premiumDashboardFeatureItems(planId);
  const extraIds = new Set([
    "boost",
    "heartshot",
    "spy_mode",
    "teleport_plus",
  ]);
  const base = dash
    .filter((f) => f.included && !extraIds.has(f.id))
    .slice(0, 4);
  const extras = dash
    .filter((f) => extraIds.has(f.id))
    .map((f) => {
      if (!f.included) return f;
      if (f.id === "boost") {
        return {
          ...f,
          label: `${monthlyBoostAllowance(planId)} Boost / mes`,
        };
      }
      if (f.id === "heartshot") {
        return {
          ...f,
          label: `${monthlyHeartshotAllowance(planId)} Heartshots / mes`,
        };
      }
      return f;
    });
  return [...base, ...extras];
}

function formatMonthly(value: number) {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(2).replace(/\.?0+$/, "");
}

export function PremiumPackagesSheet({
  visible,
  onClose,
  initialPlanId,
  onCheckoutDone,
}: Props) {
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [plans, setPlans] = useState<PlanCatalogItem[]>([]);
  const [currency, setCurrency] = useState("USD");
  const [loading, setLoading] = useState(true);
  const [selectedPlanId, setSelectedPlanId] = useState<PremiumPlanId | null>(
    null
  );
  const [periodMonths, setPeriodMonths] =
    useState<PremiumPeriodMonths>(3);
  const [busy, setBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [planBlock, setPlanBlock] = useState<null | "same" | "lower">(null);
  const initialHandled = useRef(false);

  const currentPlanId =
    user?.premium && user.premiumPlanId ? user.premiumPlanId : null;

  useEffect(() => {
    if (!visible) {
      initialHandled.current = false;
      setSelectedPlanId(null);
      setPlanBlock(null);
      setCheckoutError(null);
      setPeriodMonths(3);
      return;
    }

    setLoading(true);
    void api<{ currency: string; plans: PlanCatalogItem[] }>(
      "/api/premium/plans"
    )
      .then((res) => {
        setCurrency(res.currency || "USD");
        setPlans(res.plans ?? []);
      })
      .catch((err) =>
        toast.error(
          err instanceof ApiError
            ? err.message
            : "No se pudieron cargar los planes"
        )
      )
      .finally(() => setLoading(false));
  }, [visible, toast]);

  useEffect(() => {
    if (!visible || !initialPlanId || initialHandled.current) return;
    initialHandled.current = true;
    if (currentPlanId && currentPlanId === initialPlanId) {
      setPlanBlock("same");
      return;
    }
    if (isPremiumPlanDowngrade(currentPlanId, initialPlanId)) {
      setPlanBlock("lower");
      return;
    }
    setSelectedPlanId(initialPlanId);
    setPeriodMonths(3);
  }, [visible, initialPlanId, currentPlanId]);

  const focused = selectedPlanId
    ? plans.find((p) => p.id === selectedPlanId)
    : undefined;
  const shared = selectedPlanId ? getPremiumPlan(selectedPlanId) : null;
  const features = selectedPlanId
    ? premiumDashboardFeatureItems(selectedPlanId)
    : [];
  const selectedPeriod =
    focused?.periods.find((p) => p.months === periodMonths) ??
    focused?.periods[0];
  const canCheckout = Boolean(
    selectedPlanId && focused && !focused.comingSoon && selectedPeriod
  );

  async function checkout() {
    if (!focused || focused.comingSoon || !selectedPeriod) return;
    setBusy(true);
    setCheckoutError(null);
    try {
      const res = await api<{ initPoint: string }>("/api/premium/checkout", {
        method: "POST",
        body: JSON.stringify({
          planId: focused.id,
          periodMonths: selectedPeriod.months,
        }),
      });
      await WebBrowser.openBrowserAsync(res.initPoint);
      toast.info("Cuando completes el pago, volvé a Nocta");
      onCheckoutDone?.();
      onClose();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "No se pudo iniciar la suscripción";
      setCheckoutError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {
        if (planBlock) {
          setPlanBlock(null);
          return;
        }
        if (selectedPlanId) {
          setSelectedPlanId(null);
          return;
        }
        onClose();
      }}
    >
      <View
        style={[
          styles.root,
          { paddingTop: Math.max(insets.top, 12), paddingBottom: insets.bottom },
        ]}
      >
        <View style={styles.head}>
          <View style={styles.headCopy}>
            {selectedPlanId ? (
              <>
                <Pressable
                  onPress={() => setSelectedPlanId(null)}
                  style={styles.backRow}
                  hitSlop={8}
                >
                  <Ionicons
                    name="arrow-back"
                    size={16}
                    color={colors.textMuted}
                  />
                  <Text style={styles.backText}>Planes</Text>
                </Pressable>
                <View style={styles.planTitleRow}>
                  <NoctaWordmark size={28} />
                  <View
                    style={[
                      styles.hourPill,
                      PLAN_PILL[selectedPlanId] && {
                        backgroundColor: PLAN_PILL[selectedPlanId]!.bg,
                        borderColor: PLAN_PILL[selectedPlanId]!.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.hourPillText,
                        PLAN_PILL[selectedPlanId] && {
                          color: PLAN_PILL[selectedPlanId]!.color,
                        },
                      ]}
                    >
                      {PLAN_HOUR[selectedPlanId]}
                    </Text>
                  </View>
                </View>
                {(focused?.tagline || shared?.tagline) ? (
                  <Text style={styles.tagline}>
                    {focused?.tagline || shared?.tagline}
                  </Text>
                ) : null}
              </>
            ) : (
              <>
                <Text style={styles.eyebrow}>Nocta Premium</Text>
                <Text style={styles.title}>Elegí tu noche</Text>
              </>
            )}
          </View>
          <Pressable
            onPress={onClose}
            style={styles.closeBtn}
            accessibilityLabel="Cerrar"
          >
            <Ionicons name="close" size={20} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <Text style={styles.hint}>Cargando planes…</Text>
          ) : !selectedPlanId ? (
            <>
              <Text style={styles.intro}>
                Elegí un plan para ver periodos y suscribirte. 2 A.M. arranca la
                noche; 4 A.M. suma Boost y Heartshots; 6 A.M. lleva Clone y Modo
                espía.
              </Text>
              <View style={styles.planList}>
                {plans.map((item) => {
                  const pill = PLAN_PILL[item.id];
                  const fromPrice = premiumCheapestMonthlyUsd(item.periods);
                  const isCurrent =
                    Boolean(currentPlanId) && currentPlanId === item.id;
                  const isLower = isPremiumPlanDowngrade(
                    currentPlanId,
                    String(item.id)
                  );
                  const cardFeatures = planCardFeatures(
                    String(item.id),
                    item.comingSoon
                  );
                  return (
                    <Pressable
                      key={item.id}
                      disabled={item.comingSoon}
                      onPress={() => {
                        if (isCurrent) {
                          setPlanBlock("same");
                          return;
                        }
                        if (isLower) {
                          setPlanBlock("lower");
                          return;
                        }
                        setSelectedPlanId(item.id as PremiumPlanId);
                        setPeriodMonths(3);
                      }}
                      style={[
                        styles.planCard,
                        item.comingSoon && { opacity: 0.55 },
                        isCurrent && styles.planCardCurrent,
                      ]}
                    >
                      <View style={styles.planCardTop}>
                        <View
                          style={[
                            styles.hourPill,
                            pill && {
                              backgroundColor: pill.bg,
                              borderColor: pill.border,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.hourPillText,
                              pill && { color: pill.color },
                            ]}
                          >
                            {PLAN_HOUR[item.id] ?? item.name}
                          </Text>
                        </View>
                        {isCurrent ? (
                          <Text style={styles.currentBadge}>Tu plan</Text>
                        ) : item.comingSoon ? (
                          <Text style={styles.soonBadge}>Pronto</Text>
                        ) : null}
                      </View>
                      <Text style={styles.planName}>{item.name}</Text>
                      <Text style={styles.tagline}>{item.tagline}</Text>
                      {fromPrice != null && !item.comingSoon ? (
                        <View>
                          <Text style={styles.fromPrice}>
                            Desde {currency} {formatMonthly(fromPrice.monthly)}
                            /mes
                          </Text>
                          <Text style={styles.fromPriceNote}>
                            {premiumFromPriceNote(fromPrice.months)}
                          </Text>
                        </View>
                      ) : null}
                      <View style={styles.featureMini}>
                        {cardFeatures.map((f) => (
                          <Text
                            key={f.id}
                            style={[
                              styles.featureMiniText,
                              !f.included && styles.featureMiniOff,
                            ]}
                          >
                            {f.included ? "· " : "○ "}
                            {f.label}
                          </Text>
                        ))}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : (
            <>
              {focused && !focused.comingSoon ? (
                <View style={styles.periodSection}>
                  <Text style={styles.sectionLabel}>Facturación</Text>
                  <Text style={styles.hint}>
                    Se cobra automáticamente según el periodo que elijas.
                  </Text>
                  <View style={styles.periodGrid}>
                    {PREMIUM_PERIOD_MONTHS.map((months) => {
                      const period = focused.periods.find(
                        (p) => p.months === months
                      );
                      if (!period) return null;
                      const selected = periodMonths === months;
                      const savings = premiumPeriodSavingsPercent(
                        months,
                        String(focused.id)
                      );
                      return (
                        <Pressable
                          key={months}
                          onPress={() => setPeriodMonths(months)}
                          style={[
                            styles.periodChip,
                            selected && styles.periodChipOn,
                            months === 3 && styles.periodPopular,
                          ]}
                        >
                          <View style={styles.periodLabelRow}>
                            <Text
                              style={[
                                styles.periodLabel,
                                selected && styles.periodLabelOn,
                              ]}
                            >
                              {period.label}
                            </Text>
                            {months === 3 ? (
                              <Text style={styles.popularBadge}>POPULAR</Text>
                            ) : null}
                          </View>
                          <View style={styles.periodPriceRow}>
                            <Text
                              style={[
                                styles.periodPrice,
                                selected && styles.periodPriceOn,
                              ]}
                            >
                              {currency} {period.priceUsd}
                            </Text>
                            {savings > 0 ? (
                              <Text style={styles.savings}>
                                Ahorrás {savings}%
                              </Text>
                            ) : null}
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              <View style={styles.featureList}>
                {features.map((feature) => (
                  <View
                    key={feature.id}
                    style={[
                      styles.featureRow,
                      !feature.included && styles.featureRowOff,
                    ]}
                  >
                    <Ionicons
                      name={
                        feature.included
                          ? "checkmark"
                          : feature.id === "boost"
                            ? "rocket-outline"
                            : feature.id === "heartshot"
                              ? "heart-outline"
                              : "remove"
                      }
                      size={16}
                      color={
                        feature.included ? colors.primary : colors.textFaint
                      }
                    />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        style={[
                          styles.featureLabel,
                          !feature.included && { color: colors.textFaint },
                        ]}
                      >
                        {feature.label}
                      </Text>
                      <Text style={styles.featureDesc}>
                        {feature.description}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}
        </ScrollView>

        {canCheckout ? (
          <View style={styles.footer}>
            {checkoutError ? (
              <Text style={styles.checkoutError}>{checkoutError}</Text>
            ) : null}
            <Pressable
              disabled={busy || !selectedPeriod}
              onPress={() => void checkout()}
              style={[
                styles.cta,
                (busy || !selectedPeriod) && { opacity: 0.55 },
              ]}
            >
              <Text style={styles.ctaText}>
                {busy
                  ? "Abriendo Mercado Pago…"
                  : `Suscribirme · ${currency} ${selectedPeriod?.priceUsd ?? ""} / ${selectedPeriod?.label ?? ""}`}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {planBlock ? (
          <View style={styles.blockOverlay}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setPlanBlock(null)}
            />
            <View style={styles.blockDialog}>
              <Text style={styles.blockTitle}>
                {planBlock === "lower"
                  ? "Ya tenés un plan superior"
                  : "Ya tenés este plan"}
              </Text>
              <Text style={styles.hint}>
                Para gestionarlo, cerrá este panel y mirá tu suscripción en
                Premium.
              </Text>
              <Pressable
                onPress={() => setPlanBlock(null)}
                style={styles.blockBtn}
              >
                <Text style={styles.blockBtnText}>Entendido</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  head: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  headCopy: { flex: 1, minWidth: 0, gap: 4 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.elevated,
  },
  eyebrow: {
    color: colors.primary,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  title: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 28,
    letterSpacing: -0.03 * 28,
  },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
  },
  backText: {
    color: colors.textMuted,
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
  },
  planTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  hourPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.elevated,
  },
  hourPillText: {
    color: colors.primary,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
  },
  tagline: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  intro: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
  },
  hint: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
  },
  planList: { gap: spacing.sm },
  planCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    padding: spacing.md,
    gap: 6,
  },
  planCardCurrent: {
    borderColor: "rgba(214,255,75,0.45)",
  },
  planCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  currentBadge: {
    color: colors.primary,
    fontFamily: fonts.bodyBold,
    fontSize: 11,
  },
  soonBadge: {
    color: colors.textMuted,
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
  },
  planName: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 22,
    letterSpacing: -0.03 * 22,
  },
  fromPrice: {
    color: colors.primary,
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    marginTop: 2,
  },
  fromPriceNote: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 11,
    marginTop: 1,
  },
  featureMini: { marginTop: 4, gap: 2 },
  featureMiniText: {
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  featureMiniOff: { color: colors.textFaint },
  periodSection: { gap: 8 },
  sectionLabel: {
    color: colors.text,
    fontFamily: fonts.bodyBold,
    fontSize: 15,
  },
  periodGrid: { gap: 8 },
  periodChip: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.elevated,
    padding: spacing.md,
    gap: 6,
  },
  periodChipOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryDim,
  },
  periodPopular: {},
  periodLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  periodLabel: {
    color: colors.textMuted,
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
  },
  periodLabelOn: { color: colors.text },
  popularBadge: {
    color: colors.onPrimary,
    backgroundColor: colors.primary,
    overflow: "hidden",
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  periodPriceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 8,
  },
  periodPrice: {
    color: colors.text,
    fontFamily: fonts.bodyBold,
    fontSize: 16,
  },
  periodPriceOn: { color: colors.primary },
  savings: {
    color: colors.success,
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
  },
  featureList: { gap: 10 },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  featureRowOff: { opacity: 0.55 },
  featureLabel: {
    color: colors.text,
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
  },
  featureDesc: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  footer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  checkoutError: {
    color: colors.danger,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  cta: {
    minHeight: 48,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  ctaText: {
    color: colors.onPrimary,
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    textAlign: "center",
  },
  blockOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  blockDialog: {
    width: "100%",
    maxWidth: 360,
    borderRadius: radii.lg,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  blockTitle: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 20,
    letterSpacing: -0.03 * 20,
  },
  blockBtn: {
    alignSelf: "flex-start",
    marginTop: spacing.sm,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  blockBtnText: {
    color: colors.text,
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
  },
});

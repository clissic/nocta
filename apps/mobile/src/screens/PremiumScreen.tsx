import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getPremiumPlan,
  type AuthUser,
  type PremiumPlanId,
} from "@nocta/shared";
import { useAuth } from "../auth/AuthContext";
import { NoctaWordmark } from "../components/NoctaWordmark";
import { PremiumPackagesSheet } from "../components/premium/PremiumPackagesSheet";
import { useToast } from "../components/ToastProvider";
import { LoadingBlock, Screen } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { colors, fonts, radii, spacing } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Premium">;

type FeatureItem = {
  id: string;
  label: string;
  description: string;
  included: boolean;
};

type SubscriptionSummary = {
  active: boolean;
  planId?: string;
  planName?: string;
  periodMonths?: number;
  periodLabel?: string;
  amountUsd?: number;
  currency: string;
  status: string;
  cancelAtPeriodEnd: boolean;
  expiresAt: string | null;
  nextPaymentAt: string | null;
  managedByMercadoPago: boolean;
  features: Array<{ id: string; label: string; description: string }>;
  featureItems?: FeatureItem[];
};

type PaymentRow = {
  id: string;
  planName: string;
  periodLabel: string;
  amount: number;
  currency: string;
  status: string;
  paidAt?: string;
  coversUntil: string | null;
  mpPaymentId?: string | null;
};

type PaymentsPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
};

const PLAN_PILL: Record<
  string,
  { label: string; bg: string; color: string; border: string }
> = {
  nocta_2am: {
    label: "2 AM",
    bg: "rgba(214,255,75,0.18)",
    color: "#d6ff4b",
    border: "rgba(214,255,75,0.45)",
  },
  nocta_4am: {
    label: "4 AM",
    bg: "rgba(77,166,255,0.18)",
    color: "#7ec4ff",
    border: "rgba(77,166,255,0.45)",
  },
  nocta_6am: {
    label: "6 AM",
    bg: "rgba(167,112,255,0.18)",
    color: "#c4a0ff",
    border: "rgba(167,112,255,0.45)",
  },
};

const FEATURE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  unlimited_likes: "heart-outline",
  rewind: "arrow-undo-outline",
  see_likes: "eye-outline",
  teleport: "location-outline",
  rogue_mode: "moon-outline",
  no_ads: "ban-outline",
  boost: "rocket-outline",
  heartshot: "heart",
  spy_mode: "eye-outline",
  teleport_plus: "people-outline",
};

const PAYMENTS_PAGE_SIZE = 10;

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("es-UY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function daysRemaining(value?: string | null) {
  if (!value) return null;
  const end = new Date(value);
  if (Number.isNaN(end.getTime())) return null;
  return Math.ceil((end.getTime() - Date.now()) / 86_400_000);
}

function statusLabel(status: string, cancelAtPeriodEnd: boolean) {
  if (cancelAtPeriodEnd) return "Cancelada al final del periodo";
  switch (status) {
    case "authorized":
      return "Activa";
    case "paused":
      return "Pausada";
    case "pending":
      return "Pendiente de autorización";
    case "cancelled":
      return "Cancelada";
    default:
      return "Sin suscripción";
  }
}

function statusTone(
  status: string,
  cancelAtPeriodEnd: boolean
): "ok" | "warn" | "pending" | "danger" {
  if (cancelAtPeriodEnd || status === "paused") return "warn";
  if (status === "pending") return "pending";
  if (status === "cancelled") return "danger";
  return "ok";
}

function paymentStatusLabel(status: string) {
  switch (status) {
    case "approved":
      return "Aprobado";
    case "pending":
      return "Pendiente";
    case "rejected":
      return "Rechazado";
    default:
      return status;
  }
}

function lockHint(featureId: string) {
  if (featureId === "spy_mode" || featureId === "teleport_plus") return "6 AM";
  if (
    featureId === "boost" ||
    featureId === "heartshot" ||
    featureId === "see_likes"
  ) {
    return "4 AM+";
  }
  return "Premium";
}

function PremiumOrbit() {
  const spin = useSharedValue(0);
  useEffect(() => {
    spin.value = withRepeat(
      withTiming(360, { duration: 18_000, easing: Easing.linear }),
      -1,
      false
    );
  }, [spin]);

  const trackStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value}deg` }],
  }));
  const counterStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-spin.value}deg` }],
  }));

  const pills = [
    { label: "2 AM", style: PLAN_PILL.nocta_2am!, angle: 0 },
    { label: "4 AM", style: PLAN_PILL.nocta_4am!, angle: 120 },
    { label: "6 AM", style: PLAN_PILL.nocta_6am!, angle: 240 },
  ];

  return (
    <View style={styles.orbit} accessibilityElementsHidden>
      <View style={[styles.orbitRing, styles.orbitRingOuter]} />
      <View style={styles.orbitRing} />
      <Animated.View style={[styles.orbitTrack, trackStyle]}>
        {pills.map((pill) => (
          <View
            key={pill.label}
            style={[
              styles.orbitSlot,
              { transform: [{ rotate: `${pill.angle}deg` }] },
            ]}
          >
            <Animated.View
              style={[
                styles.orbitPill,
                {
                  backgroundColor: pill.style.bg,
                  borderColor: pill.style.border,
                },
                counterStyle,
              ]}
            >
              <Text style={[styles.orbitPillText, { color: pill.style.color }]}>
                {pill.label}
              </Text>
            </Animated.View>
          </View>
        ))}
      </Animated.View>
      <View style={styles.orbitCore}>
        <Ionicons name="diamond" size={28} color={colors.primary} />
      </View>
    </View>
  );
}

export function PremiumScreen({ navigation, route }: Props) {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionSummary | null>(
    null
  );
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [paymentsPagination, setPaymentsPagination] =
    useState<PaymentsPagination | null>(null);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [packagesOpen, setPackagesOpen] = useState(false);
  const [packagesPlanId, setPackagesPlanId] = useState<
    PremiumPlanId | undefined
  >(route.params?.planId);
  const [selectedPayment, setSelectedPayment] = useState<PaymentRow | null>(
    null
  );

  const loadPayments = useCallback(
    async (page: number) => {
      setPaymentsLoading(true);
      try {
        const payRes = await api<{
          payments: PaymentRow[];
          pagination: PaymentsPagination;
        }>(`/api/premium/payments?page=${page}&limit=${PAYMENTS_PAGE_SIZE}`);
        setPayments(payRes.payments);
        setPaymentsPagination(payRes.pagination);
        setPaymentsPage(payRes.pagination.page);
      } catch (err) {
        toast.error(
          err instanceof ApiError
            ? err.message
            : "No se pudo cargar el historial de pagos"
        );
      } finally {
        setPaymentsLoading(false);
      }
    },
    [toast]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const meRes = await api<{
        user: AuthUser;
        subscription: SubscriptionSummary;
      }>("/api/premium/me");
      setUser(meRes.user);
      setSubscription(meRes.subscription);
      if (meRes.subscription.active) {
        await loadPayments(1);
      } else {
        setPayments([]);
        setPaymentsPagination(null);
      }
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo cargar Premium"
      );
    } finally {
      setLoading(false);
    }
  }, [loadPayments, setUser, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (route.params?.planId) {
      setPackagesPlanId(route.params.planId);
      setPackagesOpen(true);
    }
  }, [route.params?.planId]);

  async function cancelRenewal() {
    setBusy(true);
    try {
      const res = await api<{ user: AuthUser; message?: string }>(
        "/api/premium/cancel",
        { method: "POST", body: JSON.stringify({}) }
      );
      setUser(res.user);
      toast.success(res.message || "Renovación cancelada");
      await load();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo cancelar"
      );
    } finally {
      setBusy(false);
    }
  }

  async function pauseSubscription() {
    setBusy(true);
    try {
      const res = await api<{ user: AuthUser }>("/api/premium/pause", {
        method: "POST",
        body: JSON.stringify({}),
      });
      setUser(res.user);
      toast.success("Suscripción pausada");
      await load();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo pausar"
      );
    } finally {
      setBusy(false);
    }
  }

  async function resumeSubscription() {
    setBusy(true);
    try {
      const res = await api<{ user: AuthUser }>("/api/premium/resume", {
        method: "POST",
        body: JSON.stringify({}),
      });
      setUser(res.user);
      toast.success("Suscripción reactivada");
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.code === "NEEDS_CHECKOUT") {
        toast.info(err.message);
        setPackagesPlanId(undefined);
        setPackagesOpen(true);
      } else {
        toast.error(
          err instanceof ApiError ? err.message : "No se pudo reactivar"
        );
      }
    } finally {
      setBusy(false);
    }
  }

  function confirmCancel() {
    Alert.alert(
      "¿Cancelar renovación?",
      `Seguirás con Premium hasta el ${formatDate(subscription?.expiresAt)}. Después no se te cobrará de nuevo.`,
      [
        { text: "Seguir con Premium", style: "cancel" },
        {
          text: "Confirmar cancelación",
          style: "destructive",
          onPress: () => void cancelRenewal(),
        },
      ]
    );
  }

  if (loading || !subscription) {
    return <LoadingBlock label="Cargando Premium…" />;
  }

  if (!subscription.active) {
    return (
      <Screen padded={false} safeTop={false}>
        <View
          style={[
            styles.marketing,
            {
              paddingTop: 12,
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.backAbs}
            accessibilityLabel="Volver"
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <PremiumOrbit />
          <Text style={styles.eyebrow}>Nocta Premium</Text>
          <NoctaWordmark size={42} />
          <Text style={styles.lead}>
            Likes ilimitados, rewind, ver quién te dio like, Teleport y modo
            pícaro. Suscripción recurrente según el periodo que elijas.
          </Text>
          <Pressable
            onPress={() => {
              setPackagesPlanId(undefined);
              setPackagesOpen(true);
            }}
            style={styles.primaryBtn}
          >
            <Text style={styles.primaryBtnText}>Ver planes</Text>
          </Pressable>
        </View>
        <PremiumPackagesSheet
          visible={packagesOpen}
          initialPlanId={packagesPlanId}
          onClose={() => setPackagesOpen(false)}
          onCheckoutDone={() => void load()}
        />
      </Screen>
    );
  }

  const planId = (subscription.planId || "nocta_2am") as PremiumPlanId;
  const pill = PLAN_PILL[planId] ?? PLAN_PILL.nocta_2am!;
  const planMeta = getPremiumPlan(planId);
  const tone = statusTone(subscription.status, subscription.cancelAtPeriodEnd);
  const remaining = daysRemaining(subscription.expiresAt);
  const perMonth =
    subscription.amountUsd != null && subscription.periodMonths
      ? Math.round(
          (subscription.amountUsd / subscription.periodMonths) * 100
        ) / 100
      : null;
  const dashFeatures =
    subscription.featureItems?.length
      ? subscription.featureItems
      : subscription.features.map((f) => ({ ...f, included: true }));

  return (
    <Screen padded={false} safeTop={false}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: 12,
          paddingBottom: Math.max(insets.bottom, 24),
          paddingHorizontal: spacing.md,
          gap: spacing.md,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.dashHead}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            accessibilityLabel="Volver"
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <View style={styles.dashHeadCopy}>
            <Text style={styles.eyebrowSm}>Tu suscripción</Text>
            <Text style={styles.dashTitle}>Premium</Text>
          </View>
          <Pressable
            disabled={busy}
            onPress={() => {
              setPackagesPlanId(undefined);
              setPackagesOpen(true);
            }}
            style={styles.changeBtn}
          >
            <Text style={styles.changeBtnText}>Cambiar plan</Text>
          </Pressable>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroMain}>
            <View style={styles.heroIcon}>
              <Ionicons name="diamond" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <View style={styles.heroTitleRow}>
                <Text style={styles.planName} numberOfLines={1}>
                  {subscription.planName || planMeta?.name || "Nocta Premium"}
                </Text>
                <View
                  style={[
                    styles.pill,
                    {
                      backgroundColor: pill.bg,
                      borderColor: pill.border,
                    },
                  ]}
                >
                  <Text style={[styles.pillText, { color: pill.color }]}>
                    {pill.label}
                  </Text>
                </View>
              </View>
              {planMeta?.tagline ? (
                <Text style={styles.tagline}>{planMeta.tagline}</Text>
              ) : null}
              <Text
                style={[
                  styles.status,
                  tone === "warn" && styles.statusWarn,
                  tone === "pending" && styles.statusPending,
                  tone === "danger" && styles.statusDanger,
                ]}
              >
                {statusLabel(
                  subscription.status,
                  subscription.cancelAtPeriodEnd
                )}
              </Text>
            </View>
          </View>
          <View style={styles.heroPrice}>
            {subscription.amountUsd != null ? (
              <>
                <Text style={styles.priceValue}>
                  <Text style={styles.priceCurrency}>
                    {subscription.currency}{" "}
                  </Text>
                  {subscription.amountUsd}
                </Text>
                <Text style={styles.pricePeriod}>
                  {subscription.periodLabel || "Periodo"}
                  {perMonth != null && subscription.periodMonths !== 1
                    ? ` · ~${subscription.currency} ${perMonth}/mes`
                    : ""}
                </Text>
              </>
            ) : (
              <Text style={styles.pricePeriod}>
                {subscription.periodLabel || "Plan activo"}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.stats}>
          <Stat
            label="Facturación"
            value={subscription.periodLabel || "—"}
            hint={
              subscription.managedByMercadoPago
                ? "Mercado Pago"
                : "Gestión manual"
            }
          />
          <Stat
            label="Vigencia"
            value={formatDate(subscription.expiresAt)}
            hint={
              remaining == null
                ? "Sin fecha"
                : remaining < 0
                  ? "Vencida"
                  : remaining === 0
                    ? "Vence hoy"
                    : remaining === 1
                      ? "1 día restante"
                      : `${remaining} días restantes`
            }
          />
          <Stat
            label="Próximo cobro"
            value={
              subscription.cancelAtPeriodEnd
                ? "No se renueva"
                : formatDate(subscription.nextPaymentAt)
            }
            hint={
              subscription.cancelAtPeriodEnd
                ? "Acceso hasta el fin del periodo"
                : "Renovación automática"
            }
          />
          <Stat
            label="Pagos"
            value={String(paymentsPagination?.total ?? payments.length)}
            hint={
              (paymentsPagination?.total ?? payments.length) === 0
                ? "Sin cobros aún"
                : (paymentsPagination?.total ?? payments.length) === 1
                  ? "Último cobro registrado"
                  : "En el historial"
            }
          />
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHead}>
            <Text style={styles.panelTitle}>Beneficios incluidos</Text>
            <Text style={styles.panelCount}>
              {dashFeatures.filter((f) => f.included).length}
            </Text>
          </View>
          {dashFeatures.length > 0 ? (
            <View style={styles.featureList}>
              {dashFeatures.map((feature) => (
                <View
                  key={feature.id}
                  style={[
                    styles.featureRow,
                    !feature.included && styles.featureOff,
                  ]}
                >
                  <View style={styles.featureIcon}>
                    <Ionicons
                      name={FEATURE_ICONS[feature.id] ?? "checkmark"}
                      size={16}
                      color={
                        feature.included ? colors.primary : colors.textFaint
                      }
                    />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.featureLabel}>
                      {feature.label}
                      {!feature.included ? (
                        <Text style={styles.featureLock}>
                          {" "}
                          · {lockHint(feature.id)}
                        </Text>
                      ) : feature.id === "boost" ? (
                        <Text style={styles.featureMeta}>
                          {" "}
                          · {user?.boostsRemaining ?? 0} rest.
                        </Text>
                      ) : feature.id === "heartshot" ? (
                        <Text style={styles.featureMeta}>
                          {" "}
                          · {user?.heartshotsRemaining ?? 0} rest.
                        </Text>
                      ) : null}
                    </Text>
                    <Text style={styles.featureDesc}>{feature.description}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.hint}>
              Tu plan no lista beneficios todavía.
            </Text>
          )}

          <View style={styles.toggles}>
            <ToggleRow
              icon="location-outline"
              label="Teleport"
              value={
                user?.teleportMode
                  ? user.teleportCity?.city || "Activado"
                  : "Desactivado"
              }
            />
            <ToggleRow
              icon="moon-outline"
              label="Pícaro"
              value={user?.rogueMode ? "Activado" : "Desactivado"}
            />
            <ToggleRow
              icon="rocket-outline"
              label="Boosts"
              value={String(user?.boostsRemaining ?? 0)}
            />
            <ToggleRow
              icon="heart"
              label="Heartshots"
              value={String(user?.heartshotsRemaining ?? 0)}
            />
          </View>

          <View style={styles.actions}>
            {subscription.status === "paused" ? (
              <ActionBtn
                label="Reanudar"
                disabled={busy}
                onPress={() => void resumeSubscription()}
              />
            ) : subscription.managedByMercadoPago &&
              !subscription.cancelAtPeriodEnd ? (
              <ActionBtn
                label="Pausar"
                disabled={busy}
                onPress={() => void pauseSubscription()}
              />
            ) : null}
            {!subscription.cancelAtPeriodEnd ? (
              <ActionBtn
                label="Cancelar renovación"
                danger
                disabled={busy}
                onPress={confirmCancel}
              />
            ) : subscription.managedByMercadoPago ? (
              <ActionBtn
                label="Reactivar renovación"
                disabled={busy}
                onPress={() => void resumeSubscription()}
              />
            ) : null}
          </View>
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHead}>
            <Text style={styles.panelTitle}>Historial de pagos</Text>
            {(paymentsPagination?.total ?? 0) > 0 ? (
              <Text style={styles.panelCount}>
                {paymentsPagination?.total}
              </Text>
            ) : null}
          </View>

          {paymentsLoading && payments.length === 0 ? (
            <Text style={styles.hint}>Cargando pagos…</Text>
          ) : payments.length === 0 ? (
            <View style={styles.paymentsEmpty}>
              <Ionicons
                name="receipt-outline"
                size={28}
                color={colors.textFaint}
              />
              <Text style={styles.featureLabel}>
                Todavía no hay cobros registrados.
              </Text>
              <Text style={styles.hint}>
                Cuando se confirme un pago de Mercado Pago, va a aparecer acá.
              </Text>
            </View>
          ) : (
            <View style={styles.payList}>
              {payments.map((payment) => (
                <Pressable
                  key={payment.id}
                  onPress={() => setSelectedPayment(payment)}
                  style={styles.payRow}
                >
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Text style={styles.payPlan}>{payment.planName}</Text>
                    <Text style={styles.hint}>
                      {formatDate(payment.paidAt)} · {payment.periodLabel}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 2 }}>
                    <Text style={styles.payAmount}>
                      {payment.currency} {payment.amount}
                    </Text>
                    <Text style={styles.payStatus}>
                      {paymentStatusLabel(payment.status)}
                    </Text>
                  </View>
                </Pressable>
              ))}
              {(paymentsPagination?.totalPages ?? 0) > 1 ? (
                <View style={styles.pagination}>
                  <ActionBtn
                    label="Anterior"
                    disabled={paymentsPage <= 1 || paymentsLoading}
                    onPress={() => void loadPayments(paymentsPage - 1)}
                  />
                  <Text style={styles.hint}>
                    {paymentsPage}/{paymentsPagination?.totalPages}
                  </Text>
                  <ActionBtn
                    label="Siguiente"
                    disabled={
                      paymentsPage >= (paymentsPagination?.totalPages ?? 1) ||
                      paymentsLoading
                    }
                    onPress={() => void loadPayments(paymentsPage + 1)}
                  />
                </View>
              ) : null}
            </View>
          )}
        </View>
      </ScrollView>

      {selectedPayment ? (
        <View style={styles.detailOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setSelectedPayment(null)}
          />
          <View style={styles.detailDialog}>
            <View style={styles.heroIcon}>
              <Ionicons name="receipt-outline" size={22} color={colors.primary} />
            </View>
            <Text style={styles.detailTitle}>Detalle del pago</Text>
            <DetailRow label="ID">
              <View style={styles.idRow}>
                <Text style={styles.idText} numberOfLines={1}>
                  {selectedPayment.id}
                </Text>
                <Pressable
                  onPress={() => {
                    void Clipboard.setStringAsync(selectedPayment.id).then(
                      () => toast.success("ID copiado"),
                      () => toast.error("No se pudo copiar")
                    );
                  }}
                  style={styles.copyBtn}
                  accessibilityLabel="Copiar ID"
                >
                  <Ionicons
                    name="copy-outline"
                    size={16}
                    color={colors.text}
                  />
                </Pressable>
              </View>
            </DetailRow>
            {selectedPayment.mpPaymentId ? (
              <DetailRow label="ID Mercado Pago">
                <Text style={styles.idText}>{selectedPayment.mpPaymentId}</Text>
              </DetailRow>
            ) : null}
            <DetailRow label="Fecha">
              <Text style={styles.detailValue}>
                {formatDate(selectedPayment.paidAt)}
              </Text>
            </DetailRow>
            <DetailRow label="Concepto">
              <Text style={styles.payPlan}>{selectedPayment.planName}</Text>
              <Text style={styles.hint}>{selectedPayment.periodLabel}</Text>
            </DetailRow>
            <DetailRow label="Monto">
              <Text style={styles.payAmount}>
                {selectedPayment.currency} {selectedPayment.amount}
              </Text>
            </DetailRow>
            <DetailRow label="Estado">
              <Text style={styles.payStatus}>
                {paymentStatusLabel(selectedPayment.status)}
              </Text>
            </DetailRow>
            <DetailRow label="Cubre hasta">
              <Text style={styles.detailValue}>
                {formatDate(selectedPayment.coversUntil)}
              </Text>
            </DetailRow>
            <ActionBtn
              label="Cerrar"
              onPress={() => setSelectedPayment(null)}
            />
          </View>
        </View>
      ) : null}

      <PremiumPackagesSheet
        visible={packagesOpen}
        initialPlanId={packagesPlanId}
        onClose={() => {
          setPackagesOpen(false);
          void load();
        }}
        onCheckoutDone={() => void load()}
      />
    </Screen>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statHint}>{hint}</Text>
    </View>
  );
}

function ToggleRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleLeft}>
        <Ionicons name={icon} size={14} color={colors.textMuted} />
        <Text style={styles.toggleLabel}>{label}</Text>
      </View>
      <Text style={styles.toggleValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function ActionBtn({
  label,
  onPress,
  disabled,
  danger,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.actionBtn,
        danger && styles.actionBtnDanger,
        disabled && { opacity: 0.5 },
      ]}
    >
      <Text
        style={[styles.actionBtnText, danger && styles.actionBtnTextDanger]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      {children}
    </View>
  );
}

const ORBIT = 168;

const styles = StyleSheet.create({
  marketing: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  backAbs: {
    position: "absolute",
    left: spacing.md,
    top: spacing.md + 24,
    zIndex: 2,
    padding: 4,
  },
  orbit: {
    width: ORBIT,
    height: ORBIT,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  orbitRing: {
    position: "absolute",
    width: ORBIT * 0.72,
    height: ORBIT * 0.72,
    borderRadius: ORBIT,
    borderWidth: 1,
    borderColor: "rgba(214,255,75,0.22)",
  },
  orbitRingOuter: {
    width: ORBIT,
    height: ORBIT,
    borderColor: "rgba(214,255,75,0.12)",
  },
  orbitTrack: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  orbitSlot: {
    position: "absolute",
    width: ORBIT,
    height: ORBIT,
    alignItems: "center",
  },
  orbitPill: {
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  orbitPillText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
  },
  orbitCore: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryDim,
    borderWidth: 1,
    borderColor: "rgba(214,255,75,0.35)",
  },
  eyebrow: {
    color: colors.primary,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  eyebrowSm: {
    color: colors.primary,
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  lead: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 340,
  },
  primaryBtn: {
    minHeight: 48,
    minWidth: 180,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: colors.onPrimary,
    fontFamily: fonts.bodyBold,
    fontSize: 15,
  },
  dashHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  backBtn: { padding: 4 },
  dashHeadCopy: { flex: 1, minWidth: 0 },
  dashTitle: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 26,
    letterSpacing: -0.03 * 26,
  },
  changeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
  changeBtnText: {
    color: colors.onPrimary,
    fontFamily: fonts.bodyBold,
    fontSize: 13,
  },
  hero: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    padding: spacing.md,
    gap: spacing.md,
  },
  heroMain: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryDim,
  },
  heroTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  planName: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 22,
    letterSpacing: -0.03 * 22,
    flexShrink: 1,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  pillText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
  },
  tagline: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  status: {
    alignSelf: "flex-start",
    marginTop: 2,
    color: colors.success,
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
  },
  statusWarn: { color: colors.warning },
  statusPending: { color: "#7ec4ff" },
  statusDanger: { color: colors.danger },
  heroPrice: { gap: 2 },
  priceValue: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 28,
    letterSpacing: -0.03 * 28,
  },
  priceCurrency: {
    color: colors.textMuted,
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
  },
  pricePeriod: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  stats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  stat: {
    width: "47.5%",
    flexGrow: 1,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    padding: spacing.md,
    gap: 2,
  },
  statLabel: {
    color: colors.textMuted,
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  statValue: {
    color: colors.text,
    fontFamily: fonts.bodyBold,
    fontSize: 15,
  },
  statHint: {
    color: colors.textFaint,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  panel: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    padding: spacing.md,
    gap: spacing.md,
  },
  panelHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  panelTitle: {
    color: colors.text,
    fontFamily: fonts.bodyBold,
    fontSize: 15,
  },
  panelCount: {
    color: colors.primary,
    fontFamily: fonts.bodyBold,
    fontSize: 13,
  },
  featureList: { gap: 12 },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  featureOff: { opacity: 0.5 },
  featureIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.elevated,
  },
  featureLabel: {
    color: colors.text,
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
  },
  featureLock: {
    color: colors.textFaint,
    fontFamily: fonts.bodyMedium,
  },
  featureMeta: {
    color: colors.primary,
    fontFamily: fonts.bodyMedium,
  },
  featureDesc: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  hint: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
  },
  toggles: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    gap: 8,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  toggleLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  toggleLabel: {
    color: colors.textMuted,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
  },
  toggleValue: {
    color: colors.text,
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    flexShrink: 1,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionBtnDanger: {
    borderColor: "rgba(255,107,107,0.45)",
  },
  actionBtnText: {
    color: colors.text,
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
  },
  actionBtnTextDanger: {
    color: colors.danger,
  },
  paymentsEmpty: {
    alignItems: "center",
    gap: 6,
    paddingVertical: spacing.md,
  },
  payList: { gap: 8 },
  payRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  payPlan: {
    color: colors.text,
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
  },
  payAmount: {
    color: colors.primary,
    fontFamily: fonts.bodyBold,
    fontSize: 14,
  },
  payStatus: {
    color: colors.textMuted,
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
  },
  pagination: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.sm,
  },
  detailOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  detailDialog: {
    width: "100%",
    maxWidth: 400,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  detailTitle: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 22,
    letterSpacing: -0.03 * 22,
  },
  detailRow: { gap: 2, marginTop: 4 },
  detailLabel: {
    color: colors.textMuted,
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  detailValue: {
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  idRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  idText: {
    flex: 1,
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  copyBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
});

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { AuthUser, PremiumPlanId } from "@nocta/shared";
import { getPremiumPlan } from "@nocta/shared";
import { useAuth } from "../auth/AuthContext";
import { api, ApiError } from "../lib/api";
import { NoctaLoading } from "../components/NoctaLoading";
import { PremiumPackagesModal } from "../components/PremiumPackagesModal";
import { useToast } from "../components/ToastProvider";
import { NoctaWordmark } from "../components/NoctaWordmark";

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
  featureItems?: Array<{
    id: string;
    label: string;
    description: string;
    included: boolean;
  }>;
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

const PLAN_PILL_CLASS: Record<string, string> = {
  nocta_2am: "is-2am",
  nocta_4am: "is-4am",
  nocta_6am: "is-6am",
};

const PLAN_PILL_LABEL: Record<string, string> = {
  nocta_2am: "2 AM",
  nocta_4am: "4 AM",
  nocta_6am: "6 AM",
};

const FEATURE_ICONS: Record<string, string> = {
  unlimited_likes: "bi-heart",
  rewind: "bi-arrow-counterclockwise",
  see_likes: "bi-eye",
  teleport: "bi-geo-alt",
  rogue_mode: "bi-moon-stars",
  no_ads: "bi-slash-circle",
  boost: "bi-rocket-takeoff",
  heartshot: "bi-arrow-through-heart",
  spy_mode: "bi-binoculars",
  teleport_plus: "bi-people",
};

const PAYMENTS_PAGE_SIZE = 10;

type PaymentsPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
};

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
  const diffMs = end.getTime() - Date.now();
  return Math.ceil(diffMs / 86_400_000);
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

function statusToneClass(status: string, cancelAtPeriodEnd: boolean) {
  if (cancelAtPeriodEnd) return "is-warn";
  if (status === "paused") return "is-warn";
  if (status === "pending") return "is-pending";
  if (status === "cancelled") return "is-danger";
  return "is-ok";
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

export function PremiumPage() {
  const { user, setUser, refresh } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
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
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentRow | null>(
    null
  );

  function openPaymentDetail(payment: PaymentRow) {
    setSelectedPayment(payment);
  }

  const loadPayments = useCallback(async (page: number) => {
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
  }, [toast]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const meRes = await api<{
        user: AuthUser;
        subscription: SubscriptionSummary;
      }>("/api/premium/me");
      setUser(meRes.user);
      setSubscription(meRes.subscription);
      await loadPayments(1);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo cargar Premium"
      );
    } finally {
      setLoading(false);
    }
  }, [setUser, toast, loadPayments]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const status = searchParams.get("status");
    if (!status) return;
    if (status === "success") {
      toast.success("Suscripción autorizada. Bienvenido a Nocta Premium.");
      void refresh().then(() => void load());
    } else if (status === "pending") {
      toast.info("Suscripción pendiente. Te avisamos cuando se confirme.");
    } else if (status === "failure") {
      toast.error("No se completó la suscripción. Podés intentar de nuevo.");
      setPackagesOpen(true);
    }
    const next = new URLSearchParams(searchParams);
    next.delete("status");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, toast, refresh, load]);

  useEffect(() => {
    if (user && !user.premium && searchParams.get("buy") === "1") {
      setPackagesOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete("buy");
      setSearchParams(next, { replace: true });
    }
  }, [user, searchParams, setSearchParams]);

  async function cancelRenewal() {
    setBusy(true);
    try {
      const res = await api<{ user: AuthUser; message?: string }>(
        "/api/premium/cancel",
        { method: "POST", body: JSON.stringify({}) }
      );
      setUser(res.user);
      toast.success(res.message || "Renovación cancelada");
      setConfirmCancel(false);
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

  if (loading || !subscription) {
    return <NoctaLoading variant="block" />;
  }

  if (!subscription.active) {
    return (
      <div className="app-screen premium-page premium-page-marketing fade-in">
        <div className="premium-page-shell">
          <div className="premium-orbit" aria-hidden="true">
            <span className="premium-orbit-ring" />
            <span className="premium-orbit-ring is-outer" />
            <div className="premium-orbit-track">
              <span className="premium-orbit-slot" style={{ "--i": 0 } as CSSProperties}>
                <span className="profile-settings-plan-pill is-2am premium-orbit-pill">
                  2 AM
                </span>
              </span>
              <span className="premium-orbit-slot" style={{ "--i": 1 } as CSSProperties}>
                <span className="profile-settings-plan-pill is-4am premium-orbit-pill">
                  4 AM
                </span>
              </span>
              <span className="premium-orbit-slot" style={{ "--i": 2 } as CSSProperties}>
                <span className="profile-settings-plan-pill is-6am premium-orbit-pill">
                  6 AM
                </span>
              </span>
            </div>
            <div className="premium-orbit-core">
              <i className="bi bi-gem" />
            </div>
          </div>

          <div className="premium-page-copy">
            <p className="premium-page-eyebrow">Nocta Premium</p>
            <h1 className="app-title display-6 mb-2 premium-page-title">
              <NoctaWordmark />
            </h1>
            <p className="text-secondary premium-page-lead mb-0">
              Likes ilimitados, rewind, ver quién te dio like, Teleport y modo
              pícaro. Suscripción recurrente según el periodo que elijas.
            </p>
            <div className="premium-page-cta">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setPackagesOpen(true)}
              >
                Ver planes
              </button>
            </div>
          </div>
        </div>
        {packagesOpen && (
          <PremiumPackagesModal
            onClose={() => setPackagesOpen(false)}
          />
        )}
      </div>
    );
  }

  const planId = (subscription.planId || "nocta_2am") as PremiumPlanId;
  const pillClass = PLAN_PILL_CLASS[planId] || "is-free";
  const pillLabel = PLAN_PILL_LABEL[planId] || "Premium";
  const planMeta = getPremiumPlan(planId);
  const statusText = statusLabel(
    subscription.status,
    subscription.cancelAtPeriodEnd
  );
  const statusTone = statusToneClass(
    subscription.status,
    subscription.cancelAtPeriodEnd
  );
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
      : subscription.features.map((feature) => ({
          ...feature,
          included: true,
        }));

  return (
    <div className="app-screen premium-page premium-page-dash fade-in">
      <header className="premium-dash-head">
        <div className="premium-dash-head-copy min-w-0">
          <p className="premium-page-eyebrow mb-1">Tu suscripción</p>
          <h1 className="app-title h3 mb-0">Premium</h1>
        </div>
        <div className="premium-dash-head-actions">
          <Link to="/profile" className="btn btn-outline-light btn-sm">
            Perfil
          </Link>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={busy}
            onClick={() => setPackagesOpen(true)}
          >
            Cambiar plan
          </button>
        </div>
      </header>

      <section className="premium-dash-hero">
        <div className="premium-dash-hero-main">
          <div className="premium-dash-hero-icon" aria-hidden="true">
            <i className="bi bi-gem" />
          </div>
          <div className="min-w-0">
            <div className="premium-dash-hero-title-row">
              <h2 className="premium-dash-plan-name mb-0">
                {subscription.planName || planMeta?.name || "Nocta Premium"}
              </h2>
              <span className={`profile-settings-plan-pill ${pillClass}`}>
                {pillLabel}
              </span>
            </div>
            {planMeta?.tagline ? (
              <p className="premium-dash-tagline mb-0">{planMeta.tagline}</p>
            ) : null}
            <span className={`premium-dash-status ${statusTone}`}>
              {statusText}
            </span>
          </div>
        </div>

        <div className="premium-dash-hero-price">
          {subscription.amountUsd != null ? (
            <>
              <p className="premium-dash-price-value mb-0">
                <span className="premium-dash-price-currency">
                  {subscription.currency}
                </span>{" "}
                {subscription.amountUsd}
              </p>
              <p className="premium-dash-price-period mb-0">
                {subscription.periodLabel || "Periodo"}
                {perMonth != null && subscription.periodMonths !== 1
                  ? ` · ~${subscription.currency} ${perMonth}/mes`
                  : ""}
              </p>
            </>
          ) : (
            <p className="premium-dash-price-period mb-0">
              {subscription.periodLabel || "Plan activo"}
            </p>
          )}
        </div>
      </section>

      <div className="premium-dash-stats">
        <article className="premium-dash-stat">
          <span className="premium-dash-stat-label">Facturación</span>
          <strong>{subscription.periodLabel || "—"}</strong>
          <small>
            {subscription.managedByMercadoPago
              ? "Mercado Pago"
              : "Gestión manual"}
          </small>
        </article>
        <article className="premium-dash-stat">
          <span className="premium-dash-stat-label">Vigencia</span>
          <strong>{formatDate(subscription.expiresAt)}</strong>
          <small>
            {remaining == null
              ? "Sin fecha"
              : remaining < 0
                ? "Vencida"
                : remaining === 0
                  ? "Vence hoy"
                  : remaining === 1
                    ? "1 día restante"
                    : `${remaining} días restantes`}
          </small>
        </article>
        <article className="premium-dash-stat">
          <span className="premium-dash-stat-label">Próximo cobro</span>
          <strong>
            {subscription.cancelAtPeriodEnd
              ? "No se renueva"
              : formatDate(subscription.nextPaymentAt)}
          </strong>
          <small>
            {subscription.cancelAtPeriodEnd
              ? "Acceso hasta el fin del periodo"
              : "Renovación automática"}
          </small>
        </article>
        <article className="premium-dash-stat">
          <span className="premium-dash-stat-label">Pagos</span>
          <strong>{paymentsPagination?.total ?? payments.length}</strong>
          <small>
            {(paymentsPagination?.total ?? payments.length) === 0
              ? "Sin cobros aún"
              : (paymentsPagination?.total ?? payments.length) === 1
                ? "Último cobro registrado"
                : "En el historial"}
          </small>
        </article>
      </div>

      <div className="premium-dash-grid">
        <section className="premium-dash-card premium-dash-panel">
          <div className="premium-dash-panel-head">
            <h2 className="h6 mb-0">Beneficios incluidos</h2>
            <span className="premium-dash-panel-count">
              {dashFeatures.filter((f) => f.included).length}
            </span>
          </div>

          {dashFeatures.length > 0 ? (
            <ul className="premium-dash-features list-unstyled mb-0">
              {dashFeatures.map((feature) => (
                <li
                  key={feature.id}
                  className={feature.included ? undefined : "is-disabled"}
                >
                  <span className="premium-dash-feature-icon" aria-hidden="true">
                    <i
                      className={`bi ${
                        FEATURE_ICONS[feature.id] || "bi-check2"
                      }`}
                    />
                  </span>
                  <span>
                    <strong>
                      {feature.label}
                      {!feature.included ? (
                        <span className="premium-dash-feature-lock">
                          {" "}
                          ·{" "}
                          {feature.id === "spy_mode" ||
                          feature.id === "teleport_plus"
                            ? "6 AM"
                            : feature.id === "boost" ||
                                feature.id === "heartshot" ||
                                feature.id === "see_likes"
                              ? "4 AM+"
                              : "Premium"}
                        </span>
                      ) : feature.id === "boost" ? (
                        <span className="premium-dash-feature-meta">
                          {" "}
                          · {user?.boostsRemaining ?? 0} rest.
                        </span>
                      ) : feature.id === "heartshot" ? (
                        <span className="premium-dash-feature-meta">
                          {" "}
                          · {user?.heartshotsRemaining ?? 0} rest.
                        </span>
                      ) : null}
                    </strong>
                    <small>{feature.description}</small>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-secondary small mb-0">
              Tu plan no lista beneficios todavía.
            </p>
          )}

          <div className="premium-dash-toggles">
            <div className="premium-dash-toggle">
              <span>
                <i className="bi bi-geo-alt" aria-hidden="true" />
                Teleport
              </span>
              <strong>
                {user?.teleportMode
                  ? user.teleportCity?.city || "Activado"
                  : "Desactivado"}
              </strong>
            </div>
            <div className="premium-dash-toggle">
              <span>
                <i className="bi bi-moon-stars" aria-hidden="true" />
                Pícaro
              </span>
              <strong>{user?.rogueMode ? "Activado" : "Desactivado"}</strong>
            </div>
            <div className="premium-dash-toggle">
              <span>
                <i className="bi bi-rocket-takeoff" aria-hidden="true" />
                Boosts
              </span>
              <strong>{user?.boostsRemaining ?? 0}</strong>
            </div>
            <div className="premium-dash-toggle">
              <span>
                <i className="bi bi-arrow-through-heart" aria-hidden="true" />
                Heartshots
              </span>
              <strong>{user?.heartshotsRemaining ?? 0}</strong>
            </div>
          </div>

          <div className="premium-dash-actions">
            {subscription.status === "paused" ? (
              <button
                type="button"
                className="btn btn-outline-light btn-sm"
                disabled={busy}
                onClick={() => void resumeSubscription()}
              >
                Reanudar
              </button>
            ) : subscription.managedByMercadoPago &&
              !subscription.cancelAtPeriodEnd ? (
              <button
                type="button"
                className="btn btn-outline-light btn-sm"
                disabled={busy}
                onClick={() => void pauseSubscription()}
              >
                Pausar
              </button>
            ) : null}
            {!subscription.cancelAtPeriodEnd ? (
              <button
                type="button"
                className="btn btn-outline-danger btn-sm"
                disabled={busy}
                onClick={() => setConfirmCancel(true)}
              >
                Cancelar renovación
              </button>
            ) : subscription.managedByMercadoPago ? (
              <button
                type="button"
                className="btn btn-outline-light btn-sm"
                disabled={busy}
                onClick={() => void resumeSubscription()}
              >
                Reactivar renovación
              </button>
            ) : null}
          </div>
        </section>

        <section className="premium-dash-card premium-dash-panel">
          <div className="premium-dash-panel-head">
            <h2 className="h6 mb-0">Historial de pagos</h2>
            {(paymentsPagination?.total ?? 0) > 0 ? (
              <span className="premium-dash-panel-count">
                {paymentsPagination?.total}
              </span>
            ) : null}
          </div>

          {paymentsLoading && payments.length === 0 ? (
            <p className="text-secondary small mb-0">Cargando pagos…</p>
          ) : payments.length === 0 ? (
            <div className="premium-dash-payments-empty">
              <i className="bi bi-receipt" aria-hidden="true" />
              <p className="mb-0">Todavía no hay cobros registrados.</p>
              <small className="text-secondary">
                Cuando se confirme un pago de Mercado Pago, va a aparecer acá.
              </small>
            </div>
          ) : (
            <>
              <div
                className={`premium-dash-payments${paymentsLoading ? " is-loading" : ""}`}
              >
                <table className="table premium-dash-table mb-0">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th className="premium-dash-col-detail">Concepto</th>
                      <th>Monto</th>
                      <th>Estado</th>
                      <th className="premium-dash-col-detail">Cubre hasta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((payment) => (
                      <tr
                        key={payment.id}
                        className="premium-dash-pay-row"
                        tabIndex={0}
                        aria-label={`Ver detalle del pago del ${formatDate(payment.paidAt)}`}
                        onClick={() => openPaymentDetail(payment)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openPaymentDetail(payment);
                          }
                        }}
                      >
                        <td>{formatDate(payment.paidAt)}</td>
                        <td className="premium-dash-col-detail">
                          <span className="premium-dash-pay-plan">
                            {payment.planName}
                          </span>
                          <span className="d-block small text-secondary">
                            {payment.periodLabel}
                          </span>
                        </td>
                        <td className="premium-dash-pay-amount">
                          {payment.currency} {payment.amount}
                        </td>
                        <td>
                          <span className="premium-dash-pay-status">
                            {paymentStatusLabel(payment.status)}
                          </span>
                        </td>
                        <td className="premium-dash-col-detail">
                          {formatDate(payment.coversUntil)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {(paymentsPagination?.totalPages ?? 0) > 1 ? (
                <nav
                  className="premium-dash-pagination"
                  aria-label="Paginación de pagos"
                >
                  <button
                    type="button"
                    className="btn btn-outline-light btn-sm"
                    disabled={paymentsPage <= 1 || paymentsLoading}
                    onClick={() => void loadPayments(paymentsPage - 1)}
                  >
                    Anterior
                  </button>
                  <span className="premium-dash-pagination-status">
                    Página {paymentsPage} de {paymentsPagination?.totalPages}
                  </span>
                  <button
                    type="button"
                    className="btn btn-outline-light btn-sm"
                    disabled={
                      paymentsPage >= (paymentsPagination?.totalPages ?? 1) ||
                      paymentsLoading
                    }
                    onClick={() => void loadPayments(paymentsPage + 1)}
                  >
                    Siguiente
                  </button>
                </nav>
              ) : null}
            </>
          )}
        </section>
      </div>

      {confirmCancel && (
        <div className="logout-confirm-layer" role="presentation">
          <button
            type="button"
            className="logout-confirm-backdrop"
            aria-label="Cerrar"
            onClick={() => setConfirmCancel(false)}
          />
          <section
            className="logout-confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="premium-cancel-title"
          >
            <div className="logout-confirm-icon" aria-hidden="true">
              <i className="bi bi-slash-circle" />
            </div>
            <h2 id="premium-cancel-title">¿Cancelar renovación?</h2>
            <p>
              Seguirás con Premium hasta el{" "}
              <strong>{formatDate(subscription.expiresAt)}</strong>. Después no
              se te cobrará de nuevo.
            </p>
            <div className="logout-confirm-actions">
              <button
                type="button"
                className="btn btn-outline-light"
                onClick={() => setConfirmCancel(false)}
                disabled={busy}
              >
                Seguir con Premium
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => void cancelRenewal()}
                disabled={busy}
              >
                Confirmar cancelación
              </button>
            </div>
          </section>
        </div>
      )}

      {selectedPayment && (
        <div className="logout-confirm-layer" role="presentation">
          <button
            type="button"
            className="logout-confirm-backdrop"
            aria-label="Cerrar"
            onClick={() => setSelectedPayment(null)}
          />
          <section
            className="logout-confirm-dialog premium-payment-detail-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="premium-payment-detail-title"
          >
            <div className="logout-confirm-icon" aria-hidden="true">
              <i className="bi bi-receipt" />
            </div>
            <h2 id="premium-payment-detail-title">Detalle del pago</h2>
            <dl className="premium-payment-detail-list mb-0">
              <div>
                <dt>ID</dt>
                <dd>
                  <div className="d-flex align-items-center gap-2">
                    <code className="small text-break mb-0">
                      {selectedPayment.id}
                    </code>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-light"
                      aria-label="Copiar ID"
                      onClick={() => {
                        void navigator.clipboard
                          .writeText(selectedPayment.id)
                          .then(() => toast.success("ID copiado"))
                          .catch(() => toast.error("No se pudo copiar"));
                      }}
                    >
                      <i className="bi bi-clipboard" aria-hidden="true" />
                    </button>
                  </div>
                </dd>
              </div>
              {selectedPayment.mpPaymentId ? (
                <div>
                  <dt>ID Mercado Pago</dt>
                  <dd className="font-monospace small text-break">
                    {selectedPayment.mpPaymentId}
                  </dd>
                </div>
              ) : null}
              <div>
                <dt>Fecha</dt>
                <dd>{formatDate(selectedPayment.paidAt)}</dd>
              </div>
              <div>
                <dt>Concepto</dt>
                <dd>
                  <span className="premium-dash-pay-plan">
                    {selectedPayment.planName}
                  </span>
                  <span className="d-block small text-secondary">
                    {selectedPayment.periodLabel}
                  </span>
                </dd>
              </div>
              <div>
                <dt>Monto</dt>
                <dd className="premium-dash-pay-amount">
                  {selectedPayment.currency} {selectedPayment.amount}
                </dd>
              </div>
              <div>
                <dt>Estado</dt>
                <dd>
                  <span className="premium-dash-pay-status">
                    {paymentStatusLabel(selectedPayment.status)}
                  </span>
                </dd>
              </div>
              <div>
                <dt>Cubre hasta</dt>
                <dd>{formatDate(selectedPayment.coversUntil)}</dd>
              </div>
            </dl>
            <div className="logout-confirm-actions">
              <button
                type="button"
                className="btn btn-outline-light"
                onClick={() => setSelectedPayment(null)}
              >
                Cerrar
              </button>
            </div>
          </section>
        </div>
      )}

      {packagesOpen && (
        <PremiumPackagesModal
          onClose={() => {
            setPackagesOpen(false);
            void load();
          }}
        />
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  PREMIUM_PERIOD_MONTHS,
  getPremiumPlan,
  isPremiumPlanDowngrade,
  premiumDashboardFeatureItems,
  premiumPeriodSavingsPercent,
  type PremiumPeriodMonths,
  type PremiumPlanId,
} from "@nocta/shared";
import { api, ApiError } from "../lib/api";
import { OverflowFade } from "./OverflowFade";
import { PremiumPlanCards } from "./PremiumPlanCards";
import { useToast } from "./ToastProvider";
import { NoctaLoading } from "./NoctaLoading";
import { NoctaWordmark } from "./NoctaWordmark";
import { useAuth } from "../auth/AuthContext";
import { Link } from "react-router-dom";

type PlanPeriod = {
  months: PremiumPeriodMonths;
  priceUsd: number;
  label: string;
};

type FeatureItem = {
  id: string;
  label: string;
  description: string;
};

type PlanCatalogItem = {
  id: PremiumPlanId | string;
  name: string;
  tagline: string;
  comingSoon: boolean;
  featureLabels: string[];
  featureItems?: FeatureItem[];
  periods: PlanPeriod[];
};

const PLAN_HOUR_LABEL: Record<string, string> = {
  nocta_2am: "2 AM",
  nocta_4am: "4 AM",
  nocta_6am: "6 AM",
};

type Props = {
  onClose: () => void;
  /** Si se pasa, abre directo ese plan (o el aviso de plan actual / inferior). */
  planId?: PremiumPlanId;
};

export function PremiumPackagesModal({ onClose, planId }: Props) {
  const toast = useToast();
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
  const [planBlockModal, setPlanBlockModal] = useState<
    null | "same" | "lower"
  >(null);
  const initialPlanHandled = useRef(false);
  const currentPlanId =
    user?.premium && user.premiumPlanId ? user.premiumPlanId : null;

  useEffect(() => {
    if (!planId || initialPlanHandled.current) return;
    initialPlanHandled.current = true;

    if (currentPlanId && currentPlanId === planId) {
      setPlanBlockModal("same");
      return;
    }
    if (isPremiumPlanDowngrade(currentPlanId, planId)) {
      setPlanBlockModal("lower");
      return;
    }
    setSelectedPlanId(planId);
    setPeriodMonths(3);
  }, [planId, currentPlanId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (planBlockModal) {
        setPlanBlockModal(null);
        return;
      }
      if (selectedPlanId) {
        setSelectedPlanId(null);
        return;
      }
      onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose, selectedPlanId, planBlockModal]);

  useEffect(() => {
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
  }, [toast]);

  const focusedPlan = selectedPlanId
    ? plans.find((p) => p.id === selectedPlanId)
    : undefined;
  const sharedPlan = selectedPlanId ? getPremiumPlan(selectedPlanId) : null;
  const featureItems = selectedPlanId
    ? premiumDashboardFeatureItems(selectedPlanId)
    : [];
  const planName = focusedPlan?.name ?? sharedPlan?.name ?? "Nocta Premium";
  const planTagline = focusedPlan?.tagline ?? sharedPlan?.tagline ?? "";
  const planHourLabel = selectedPlanId
    ? PLAN_HOUR_LABEL[selectedPlanId] ?? null
    : null;

  const selectedPeriod =
    focusedPlan?.periods.find((p) => p.months === periodMonths) ??
    focusedPlan?.periods[0];

  const canCheckout = Boolean(
    selectedPlanId &&
      focusedPlan &&
      !focusedPlan.comingSoon &&
      selectedPeriod
  );

  async function checkout() {
    if (!focusedPlan || focusedPlan.comingSoon || !selectedPeriod) return;
    setBusy(true);
    try {
      const res = await api<{ initPoint: string }>("/api/premium/checkout", {
        method: "POST",
        body: JSON.stringify({
          planId: focusedPlan.id,
          periodMonths: selectedPeriod.months,
        }),
      });
      window.location.assign(res.initPoint);
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "No se pudo iniciar la suscripción"
      );
      setBusy(false);
    }
  }

  if (typeof document === "undefined") return null;

  const pickerMode = !selectedPlanId;

  return createPortal(
    <div
      className="premium-packages-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="premium-packages-title"
    >
      <button
        type="button"
        className="premium-packages-backdrop"
        aria-label="Cerrar opciones Premium"
        onClick={onClose}
      />
      <div className="premium-packages-dialog">
        <OverflowFade className="premium-packages-body">
          <header className="premium-packages-head">
            <div>
              {pickerMode ? (
                <>
                  <p className="premium-packages-eyebrow">Nocta Premium</p>
                  <h2 id="premium-packages-title">Elegí tu noche</h2>
                </>
              ) : (
                <>
                  {!pickerMode && (
                    <button
                      type="button"
                      className="premium-packages-back"
                      onClick={() => setSelectedPlanId(null)}
                    >
                      <i className="bi bi-arrow-left" aria-hidden="true" />
                      Planes
                    </button>
                  )}
                  <h2
                    id="premium-packages-title"
                    className="premium-packages-plan-title"
                  >
                    <NoctaWordmark className="premium-packages-plan-wordmark" />
                    {planHourLabel && (
                      <span
                        className={`premium-packages-plan-hour${
                          selectedPlanId
                            ? ` is-${selectedPlanId.replace("nocta_", "")}`
                            : ""
                        }`}
                      >
                        {planHourLabel}
                      </span>
                    )}
                    <span className="visually-hidden">{planName}</span>
                  </h2>
                  {planTagline && (
                    <p className="premium-packages-plan-tagline mb-0">
                      {planTagline}
                    </p>
                  )}
                </>
              )}
            </div>
            <button
              type="button"
              className="premium-packages-close"
              aria-label="Cerrar"
              onClick={onClose}
            >
              <i className="bi bi-x-lg" aria-hidden="true" />
            </button>
          </header>

          {pickerMode ? (
            <PremiumPlanCards
              intro="Elegí un plan para ver periodos y suscribirte. 2 A.M. arranca la noche; 4 A.M. suma Boost y Heartshots; 6 A.M. lleva Clone y Modo espía."
              onSelectPlan={(id) => {
                setSelectedPlanId(id);
                setPeriodMonths(3);
              }}
            />
          ) : loading ? (
            <NoctaLoading variant="block" />
          ) : (
            <>
              {focusedPlan && !focusedPlan.comingSoon && (
                <PeriodPicker
                  periods={focusedPlan.periods}
                  periodMonths={periodMonths}
                  currency={currency}
                  planId={String(focusedPlan.id)}
                  onSelect={setPeriodMonths}
                />
              )}

              <ul className="premium-focused-features list-unstyled">
                {featureItems.map((feature) => (
                  <li
                    key={feature.id}
                    className={feature.included ? undefined : "is-disabled"}
                  >
                    <i
                      className={`bi ${
                        feature.included
                          ? "bi-check2 text-primary"
                          : feature.id === "boost"
                            ? "bi-rocket-takeoff"
                            : feature.id === "heartshot"
                              ? "bi-arrow-through-heart"
                              : feature.id === "spy_mode"
                                ? "bi-binoculars"
                                : feature.id === "teleport_plus"
                                  ? "bi-people"
                                  : "bi-dash"
                      }`}
                      aria-hidden="true"
                    />
                    <span>
                      <strong>{feature.label}</strong>
                      <small>{feature.description}</small>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </OverflowFade>

        {canCheckout && (
          <footer className="premium-packages-footer">
            <button
              type="button"
              className="btn btn-primary w-100"
              disabled={busy || !selectedPeriod}
              onClick={() => void checkout()}
            >
              {busy
                ? "Redirigiendo a Mercado Pago…"
                : `Suscribirme · ${currency} ${selectedPeriod?.priceUsd ?? ""} / ${selectedPeriod?.label ?? ""}`}
            </button>
          </footer>
        )}
      </div>

      {planBlockModal && (
        <div
          className="premium-owned-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="premium-owned-title"
        >
          <button
            type="button"
            className="premium-owned-backdrop"
            aria-label="Cerrar"
            onClick={() => setPlanBlockModal(null)}
          />
          <div className="premium-owned-dialog">
            <h3 id="premium-owned-title" className="h5 mb-2">
              {planBlockModal === "lower"
                ? "Ya tenés un plan superior"
                : "Ya tenés este plan"}
            </h3>
            <p className="text-secondary mb-3">
              Para gestionarlo,{" "}
              <Link
                to="/premium"
                className="link-primary"
                onClick={() => {
                  setPlanBlockModal(null);
                  onClose();
                }}
              >
                hacé click aquí
              </Link>
              .
            </p>
            <button
              type="button"
              className="btn btn-outline-light btn-sm"
              onClick={() => setPlanBlockModal(null)}
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}

function PeriodPicker({
  periods,
  periodMonths,
  currency,
  planId,
  onSelect,
}: {
  periods: PlanPeriod[];
  periodMonths: PremiumPeriodMonths;
  currency: string;
  planId: string;
  onSelect: (months: PremiumPeriodMonths) => void;
}) {
  return (
    <section className="premium-period-section">
      <h3 className="h6 mb-3">Facturación</h3>
      <p className="small text-secondary mb-3">
        Se cobra automáticamente según el periodo que elijas.
      </p>
      <div
        className="premium-period-grid"
        role="radiogroup"
        aria-label="Periodicidad de cobro"
      >
        {PREMIUM_PERIOD_MONTHS.map((months) => {
          const period = periods.find((p) => p.months === months);
          if (!period) return null;
          const selected = periodMonths === months;
          const savingsPercent = premiumPeriodSavingsPercent(months, planId);
          return (
            <button
              key={months}
              type="button"
              role="radio"
              aria-checked={selected}
              className={`premium-period-chip${
                selected ? " is-selected" : ""
              }${savingsPercent > 0 ? " has-savings" : ""}${
                months === 3 ? " is-popular" : ""
              }`}
              onClick={() => onSelect(months)}
            >
              <strong className="premium-period-label-row">
                <span>{period.label}</span>
                {months === 3 && (
                  <span className="premium-period-popular-badge">POPULAR</span>
                )}
              </strong>
              <span className="premium-period-price-row">
                <span className="premium-period-price">
                  {currency} {period.priceUsd}
                </span>
                {savingsPercent > 0 && (
                  <em className="premium-period-savings">
                    Ahorrás {savingsPercent}%
                  </em>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

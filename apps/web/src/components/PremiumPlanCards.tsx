import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  isPremiumPlanDowngrade,
  monthlyBoostAllowance,
  monthlyHeartshotAllowance,
  premiumDashboardFeatureItems,
  type PremiumPlanId,
} from "@nocta/shared";
import { useAuth } from "../auth/AuthContext";
import { api, ApiError } from "../lib/api";
import { NoctaLoading } from "./NoctaLoading";
import { useToast } from "./ToastProvider";

type PlanPeriod = {
  months: number;
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

const PLAN_PILL_CLASS: Record<string, string> = {
  nocta_2am: "is-2am",
  nocta_4am: "is-4am",
  nocta_6am: "is-6am",
};

const PLAN_HOUR_LABEL: Record<string, string> = {
  nocta_2am: "2 AM",
  nocta_4am: "4 AM",
  nocta_6am: "6 AM",
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
    .filter((feature) => feature.included && !extraIds.has(feature.id))
    .slice(0, 4);
  const extras = dash
    .filter((feature) => extraIds.has(feature.id))
    .map((feature) => {
      if (!feature.included) return feature;
      if (feature.id === "boost") {
        return {
          ...feature,
          label: `${monthlyBoostAllowance(planId)} Boost / mes`,
        };
      }
      if (feature.id === "heartshot") {
        return {
          ...feature,
          label: `${monthlyHeartshotAllowance(planId)} Heartshots / mes`,
        };
      }
      return feature;
    });
  return [...base, ...extras];
}

function cheapestMonthlyPrice(periods: PlanPeriod[]) {
  if (!periods.length) return null;
  let best = Infinity;
  for (const period of periods) {
    if (period.months <= 0) continue;
    const monthly = period.priceUsd / period.months;
    if (monthly < best) best = monthly;
  }
  return Number.isFinite(best) ? best : null;
}

function formatMonthlyPrice(value: number) {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(2).replace(/\.?0+$/, "");
}

type Props = {
  onSelectPlan: (planId: PremiumPlanId) => void;
  className?: string;
  intro?: string;
};

export function PremiumPlanCards({ onSelectPlan, className, intro }: Props) {
  const toast = useToast();
  const { user } = useAuth();
  const [plans, setPlans] = useState<PlanCatalogItem[]>([]);
  const [currency, setCurrency] = useState("USD");
  const [loading, setLoading] = useState(true);
  const [planBlockModal, setPlanBlockModal] = useState<
    null | "same" | "lower"
  >(null);
  const currentPlanId =
    user?.premium && user.premiumPlanId ? user.premiumPlanId : null;

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

  if (loading) {
    return (
      <div className={className}>
        <NoctaLoading variant="block" />
      </div>
    );
  }

  return (
    <div className={className}>
      {intro ? <p className="premium-packages-intro">{intro}</p> : null}

      <div className="premium-packages-grid" role="group" aria-label="Planes Premium">
        {plans.map((item) => {
          const hour = PLAN_HOUR_LABEL[item.id] ?? item.name;
          const disabled = item.comingSoon;
          const isCurrentPlan =
            Boolean(currentPlanId) && currentPlanId === item.id;
          const isLowerPlan = isPremiumPlanDowngrade(
            currentPlanId,
            String(item.id)
          );
          const isBlocked = isCurrentPlan || isLowerPlan;
          const fromMonthly = cheapestMonthlyPrice(item.periods);
          return (
            <button
              key={item.id}
              type="button"
              className={`premium-package premium-package-select${
                !item.comingSoon ? " is-featured" : ""
              }${isBlocked ? " is-current" : ""}`}
              disabled={disabled}
              aria-label={
                disabled
                  ? `${item.name}, próximamente`
                  : isCurrentPlan
                    ? `${item.name}, ya lo tenés`
                    : isLowerPlan
                      ? `${item.name}, ya tenés un plan superior`
                      : fromMonthly != null
                        ? `Elegir ${item.name}, desde ${currency} ${formatMonthlyPrice(fromMonthly)} por mes`
                        : `Elegir ${item.name}`
              }
              onClick={() => {
                if (disabled) return;
                if (isCurrentPlan) {
                  setPlanBlockModal("same");
                  return;
                }
                if (isLowerPlan) {
                  setPlanBlockModal("lower");
                  return;
                }
                onSelectPlan(item.id as PremiumPlanId);
              }}
            >
              <div className="premium-package-top">
                <img
                  className="premium-package-mark"
                  src="/images/nocta-logo-limaneon-nobg.png"
                  alt=""
                  aria-hidden="true"
                />
                {isCurrentPlan ? (
                  <span className="premium-package-badge is-current">
                    Tu plan
                  </span>
                ) : isLowerPlan ? (
                  <span className="premium-package-badge is-current">
                    Incluido
                  </span>
                ) : !item.comingSoon ? (
                  <span className="premium-package-badge">Disponible</span>
                ) : (
                  <span className="premium-package-badge is-soon">
                    Próximamente
                  </span>
                )}
              </div>
              <div className="premium-package-plan-block">
                <span className="premium-package-plan-label">Plan</span>
                <span
                  className={`profile-settings-plan-pill ${
                    PLAN_PILL_CLASS[item.id] ?? ""
                  }`}
                >
                  {hour}
                </span>
              </div>
              <p className="premium-package-cadence mb-0">{item.tagline}</p>
              <ul className="premium-package-features list-unstyled mb-0">
                {planCardFeatures(String(item.id), item.comingSoon).map(
                  (feature) => (
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
                      </span>
                    </li>
                  )
                )}
              </ul>
              {!disabled && fromMonthly != null && (
                <span className="premium-package-cta">
                  Desde {currency} {formatMonthlyPrice(fromMonthly)} / mes
                </span>
              )}
            </button>
          );
        })}
      </div>

      {planBlockModal && (
        <div
          className="premium-owned-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="premium-owned-title-cards"
        >
          <button
            type="button"
            className="premium-owned-backdrop"
            aria-label="Cerrar"
            onClick={() => setPlanBlockModal(null)}
          />
          <div className="premium-owned-dialog">
            <h3 id="premium-owned-title-cards" className="h5 mb-2">
              {planBlockModal === "lower"
                ? "Ya tenés un plan superior"
                : "Ya tenés este plan"}
            </h3>
            <p className="text-secondary mb-3">
              Para gestionarlo,{" "}
              <Link
                to="/premium"
                className="link-primary"
                onClick={() => setPlanBlockModal(null)}
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
    </div>
  );
}

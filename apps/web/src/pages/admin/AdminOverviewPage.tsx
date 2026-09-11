import { useEffect, useState } from "react";
import {
  PREMIUM_PLAN_IDS,
  getPremiumPlan,
  type AdminOverviewResponse,
} from "@nocta/shared";
import { api, ApiError } from "../../lib/api";
import { NoctaLoading } from "../../components/NoctaLoading";
import {
  AdminOverviewBarChart,
  AdminOverviewChartPanel,
  AdminOverviewLineChart,
  OVERVIEW_CHART_COLORS,
  buildOverviewChartRows,
} from "../../components/admin/AdminOverviewCharts";

const uyu = new Intl.NumberFormat("es-UY", {
  style: "currency",
  currency: "UYU",
  maximumFractionDigits: 0,
});

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const TABS = [
  { id: "users", label: "Usuarios", icon: "bi-people" },
  { id: "venues", label: "Espacios", icon: "bi-geo-alt" },
  { id: "requests", label: "Solicitudes", icon: "bi-inbox" },
  { id: "transactions", label: "Transacciones", icon: "bi-receipt" },
  { id: "cities", label: "Ciudades", icon: "bi-geo" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="admin-kpi">
      <strong>{value}</strong>
      <span>{label}</span>
      {hint ? <small className="admin-kpi-hint">{hint}</small> : null}
    </div>
  );
}

export function AdminOverviewPage() {
  const [overview, setOverview] = useState<AdminOverviewResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabId>("users");

  useEffect(() => {
    void api<{ overview: AdminOverviewResponse }>("/api/admin/overview")
      .then((res) => setOverview(res.overview))
      .catch((err) =>
        setError(
          err instanceof ApiError ? err.message : "No se pudo cargar el resumen"
        )
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <NoctaLoading variant="block" />;
  }

  return (
    <div className="admin-page">
      <header className="admin-page-head">
        <div>
          <p className="admin-page-eyebrow">Administración</p>
          <h1 className="app-title h3 mb-1">Resumen</h1>
          <p className="text-secondary small mb-0">
            Indicadores y tendencias de los últimos 12 meses.
          </p>
        </div>
      </header>

      {error ? <p className="text-danger small">{error}</p> : null}

      <div className="admin-overview-tabs">
        <div
          className="admin-filter-row admin-overview-tablist"
          role="tablist"
          aria-label="Secciones del resumen"
        >
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              aria-label={item.label}
              className={`admin-filter-chip admin-overview-tab-chip${
                tab === item.id ? " is-active" : ""
              }`}
              onClick={() => setTab(item.id)}
            >
              <i className={`bi ${item.icon}`} aria-hidden="true" />
              <span className="admin-overview-tab-chip-label">{item.label}</span>
            </button>
          ))}
        </div>
        <h2 className="admin-overview-tab-title" aria-live="polite">
          {TABS.find((item) => item.id === tab)?.label}
        </h2>
      </div>

      {!overview ? null : (
        <div className="admin-overview-tab" role="tabpanel">
          {tab === "users" ? <UsersTab overview={overview} /> : null}
          {tab === "venues" ? <VenuesTab overview={overview} /> : null}
          {tab === "requests" ? <RequestsTab overview={overview} /> : null}
          {tab === "transactions" ? (
            <TransactionsTab overview={overview} />
          ) : null}
          {tab === "cities" ? <CitiesTab overview={overview} /> : null}
        </div>
      )}
    </div>
  );
}

function UsersTab({ overview }: { overview: AdminOverviewResponse }) {
  const users = overview.users;
  const premiumSeriesMeta = PREMIUM_PLAN_IDS.map((id, index) => ({
    key: id,
    label: getPremiumPlan(id)?.name.replace("Nocta ", "") ?? id,
    color: [
      OVERVIEW_CHART_COLORS.primary,
      OVERVIEW_CHART_COLORS.secondary,
      OVERVIEW_CHART_COLORS.tertiary,
    ][index]!,
    values: users.premiumByPlanMonthly[id],
  }));

  const premiumRows = buildOverviewChartRows(
    overview.months,
    premiumSeriesMeta.map((s) => ({ key: s.key, values: s.values }))
  );
  const usersRows = buildOverviewChartRows(overview.months, [
    { key: "users", values: users.usersCumulativeMonthly },
  ]);

  return (
    <>
      <div className="admin-kpi-grid admin-kpi-grid-5">
        <KpiCard label="Usuarios" value={users.cards.users} />
        <KpiCard label="Administradores" value={users.cards.admins} />
        <KpiCard label="Matches" value={users.cards.matches} />
        <KpiCard label="Denuncias abiertas" value={users.cards.openReports} />
        <KpiCard label="Premium activos" value={users.cards.premiumActive} />
      </div>
      <div className="admin-overview-charts">
        <AdminOverviewChartPanel title="Usuarios Premium por mes">
          <AdminOverviewBarChart
            data={premiumRows}
            series={premiumSeriesMeta.map(({ key, label, color }) => ({
              key,
              label,
              color,
            }))}
            stacked
          />
        </AdminOverviewChartPanel>
        <AdminOverviewChartPanel title="Usuarios totales por mes">
          <AdminOverviewLineChart
            data={usersRows}
            series={[
              {
                key: "users",
                label: "Usuarios",
                color: OVERVIEW_CHART_COLORS.primary,
              },
            ]}
          />
        </AdminOverviewChartPanel>
      </div>
    </>
  );
}

function VenuesTab({ overview }: { overview: AdminOverviewResponse }) {
  const { venues, months } = overview;
  const presenceRows = buildOverviewChartRows(months, [
    { key: "presences", values: venues.presencesMonthly },
  ]);
  const ratingsRows = buildOverviewChartRows(months, [
    { key: "ratings", values: venues.ratingsAvgMonthly },
  ]);

  return (
    <>
      <div className="admin-kpi-grid admin-kpi-grid-5">
        <KpiCard label="Espacios" value={venues.cards.venues} />
        <KpiCard label="Sin organizador" value={venues.cards.ownerlessVenues} />
        <KpiCard label="Presencias" value={venues.cards.activePresences} />
        <KpiCard
          label="Mejor puntuado"
          value={
            venues.cards.bestRated
              ? venues.cards.bestRated.value.toFixed(1)
              : "—"
          }
          hint={venues.cards.bestRated?.name}
        />
        <KpiCard
          label="Peor puntuado"
          value={
            venues.cards.worstRated
              ? venues.cards.worstRated.value.toFixed(1)
              : "—"
          }
          hint={venues.cards.worstRated?.name}
        />
      </div>
      <div className="admin-overview-charts">
        <AdminOverviewChartPanel title="Presencias por mes">
          <AdminOverviewBarChart
            data={presenceRows}
            series={[
              {
                key: "presences",
                label: "Presencias",
                color: OVERVIEW_CHART_COLORS.primary,
              },
            ]}
          />
        </AdminOverviewChartPanel>
        <AdminOverviewChartPanel title="Calificaciones por mes">
          <AdminOverviewLineChart
            data={ratingsRows}
            series={[
              {
                key: "ratings",
                label: "Promedio",
                color: OVERVIEW_CHART_COLORS.secondary,
              },
            ]}
          />
        </AdminOverviewChartPanel>
      </div>
    </>
  );
}

function RequestsTab({ overview }: { overview: AdminOverviewResponse }) {
  const { requests, months } = overview;
  const requestsRows = buildOverviewChartRows(months, [
    { key: "requests", values: requests.requestsMonthly },
  ]);
  const splitRows = buildOverviewChartRows(months, [
    { key: "manage", values: requests.manageMonthly },
    { key: "suggest", values: requests.suggestMonthly },
  ]);

  return (
    <>
      <div className="admin-kpi-grid admin-kpi-grid-3">
        <KpiCard label="Pendientes" value={requests.cards.pending} />
        <KpiCard label="Aprobadas" value={requests.cards.approved} />
        <KpiCard label="Rechazadas" value={requests.cards.rejected} />
      </div>
      <div className="admin-overview-charts">
        <AdminOverviewChartPanel title="Solicitudes por mes">
          <AdminOverviewBarChart
            data={requestsRows}
            series={[
              {
                key: "requests",
                label: "Solicitudes",
                color: OVERVIEW_CHART_COLORS.primary,
              },
            ]}
          />
        </AdminOverviewChartPanel>
        <AdminOverviewChartPanel title="Alta con administración vs sugerencias">
          <AdminOverviewBarChart
            data={splitRows}
            series={[
              {
                key: "manage",
                label: "Con administración",
                color: OVERVIEW_CHART_COLORS.primary,
              },
              {
                key: "suggest",
                label: "Sugerencias",
                color: OVERVIEW_CHART_COLORS.secondary,
              },
            ]}
            stacked
          />
        </AdminOverviewChartPanel>
      </div>
    </>
  );
}

function TransactionsTab({ overview }: { overview: AdminOverviewResponse }) {
  const { transactions, months } = overview;
  const { cards } = transactions;
  const revenueRows = buildOverviewChartRows(months, [
    { key: "total", values: transactions.revenueMonthly.totalUsd },
  ]);
  const txRows = buildOverviewChartRows(months, [
    { key: "tx", values: transactions.transactionsMonthly },
  ]);

  return (
    <>
      <div className="admin-kpi-grid admin-kpi-grid-5">
        <KpiCard
          label="Importe en promos"
          value={uyu.format(cards.promoRevenueUyu)}
        />
        <KpiCard label="Cobros de promos" value={cards.promoPurchases} />
        <KpiCard
          label="Importe en premiums"
          value={usd.format(cards.premiumRevenueUsd)}
        />
        <KpiCard
          label="Cobros de premium"
          value={cards.premiumPurchasesApproved}
        />
        <KpiCard
          label="Ganancias totales"
          value={usd.format(cards.totalRevenueUsd)}
          hint="USD · promos a UYU 39"
        />
      </div>
      <div className="admin-overview-charts">
        <AdminOverviewChartPanel title="Ganancias totales por mes (USD)">
          <AdminOverviewLineChart
            data={revenueRows}
            series={[
              {
                key: "total",
                label: "Ganancias (USD)",
                color: OVERVIEW_CHART_COLORS.primary,
              },
            ]}
          />
        </AdminOverviewChartPanel>
        <AdminOverviewChartPanel title="Transacciones totales por mes">
          <AdminOverviewBarChart
            data={txRows}
            series={[
              {
                key: "tx",
                label: "Transacciones",
                color: OVERVIEW_CHART_COLORS.primary,
              },
            ]}
          />
        </AdminOverviewChartPanel>
      </div>
    </>
  );
}

function CitiesTab({ overview }: { overview: AdminOverviewResponse }) {
  const { cities } = overview;
  const countryRows = cities.venuesByCountry.map((row) => ({
    label: row.name,
    country: row.value,
  }));

  return (
    <>
      <div className="admin-kpi-grid admin-kpi-grid-5">
        <KpiCard label="Países activos" value={cities.cards.activeCountries} />
        <KpiCard label="Ciudades activas" value={cities.cards.activeCities} />
        <KpiCard
          label="Países inactivos"
          value={cities.cards.inactiveCountries}
        />
        <KpiCard
          label="Ciudades inactivas"
          value={cities.cards.inactiveCities}
        />
        <KpiCard
          label="País con más Espacios"
          value={cities.cards.topCountryByVenues?.value ?? "—"}
          hint={cities.cards.topCountryByVenues?.name}
        />
      </div>
      <div className="admin-overview-charts admin-overview-charts-single">
        <AdminOverviewChartPanel title="Espacios por países">
          <AdminOverviewBarChart
            data={countryRows}
            series={[
              {
                key: "country",
                label: "Espacios",
                color: OVERVIEW_CHART_COLORS.primary,
              },
            ]}
          />
        </AdminOverviewChartPanel>
      </div>
    </>
  );
}

import { useEffect, useState } from "react";
import {
  PROMO_PURCHASE_STATUS_LABELS,
  type AdminPremiumPurchasesResponse,
  type AdminPromoPurchasesResponse,
  type PremiumPurchaseStatus,
} from "@nocta/shared";
import { ApiError, api } from "../../lib/api";
import { NoctaLoading } from "../../components/NoctaLoading";
import { useToast } from "../../components/ToastProvider";
import {
  ADMIN_PAGE_SIZE,
  AdminPagination,
} from "../../components/admin/AdminPagination";
import { AdminFiltersAccordion } from "../../components/admin/AdminFiltersAccordion";
import { ManualSearchInput } from "../../components/ManualSearchInput";

const uyu = new Intl.NumberFormat("es-UY", {
  style: "currency",
  currency: "UYU",
  maximumFractionDigits: 0,
});

const dateTime = new Intl.DateTimeFormat("es-UY", {
  dateStyle: "medium",
  timeStyle: "short",
});

const PROMO_STATUS_CLASS = {
  valid: "text-bg-success",
  redeemed: "text-bg-primary",
  expired: "text-bg-secondary",
  refunded: "text-bg-warning",
} as const;

const PREMIUM_STATUS_LABELS: Record<PremiumPurchaseStatus, string> = {
  pending: "Pendiente",
  approved: "Aprobado",
  rejected: "Rechazado",
  refunded: "Reembolsado",
};

const PREMIUM_STATUS_CLASS: Record<PremiumPurchaseStatus, string> = {
  pending: "text-bg-warning",
  approved: "text-bg-success",
  rejected: "text-bg-danger",
  refunded: "text-bg-secondary",
};

type Tab = "premium" | "promos";

export function AdminTransactionsPage() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("premium");
  const [promoData, setPromoData] =
    useState<AdminPromoPurchasesResponse | null>(null);
  const [premiumData, setPremiumData] =
    useState<AdminPremiumPurchasesResponse | null>(null);
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function copyTransactionId(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      toast.success("ID de transacción copiado");
    } catch {
      toast.error("No se pudo copiar el ID");
    }
  }

  useEffect(() => {
    setPage(1);
  }, [tab]);

  useEffect(() => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({
      page: String(page),
      limit: String(ADMIN_PAGE_SIZE),
    });
    if (submittedQuery) params.set("q", submittedQuery);
    const path =
      tab === "premium"
        ? `/api/admin/premium-purchases?${params}`
        : `/api/admin/promo-purchases?${params}`;
    void api<AdminPremiumPurchasesResponse | AdminPromoPurchasesResponse>(path)
      .then((res) => {
        if (tab === "premium") {
          setPremiumData(res as AdminPremiumPurchasesResponse);
        } else {
          setPromoData(res as AdminPromoPurchasesResponse);
        }
      })
      .catch((err) =>
        setError(
          err instanceof ApiError
            ? err.message
            : "No se pudieron cargar las transacciones"
        )
      )
      .finally(() => setLoading(false));
  }, [page, tab, submittedQuery]);

  const activeTotal =
    tab === "premium"
      ? premiumData?.pagination.total ?? 0
      : promoData?.pagination.total ?? 0;

  return (
    <div className="admin-page">
      <header className="admin-page-head">
        <div>
          <p className="admin-page-eyebrow">Operaciones</p>
          <h1 className="app-title h3 mb-1">Transacciones</h1>
          <p className="text-secondary small mb-0">
            Cobros Premium (Mercado Pago) y compras internas de promos de
            Espacios. La conciliación externa detallada se ampliará después.
          </p>
        </div>
      </header>

      <div className="admin-filter-chips" role="tablist" aria-label="Tipo">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "premium"}
          className={`btn venue-filter-chip${
            tab === "premium" ? " is-active" : ""
          }`}
          onClick={() => setTab("premium")}
        >
          Premium
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "promos"}
          className={`btn venue-filter-chip${
            tab === "promos" ? " is-active" : ""
          }`}
          onClick={() => setTab("promos")}
        >
          Promos
        </button>
      </div>

      <AdminFiltersAccordion activeCount={submittedQuery ? 1 : 0}>
        <ManualSearchInput
          className="admin-toolbar"
          placeholder="Buscar por usuario, email o ID…"
          ariaLabel="Buscar transacciones"
          value={query}
          onValueChange={setQuery}
          onSearch={(value) => {
            setSubmittedQuery(value);
            setPage(1);
          }}
        />
      </AdminFiltersAccordion>

      {loading && <NoctaLoading variant="block" />}
      {error && <p className="text-danger small">{error}</p>}

      {!loading && !error && activeTotal === 0 && (
        <div className="admin-panel text-center py-5">
          <p className="mb-1 fw-bold">Todavía no hay transacciones</p>
          <p className="text-secondary small mb-0">
            {tab === "premium"
              ? "Los cobros Premium aparecerán aquí."
              : "Las compras de promos aparecerán aquí."}
          </p>
        </div>
      )}

      {!loading &&
        tab === "premium" &&
        premiumData &&
        premiumData.purchases.length > 0 && (
          <div className="row row-cols-1 row-cols-md-2 row-cols-xl-3 g-3">
            {premiumData.purchases.map((purchase) => (
              <div className="col" key={purchase.id}>
                <article className="admin-panel h-100">
                  <div className="d-flex justify-content-between gap-2 mb-3">
                    <div className="min-w-0">
                      <h2 className="h6 mb-1 text-truncate">
                        {purchase.planName}
                      </h2>
                      <p className="text-secondary small mb-0 text-truncate">
                        {purchase.periodLabel}
                        {purchase.kind === "subscription"
                          ? " · Suscripción"
                          : ""}
                      </p>
                    </div>
                    <span
                      className={`badge align-self-start ${
                        PREMIUM_STATUS_CLASS[purchase.status]
                      }`}
                    >
                      {PREMIUM_STATUS_LABELS[purchase.status]}
                    </span>
                  </div>
                  <dl className="admin-transaction-details small mb-0">
                    <div>
                      <dt>ID</dt>
                      <dd>
                        <div className="admin-organizer-row">
                          <code className="small text-break">{purchase.id}</code>
                          <button
                            type="button"
                            className="admin-copy-id"
                            aria-label="Copiar ID de transacción"
                            onClick={() => void copyTransactionId(purchase.id)}
                          >
                            <i className="bi bi-clipboard" aria-hidden="true" />
                          </button>
                        </div>
                      </dd>
                    </div>
                    <div>
                      <dt>Usuario</dt>
                      <dd>{purchase.user.name}</dd>
                    </div>
                    <div>
                      <dt>Email</dt>
                      <dd>{purchase.user.email}</dd>
                    </div>
                    <div>
                      <dt>Importe</dt>
                      <dd>
                        {purchase.currency} {purchase.amount}
                      </dd>
                    </div>
                    <div>
                      <dt>Fecha</dt>
                      <dd>
                        {dateTime.format(new Date(purchase.createdAt))}
                      </dd>
                    </div>
                  </dl>
                </article>
              </div>
            ))}
          </div>
        )}

      {!loading &&
        tab === "promos" &&
        promoData &&
        promoData.purchases.length > 0 && (
          <div className="row row-cols-1 row-cols-md-2 row-cols-xl-3 g-3">
            {promoData.purchases.map((purchase) => (
              <div className="col" key={purchase.id}>
                <article className="admin-panel h-100">
                  <div className="d-flex justify-content-between gap-2 mb-3">
                    <div className="min-w-0">
                      <h2 className="h6 mb-1 text-truncate">
                        {purchase.promotion.title}
                      </h2>
                      <p className="text-secondary small mb-0 text-truncate">
                        {purchase.venue.name}
                      </p>
                    </div>
                    <span
                      className={`badge align-self-start ${
                        PROMO_STATUS_CLASS[purchase.status]
                      }`}
                    >
                      {PROMO_PURCHASE_STATUS_LABELS[purchase.status]}
                    </span>
                  </div>
                  <dl className="admin-transaction-details small mb-0">
                    <div>
                      <dt>ID</dt>
                      <dd>
                        <div className="admin-organizer-row">
                          <code className="small text-break">{purchase.id}</code>
                          <button
                            type="button"
                            className="admin-copy-id"
                            aria-label="Copiar ID de transacción"
                            onClick={() => void copyTransactionId(purchase.id)}
                          >
                            <i className="bi bi-clipboard" aria-hidden="true" />
                          </button>
                        </div>
                      </dd>
                    </div>
                    <div>
                      <dt>Usuario</dt>
                      <dd>{purchase.user.name}</dd>
                    </div>
                    <div>
                      <dt>Email</dt>
                      <dd>{purchase.user.email}</dd>
                    </div>
                    <div>
                      <dt>Importe</dt>
                      <dd>{uyu.format(purchase.priceUyu ?? 0)}</dd>
                    </div>
                    <div>
                      <dt>Fecha</dt>
                      <dd>
                        {dateTime.format(new Date(purchase.purchasedAt))}
                      </dd>
                    </div>
                  </dl>
                </article>
              </div>
            ))}
          </div>
        )}

      <AdminPagination
        page={page}
        totalItems={activeTotal}
        onPageChange={setPage}
        label={
          tab === "premium" ? "Páginas de Premium" : "Páginas de promos"
        }
      />
    </div>
  );
}

import { useEffect, useState } from "react";
import {
  PROMO_PURCHASE_STATUS_LABELS,
  type AdminPromoPurchasesResponse,
} from "@nocta/shared";
import { ApiError, api } from "../../lib/api";
import { NoctaLoading } from "../../components/NoctaLoading";
import {
  ADMIN_PAGE_SIZE,
  AdminPagination,
} from "../../components/admin/AdminPagination";

const uyu = new Intl.NumberFormat("es-UY", {
  style: "currency",
  currency: "UYU",
  maximumFractionDigits: 0,
});

const dateTime = new Intl.DateTimeFormat("es-UY", {
  dateStyle: "medium",
  timeStyle: "short",
});

const STATUS_CLASS = {
  valid: "text-bg-success",
  redeemed: "text-bg-primary",
  expired: "text-bg-secondary",
  refunded: "text-bg-warning",
} as const;

export function AdminTransactionsPage() {
  const [data, setData] = useState<AdminPromoPurchasesResponse | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    void api<AdminPromoPurchasesResponse>(
      `/api/admin/promo-purchases?page=${page}&limit=${ADMIN_PAGE_SIZE}`
    )
      .then(setData)
      .catch((err) =>
        setError(
          err instanceof ApiError ? err.message : "No se pudieron cargar las transacciones"
        )
      )
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div className="admin-page">
      <header className="admin-page-head">
        <div>
          <p className="admin-page-eyebrow">Operaciones</p>
          <h1 className="app-title h3 mb-1">Transacciones</h1>
          <p className="text-secondary small mb-0">
            Compras internas de promos. La conciliación con Mercado Pago se
            incorporará cuando exista esa integración.
          </p>
        </div>
      </header>

      {loading && <NoctaLoading variant="block" />}
      {error && <p className="text-danger small">{error}</p>}

      {!loading && !error && data?.purchases.length === 0 && (
        <div className="admin-panel text-center py-5">
          <p className="mb-1 fw-bold">Todavía no hay transacciones</p>
          <p className="text-secondary small mb-0">
            Las compras de promos aparecerán aquí.
          </p>
        </div>
      )}

      {!loading && data && data.purchases.length > 0 && (
        <>
          <div className="row row-cols-1 row-cols-md-2 row-cols-xl-3 g-3">
            {data.purchases.map((purchase) => (
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
                      className={`badge align-self-start ${STATUS_CLASS[purchase.status]}`}
                    >
                      {PROMO_PURCHASE_STATUS_LABELS[purchase.status]}
                    </span>
                  </div>
                  <dl className="admin-transaction-details small mb-0">
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
                      <dd>{dateTime.format(new Date(purchase.purchasedAt))}</dd>
                    </div>
                  </dl>
                </article>
              </div>
            ))}
          </div>

          <AdminPagination
            page={page}
            totalItems={data.pagination.total}
            onPageChange={setPage}
            label="Páginas de transacciones"
          />
        </>
      )}
    </div>
  );
}

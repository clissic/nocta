import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  PROMO_PURCHASE_STATUS_LABELS,
  type PromoPurchase,
} from "@nocta/shared";
import { api } from "../lib/api";
import { PromoQrCode } from "../components/PromoQrCode";

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

function PurchaseMeta({ item }: { item: PromoPurchase }) {
  const price = formatPrice(item.priceUyu);
  const until = formatDate(item.validUntil);
  return (
    <>
      <strong className="text-truncate d-block">{item.title}</strong>
      <small className="text-secondary text-truncate d-block">
        {item.venueName ?? "Espacio"}
        {price ? ` · ${price}` : ""}
      </small>
      <span className={`my-promos-status is-${item.status}`}>
        {PROMO_PURCHASE_STATUS_LABELS[item.status]}
        {until ? ` · hasta ${until}` : ""}
      </span>
    </>
  );
}

function QrPanel({ item }: { item: PromoPurchase }) {
  return (
    <div className="my-promos-qr">
      {item.status === "valid" ? (
        <>
          <PromoQrCode
            className="my-promos-qr-code"
            payload={item.qrPayload}
            size={240}
          />
          <p className="my-promos-qr-hint text-secondary small mb-0">
            Mostrá este código en el Espacio para canjear la promo.
          </p>
        </>
      ) : (
        <p className="text-secondary small mb-0">
          Esta promo ya no se puede canjear (
          {PROMO_PURCHASE_STATUS_LABELS[item.status].toLowerCase()}).
        </p>
      )}
    </div>
  );
}

export function MyPromosPage() {
  const [purchases, setPurchases] = useState<PromoPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void api<{ purchases: PromoPurchase[] }>("/api/me/promo-purchases")
      .then((res) => {
        if (!alive) return;
        setPurchases(res.purchases);
        const firstValid = res.purchases.find((p) => p.status === "valid");
        setSelectedId(firstValid?.id ?? res.purchases[0]?.id ?? null);
      })
      .catch(() => {
        if (alive) setPurchases([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const selected = useMemo(
    () => purchases.find((p) => p.id === selectedId) ?? null,
    [purchases, selectedId]
  );

  const validCount = purchases.filter((p) => p.status === "valid").length;

  return (
    <div className="app-screen my-promos-page fade-in">
      <p className="my-promos-back text-secondary small mb-0">
        <Link to="/profile" className="link-light text-decoration-none">
          ← Perfil
        </Link>
      </p>

      <header className="my-promos-head">
        <div className="min-w-0">
          <h1 className="app-title h3 mb-1">Mis promos</h1>
          <p className="text-secondary small mb-0">
            Acá están los códigos QR de las promociones que compraste.
          </p>
        </div>
        {!loading && purchases.length > 0 && (
          <p className="my-promos-count mb-0">
            <strong>{validCount}</strong>
            <span>
              {validCount === 1 ? "vigente" : "vigentes"}
              {purchases.length !== validCount
                ? ` · ${purchases.length} en total`
                : ""}
            </span>
          </p>
        )}
      </header>

      {loading ? (
        <p className="text-secondary small mb-0">Cargando tus promos…</p>
      ) : purchases.length === 0 ? (
        <section
          className="my-promos-empty"
          aria-labelledby="my-promos-empty-title"
        >
          <div className="my-promos-empty-icon" aria-hidden="true">
            <i className="bi bi-qr-code" />
          </div>
          <h2 id="my-promos-empty-title" className="h5 mb-2">
            Todavía no tenés promos
          </h2>
          <p className="text-secondary mb-3">
            Cuando compres una promoción en un Espacio, tu QR va a aparecer acá
            para mostrarlo en puerta.
          </p>
          <Link className="btn btn-primary" to="/venues">
            Explorar espacios
          </Link>
        </section>
      ) : (
        <div className="my-promos-layout">
          <ul className="my-promos-list" role="list">
            {purchases.map((item) => {
              const open = selectedId === item.id;
              return (
                <li key={item.id} className="my-promos-item">
                  <button
                    type="button"
                    className={`my-promos-toggle${open ? " is-open" : ""}`}
                    aria-expanded={open}
                    aria-controls={`my-promos-panel-${item.id}`}
                    onClick={() => setSelectedId(item.id)}
                  >
                    <span className="my-promos-toggle-media" aria-hidden="true">
                      {item.venuePhoto ? (
                        <img src={item.venuePhoto} alt="" />
                      ) : (
                        <span className="my-promos-toggle-fallback" />
                      )}
                    </span>
                    <span className="my-promos-toggle-copy min-w-0">
                      <PurchaseMeta item={item} />
                    </span>
                    <i
                      className={`bi my-promos-toggle-chevron ${
                        open ? "bi-chevron-up" : "bi-chevron-down"
                      }`}
                      aria-hidden="true"
                    />
                  </button>

                  {open && (
                    <div
                      id={`my-promos-panel-${item.id}`}
                      className="my-promos-panel my-promos-panel-mobile"
                    >
                      <QrPanel item={item} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <aside className="my-promos-detail" aria-label="Código QR seleccionado">
            {selected ? (
              <>
                <div className="my-promos-detail-head">
                  <span className="my-promos-detail-media" aria-hidden="true">
                    {selected.venuePhoto ? (
                      <img src={selected.venuePhoto} alt="" />
                    ) : (
                      <span className="my-promos-toggle-fallback" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <PurchaseMeta item={selected} />
                  </div>
                </div>
                <QrPanel item={selected} />
              </>
            ) : (
              <p className="text-secondary small mb-0">
                Elegí una promo para ver su código.
              </p>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

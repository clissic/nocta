import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  IDENTITY_VERIFICATION_STATUS_LABELS,
  type AdminIdentityVerification,
} from "@nocta/shared";
import { api, ApiError, downloadApiFile, mediaUrl } from "../../lib/api";
import { OverflowFade } from "../../components/OverflowFade";
import { NoctaLoading } from "../../components/NoctaLoading";
import { ManualSearchInput } from "../../components/ManualSearchInput";
import {
  ADMIN_PAGE_SIZE,
  AdminPagination,
} from "../../components/admin/AdminPagination";
import { AdminFiltersAccordion } from "../../components/admin/AdminFiltersAccordion";
import { useToast } from "../../components/ToastProvider";

type Filter = "pending" | "approved" | "rejected" | "all";

const FILTERS: { value: Filter; label: string; icon: string }[] = [
  { value: "pending", label: "Pendientes", icon: "bi-hourglass-split" },
  { value: "approved", label: "Aprobadas", icon: "bi-patch-check" },
  { value: "rejected", label: "Rechazadas", icon: "bi-x-circle" },
  { value: "all", label: "Todas", icon: "bi-list-ul" },
];

export function AdminVerificationsPage() {
  const toast = useToast();
  const [items, setItems] = useState<AdminIdentityVerification[]>([]);
  const [filter, setFilter] = useState<Filter>("pending");
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] =
    useState<AdminIdentityVerification | null>(null);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(ADMIN_PAGE_SIZE),
    });
    if (filter !== "all") params.set("status", filter);
    else params.set("status", "all");
    if (submittedQuery) params.set("q", submittedQuery);
    void api<{
      verifications: AdminIdentityVerification[];
      pagination: { total: number };
    }>(`/api/admin/identity-verifications?${params}`)
      .then((res) => {
        setItems(res.verifications);
        setTotal(res.pagination.total);
        setError("");
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "No se pudo cargar")
      )
      .finally(() => setLoading(false));
  }, [filter, page, submittedQuery]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    const created: string[] = [];

    setDocumentUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setSelfieUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });

    if (!selected) return;

    void (async () => {
      try {
        if (selected.hasDocumentFront) {
          const blob = await downloadApiFile(
            `/api/admin/identity-verifications/${selected.userId}/files/documentFront`
          );
          if (cancelled) return;
          const url = URL.createObjectURL(blob);
          created.push(url);
          setDocumentUrl(url);
        }
        if (selected.hasSelfie) {
          const blob = await downloadApiFile(
            `/api/admin/identity-verifications/${selected.userId}/files/selfie`
          );
          if (cancelled) return;
          const url = URL.createObjectURL(blob);
          created.push(url);
          setSelfieUrl(url);
        }
      } catch {
        if (!cancelled) toast.error("No se pudieron cargar las imágenes");
      }
    })();

    return () => {
      cancelled = true;
      for (const url of created) URL.revokeObjectURL(url);
    };
  }, [selected, toast]);

  async function approve(item: AdminIdentityVerification) {
    setBusy(true);
    try {
      const res = await api<{ verification: AdminIdentityVerification }>(
        `/api/admin/identity-verifications/${item.userId}/approve`,
        { method: "POST", body: JSON.stringify({}) }
      );
      toast.success("Verificación aprobada");
      setSelected(null);
      if (filter === "pending") {
        setItems((current) =>
          current.filter((row) => row.userId !== item.userId)
        );
        setTotal((n) => Math.max(0, n - 1));
      } else {
        setItems((current) =>
          current.map((row) =>
            row.userId === item.userId ? res.verification : row
          )
        );
      }
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo aprobar"
      );
    } finally {
      setBusy(false);
    }
  }

  async function reject(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setBusy(true);
    try {
      const res = await api<{ verification: AdminIdentityVerification }>(
        `/api/admin/identity-verifications/${selected.userId}/reject`,
        {
          method: "POST",
          body: JSON.stringify({ reason: rejectReason.trim() }),
        }
      );
      toast.success("Verificación rechazada");
      setRejectReason("");
      setSelected(null);
      if (filter === "pending") {
        setItems((current) =>
          current.filter((row) => row.userId !== selected.userId)
        );
        setTotal((n) => Math.max(0, n - 1));
      } else {
        setItems((current) =>
          current.map((row) =>
            row.userId === selected.userId ? res.verification : row
          )
        );
      }
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo rechazar"
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-page">
      <header className="admin-page-head">
        <div>
          <p className="admin-page-eyebrow">Administración</p>
          <h1 className="app-title h3 mb-1">Verificaciones</h1>
          <p className="text-secondary small mb-0">
            Revisá documentos de identidad y selfies enviados por usuarios.
          </p>
        </div>
      </header>

      <div
        className="admin-filter-row"
        role="tablist"
        aria-label="Filtrar por estado"
      >
        {FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={filter === item.value}
            className={`admin-filter-chip${
              filter === item.value ? " is-active" : ""
            }`}
            onClick={() => {
              setPage(1);
              setFilter(item.value);
            }}
          >
            <i className={`bi ${item.icon}`} aria-hidden="true" />
            {item.label}
          </button>
        ))}
      </div>

      <AdminFiltersAccordion activeCount={submittedQuery ? 1 : 0}>
        <ManualSearchInput
          className="admin-toolbar"
          placeholder="Buscar por nombre o email…"
          ariaLabel="Buscar verificaciones"
          value={query}
          onValueChange={setQuery}
          onSearch={(value) => {
            setSubmittedQuery(value);
            setPage(1);
          }}
        />
      </AdminFiltersAccordion>

      {loading ? (
        <NoctaLoading variant="block" />
      ) : error ? (
        <p className="text-danger">{error}</p>
      ) : items.length === 0 ? (
        <p className="text-secondary">No hay solicitudes en este filtro.</p>
      ) : (
        <div className="admin-list">
            {items.map((item) => (
              <button
                key={item.userId}
                type="button"
                className="admin-list-item text-start"
                onClick={() => {
                  setRejectReason("");
                  setSelected(item);
                }}
              >
                <span className="admin-list-avatar">
                  {item.photo ? (
                    <img src={mediaUrl(item.photo)} alt="" />
                  ) : (
                    <i className="bi bi-person" aria-hidden="true" />
                  )}
                </span>
                <span className="admin-list-main">
                  <strong>{item.name}</strong>
                  <small className="d-block text-secondary">{item.email}</small>
                </span>
                <span className="admin-list-meta">
                  {IDENTITY_VERIFICATION_STATUS_LABELS[item.status]}
                  {item.submittedAt && (
                    <small className="d-block text-secondary">
                      {new Date(item.submittedAt).toLocaleString("es-UY")}
                    </small>
                  )}
                </span>
              </button>
            ))}
        </div>
      )}

      <AdminPagination
        page={page}
        totalItems={total}
        onPageChange={setPage}
        label="Paginación de verificaciones"
      />

      {selected && (
        <div
          className="profile-connections-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-verification-title"
        >
          <button
            type="button"
            className="profile-connections-backdrop"
            aria-label="Cerrar"
            onClick={() => !busy && setSelected(null)}
          />
          <div className="profile-connections-dialog">
            <header className="profile-connections-head">
              <h2 id="admin-verification-title">
                Verificación · {selected.name}
              </h2>
              <button
                type="button"
                className="profile-connections-close"
                aria-label="Cerrar"
                disabled={busy}
                onClick={() => setSelected(null)}
              >
                <i className="bi bi-x-lg" aria-hidden="true" />
              </button>
            </header>
            <OverflowFade className="profile-connections-body">
              <p className="small text-secondary mb-3">
                {selected.email}
                {" · "}
                {IDENTITY_VERIFICATION_STATUS_LABELS[selected.status]}
              </p>
              <div className="row g-3 mb-3">
                <div className="col-md-6">
                  <p className="small mb-1">Documento</p>
                  {documentUrl ? (
                    <img
                      src={documentUrl}
                      alt="Documento"
                      className="img-fluid rounded border border-secondary"
                    />
                  ) : (
                    <p className="text-secondary small mb-0">Sin imagen</p>
                  )}
                </div>
                <div className="col-md-6">
                  <p className="small mb-1">Selfie con documento</p>
                  {selfieUrl ? (
                    <img
                      src={selfieUrl}
                      alt="Selfie"
                      className="img-fluid rounded border border-secondary"
                    />
                  ) : (
                    <p className="text-secondary small mb-0">Sin imagen</p>
                  )}
                </div>
              </div>

              {selected.status === "pending" && (
                <div className="d-grid gap-3">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() => void approve(selected)}
                  >
                    {busy ? "Procesando…" : "Aprobar verificación"}
                  </button>
                  <form className="d-grid gap-2" onSubmit={reject}>
                    <label className="form-label small mb-0" htmlFor="reject-reason">
                      Motivo del rechazo
                    </label>
                    <textarea
                      id="reject-reason"
                      className="form-control bg-transparent border-secondary"
                      rows={3}
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      required
                      minLength={5}
                      placeholder="Explicá por qué no se aprueba…"
                    />
                    <button
                      type="submit"
                      className="btn btn-outline-danger"
                      disabled={busy || rejectReason.trim().length < 5}
                    >
                      Rechazar
                    </button>
                  </form>
                </div>
              )}

              {selected.status === "rejected" && selected.rejectionReason && (
                <p className="small text-danger mb-0">
                  Motivo: {selected.rejectionReason}
                </p>
              )}
            </OverflowFade>
          </div>
        </div>
      )}
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  NOTIFICATIONS_PAGE_SIZE,
  type NotificationItem,
  type NotificationsResponse,
} from "@nocta/shared";
import { api, ApiError } from "../lib/api";
import { useToast } from "../components/ToastProvider";
import { NotificationContent } from "../components/NotificationContent";
import { NoctaLoading } from "../components/NoctaLoading";

export function NotificationsPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const pageParam = Number(searchParams.get("page") ?? "1");
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<NotificationsResponse>(
        `/api/notifications?page=${page}&limit=${NOTIFICATIONS_PAGE_SIZE}`
      );
      setItems(data.notifications ?? []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total ?? 0);
      if (data.page && data.page !== page) {
        setSearchParams({ page: String(data.page) }, { replace: true });
      }
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "No se pudieron cargar las notificaciones"
      );
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [page, setSearchParams, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openItem(item: NotificationItem) {
    if (!item.readAt) {
      try {
        await api("/api/notifications/read", {
          method: "POST",
          body: JSON.stringify({ ids: [item.id] }),
        });
        setItems((prev) =>
          prev.map((n) =>
            n.id === item.id
              ? { ...n, readAt: n.readAt ?? new Date().toISOString() }
              : n
          )
        );
      } catch {
        // seguir igual
      }
    }
    if (item.href) navigate(item.href);
  }

  function goToPage(next: number) {
    setSearchParams({ page: String(next) });
  }

  return (
    <div className="app-screen notifications-page fade-in">
      <div className="notifications-page-head">
        <div>
          <h1 className="app-title h3 mb-1">Notificaciones</h1>
          <p className="text-secondary small mb-0">
            {total === 0
              ? "Todavía no tenés avisos."
              : `${total} en total · las leídas se borran a los 30 días`}
          </p>
        </div>
      </div>

      {loading ? (
        <NoctaLoading variant="block" />
      ) : items.length === 0 ? (
        <div className="notifications-page-empty">
          <p className="mb-3">No hay notificaciones en esta página.</p>
          <Link className="btn btn-outline-light" to="/venues">
            Ir a Espacios
          </Link>
        </div>
      ) : (
        <ul className="notifications-page-list">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={`notifications-item notifications-page-item${item.readAt ? "" : " is-unread"}`}
                onClick={() => void openItem(item)}
              >
                <NotificationContent item={item} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <nav
          className="notifications-pagination"
          aria-label="Paginación de notificaciones"
        >
          <button
            type="button"
            className="btn btn-outline-light btn-sm"
            disabled={page <= 1 || loading}
            onClick={() => goToPage(page - 1)}
          >
            Anterior
          </button>
          <span className="notifications-pagination-status">
            Página {page} de {totalPages}
          </span>
          <button
            type="button"
            className="btn btn-outline-light btn-sm"
            disabled={page >= totalPages || loading}
            onClick={() => goToPage(page + 1)}
          >
            Siguiente
          </button>
        </nav>
      )}
    </div>
  );
}

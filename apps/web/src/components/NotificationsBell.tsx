import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  NOTIFICATIONS_PREVIEW_LIMIT,
  type NotificationItem,
  type NotificationsResponse,
  type NotificationsUnreadResponse,
} from "@nocta/shared";
import { api, ApiError } from "../lib/api";
import { useToast } from "./ToastProvider";
import { NotificationContent } from "./NotificationContent";
import { OverflowFade } from "./OverflowFade";
import { NoctaLoading } from "./NoctaLoading";

const POLL_MS = 35_000;

export function NotificationsBell() {
  const toast = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const refreshUnread = useCallback(async () => {
    try {
      const data = await api<NotificationsUnreadResponse>(
        "/api/notifications/unread-count"
      );
      setUnread(data.count ?? 0);
    } catch {
      // silencioso en polling
    }
  }, []);

  const loadList = useCallback(async () => {
    setLoadingList(true);
    try {
      const data = await api<NotificationsResponse>(
        `/api/notifications?page=1&limit=${NOTIFICATIONS_PREVIEW_LIMIT}`
      );
      setItems(data.notifications ?? []);
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "No se pudieron cargar las notificaciones"
      );
    } finally {
      setLoadingList(false);
    }
  }, [toast]);

  useEffect(() => {
    void refreshUnread();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshUnread();
    }, POLL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") void refreshUnread();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refreshUnread]);

  useEffect(() => {
    if (!open) return;
    void loadList();
  }, [open, loadList]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);

    let removePointer: (() => void) | undefined;
    const timer = window.setTimeout(() => {
      const onPointer = (event: PointerEvent) => {
        const target = event.target as Node;
        if (triggerRef.current?.contains(target)) return;
        if (panelRef.current?.contains(target)) return;
        setOpen(false);
      };
      document.addEventListener("pointerdown", onPointer);
      removePointer = () =>
        document.removeEventListener("pointerdown", onPointer);
    }, 0);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
      window.clearTimeout(timer);
      removePointer?.();
    };
  }, [open]);

  async function markRead(ids?: string[], all?: boolean) {
    try {
      const data = await api<{ ok: true; count: number }>(
        "/api/notifications/read",
        {
          method: "POST",
          body: JSON.stringify(all ? { all: true } : { ids }),
        }
      );
      setUnread(data.count ?? 0);
      if (all) {
        setItems((prev) =>
          prev.map((n) => ({
            ...n,
            readAt: n.readAt ?? new Date().toISOString(),
          }))
        );
      } else if (ids?.length) {
        const set = new Set(ids);
        const now = new Date().toISOString();
        setItems((prev) =>
          prev.map((n) =>
            set.has(n.id) ? { ...n, readAt: n.readAt ?? now } : n
          )
        );
      }
    } catch {
      // ignore
    }
  }

  async function openItem(item: NotificationItem) {
    if (!item.readAt) await markRead([item.id]);
    setOpen(false);
    if (item.href) navigate(item.href);
  }

  function openAll() {
    setOpen(false);
    navigate("/notifications");
  }

  const panel =
    open && typeof document !== "undefined"
      ? createPortal(
          <div className="notifications-overlay">
            <button
              type="button"
              className="notifications-backdrop"
              aria-label="Cerrar notificaciones"
              onClick={() => setOpen(false)}
            />
            <div
              className="notifications-panel"
              role="dialog"
              aria-label="Notificaciones"
              ref={panelRef}
            >
              <header className="notifications-panel-head">
                <h2>Notificaciones</h2>
                {unread > 0 && (
                  <button
                    type="button"
                    className="btn btn-link btn-sm link-secondary text-decoration-none p-0"
                    onClick={() => void markRead(undefined, true)}
                  >
                    Marcar todas
                  </button>
                )}
              </header>

              <OverflowFade className="notifications-panel-body">
                {loadingList ? (
                  <NoctaLoading variant="inline" />
                ) : items.length === 0 ? (
                  <p className="text-secondary small mb-0 px-3 py-3">
                    No tenés notificaciones.
                  </p>
                ) : (
                  <ul className="notifications-list">
                    {items.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          className={`notifications-item${item.readAt ? "" : " is-unread"}`}
                          onClick={() => void openItem(item)}
                        >
                          <NotificationContent item={item} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </OverflowFade>

              <div className="notifications-panel-footer">
                <button
                  type="button"
                  className="btn btn-primary btn-sm w-100"
                  onClick={openAll}
                >
                  Ver más
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div className="notifications-bell">
      <button
        ref={triggerRef}
        type="button"
        className="btn btn-sm btn-link link-light text-decoration-none p-0 notifications-bell-trigger"
        aria-label={
          unread > 0
            ? `Notificaciones, ${unread} sin leer`
            : "Notificaciones"
        }
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
      >
        <i className="bi bi-bell fs-5" aria-hidden="true" />
        {unread > 0 && (
          <span className="notifications-bell-badge">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {panel}
    </div>
  );
}

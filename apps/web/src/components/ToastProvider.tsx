import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ToastVariant = "success" | "danger" | "warning" | "info";

export interface ToastOptions {
  message: string;
  variant?: ToastVariant;
  delayMs?: number;
}

interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  push: (options: ToastOptions | string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DELAY = 3200;

const VARIANT_CLASS: Record<ToastVariant, string> = {
  success: "text-bg-success",
  danger: "text-bg-danger",
  warning: "text-bg-warning",
  info: "text-bg-dark border border-secondary",
};

let toastSeq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (options: ToastOptions | string) => {
      const opts = typeof options === "string" ? { message: options } : options;
      const id = `toast-${++toastSeq}`;
      const variant = opts.variant ?? "info";
      const delayMs = opts.delayMs ?? DEFAULT_DELAY;

      setToasts((prev) => [...prev, { id, message: opts.message, variant }]);
      window.setTimeout(() => dismiss(id), delayMs);
    },
    [dismiss]
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      push,
      success: (message) => push({ message, variant: "success" }),
      error: (message) => push({ message, variant: "danger" }),
      info: (message) => push({ message, variant: "info" }),
      warning: (message) => push({ message, variant: "warning" }),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="toast-container position-fixed top-0 end-0 p-3 nocta-toast-container"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast show align-items-center ${VARIANT_CLASS[toast.variant]} nocta-toast`}
            role="alert"
            aria-live="assertive"
            aria-atomic="true"
          >
            <div className="d-flex">
              <div className="toast-body">{toast.message}</div>
              <button
                type="button"
                className="btn-close btn-close-white me-2 m-auto"
                aria-label="Cerrar"
                onClick={() => dismiss(toast.id)}
              />
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast fuera de ToastProvider");
  return ctx;
}

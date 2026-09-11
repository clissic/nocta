import { useEffect } from "react";
import { createPortal } from "react-dom";

export type DiscoverSafetyAction = "block" | "report";

type Props = {
  action: DiscoverSafetyAction;
  personName: string;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

const COPY: Record<
  DiscoverSafetyAction,
  { title: string; description: (name: string) => string; confirm: string }
> = {
  block: {
    title: "Bloquear perfil",
    description: (name) => `¿Quieres bloquear a ${name}?`,
    confirm: "Bloquear",
  },
  report: {
    title: "Denunciar perfil",
    description: (name) => `¿Quieres denunciar a ${name}?`,
    confirm: "Continuar",
  },
};

export function DiscoverSafetyModal({
  action,
  personName,
  busy = false,
  onClose,
  onConfirm,
}: Props) {
  const copy = COPY[action];

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [busy, onClose]);

  return createPortal(
    <div className="discover-safety-modal-layer" role="presentation">
      <button
        className="discover-safety-modal-backdrop"
        type="button"
        aria-label="Cerrar"
        disabled={busy}
        onClick={onClose}
      />
      <section
        className={`discover-safety-modal-dialog is-${action}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="discover-safety-modal-title"
        aria-describedby="discover-safety-modal-description"
      >
        <div className="discover-safety-modal-icon" aria-hidden="true">
          <i
            className={`bi ${
              action === "block" ? "bi-slash-circle" : "bi-flag"
            }`}
          />
        </div>
        <h2 id="discover-safety-modal-title">{copy.title}</h2>
        <p id="discover-safety-modal-description">
          {copy.description(personName)}
        </p>
        {action === "block" && (
          <p className="discover-safety-modal-note">
            No volverán a verse en perfiles, conexiones ni Discover.
          </p>
        )}
        <div className="discover-safety-modal-actions">
          <button
            className="btn btn-outline-light"
            type="button"
            disabled={busy}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            className="btn btn-danger"
            type="button"
            disabled={busy}
            autoFocus
            onClick={onConfirm}
          >
            {busy ? "Bloqueando…" : copy.confirm}
          </button>
        </div>
      </section>
    </div>,
    document.body
  );
}

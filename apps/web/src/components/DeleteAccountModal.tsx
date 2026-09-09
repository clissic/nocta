import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ApiError, api } from "../lib/api";
import { useToast } from "./ToastProvider";

type DeleteAccountModalProps = {
  onClose: () => void;
};

export function DeleteAccountModal({ onClose }: DeleteAccountModalProps) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const canDelete = confirmation === "Eliminar";

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [busy, onClose]);

  async function deleteAccount() {
    if (!canDelete || busy) return;
    setBusy(true);
    try {
      await api("/api/me/account", {
        method: "DELETE",
        body: JSON.stringify({ confirmation }),
      });
      logout();
      toast.success("Tu cuenta fue eliminada");
      navigate("/login", { replace: true });
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo eliminar la cuenta"
      );
      setBusy(false);
    }
  }

  return createPortal(
    <div className="delete-account-layer" role="presentation">
      <button
        className="delete-account-backdrop"
        type="button"
        aria-label="Cancelar eliminación de cuenta"
        disabled={busy}
        onClick={onClose}
      />
      <section
        className="delete-account-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-account-title"
        aria-describedby="delete-account-description"
      >
        <div className="delete-account-icon" aria-hidden="true">
          <i className="bi bi-exclamation-triangle" />
        </div>
        <h2 id="delete-account-title">Eliminar cuenta</h2>
        <p id="delete-account-description">
          Esta acción es permanente. Se eliminarán tu perfil, conexiones,
          matches, mensajes, contenido y datos asociados.
        </p>
        <label className="delete-account-confirmation">
          <span>
            Escribí <strong>Eliminar</strong> para confirmar
          </span>
          <input
            className="form-control"
            type="text"
            value={confirmation}
            disabled={busy}
            autoComplete="off"
            autoFocus
            onChange={(event) => setConfirmation(event.target.value)}
          />
        </label>
        <div className="delete-account-actions">
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
            disabled={!canDelete || busy}
            onClick={() => void deleteAccount()}
          >
            {busy ? "Eliminando…" : "Eliminar definitivamente"}
          </button>
        </div>
      </section>
    </div>,
    document.body
  );
}

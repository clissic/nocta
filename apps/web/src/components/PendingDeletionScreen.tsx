import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { ApiError, api } from "../lib/api";
import { useToast } from "./ToastProvider";
import type { AuthUser } from "@nocta/shared";

/** Pantalla mínima cuando la cuenta está en período de recuperación (30 días). */
export function PendingDeletionScreen() {
  const { user, setUser, logout, refresh } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function restore() {
    if (busy) return;
    setBusy(true);
    try {
      const data = await api<{ user: AuthUser }>("/api/me/account/restore", {
        method: "POST",
        body: JSON.stringify({}),
      });
      setUser(data.user);
      await refresh();
      toast.success("Cuenta recuperada");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo recuperar la cuenta"
      );
      setBusy(false);
    }
  }

  const requested = user?.deletionRequestedAt
    ? new Date(user.deletionRequestedAt).toLocaleDateString("es-UY")
    : null;

  return (
    <div className="container py-5" style={{ maxWidth: 480 }}>
      <h1 className="h3 mb-3">Cuenta pendiente de eliminación</h1>
      <p className="text-secondary mb-4">
        Solicitaste borrar tu cuenta
        {requested ? ` el ${requested}` : ""}. Durante 30 días podés
        recuperarla. Si no lo hacés, se eliminarán tu perfil, fotos y datos
        asociados.
      </p>
      <div className="d-flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          onClick={() => void restore()}
        >
          {busy ? "Recuperando…" : "Recuperar cuenta"}
        </button>
        <button
          type="button"
          className="btn btn-outline-light"
          disabled={busy}
          onClick={logout}
        >
          Salir
        </button>
      </div>
    </div>
  );
}

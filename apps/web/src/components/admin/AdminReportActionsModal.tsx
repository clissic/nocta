import { useEffect, useState } from "react";
import {
  SUSPENSION_DURATIONS,
  SUSPENSION_DURATION_LABELS,
  type AdminReport,
  type SuspensionDuration,
} from "@nocta/shared";
import { ApiError, api } from "../../lib/api";
import { OverflowFade } from "../OverflowFade";
import { useToast } from "../ToastProvider";

type Props = {
  report: AdminReport;
  onClose: () => void;
  onResolved: (report: AdminReport) => void;
};

export function AdminReportActionsModal({
  report,
  onClose,
  onResolved,
}: Props) {
  const toast = useToast();
  const [action, setAction] = useState<"dismiss" | "suspend" | null>(null);
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState<SuspensionDuration>(30);
  const [busy, setBusy] = useState(false);
  const resolved = report.status !== "open";

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

  async function confirmAction() {
    if (!action || busy || reason.trim().length < 3) {
      return;
    }
    setBusy(true);
    try {
      const response = await api<{
        report: Pick<AdminReport, "id" | "status" | "resolution">;
      }>(`/api/admin/reports/${report.id}/actions`, {
        method: "POST",
        body: JSON.stringify(
          action === "dismiss"
            ? { action, reason: reason.trim() }
            : { action, duration, reason: reason.trim() }
        ),
      });
      onResolved({ ...report, ...response.report });
      toast.success(
        action === "dismiss" ? "Denuncia descartada" : "Usuario suspendido"
      );
      onClose();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo resolver la denuncia"
      );
      setBusy(false);
    }
  }

  const resolution = report.resolution;

  return (
    <div className="admin-modal" role="presentation">
      <button
        type="button"
        className="admin-modal-backdrop"
        aria-label="Cerrar acciones de denuncia"
        disabled={busy}
        onClick={onClose}
      />
      <section
        className="admin-modal-dialog admin-report-actions-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-report-actions-title"
      >
        <header className="admin-modal-head">
          <div>
            <p className="admin-page-eyebrow mb-1">Denuncia</p>
            <h2 id="admin-report-actions-title" className="app-title h4 mb-0">
              {resolved ? "Resolución" : "Acciones"}
            </h2>
          </div>
          <button
            type="button"
            className="admin-modal-close"
            aria-label="Cerrar"
            disabled={busy}
            onClick={onClose}
          >
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>
        </header>

        <OverflowFade className="admin-modal-body">
          <div className="admin-report-action-summary">
            <strong>{report.reportedUser.name}</strong>
            <span className="text-secondary small">
              Denunciado por {report.reporter.name}
            </span>
          </div>

          {resolution ? (
            <section className="admin-modal-section">
              <h3 className="admin-review-label">Resultado</h3>
              <div className="admin-modal-grid">
                <div className="admin-modal-field">
                  <span>Acción</span>
                  <strong>
                    {resolution.action === "dismiss"
                      ? "Denuncia descartada"
                      : "Usuario suspendido"}
                  </strong>
                </div>
                <div className="admin-modal-field">
                  <span>Fecha</span>
                  <strong>
                    {new Date(resolution.resolvedAt).toLocaleString("es-UY")}
                  </strong>
                </div>
                {resolution.duration != null && (
                  <div className="admin-modal-field">
                    <span>Duración</span>
                    <strong>
                      {SUSPENSION_DURATION_LABELS[resolution.duration]}
                    </strong>
                  </div>
                )}
                {resolution.suspendedUntil && (
                  <div className="admin-modal-field">
                    <span>Finaliza</span>
                    <strong>
                      {new Date(
                        resolution.suspendedUntil
                      ).toLocaleString("es-UY")}
                    </strong>
                  </div>
                )}
              </div>
              {resolution.reason && (
                <div className="admin-report-resolution-reason">
                  <span>Explicación comunicada</span>
                  <p className="mb-0">{resolution.reason}</p>
                </div>
              )}
            </section>
          ) : resolved ? (
            <section className="admin-modal-section">
              <h3 className="admin-review-label">Resultado</h3>
              <p className="text-secondary small mb-0">
                Esta denuncia fue cerrada con el flujo de moderación anterior.
                No hay detalles adicionales registrados.
              </p>
            </section>
          ) : (
            <>
              <div
                className="admin-report-action-options"
                role="radiogroup"
                aria-label="Acción administrativa"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={action === "dismiss"}
                  className={action === "dismiss" ? "is-active" : ""}
                  onClick={() => setAction("dismiss")}
                >
                  <i className="bi bi-x-circle" aria-hidden="true" />
                  <span>
                    <strong>Descartar denuncia</strong>
                    <small>No se aplicarán medidas al usuario.</small>
                  </span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={action === "suspend"}
                  className={action === "suspend" ? "is-active is-danger" : ""}
                  onClick={() => setAction("suspend")}
                >
                  <i className="bi bi-person-lock" aria-hidden="true" />
                  <span>
                    <strong>Suspender usuario</strong>
                    <small>Cerrará sus sesiones y ocultará su perfil.</small>
                  </span>
                </button>
              </div>

              {action === "suspend" && (
                <fieldset className="admin-report-duration-fieldset">
                  <legend>Duración de la suspensión (días)</legend>
                  <div className="admin-report-duration-options">
                    {SUSPENSION_DURATIONS.map((value) => (
                      <label key={value}>
                        <input
                          type="radio"
                          name="suspensionDuration"
                          value={value}
                          checked={duration === value}
                          onChange={() => setDuration(value)}
                        />
                        <span>
                          {value === "permanent" ? "PERMANENTEMENTE" : value}
                        </span>
                      </label>
                    ))}
                  </div>
                  <p className="text-secondary small mb-0">
                    La cuenta quedará inaccesible y oculta inmediatamente.
                    También se informará por email a ambas personas.
                  </p>
                </fieldset>
              )}

              {action && (
                <label className="admin-field">
                  <span>Explicación de la resolución</span>
                  <textarea
                    className="form-control"
                    rows={4}
                    minLength={3}
                    maxLength={1000}
                    value={reason}
                    placeholder={
                      action === "dismiss"
                        ? "Explicá por qué se descarta la denuncia"
                        : "Explicá la medida aplicada al usuario"
                    }
                    onChange={(event) => setReason(event.target.value)}
                  />
                  <small className="text-secondary text-end">
                    {reason.length}/1000
                  </small>
                </label>
              )}
            </>
          )}
        </OverflowFade>

        <footer className="admin-report-actions-footer">
          <button
            className="btn btn-outline-light"
            type="button"
            disabled={busy}
            onClick={onClose}
          >
            {resolved ? "Cerrar" : "Cancelar"}
          </button>
          {!resolved && (
            <button
              className={`btn ${
                action === "suspend" ? "btn-danger" : "btn-primary"
              }`}
              type="button"
              disabled={
                !action ||
                busy ||
                reason.trim().length < 3
              }
              onClick={() => void confirmAction()}
            >
              {busy ? "Procesando…" : "Confirmar acción"}
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}

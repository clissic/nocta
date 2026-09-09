import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  REPORT_REASON_LABELS,
  SUSPENSION_DURATION_LABELS,
  type MyReportResolution,
} from "@nocta/shared";
import { ApiError, api } from "../lib/api";
import { NoctaLoading } from "../components/NoctaLoading";

export function ReportResolutionPage() {
  const { reportId } = useParams<{ reportId: string }>();
  const [report, setReport] = useState<MyReportResolution | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!reportId) {
      setError("Denuncia inválida");
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    void api<{ report: MyReportResolution }>(`/api/me/reports/${reportId}`)
      .then((response) => {
        if (!alive) return;
        setReport(response.report);
        setError("");
      })
      .catch((err) => {
        if (!alive) return;
        setReport(null);
        setError(
          err instanceof ApiError
            ? err.message
            : "No se pudo cargar el resultado de la denuncia"
        );
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [reportId]);

  const resolution = report?.resolution;

  return (
    <section className="report-resolution-page">
      <header className="report-resolution-head">
        <Link
          className="btn btn-sm btn-outline-light"
          to="/notifications"
          aria-label="Volver a notificaciones"
        >
          <i className="bi bi-arrow-left" aria-hidden="true" />
        </Link>
        <div>
          <p className="admin-page-eyebrow mb-1">Moderación</p>
          <h1 className="app-title h3 mb-0">Resultado de tu denuncia</h1>
        </div>
      </header>

      {loading ? (
        <NoctaLoading />
      ) : error ? (
        <div className="report-resolution-empty">
          <strong>{error}</strong>
          <Link className="btn btn-outline-light" to="/notifications">
            Volver a notificaciones
          </Link>
        </div>
      ) : report ? (
        <div className="report-resolution-card">
          <div className="report-resolution-meta">
            <span>Motivo original</span>
            <strong>{REPORT_REASON_LABELS[report.reason]}</strong>
          </div>
          <div className="report-resolution-meta">
            <span>Origen</span>
            <strong>
              {report.source === "match" ? "Conversación" : "Perfil"}
            </strong>
          </div>
          <div className="report-resolution-meta">
            <span>Enviada</span>
            <strong>
              {new Date(report.createdAt).toLocaleString("es-UY")}
            </strong>
          </div>

          {resolution ? (
            <>
              <div
                className={`report-resolution-result is-${resolution.action}`}
              >
                <i
                  className={`bi ${
                    resolution.action === "dismiss"
                      ? "bi-x-circle"
                      : "bi-shield-check"
                  }`}
                  aria-hidden="true"
                />
                <div>
                  <strong>
                    {resolution.action === "dismiss"
                      ? "Denuncia descartada"
                      : "Se tomaron medidas"}
                  </strong>
                  <p className="mb-0">
                    {resolution.action === "dismiss"
                      ? "Un administrador revisó tu denuncia y decidió descartarla."
                      : "Un administrador revisó tu denuncia y aplicó una sanción."}
                  </p>
                </div>
              </div>

              {resolution.reason && (
                <div className="report-resolution-reason">
                  <span>Explicación</span>
                  <p className="mb-0">{resolution.reason}</p>
                </div>
              )}

              {resolution.action === "suspend" && resolution.duration != null && (
                <div className="report-resolution-meta">
                  <span>Duración aplicada</span>
                  <strong>
                    {SUSPENSION_DURATION_LABELS[resolution.duration]}
                  </strong>
                </div>
              )}

              <div className="report-resolution-meta">
                <span>Resuelta</span>
                <strong>
                  {new Date(resolution.resolvedAt).toLocaleString("es-UY")}
                </strong>
              </div>
            </>
          ) : (
            <div className="report-resolution-result is-open">
              <i className="bi bi-hourglass-split" aria-hidden="true" />
              <div>
                <strong>En revisión</strong>
                <p className="mb-0">
                  Todavía no hay una resolución registrada para esta denuncia.
                </p>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}

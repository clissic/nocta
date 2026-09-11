import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  REPORT_REASONS,
  REPORT_REASON_LABELS,
  type ReportReason,
} from "@nocta/shared";
import { ApiError, api } from "../lib/api";
import { NoctaLoading } from "../components/NoctaLoading";
import { useToast } from "../components/ToastProvider";
import { OptimizedImage } from "../components/OptimizedImage";

type ReportedUser = {
  id: string;
  name: string;
  photo?: string;
};

export function UserReportPage() {
  const { userId = "" } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [reportedUser, setReportedUser] = useState<ReportedUser | null>(null);
  const [reason, setReason] = useState<ReportReason | "">("");
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    setLoading(true);
    void api<{ user: ReportedUser }>(`/api/users/${userId}`)
      .then((response) => setReportedUser(response.user))
      .catch((err) =>
        setLoadError(
          err instanceof ApiError ? err.message : "No se pudo cargar el perfil"
        )
      )
      .finally(() => setLoading(false));
  }, [userId]);

  async function submitReport(event: React.FormEvent) {
    event.preventDefault();
    if (!reason || busy) return;
    setBusy(true);
    try {
      await api(`/api/users/${userId}/report`, {
        method: "POST",
        body: JSON.stringify({
          reason,
          details: details.trim() || undefined,
        }),
      });
      toast.success("Denuncia enviada");
      navigate("/discover", { replace: true });
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo enviar la denuncia"
      );
      setBusy(false);
    }
  }

  if (loading) return <NoctaLoading />;

  if (loadError || !reportedUser) {
    return (
      <div className="app-screen user-report-page fade-in">
        <p className="text-danger">{loadError || "Usuario no encontrado"}</p>
        <Link className="btn btn-outline-light" to="/discover">
          Volver a Discover
        </Link>
      </div>
    );
  }

  return (
    <div className="app-screen user-report-page fade-in">
      <header className="user-report-head">
        <Link
          className="btn btn-outline-light user-report-back"
          to="/discover"
          aria-label="Volver a Discover"
        >
          <i className="bi bi-arrow-left" aria-hidden="true" />
        </Link>
        <div>
          <p className="text-secondary small mb-1">Seguridad</p>
          <h1 className="app-title h3 mb-0">Denunciar perfil</h1>
        </div>
      </header>

      <div className="user-report-person">
        {reportedUser.photo ? (
          <OptimizedImage
            src={reportedUser.photo}
            alt=""
            variant="thumb"
            sizes="48px"
          />
        ) : (
          <span aria-hidden="true">
            {reportedUser.name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <div>
          <small className="text-secondary">Vas a denunciar a</small>
          <strong>{reportedUser.name}</strong>
        </div>
      </div>

      <form className="user-report-form" onSubmit={submitReport}>
        <fieldset>
          <legend>¿Cuál es el motivo?</legend>
          <div className="user-report-reasons">
            {REPORT_REASONS.map((value) => (
              <label key={value} className="user-report-reason">
                <input
                  className="form-check-input"
                  type="radio"
                  name="reportReason"
                  value={value}
                  checked={reason === value}
                  onChange={() => setReason(value)}
                />
                <span>{REPORT_REASON_LABELS[value]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="user-report-details">
          <span>Contanos qué pasó (opcional)</span>
          <textarea
            className="form-control"
            rows={5}
            maxLength={1000}
            value={details}
            placeholder="Agregá información que ayude a revisar la denuncia"
            onChange={(event) => setDetails(event.target.value)}
          />
          <small className="text-secondary">{details.length}/1000</small>
        </label>

        <p className="text-secondary small mb-0">
          La persona denunciada no sabrá quién realizó la denuncia.
        </p>
        <button
          className="btn btn-danger user-report-submit"
          type="submit"
          disabled={!reason || busy}
        >
          {busy ? "Enviando…" : "Enviar denuncia"}
        </button>
      </form>
    </div>
  );
}

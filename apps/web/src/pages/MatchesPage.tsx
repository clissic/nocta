import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  REPORT_REASONS,
  type MatchSummary,
  type ReportReason,
} from "@nocta/shared";
import { api, ApiError } from "../lib/api";
import { OverflowFade } from "../components/OverflowFade";
import { NoctaLoading } from "../components/NoctaLoading";

const REPORT_LABELS: Record<ReportReason, string> = {
  spam: "Spam",
  acoso: "Acoso",
  perfil_falso: "Perfil falso",
  contenido_inapropiado: "Contenido inapropiado",
  otro: "Otro",
};

const FALLBACK_PHOTO =
  "https://images.unsplash.com/photo-1511367461989-f85a21fda167?w=400";

function formatMessageTime(iso?: string) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return date.toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return date.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
  });
}

export function MatchesPage() {
  const navigate = useNavigate();
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [menuMatch, setMenuMatch] = useState<MatchSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReason>("spam");
  const [mode, setMode] = useState<"menu" | "report">("menu");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await api<{ matches: MatchSummary[] }>("/api/matches");
      setMatches(data.matches);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudieron cargar");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function closeSheet() {
    setMenuMatch(null);
    setMode("menu");
    setReportReason("spam");
  }

  async function removeMatch(id: string) {
    if (!window.confirm("¿Eliminar este match?")) return;
    setBusy(true);
    try {
      await api(`/api/matches/${id}`, { method: "DELETE" });
      setMatches((prev) => prev.filter((m) => m.id !== id));
      closeSheet();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo eliminar");
    } finally {
      setBusy(false);
    }
  }

  async function blockMatch(id: string) {
    if (!window.confirm("¿Bloquear a esta persona? Se eliminará el match.")) return;
    setBusy(true);
    try {
      await api(`/api/matches/${id}/block`, { method: "POST", body: "{}" });
      setMatches((prev) => prev.filter((m) => m.id !== id));
      closeSheet();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo bloquear");
    } finally {
      setBusy(false);
    }
  }

  async function reportMatch(id: string) {
    setBusy(true);
    try {
      await api(`/api/matches/${id}/report`, {
        method: "POST",
        body: JSON.stringify({ reason: reportReason, unmatch: true }),
      });
      setMatches((prev) => prev.filter((m) => m.id !== id));
      closeSheet();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo denunciar");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <NoctaLoading />;
  }

  if (!matches.length) {
    return (
      <div className="app-screen matches-empty-page fade-in">
        {error && <p className="text-danger small matches-empty-error">{error}</p>}
        <div className="matches-empty-visual" aria-hidden="true">
          <span className="matches-empty-orbit is-one" />
          <span className="matches-empty-orbit is-two" />
          <span className="matches-empty-orbit is-three" />
          <span className="matches-empty-dot is-one" />
          <span className="matches-empty-dot is-two" />
          <span className="matches-empty-dot is-three" />
          <span className="matches-empty-core">
            <i className="bi bi-chat-heart-fill" />
          </span>
        </div>

        <div className="matches-empty-copy">
          <p className="matches-empty-eyebrow">Matches</p>
          <h1 className="app-title display-6 mb-2">Todavía no hay chispa</h1>
          <p className="text-secondary mb-0">
            Cuando alguien del mismo Espacio te guste también, el chat aparece
            acá.
          </p>

          <div className="matches-empty-actions">
            <Link className="btn btn-primary" to="/discover">
              <i className="bi bi-fire me-2" aria-hidden="true" />
              Ir al Discover
              <i className="bi bi-arrow-right ms-2" aria-hidden="true" />
            </Link>
            <Link className="btn btn-outline-light" to="/venues">
              <i className="bi bi-geo-alt me-2" aria-hidden="true" />
              Explorar espacios
            </Link>
          </div>

          <p className="matches-empty-note mb-0">
            Solo ves gente publicada en el mismo Espacio que vos.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-screen matches-page fade-in">
      <div className="matches-head">
        <div>
          <h1 className="app-title h3 mb-1">Matches</h1>
          <p className="text-secondary small mb-0">Gente del mismo espacio.</p>
        </div>
      </div>

      {error && <p className="text-danger small">{error}</p>}

      <div className="matches-grid">
        {matches.map((m) => (
          <article key={m.id} className="match-row">
            <Link to={`/matches/${m.id}`} className="match-row-main">
              <img
                className="match-avatar"
                src={m.otherUser.photo ?? FALLBACK_PHOTO}
                alt=""
              />
              <div className="match-row-copy min-w-0">
                <div className="match-row-name fw-semibold text-truncate">
                  {m.otherUser.name}
                </div>
                <div className="match-row-venue text-secondary small text-truncate">
                  {m.venueName ?? "Espacio"}
                </div>
                <div className="match-row-preview small text-truncate">
                  <span className="text-secondary">
                    {m.lastMessage?.body ?? "Decí hola"}
                  </span>
                  {m.lastMessage?.createdAt && (
                    <span className="match-row-time">
                      · {formatMessageTime(m.lastMessage.createdAt)}
                    </span>
                  )}
                </div>
              </div>
            </Link>
            <button
              type="button"
              className="btn btn-link link-secondary match-row-menu"
              aria-label={`Opciones de ${m.otherUser.name}`}
              onClick={() => {
                setMenuMatch(m);
                setMode("menu");
              }}
            >
              <i className="bi bi-three-dots-vertical" aria-hidden="true" />
            </button>
          </article>
        ))}
      </div>

      {menuMatch && (
        <div className="chat-sheet" role="dialog" aria-modal="true">
          <button
            type="button"
            className="chat-sheet-backdrop"
            aria-label="Cerrar"
            onClick={closeSheet}
          />
          <div className="chat-sheet-panel">
            <OverflowFade>
            <div className="chat-sheet-handle d-md-none" aria-hidden="true" />
            <div className="chat-sheet-title">{menuMatch.otherUser.name}</div>

            {mode === "menu" ? (
              <div className="d-grid gap-2">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => navigate(`/matches/${menuMatch.id}`)}
                >
                  <i className="bi bi-chat-dots me-2" aria-hidden="true" />
                  Abrir chat
                </button>
                <button
                  type="button"
                  className="btn btn-outline-light"
                  disabled={busy}
                  onClick={() => void removeMatch(menuMatch.id)}
                >
                  <i className="bi bi-trash me-2" aria-hidden="true" />
                  Eliminar match
                </button>
                <button
                  type="button"
                  className="btn btn-outline-warning"
                  disabled={busy}
                  onClick={() => setMode("report")}
                >
                  <i className="bi bi-flag me-2" aria-hidden="true" />
                  Denunciar
                </button>
                <button
                  type="button"
                  className="btn btn-outline-danger"
                  disabled={busy}
                  onClick={() => void blockMatch(menuMatch.id)}
                >
                  <i className="bi bi-slash-circle me-2" aria-hidden="true" />
                  Bloquear
                </button>
                <button type="button" className="btn btn-link link-secondary" onClick={closeSheet}>
                  Cancelar
                </button>
              </div>
            ) : (
              <div className="d-grid gap-2">
                <p className="small text-secondary mb-0">
                  Elegí el motivo. Se eliminará el match.
                </p>
                <select
                  className="form-select bg-transparent border-secondary"
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value as ReportReason)}
                >
                  {REPORT_REASONS.map((reason) => (
                    <option key={reason} value={reason}>
                      {REPORT_LABELS[reason]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-warning"
                  disabled={busy}
                  onClick={() => void reportMatch(menuMatch.id)}
                >
                  Enviar denuncia
                </button>
                <button
                  type="button"
                  className="btn btn-link link-secondary"
                  onClick={() => setMode("menu")}
                >
                  Volver
                </button>
              </div>
            )}
            </OverflowFade>
          </div>
        </div>
      )}
    </div>
  );
}

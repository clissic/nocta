import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { ChatMessage, MatchSummary } from "@nocta/shared";
import { useAuth } from "../auth/AuthContext";
import { api } from "../lib/api";

const FALLBACK_PHOTO =
  "https://images.unsplash.com/photo-1511367461989-f85a21fda167?w=200";

function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startMsg = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round(
    (startToday.getTime() - startMsg.getTime()) / (24 * 60 * 60 * 1000)
  );
  if (diffDays === 0) return "Hoy";
  if (diffDays === 1) return "Ayer";
  return date.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

type ChatItem =
  | { kind: "sep"; id: string; label: string }
  | { kind: "msg"; message: ChatMessage };

export function ChatPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [matchMeta, setMatchMeta] = useState<MatchSummary | null>(null);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [msgRes, matchesRes] = await Promise.all([
          api<{ messages: ChatMessage[] }>(`/api/matches/${id}/messages`),
          api<{ matches: MatchSummary[] }>("/api/matches"),
        ]);
        if (!alive) return;
        setMessages(msgRes.messages);
        setMatchMeta(matchesRes.matches.find((m) => m.id === id) ?? null);
      } catch {
        if (alive) setError("No se pudo cargar el chat");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const items = useMemo(() => {
    const out: ChatItem[] = [];
    let lastDay = "";
    for (const message of messages) {
      const key = dayKey(message.createdAt);
      if (key !== lastDay) {
        out.push({
          kind: "sep",
          id: `day-${key}`,
          label: dayLabel(message.createdAt),
        });
        lastDay = key;
      }
      out.push({ kind: "msg", message });
    }
    return out;
  }, [messages]);

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    try {
      const data = await api<{ message: ChatMessage }>(`/api/matches/${id}/messages`, {
        method: "POST",
        body: JSON.stringify({ body }),
      });
      setMessages((prev) => [...prev, data.message]);
      setBody("");
      setError("");
    } catch {
      setError("No se pudo enviar. Probá de nuevo.");
    }
  }

  if (loading) return <div className="app-screen text-secondary">Cargando…</div>;

  return (
    <div className="chat-screen fade-in">
      <header className="chat-header">
        <button
          type="button"
          className="btn btn-link link-light p-0"
          aria-label="Volver"
          onClick={() => navigate("/matches")}
        >
          <i className="bi bi-arrow-left fs-5" aria-hidden="true" />
        </button>
        <img
          className="chat-header-avatar"
          src={matchMeta?.otherUser.photo ?? FALLBACK_PHOTO}
          alt=""
        />
        <div className="min-w-0">
          <div className="fw-semibold text-truncate">
            {matchMeta?.otherUser.name ?? "Chat"}
          </div>
          <div className="text-secondary small text-truncate">
            {matchMeta?.venueName}
          </div>
        </div>
      </header>

      <div className="chat-messages">
        {!messages.length && (
          <p className="text-secondary text-center small mt-4">Rompé el hielo.</p>
        )}
        {items.map((item) =>
          item.kind === "sep" ? (
            <div key={item.id} className="chat-day-sep">
              <span>{item.label}</span>
            </div>
          ) : (
            <div
              key={item.message.id}
              className={`bubble ${
                item.message.senderId === user?.id ? "mine" : "theirs"
              }`}
            >
              <span className="bubble-text">{item.message.body}</span>
              <time className="bubble-time" dateTime={item.message.createdAt}>
                {timeLabel(item.message.createdAt)}
              </time>
            </div>
          )
        )}
        <div ref={bottomRef} />
      </div>

      {error && <p className="text-danger small px-3 mb-0">{error}</p>}

      <form className="chat-compose" onSubmit={(e) => void send(e)}>
        <input
          className="form-control bg-transparent border-secondary"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Mensaje…"
          maxLength={2000}
        />
        <button className="btn btn-primary" type="submit" aria-label="Enviar">
          <i className="bi bi-send-fill" aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}

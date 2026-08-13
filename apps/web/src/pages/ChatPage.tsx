import { FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { ChatMessage, MatchSummary } from "@nocta/shared";
import { useAuth } from "../auth/AuthContext";
import { api } from "../lib/api";

export function ChatPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [matchMeta, setMatchMeta] = useState<MatchSummary | null>(null);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
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

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    const data = await api<{ message: ChatMessage }>(`/api/matches/${id}/messages`, {
      method: "POST",
      body: JSON.stringify({ body }),
    });
    setMessages((prev) => [...prev, data.message]);
    setBody("");
  }

  if (loading) return <div className="app-screen text-secondary">Cargando…</div>;

  return (
    <div className="chat-screen fade-in">
      <div className="d-flex align-items-center gap-2 px-3 py-2 border-bottom border-secondary">
        <button
          type="button"
          className="btn btn-link link-light p-0"
          aria-label="Volver"
          onClick={() => navigate("/matches")}
        >
          <i className="bi bi-arrow-left fs-5" aria-hidden="true"></i>
        </button>
        <div className="min-w-0">
          <div className="fw-semibold text-truncate">
            {matchMeta?.otherUser.name ?? "Chat"}
          </div>
          <div className="text-secondary small text-truncate">{matchMeta?.venueName}</div>
        </div>
      </div>

      <div className="chat-messages">
        {!messages.length && (
          <p className="text-secondary text-center small mt-4">Rompé el hielo.</p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`bubble ${m.senderId === user?.id ? "mine" : "theirs"}`}
          >
            {m.body}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form className="chat-compose" onSubmit={send}>
        <input
          className="form-control bg-transparent border-secondary"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Mensaje…"
          maxLength={2000}
        />
        <button className="btn btn-primary" type="submit" aria-label="Enviar">
          <i className="bi bi-send-fill" aria-hidden="true"></i>
        </button>
      </form>
    </div>
  );
}

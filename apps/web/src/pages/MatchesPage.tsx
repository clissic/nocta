import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { MatchSummary } from "@nocta/shared";
import { api } from "../lib/api";

export function MatchesPage() {
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await api<{ matches: MatchSummary[] }>("/api/matches");
        if (alive) setMatches(data.matches);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (loading) return <div className="app-screen text-secondary fade-in">Cargando…</div>;

  return (
    <div className="app-screen fade-in" style={{ maxWidth: 720, width: "100%" }}>
      <h1 className="app-title h3 mb-1">Matches</h1>
      <p className="text-secondary small mb-2">Gente del mismo local.</p>

      {!matches.length ? (
        <p className="text-secondary mt-4">Todavía no tenés matches.</p>
      ) : (
        <div className="flat-list">
          {matches.map((m) => (
            <Link key={m.id} to={`/matches/${m.id}`}>
              <img
                className="match-avatar"
                src={
                  m.otherUser.photo ??
                  "https://images.unsplash.com/photo-1511367461989-f85a21fda167?w=200"
                }
                alt=""
              />
              <div className="min-w-0 flex-grow-1">
                <div className="fw-semibold">{m.otherUser.name}</div>
                <div className="text-secondary small text-truncate">
                  {m.venueName ?? "Local"} · {m.lastMessage ?? "Decí hola"}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

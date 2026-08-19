import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  GENDER_LABELS,
  INTEREST_LABELS,
  LOOKING_FOR_LABELS,
  REPORT_REASONS,
  REPORT_REASON_LABELS,
  SOCIAL_NETWORKS,
  SOCIAL_NETWORK_LABELS,
  type ChatMessage,
  type Gender,
  type Interest,
  type LookingFor,
  type MatchSummary,
  type ProfileLocation,
  type ProfileSocials,
  type ReportReason,
  type SocialNetwork,
} from "@nocta/shared";
import { useAuth } from "../auth/AuthContext";
import { OverflowFade } from "../components/OverflowFade";
import { NoctaLoading } from "../components/NoctaLoading";
import { PhotoLightbox } from "../components/PhotoLightbox";
import { useToast } from "../components/ToastProvider";
import { api, ApiError } from "../lib/api";
import { LOOKING_FOR_ICONS } from "../lib/lookingForIcons";

const FALLBACK_PHOTO =
  "https://images.unsplash.com/photo-1511367461989-f85a21fda167?w=200";

const SOCIAL_ICONS: Record<SocialNetwork, string> = {
  instagram: "bi-instagram",
  tiktok: "bi-tiktok",
  x: "bi-twitter-x",
  facebook: "bi-facebook",
  linkedin: "bi-linkedin",
};

function socialUrl(network: SocialNetwork, handle: string) {
  const clean = handle.replace(/^@/, "").trim();
  if (!clean) return null;
  switch (network) {
    case "instagram":
      return `https://instagram.com/${clean}`;
    case "tiktok":
      return `https://www.tiktok.com/@${clean}`;
    case "x":
      return `https://x.com/${clean}`;
    case "facebook":
      return `https://facebook.com/${clean}`;
    case "linkedin":
      return `https://www.linkedin.com/in/${clean}`;
    default:
      return null;
  }
}

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

type MatchPeerProfile = {
  id: string;
  name: string;
  age: number;
  heightCm?: number;
  bio?: string;
  lookingFor: LookingFor[];
  interests: Interest[];
  gender?: string;
  livesIn?: ProfileLocation;
  socials?: ProfileSocials;
  photo?: string;
  photos: string[];
};

type AsideMode = "actions" | "block" | "report";

export function ChatPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [matchMeta, setMatchMeta] = useState<MatchSummary | null>(null);
  const [peer, setPeer] = useState<MatchPeerProfile | null>(null);
  const [peerLoading, setPeerLoading] = useState(false);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [asideMode, setAsideMode] = useState<AsideMode>("actions");
  const [reportReason, setReportReason] = useState<ReportReason>("spam");
  const [busy, setBusy] = useState(false);
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
    const otherId = matchMeta?.otherUser.id;
    if (!otherId) {
      setPeer(null);
      setPeerLoading(false);
      return;
    }
    let alive = true;
    setPeerLoading(true);
    (async () => {
      try {
        const data = await api<{ user: MatchPeerProfile }>(
          `/api/users/${otherId}`
        );
        if (alive) setPeer(data.user);
      } catch {
        if (alive) setPeer(null);
      } finally {
        if (alive) setPeerLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [matchMeta?.otherUser.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    setAsideMode("actions");
    setReportReason("spam");
    setLightboxIndex(null);
  }, [id]);

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

  const galleryPhotos = useMemo(() => {
    const fromPeer = (peer?.photos ?? []).filter(Boolean);
    if (fromPeer.length) return fromPeer;
    const fallback = matchMeta?.otherUser.photo;
    return fallback ? [fallback] : [];
  }, [peer?.photos, matchMeta?.otherUser.photo]);

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

  async function blockMatch() {
    if (!id) return;
    setBusy(true);
    try {
      await api(`/api/matches/${id}/block`, { method: "POST", body: "{}" });
      toast.success("Persona bloqueada");
      navigate("/matches");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo bloquear");
    } finally {
      setBusy(false);
    }
  }

  async function reportMatch() {
    if (!id) return;
    setBusy(true);
    try {
      await api(`/api/matches/${id}/report`, {
        method: "POST",
        body: JSON.stringify({ reason: reportReason, unmatch: true }),
      });
      toast.success("Denuncia enviada");
      navigate("/matches");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo denunciar"
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <NoctaLoading />;

  const displayName = peer?.name ?? matchMeta?.otherUser.name ?? "Chat";

  return (
    <div className="chat-layout fade-in">
      <aside className="chat-match-aside" aria-label="Perfil del match">
        <OverflowFade className="chat-match-aside-scroll">
          {peerLoading && !peer ? (
            <NoctaLoading variant="inline" />
          ) : (
            <ChatMatchProfile
              name={displayName}
              age={peer?.age}
              venueName={matchMeta?.venueName}
              peer={peer}
              photos={galleryPhotos}
              onOpenPhoto={setLightboxIndex}
            />
          )}

          <div className="chat-match-aside-actions">
            {asideMode === "actions" && (
              <>
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  disabled={busy || !matchMeta}
                  onClick={() => setAsideMode("block")}
                >
                  <i className="bi bi-slash-circle me-2" aria-hidden="true" />
                  Bloquear
                </button>
                <button
                  type="button"
                  className="btn btn-outline-warning"
                  disabled={busy || !matchMeta}
                  onClick={() => setAsideMode("report")}
                >
                  <i className="bi bi-flag me-2" aria-hidden="true" />
                  Denunciar
                </button>
              </>
            )}

            {asideMode === "block" && (
              <>
                <p className="small text-secondary mb-0">
                  ¿Bloquear a {displayName}? Se eliminará el match.
                </p>
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  disabled={busy}
                  onClick={() => void blockMatch()}
                >
                  Confirmar bloqueo
                </button>
                <button
                  type="button"
                  className="btn btn-link link-secondary"
                  disabled={busy}
                  onClick={() => setAsideMode("actions")}
                >
                  Cancelar
                </button>
              </>
            )}

            {asideMode === "report" && (
              <>
                <p className="small text-secondary mb-0">
                  Elegí el motivo. Se eliminará el match.
                </p>
                <select
                  className="form-select bg-transparent border-secondary"
                  value={reportReason}
                  onChange={(e) =>
                    setReportReason(e.target.value as ReportReason)
                  }
                  disabled={busy}
                >
                  {REPORT_REASONS.map((reason) => (
                    <option key={reason} value={reason}>
                      {REPORT_REASON_LABELS[reason]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-outline-warning"
                  disabled={busy}
                  onClick={() => void reportMatch()}
                >
                  Enviar denuncia
                </button>
                <button
                  type="button"
                  className="btn btn-link link-secondary"
                  disabled={busy}
                  onClick={() => setAsideMode("actions")}
                >
                  Cancelar
                </button>
              </>
            )}
          </div>
        </OverflowFade>
      </aside>

      <div className="chat-screen">
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
            src={
              peer?.photo ?? matchMeta?.otherUser.photo ?? FALLBACK_PHOTO
            }
            alt=""
          />
          <div className="min-w-0">
            <div className="fw-semibold text-truncate">{displayName}</div>
            <div className="text-secondary small text-truncate">
              {matchMeta?.venueName}
            </div>
          </div>
        </header>

        <OverflowFade className="chat-messages">
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
                className={`chat-row ${
                  item.message.senderId === user?.id ? "is-mine" : "is-theirs"
                }`}
              >
                <div
                  className={`bubble ${
                    item.message.senderId === user?.id ? "mine" : "theirs"
                  }`}
                >
                  <span className="bubble-text">{item.message.body}</span>
                  <time className="bubble-time" dateTime={item.message.createdAt}>
                    {timeLabel(item.message.createdAt)}
                  </time>
                </div>
              </div>
            )
          )}
          <div ref={bottomRef} />
        </OverflowFade>

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

      {lightboxIndex !== null && galleryPhotos.length > 0 && (
        <PhotoLightbox
          photos={galleryPhotos}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}

function ChatMatchProfile({
  name,
  age,
  venueName,
  peer,
  photos,
  onOpenPhoto,
}: {
  name: string;
  age?: number;
  venueName?: string;
  peer: MatchPeerProfile | null;
  photos: string[];
  onOpenPhoto: (index: number) => void;
}) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const lookingFor = (peer?.lookingFor ?? []).filter(
    (value): value is LookingFor => value in LOOKING_FOR_LABELS
  );
  const interests = (peer?.interests ?? [])
    .filter((value): value is Interest => value in INTEREST_LABELS)
    .slice(0, 8);
  const genderLabel = peer?.gender
    ? GENDER_LABELS[peer.gender as Gender] ?? peer.gender
    : null;
  const activeSocials = SOCIAL_NETWORKS.filter((network) =>
    Boolean(peer?.socials?.[network]?.trim())
  );
  const hasMany = photos.length > 1;
  const safeIndex =
    photos.length === 0 ? 0 : Math.min(photoIndex, photos.length - 1);
  const currentPhoto = photos[safeIndex];

  useEffect(() => {
    setPhotoIndex(0);
  }, [photos]);

  function go(delta: number) {
    if (!hasMany) return;
    setPhotoIndex((current) => (current + delta + photos.length) % photos.length);
  }

  return (
    <>
      {currentPhoto && (
        <div className="chat-match-gallery">
          <div className="chat-match-carousel">
            <button
              type="button"
              className="chat-match-carousel-photo"
              onClick={() => onOpenPhoto(safeIndex)}
            >
              <img src={currentPhoto} alt={`Foto de ${name}`} />
            </button>
            {hasMany && (
              <>
                <button
                  type="button"
                  className="chat-match-carousel-nav is-prev"
                  aria-label="Foto anterior"
                  onClick={() => go(-1)}
                >
                  <i className="bi bi-chevron-left" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="chat-match-carousel-nav is-next"
                  aria-label="Foto siguiente"
                  onClick={() => go(1)}
                >
                  <i className="bi bi-chevron-right" aria-hidden="true" />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <div className="chat-match-identity">
        <h2 className="chat-match-name">
          {name}
          {age != null ? <span> · {age}</span> : null}
        </h2>
        {venueName && (
          <p className="chat-match-venue mb-0">Match en {venueName}</p>
        )}
      </div>

      {(peer?.heightCm || peer?.livesIn || genderLabel) && (
        <ul className="chat-match-facts">
          {peer?.heightCm ? <li>{peer.heightCm} cm</li> : null}
          {peer?.livesIn ? (
            <li>
              {peer.livesIn.city}, {peer.livesIn.country}
            </li>
          ) : null}
          {genderLabel ? <li>{genderLabel}</li> : null}
        </ul>
      )}

      {lookingFor.length > 0 && (
        <section className="chat-match-section">
          <h3 className="profile-label">Busca</h3>
          <div className="chat-match-looking">
            {lookingFor.map((value) => (
              <p key={value} className="chat-match-looking-line mb-0">
                <i
                  className={`bi ${LOOKING_FOR_ICONS[value]}`}
                  aria-hidden="true"
                />
                <span>{LOOKING_FOR_LABELS[value]}</span>
              </p>
            ))}
          </div>
        </section>
      )}

      {peer?.bio?.trim() ? (
        <section className="chat-match-section">
          <h3 className="profile-label">Sobre {name.split(" ")[0]}</h3>
          <p className="chat-match-bio mb-0">{peer.bio.trim()}</p>
        </section>
      ) : null}

      {interests.length > 0 && (
        <section className="chat-match-section">
          <h3 className="profile-label">Gustos</h3>
          <div className="chat-match-chips">
            {interests.map((interest) => (
              <span key={interest} className="profile-chip">
                {INTEREST_LABELS[interest]}
              </span>
            ))}
          </div>
        </section>
      )}

      {activeSocials.length > 0 && peer?.socials && (
        <div className="chat-match-socials" role="list" aria-label="Redes sociales">
          {activeSocials.map((network) => {
            const handle = peer.socials?.[network]?.trim();
            const href = handle ? socialUrl(network, handle) : null;
            if (!href || !handle) return null;
            const label = SOCIAL_NETWORK_LABELS[network];
            return (
              <a
                key={network}
                role="listitem"
                className="profile-social-icon is-active"
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${label}: @${handle.replace(/^@/, "")}`}
                title={`@${handle.replace(/^@/, "")}`}
              >
                <i className={`bi ${SOCIAL_ICONS[network]}`} aria-hidden="true" />
              </a>
            );
          })}
        </div>
      )}
    </>
  );
}

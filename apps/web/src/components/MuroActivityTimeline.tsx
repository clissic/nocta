import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ACTIVITY_TYPE_LABELS,
  type ActivityItem,
  type AuthUser,
  type FollowRequestProfile,
  type MuroFeedResponse,
} from "@nocta/shared";
import { ApiError, api } from "../lib/api";
import { useToast } from "./ToastProvider";
import { PhotoLightbox } from "./PhotoLightbox";
import { FollowRequestProfileModal } from "./FollowRequestProfileModal";

type PublicUserResponse = {
  id: string;
  name: string;
  age: number;
  photo?: string;
  heightCm?: number;
  livesIn?: FollowRequestProfile["livesIn"];
  socials?: FollowRequestProfile["socials"];
};

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const diffMs = Date.now() - then;
  const sec = Math.max(0, Math.floor(diffMs / 1000));
  if (sec < 60) return "ahora";
  const min = Math.floor(sec / 60);
  if (min < 60) return `hace ${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `hace ${hr} h`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `hace ${days} d`;
  return new Date(iso).toLocaleDateString("es-UY", {
    day: "numeric",
    month: "short",
  });
}

function activityIcon(type: ActivityItem["type"]): string {
  if (type === "venue_followed") return "bi-bookmark-heart";
  if (type === "venue_review_updated") return "bi-pencil-square";
  if (type === "user_post_created") return "bi-chat-quote";
  return "bi-star-fill";
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="muro-activity-stars" aria-label={`${rating} de 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <i
          key={i}
          className={`bi ${i < rating ? "bi-star-fill" : "bi-star"}`}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

type Props = {
  activity: ActivityItem[];
  followingUsers?: MuroFeedResponse["followingUsers"];
  currentUser: AuthUser | null;
  onPublishClick: () => void;
};

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || "Usuario";
}

export function MuroActivityTimeline({
  activity,
  followingUsers,
  currentUser,
  onPublishClick,
}: Props) {
  const toast = useToast();
  const people = followingUsers ?? [];
  const timelineViewportRef = useRef<HTMLDivElement>(null);
  const [hasMoreBelow, setHasMoreBelow] = useState(false);
  const [lightbox, setLightbox] = useState<{
    photos: string[];
    index: number;
  } | null>(null);
  const [reducedProfile, setReducedProfile] =
    useState<FollowRequestProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const updateTimelineOverflow = useCallback(() => {
    const viewport = timelineViewportRef.current;
    if (!viewport) return;
    const remaining =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    setHasMoreBelow(remaining > 2);
  }, []);

  useEffect(() => {
    updateTimelineOverflow();
    const viewport = timelineViewportRef.current;
    if (!viewport || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateTimelineOverflow);
    observer.observe(viewport);
    const timeline = viewport.firstElementChild;
    if (timeline) observer.observe(timeline);
    return () => observer.disconnect();
  }, [activity, updateTimelineOverflow]);

  async function openReducedProfile(userId: string) {
    setSelectedUserId(userId);
    setReducedProfile(null);
    setProfileLoading(true);
    try {
      const response = await api<{ user: PublicUserResponse }>(
        `/api/users/${userId}`
      );
      const u = response.user;
      setReducedProfile({
        id: u.id,
        name: u.name,
        age: u.age,
        photo: u.photo,
        heightCm: u.heightCm,
        livesIn: u.livesIn,
        socials: u.socials,
      });
    } catch (error) {
      setSelectedUserId(null);
      toast.error(
        error instanceof ApiError
          ? error.message
          : "No se pudo cargar el perfil"
      );
    } finally {
      setProfileLoading(false);
    }
  }

  const myPhoto = currentUser?.profile?.photos?.[0];
  const myInitial =
    firstName(currentUser?.profile?.name ?? "Yo").slice(0, 1).toUpperCase() ||
    "Y";

  return (
    <section className="muro-activity" aria-labelledby="muro-activity-title">
      <div className="muro-activity-head">
        <h2 id="muro-activity-title" className="muro-carousel-title">
          Actividad
        </h2>
        <p className="muro-carousel-sub">De personas que seguís</p>
      </div>

      <div
        className="muro-activity-people"
        role="list"
        aria-label="Mi actividad y personas que seguís"
      >
        <button
          type="button"
          className="muro-activity-person is-self"
          role="listitem"
          onClick={onPublishClick}
          aria-label="Mi actividad"
        >
          <span className="muro-activity-avatar-wrap">
            <span className="muro-activity-avatar">
              {myPhoto ? (
                <img src={myPhoto} alt="" />
              ) : (
                <span aria-hidden="true">{myInitial}</span>
              )}
            </span>
            <span className="muro-activity-badge-plus" aria-hidden="true">
              <i className="bi bi-plus" />
            </span>
          </span>
          <span className="muro-activity-person-name">Mi actividad</span>
        </button>

        {people.map((u) => (
          <button
            key={u.id}
            type="button"
            className="muro-activity-person"
            role="listitem"
            title={u.name}
            onClick={() => void openReducedProfile(u.id)}
          >
            <span className="muro-activity-avatar">
              {u.photo ? (
                <img src={u.photo} alt="" />
              ) : (
                <span aria-hidden="true">
                  {firstName(u.name).slice(0, 1).toUpperCase()}
                </span>
              )}
            </span>
            <span className="muro-activity-person-name">
              {firstName(u.name)}
            </span>
          </button>
        ))}
      </div>

      {activity.length === 0 ? (
        <p className="muro-activity-empty text-secondary small mb-0">
          Publicá algo desde Mi actividad o esperá a que quienes seguís
          compartan reseñas, Espacios y publicaciones.
        </p>
      ) : (
        <div
          ref={timelineViewportRef}
          className={`muro-activity-timeline-viewport${
            hasMoreBelow ? " has-more-below" : ""
          }`}
          onScroll={updateTimelineOverflow}
        >
          <ol className="muro-activity-timeline">
            {activity.map((item) => {
              const verb = ACTIVITY_TYPE_LABELS[item.type] ?? "actualizó";
              const venueName = item.venue?.name ?? "un Espacio";
              const venueHref = item.venue?.id
                ? `/venues/${item.venue.id}`
                : undefined;
              const photos = item.review
                ? item.review.photos
                : (item.post?.photos ?? []);

              return (
                <li key={item.id} className="muro-activity-item">
                  <span
                    className={`muro-activity-rail-icon muro-activity-rail-icon--${item.type}`}
                    aria-hidden="true"
                  >
                    <i className={`bi ${activityIcon(item.type)}`} />
                  </span>
                  <div className="muro-activity-card">
                    <p className="muro-activity-meta">
                      <time dateTime={item.createdAt}>
                        {formatRelativeTime(item.createdAt)}
                      </time>
                      <span aria-hidden="true"> · </span>
                      <span className="muro-activity-actor">
                        {item.actor.name}
                      </span>{" "}
                      {verb}{" "}
                      {venueHref ? (
                        <Link
                          to={venueHref}
                          className="muro-activity-venue-link"
                        >
                          {venueName}
                        </Link>
                      ) : (
                        <span>{venueName}</span>
                      )}
                    </p>

                    {item.review && (
                      <div className="muro-activity-review">
                        <Stars rating={item.review.rating} />
                        {item.review.body && (
                          <p className="muro-activity-body mb-0">
                            {item.review.body}
                          </p>
                        )}
                      </div>
                    )}

                    {item.post?.body && !item.review && (
                      <p className="muro-activity-body mb-0">
                        {item.post.body}
                      </p>
                    )}

                    {photos.length > 0 && (
                      <div className="muro-activity-photos">
                        {photos.map((src, index) => (
                          <button
                            key={src}
                            type="button"
                            className="muro-activity-photo"
                            aria-label={`Ver foto ${index + 1} de ${photos.length}`}
                            onClick={() =>
                              setLightbox({
                                photos,
                                index,
                              })
                            }
                          >
                            <img src={src} alt="" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {lightbox && (
        <PhotoLightbox
          photos={lightbox.photos}
          startIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}

      {(selectedUserId || profileLoading) && (
        <FollowRequestProfileModal
          profile={reducedProfile}
          loading={profileLoading}
          onClose={() => {
            setSelectedUserId(null);
            setReducedProfile(null);
            setProfileLoading(false);
          }}
        />
      )}
    </section>
  );
}

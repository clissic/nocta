import type { ReactNode } from "react";
import type { NotificationItem, NotificationType } from "@nocta/shared";
import { formatNotificationTime } from "../lib/notificationTime";

const NOTIFICATION_ICONS: Record<NotificationType, string> = {
  like_received: "bi-heart-fill",
  match_created: "bi-stars",
  message_received: "bi-chat-heart-fill",
  follow_request: "bi-person-plus-fill",
  follow_accepted: "bi-person-check-fill",
  new_follower: "bi-people-fill",
  followed_user_post: "bi-file-earmark-post-fill",
  followed_user_review: "bi-star-fill",
  venue_new_follower: "bi-shop-window",
  venue_new_review: "bi-chat-square-heart-fill",
  presence_expired: "bi-clock-history",
  likes_recharged: "bi-lightning-charge-fill",
  venue_request_resolved: "bi-clipboard-check-fill",
  report_created: "bi-flag-fill",
  report_resolved: "bi-shield-check",
  followed_presence: "bi-geo-alt-fill",
};

function actorName(item: NotificationItem): string | null {
  const structured = item.data.actorName;
  if (typeof structured === "string" && structured.trim()) {
    return structured.trim();
  }

  const title = item.title.trim();
  const body = item.body?.trim() ?? "";
  switch (item.type) {
    case "match_created":
      return body.startsWith("Matcheaste con ")
        ? body.slice("Matcheaste con ".length)
        : null;
    case "message_received":
      return title.startsWith("Mensaje de ")
        ? title.slice("Mensaje de ".length)
        : null;
    case "follow_request":
      return body.includes(" quiere seguirte")
        ? body.split(" quiere seguirte")[0] ?? null
        : null;
    case "follow_accepted":
      return body.includes(" aceptó tu solicitud")
        ? body.split(" aceptó tu solicitud")[0] ?? null
        : null;
    case "new_follower":
      return body.includes(" empezó a seguirte")
        ? body.split(" empezó a seguirte")[0] ?? null
        : null;
    case "followed_user_post":
      return body.includes(" publicó en ")
        ? body.split(" publicó en ")[0] ?? null
        : null;
    case "followed_user_review":
      if (body.includes(" actualizó su reseña de ")) {
        return body.split(" actualizó su reseña de ")[0] ?? null;
      }
      return body.includes(" reseñó ")
        ? body.split(" reseñó ")[0] ?? null
        : null;
    case "venue_new_follower":
      return body.includes(" empezó a seguir ")
        ? body.split(" empezó a seguir ")[0] ?? null
        : null;
    case "venue_new_review":
      return body.includes(" reseñó ")
        ? body.split(" reseñó ")[0] ?? null
        : null;
    case "followed_presence":
      return title.endsWith(" se publicó")
        ? title.slice(0, -" se publicó".length)
        : null;
    default:
      return null;
  }
}

function highlightName(text: string, name: string | null): ReactNode {
  if (!name) return text;
  const index = text.indexOf(name);
  if (index < 0) return text;
  return (
    <>
      {text.slice(0, index)}
      <strong className="notification-person-name">{name}</strong>
      {text.slice(index + name.length)}
    </>
  );
}

export function NotificationContent({ item }: { item: NotificationItem }) {
  const name = actorName(item);
  return (
    <>
      <span className="notification-type-icon" aria-hidden="true">
        <i className={`bi ${NOTIFICATION_ICONS[item.type]}`} />
      </span>
      <span className="notification-item-copy">
        <span className="notifications-item-title">
          {highlightName(item.title, name)}
        </span>
        {item.body && (
          <span className="notifications-item-body">
            {highlightName(item.body, name)}
          </span>
        )}
        <time
          className="notifications-item-time"
          dateTime={item.createdAt}
        >
          {formatNotificationTime(item.createdAt)}
        </time>
      </span>
    </>
  );
}

import type { NotificationItem } from "@nocta/shared";

/** Destino al abrir una notificación (corrige hrefs legacy). */
export function notificationHref(item: NotificationItem): string | null {
  if (item.type === "report_resolved") {
    const reportId = item.data.reportId;
    if (typeof reportId === "string" && reportId) {
      return `/reports/${reportId}`;
    }
  }
  return item.href ?? null;
}

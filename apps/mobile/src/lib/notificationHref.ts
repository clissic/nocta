import type { NavigatorScreenParams } from "@react-navigation/native";
import type { NotificationItem } from "@nocta/shared";
import type { MainTabParamList, RootStackParamList } from "../navigation/types";

/** Destino al abrir una notificación (espejo de web). */
export function notificationHref(item: NotificationItem): string | null {
  if (item.type === "report_resolved") {
    const reportId = item.data.reportId;
    if (typeof reportId === "string" && reportId) {
      return `/reports/${reportId}`;
    }
  }
  return item.href ?? null;
}

export type NotificationNavTarget =
  | { screen: "Chat"; params: { matchId: string } }
  | { screen: "VenueDetail"; params: { venueId: string } }
  | { screen: "Premium" }
  | { screen: "Ad"; params: { adId: string } }
  | { screen: "ReportResolution"; params: { reportId: string } }
  | { screen: "VenueRequest" }
  | { screen: "VenueManage"; params: { venueId: string } }
  | { screen: "Main"; params: NavigatorScreenParams<MainTabParamList> }
  | null;

/** Mapea href web → navegación nativa. */
export function notificationNavTarget(
  item: NotificationItem
): NotificationNavTarget {
  const href = notificationHref(item);
  if (!href) return null;

  const report = href.match(/^\/reports\/([^/?#]+)/);
  if (report) {
    return {
      screen: "ReportResolution",
      params: { reportId: decodeURIComponent(report[1]) },
    };
  }

  const matchChat = href.match(/^\/matches\/([^/?#]+)/);
  if (matchChat) {
    return {
      screen: "Chat",
      params: { matchId: decodeURIComponent(matchChat[1]) },
    };
  }

  const ad = href.match(/^\/ads\/([^/?#]+)/);
  if (ad) {
    return { screen: "Ad", params: { adId: decodeURIComponent(ad[1]) } };
  }

  const managed = href.match(/^\/venues\/([^/?#]+)\/manage/);
  if (managed) {
    return {
      screen: "VenueManage",
      params: { venueId: decodeURIComponent(managed[1]) },
    };
  }

  const matchVenue = href.match(/^\/venues\/([^/?#]+)/);
  if (matchVenue) {
    return {
      screen: "VenueDetail",
      params: { venueId: decodeURIComponent(matchVenue[1]) },
    };
  }

  if (href.startsWith("/profile/venue-request")) {
    return { screen: "VenueRequest" };
  }

  if (href === "/profile" || href.startsWith("/profile?")) {
    if (
      item.type === "identity_verification_approved" ||
      item.type === "identity_verification_rejected"
    ) {
      return {
        screen: "Main",
        params: { screen: "Profile", params: { focus: "settings" } },
      };
    }
    if (item.type === "follow_request") {
      return {
        screen: "Main",
        params: { screen: "Profile", params: { focus: "requests" } },
      };
    }
    return { screen: "Main", params: { screen: "Profile" } };
  }

  if (href.startsWith("/premium")) return { screen: "Premium" };
  if (href.startsWith("/likes")) {
    return { screen: "Main", params: { screen: "Likes" } };
  }
  if (href.startsWith("/discover")) {
    return { screen: "Main", params: { screen: "Discover" } };
  }
  if (href === "/venues" || href.startsWith("/venues?")) {
    return { screen: "Main", params: { screen: "Venues" } };
  }
  if (href.startsWith("/matches")) {
    return { screen: "Main", params: { screen: "Matches" } };
  }

  return null;
}

export function openNotificationTarget(
  navigation: { navigate: (...args: never[]) => void },
  target: Exclude<NotificationNavTarget, null>
) {
  const navigate = navigation.navigate as (
    ...args: [screen: keyof RootStackParamList, params?: object]
  ) => void;
  switch (target.screen) {
    case "Chat":
      navigate("Chat", target.params);
      return;
    case "VenueDetail":
      navigate("VenueDetail", target.params);
      return;
    case "Premium":
      navigate("Premium");
      return;
    case "Ad":
      navigate("Ad", target.params);
      return;
    case "ReportResolution":
      navigate("ReportResolution", target.params);
      return;
    case "VenueRequest":
      navigate("VenueRequest");
      return;
    case "VenueManage":
      navigate("VenueManage", target.params);
      return;
    case "Main":
      navigate("Main", target.params);
      return;
  }
}

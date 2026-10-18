import { StyleSheet, Text, Pressable, View, type TextStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import type { NotificationItem, NotificationType } from "@nocta/shared";
import { colors, fonts } from "../../theme/tokens";

const ICONS: Record<NotificationType, keyof typeof Ionicons.glyphMap> = {
  like_received: "heart",
  match_created: "sparkles",
  message_received: "chatbubble-ellipses",
  follow_request: "person-add",
  follow_accepted: "person-circle",
  new_follower: "people",
  followed_user_post: "document-text",
  followed_user_review: "star",
  venue_new_follower: "storefront",
  venue_new_review: "chatbox-ellipses",
  presence_expired: "time",
  likes_recharged: "flash",
  premium_activated: "moon",
  venue_request_resolved: "clipboard",
  report_created: "flag",
  report_resolved: "shield-checkmark",
  followed_presence: "location",
  identity_verification_approved: "checkmark-circle",
  identity_verification_rejected: "person-remove",
};

function formatTime(iso: string) {
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
      hour12: false,
    });
  }
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

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

function Highlighted({
  text,
  name,
  style,
}: {
  text: string;
  name: string | null;
  style: TextStyle;
}) {
  if (!name) return <Text style={style}>{text}</Text>;
  const index = text.indexOf(name);
  if (index < 0) return <Text style={style}>{text}</Text>;
  return (
    <Text style={style}>
      {text.slice(0, index)}
      <Text style={styles.person}>{name}</Text>
      {text.slice(index + name.length)}
    </Text>
  );
}

export function NotificationRow({
  item,
  onPress,
}: {
  item: NotificationItem;
  onPress: () => void;
}) {
  const name = actorName(item);
  const unread = !item.readAt;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      accessibilityRole="button"
    >
      {unread ? (
        <>
          <View style={styles.unreadBase} />
          <LinearGradient
            colors={["rgba(214,255,75,0.09)", "rgba(214,255,75,0)"] as const}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 0.48, y: 0.5 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        </>
      ) : null}
      <View style={styles.icon}>
        <Ionicons name={ICONS[item.type]} size={16} color={colors.primary} />
      </View>
      <View style={styles.copy}>
        <Highlighted text={item.title} name={name} style={styles.title} />
        {item.body ? (
          <Highlighted text={item.body} name={name} style={styles.body} />
        ) : null}
        <Text style={styles.time}>{formatTime(item.createdAt)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    position: "relative",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(242,240,235,0.06)",
  },
  pressed: {
    backgroundColor: "rgba(242,240,235,0.04)",
  },
  unreadBase: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(214,255,75,0.025)",
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(214,255,75,0.22)",
    backgroundColor: "rgba(214,255,75,0.08)",
  },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  title: {
    color: colors.text,
    fontFamily: fonts.bodyBold,
    fontSize: 14,
  },
  body: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
  },
  person: {
    color: colors.primary,
    fontFamily: fonts.bodyBold,
  },
  time: {
    marginTop: 2,
    color: colors.textFaint,
    fontFamily: fonts.body,
    fontSize: 11,
  },
});

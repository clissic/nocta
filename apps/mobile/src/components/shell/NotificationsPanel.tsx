import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  NOTIFICATIONS_PREVIEW_LIMIT,
  type NotificationItem,
  type NotificationsResponse,
  type NotificationsUnreadResponse,
} from "@nocta/shared";
import { useToast } from "../ToastProvider";
import { api, ApiError } from "../../lib/api";
import {
  notificationNavTarget,
  openNotificationTarget,
} from "../../lib/notificationHref";
import { NotificationRow } from "../notifications/NotificationRow";
import { colors, fonts, tabBar } from "../../theme/tokens";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import type { RootStackParamList } from "../../navigation/types";

type Props = {
  open: boolean;
  aboveTabs: boolean;
  unread: number;
  onUnread: (count: number) => void;
  onClose: () => void;
};

export function NotificationsPanel({
  open,
  aboveTabs,
  unread,
  onUnread,
  onClose,
}: Props) {
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<NotificationsResponse>(
        `/api/notifications?page=1&limit=${NOTIFICATIONS_PREVIEW_LIMIT}`
      );
      setItems(data.notifications ?? []);
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "No se pudieron cargar las notificaciones"
      );
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!open) return;
    void loadList();
  }, [open, loadList]);

  async function markRead(ids?: string[], all?: boolean) {
    try {
      const data = await api<NotificationsUnreadResponse & { ok?: true }>(
        "/api/notifications/read",
        {
          method: "POST",
          body: JSON.stringify(all ? { all: true } : { ids }),
        }
      );
      onUnread(data.count ?? 0);
      if (all) {
        const now = new Date().toISOString();
        setItems((prev) =>
          prev.map((n) => ({ ...n, readAt: n.readAt ?? now }))
        );
      }
    } catch {
      /* el panel sigue usable */
    }
  }

  function go(item: NotificationItem) {
    onClose();
    if (!item.readAt) void markRead([item.id]);
    const target = notificationNavTarget(item);
    if (!target) {
      toast.info("Abrí esta notificación desde la web por ahora");
      return;
    }
    openNotificationTarget(navigation, target);
  }

  const panelStyle = aboveTabs
    ? {
        left: 12,
        right: 12,
        bottom: tabBar.height + Math.max(insets.bottom, 8) + 12,
        maxHeight: Math.min(height * 0.6, 416),
      }
    : {
        top: insets.top + 64,
        right: 12,
        width: Math.min(352, width - 24),
        maxHeight: Math.min(height * 0.7, 448),
      };

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityLabel="Cerrar notificaciones"
        />
        <View style={[styles.panel, panelStyle]}>
          <View style={styles.head}>
            <Text style={styles.title}>Notificaciones</Text>
            {unread > 0 ? (
              <Pressable onPress={() => void markRead(undefined, true)} hitSlop={8}>
                <Text style={styles.markAll}>Marcar todas</Text>
              </Pressable>
            ) : null}
          </View>
          <ScrollView
            style={styles.body}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {loading ? (
              <ActivityIndicator color={colors.primary} style={styles.loader} />
            ) : items.length === 0 ? (
              <Text style={styles.empty}>No tenés notificaciones.</Text>
            ) : (
              items.map((item) => (
                <NotificationRow
                  key={item.id}
                  item={item}
                  onPress={() => go(item)}
                />
              ))
            )}
          </ScrollView>
          <View style={styles.footer}>
            <Pressable
              style={styles.more}
              onPress={() => {
                onClose();
                navigation.navigate("Notifications");
              }}
            >
              <Text style={styles.moreText}>Ver más</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1 },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  panel: {
    position: "absolute",
    backgroundColor: "#121214",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(242,240,235,0.12)",
    overflow: "hidden",
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(242,240,235,0.08)",
  },
  title: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 17,
    letterSpacing: -0.4,
  },
  markAll: {
    color: colors.textMuted,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
  },
  body: { flexGrow: 0 },
  loader: { marginVertical: 28 },
  empty: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(242,240,235,0.08)",
  },
  more: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  moreText: {
    color: colors.onPrimary,
    fontFamily: fonts.bodyBold,
    fontSize: 14,
  },
});

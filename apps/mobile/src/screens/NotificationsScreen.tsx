import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  NOTIFICATIONS_PAGE_SIZE,
  type NotificationItem,
  type NotificationsResponse,
} from "@nocta/shared";
import { NoctaLoading } from "../components/NoctaLoading";
import { NotificationRow } from "../components/notifications/NotificationRow";
import { useToast } from "../components/ToastProvider";
import { Screen } from "../components/ui";
import { api, ApiError } from "../lib/api";
import {
  notificationNavTarget,
  openNotificationTarget,
} from "../lib/notificationHref";
import { colors, fonts, spacing } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Notifications">;

export function NotificationsScreen({ navigation }: Props) {
  const toast = useToast();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (nextPage: number) => {
      setLoading(true);
      try {
        const data = await api<NotificationsResponse>(
          `/api/notifications?page=${nextPage}&limit=${NOTIFICATIONS_PAGE_SIZE}`
        );
        setItems(data.notifications ?? []);
        setTotalPages(data.totalPages || 1);
        setTotal(data.total ?? 0);
        setPage(data.page || nextPage);
      } catch (err) {
        toast.error(
          err instanceof ApiError
            ? err.message
            : "No se pudieron cargar las notificaciones"
        );
        setItems([]);
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  async function openItem(item: NotificationItem) {
    if (!item.readAt) {
      try {
        await api("/api/notifications/read", {
          method: "POST",
          body: JSON.stringify({ ids: [item.id] }),
        });
        setItems((prev) =>
          prev.map((n) =>
            n.id === item.id
              ? { ...n, readAt: n.readAt ?? new Date().toISOString() }
              : n
          )
        );
      } catch {
        // seguir
      }
    }
    const target = notificationNavTarget(item);
    if (!target) {
      toast.info("Abrí esta notificación desde la web por ahora");
      return;
    }
    openNotificationTarget(navigation, target);
  }

  return (
    <Screen safeTop={false} style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.head}>
          <Text style={styles.title}>Notificaciones</Text>
          <Text style={styles.subtitle}>
            {total === 0
              ? "Todavía no tenés avisos."
              : `${total} en total · las leídas se borran a los 30 días`}
          </Text>
        </View>

        {loading ? (
          <NoctaLoading variant="block" />
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              No hay notificaciones en esta página.
            </Text>
            <Pressable
              style={styles.outlineBtn}
              onPress={() => navigation.navigate("Main", { screen: "Venues" })}
            >
              <Text style={styles.outlineBtnText}>Ir a Espacios</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.card}>
            {items.map((item) => (
              <NotificationRow
                key={item.id}
                item={item}
                onPress={() => void openItem(item)}
              />
            ))}
          </View>
        )}

        {totalPages > 1 ? (
          <View style={styles.pager} accessibilityLabel="Paginación de notificaciones">
            <Pressable
              style={[styles.outlineBtn, styles.pagerBtn, page <= 1 && styles.disabled]}
              disabled={page <= 1 || loading}
              onPress={() => void load(page - 1)}
            >
              <Text style={styles.outlineBtnText}>Anterior</Text>
            </Pressable>
            <Text style={styles.pagerStatus}>
              Página {page} de {totalPages}
            </Text>
            <Pressable
              style={[
                styles.outlineBtn,
                styles.pagerBtn,
                page >= totalPages && styles.disabled,
              ]}
              disabled={page >= totalPages || loading}
              onPress={() => void load(page + 1)}
            >
              <Text style={styles.outlineBtnText}>Siguiente</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingTop: spacing.md,
  },
  scroll: {
    paddingBottom: spacing.lg,
    flexGrow: 1,
  },
  head: {
    marginBottom: spacing.md,
    gap: 4,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 28,
    letterSpacing: -0.03 * 28,
  },
  subtitle: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  card: {
    borderWidth: 1,
    borderColor: "rgba(242,240,235,0.1)",
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "rgba(242,240,235,0.03)",
  },
  empty: {
    paddingVertical: 32,
    paddingHorizontal: 16,
    alignItems: "center",
    gap: 12,
  },
  emptyText: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 15,
    textAlign: "center",
  },
  outlineBtn: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  outlineBtnText: {
    color: colors.text,
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
  },
  pager: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: spacing.md,
    flexWrap: "wrap",
  },
  pagerBtn: {
    minWidth: 96,
  },
  pagerStatus: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  disabled: {
    opacity: 0.45,
  },
});

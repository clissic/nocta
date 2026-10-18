import { useEffect, useState } from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { NotificationsUnreadResponse } from "@nocta/shared";
import { useAuth } from "../../auth/AuthContext";
import { api } from "../../lib/api";
import { NoctaWordmark } from "../NoctaWordmark";
import { colors, fonts } from "../../theme/tokens";
import type { RootStackParamList } from "../../navigation/types";
import { BoostPulse } from "../BoostPulse";
import { AccountDrawer } from "./AccountDrawer";
import { NotificationsPanel } from "./NotificationsPanel";
import { onPushReceived } from "../../lib/push";

const POLL_MS = 35_000;

function formatBoostCountdown(remainingMs: number) {
  const totalSec = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

type Props = {
  aboveTabs: boolean;
  routeKey: string;
};

export function AppTopBar({ aboveTabs, routeKey }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [notesOpen, setNotesOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setNotesOpen(false);
    setMenuOpen(false);
  }, [routeKey]);

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      try {
        const data = await api<NotificationsUnreadResponse>(
          "/api/notifications/unread-count"
        );
        if (!cancelled) setUnread(data.count ?? 0);
      } catch {
        /* el badge no bloquea la navegación */
      }
    }
    void refresh();
    const offPush = onPushReceived(() => void refresh());
    const id = setInterval(() => {
      if (AppState.currentState === "active") void refresh();
    }, POLL_MS);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    return () => {
      cancelled = true;
      offPush();
      clearInterval(id);
      sub.remove();
    };
  }, []);

  const expiresAt = user?.boostExpiresAt
    ? new Date(user.boostExpiresAt).getTime()
    : 0;
  const boostLeft = expiresAt - now;
  const boostActive = boostLeft > 0;

  useEffect(() => {
    if (!expiresAt || expiresAt <= Date.now()) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return (
    <>
      <View style={[styles.bar, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => navigation.navigate("Main", { screen: "Venues" })}
          accessibilityRole="button"
          accessibilityLabel="Nocta, ir a Espacios"
          hitSlop={6}
        >
          <NoctaWordmark size={22} />
        </Pressable>
        <View style={styles.actions}>
          {boostActive ? (
            <BoostPulse>
              <View
                style={styles.boost}
                accessibilityLabel={`Boost activo · ${formatBoostCountdown(boostLeft)} restantes`}
              >
                <Ionicons name="rocket" size={14} color={colors.primary} />
                <Text style={styles.boostTime}>
                  {formatBoostCountdown(boostLeft)}
                </Text>
              </View>
            </BoostPulse>
          ) : null}
          <Pressable
            onPress={() => {
              setMenuOpen(false);
              setNotesOpen((v) => !v);
            }}
            style={styles.bell}
            accessibilityRole="button"
            accessibilityLabel={
              unread > 0
                ? `Notificaciones, ${unread} sin leer`
                : "Notificaciones"
            }
          >
            <Ionicons name="notifications-outline" size={22} color={colors.text} />
            {unread > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unread > 99 ? "99+" : unread}
                </Text>
              </View>
            ) : null}
          </Pressable>
          <Pressable
            onPress={() => {
              setNotesOpen(false);
              setMenuOpen(true);
            }}
            style={styles.menu}
            accessibilityRole="button"
            accessibilityLabel="Abrir menú de cuenta"
          >
            <Ionicons name="menu" size={22} color={colors.text} />
          </Pressable>
        </View>
      </View>
      <NotificationsPanel
        open={notesOpen}
        aboveTabs={aboveTabs}
        unread={unread}
        onUnread={setUnread}
        onClose={() => setNotesOpen(false)}
      />
      <AccountDrawer visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: 56,
    paddingHorizontal: 16,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: "rgba(10,10,11,0.94)",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  boost: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 36,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(214,255,75,0.55)",
    backgroundColor: "rgba(214,255,75,0.1)",
  },
  boostTime: {
    color: colors.primary,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    minWidth: 36,
    textAlign: "center",
  },
  bell: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: colors.onPrimary,
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    lineHeight: 12,
  },
  menu: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
});

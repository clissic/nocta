import { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../lib/api";
import { colors, fonts, tabBar } from "../theme/tokens";

type IconName = keyof typeof Ionicons.glyphMap;

const TABS: Array<{
  name: string;
  label: string;
  icon: IconName;
  iconActive: IconName;
  discover?: boolean;
}> = [
  {
    name: "Venues",
    label: "Espacios",
    icon: "location-outline",
    iconActive: "location",
  },
  {
    name: "Likes",
    label: "Likes",
    icon: "heart-outline",
    iconActive: "heart",
  },
  {
    name: "Discover",
    label: "Discover",
    icon: "flame",
    iconActive: "flame",
    discover: true,
  },
  {
    name: "Matches",
    label: "Matches",
    icon: "chatbubbles-outline",
    iconActive: "chatbubbles",
  },
  {
    name: "Profile",
    label: "Perfil",
    icon: "person-outline",
    iconActive: "person",
  },
];

function formatUnread(count: number) {
  return count > 99 ? "99+" : String(count);
}

export function MainTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, 8);
  const [unreadChats, setUnreadChats] = useState(0);
  const routeName = state.routes[state.index]?.name;

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      try {
        const data = await api<{ chats: number }>("/api/matches/unread-count");
        if (!cancelled) setUnreadChats(data.chats ?? 0);
      } catch {
        /* el badge no bloquea la navegación */
      }
    }
    void refresh();
    const id = setInterval(() => void refresh(), 12000);
    const parent = navigation.getParent();
    const unsub = parent?.addListener("state", () => {
      void refresh();
    });
    return () => {
      cancelled = true;
      clearInterval(id);
      unsub?.();
    };
  }, [navigation, routeName]);

  return (
    <View style={[styles.bar, { height: tabBar.height + bottom, paddingBottom: bottom }]}>
      {TABS.map((tab) => {
        const route = state.routes.find((r) => r.name === tab.name);
        if (!route) return null;
        const focused = state.routes[state.index]?.name === tab.name;
        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        if (tab.discover) {
          return (
            <Pressable
              key={tab.name}
              onPress={onPress}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={tab.label}
              style={styles.discoverSlot}
              android_ripple={{
                color: "rgba(214,255,75,0.28)",
                borderless: true,
                radius: 40,
              }}
            >
              {/* Sombra circular: elevation + borderRadius + overflow en el mismo nodo */}
              <View
                style={[
                  styles.discoverFab,
                  focused && styles.discoverFabActive,
                ]}
              >
                <Ionicons name="flame" size={26} color={colors.onPrimary} />
              </View>
              <Text
                style={[
                  styles.discoverLabel,
                  focused && styles.discoverLabelActive,
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        }

        return (
          <Pressable
            key={tab.name}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            accessibilityLabel={
              tab.name === "Matches" && unreadChats > 0
                ? `Matches, ${unreadChats} chats sin leer`
                : tab.label
            }
            style={styles.item}
          >
            <View style={styles.iconWrap}>
              <Ionicons
                name={focused ? tab.iconActive : tab.icon}
                size={22}
                color={focused ? colors.primary : colors.textFaint}
              />
              {tab.name === "Matches" && unreadChats > 0 ? (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>
                    {formatUnread(unreadChats)}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.label, focused && styles.labelActive]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: colors.panel,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 6,
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  iconWrap: {
    position: "relative",
  },
  unreadBadge: {
    position: "absolute",
    top: -6,
    right: -10,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadBadgeText: {
    color: colors.onPrimary,
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    lineHeight: 12,
  },
  label: {
    color: colors.textFaint,
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
  },
  labelActive: {
    color: colors.primary,
    fontFamily: fonts.bodyBold,
  },
  discoverSlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: -18,
    backgroundColor: "transparent",
  },
  discoverFab: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    // iOS glow
    shadowColor: colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    // Android: elevation rectangular se nota menos sin “marco” extra
    ...(Platform.OS === "android"
      ? { elevation: 4 }
      : { elevation: 0 }),
  },
  discoverFabActive: {
    backgroundColor: colors.primaryHover,
    // Anillo con shadow/inset simulado sin borderWidth (evita caja rara en Android)
    shadowOpacity: 0.55,
  },
  discoverLabel: {
    marginTop: 4,
    color: colors.textFaint,
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
  },
  discoverLabelActive: {
    color: colors.primary,
    fontFamily: fonts.bodyBold,
  },
});

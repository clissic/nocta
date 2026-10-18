import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ChatMessage, MatchSummary } from "@nocta/shared";
import { useAuth } from "../auth/AuthContext";
import { NoctaImage } from "../components/NoctaImage";
import { useToast } from "../components/ToastProvider";
import { LoadingBlock, Screen } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { connectChatSocket } from "../lib/chatSocket";
import { colors, fonts, radii, spacing } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Chat">;

const FALLBACK_PHOTO =
  "https://images.unsplash.com/photo-1511367461989-f85a21fda167?w=200";

type ChatItem =
  | { kind: "sep"; id: string; label: string }
  | { kind: "msg"; message: ChatMessage };

function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startMsg = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
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

function withMessage(prev: ChatMessage[], message: ChatMessage) {
  return prev.some((item) => item.id === message.id) ? prev : [...prev, message];
}

export function ChatScreen({ route, navigation }: Props) {
  const { matchId } = route.params;
  const { user } = useAuth();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<ChatItem>>(null);
  const [keyboardInset, setKeyboardInset] = useState(0);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [matchMeta, setMatchMeta] = useState<MatchSummary | null>(null);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [live, setLive] = useState(false);
  const userIdRef = useRef(user?.id);
  userIdRef.current = user?.id;

  const load = useCallback(async () => {
    try {
      const [msgs, matches] = await Promise.all([
        api<{ messages: ChatMessage[] }>(`/api/matches/${matchId}/messages`),
        api<{ matches: MatchSummary[] }>("/api/matches"),
      ]);
      setMessages(msgs.messages);
      setMatchMeta(matches.matches.find((m) => m.id === matchId) ?? null);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo cargar el chat"
      );
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [matchId, navigation, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    function onShow(event: { endCoordinates: { screenY: number } }) {
      const windowHeight = Dimensions.get("window").height;
      setKeyboardInset(Math.max(0, windowHeight - event.endCoordinates.screenY));
      requestAnimationFrame(() =>
        listRef.current?.scrollToEnd({ animated: true })
      );
    }
    function onHide() {
      setKeyboardInset(0);
    }

    const subscriptions = [
      Keyboard.addListener("keyboardWillShow", onShow),
      Keyboard.addListener("keyboardDidShow", onShow),
      Keyboard.addListener("keyboardWillHide", onHide),
      Keyboard.addListener("keyboardDidHide", onHide),
    ];
    return () => {
      for (const subscription of subscriptions) subscription.remove();
    };
  }, []);

  useEffect(() => {
    let socket: Awaited<ReturnType<typeof connectChatSocket>> = null;
    let cancelled = false;

    const onMessage = (message: ChatMessage) => {
      if (message.matchId !== matchId) return;
      setMessages((prev) => withMessage(prev, message));
      if (message.senderId === userIdRef.current) return;
      void api<{ messages: ChatMessage[] }>(`/api/matches/${matchId}/messages`)
        .then((res) => setMessages(res.messages))
        .catch(() => undefined);
    };
    const onConnect = () => {
      setLive(true);
      socket?.emit("chat:join", matchId);
    };
    const onDisconnect = () => setLive(false);

    void connectChatSocket().then((sock) => {
      if (cancelled || !sock) return;
      socket = sock;
      sock.on("message:new", onMessage);
      sock.on("connect", onConnect);
      sock.on("disconnect", onDisconnect);
      if (sock.connected) onConnect();
    });

    return () => {
      cancelled = true;
      socket?.emit("chat:leave", matchId);
      socket?.off("message:new", onMessage);
      socket?.off("connect", onConnect);
      socket?.off("disconnect", onDisconnect);
    };
  }, [matchId]);

  useEffect(() => {
    if (live) return;
    const interval = setInterval(() => {
      void api<{ messages: ChatMessage[] }>(`/api/matches/${matchId}/messages`)
        .then((res) => setMessages(res.messages))
        .catch(() => undefined);
    }, 8000);
    return () => clearInterval(interval);
  }, [live, matchId]);

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

  useEffect(() => {
    if (!items.length) return;
    const t = setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 50);
    return () => clearTimeout(t);
  }, [items.length]);

  async function send() {
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const data = await api<{ message: ChatMessage }>(
        `/api/matches/${matchId}/messages`,
        { method: "POST", body: JSON.stringify({ body: text }) }
      );
      setMessages((prev) => withMessage(prev, data.message));
      setBody("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo enviar");
    } finally {
      setSending(false);
    }
  }

  if (loading) return <LoadingBlock label="Cargando chat…" />;

  const displayName = matchMeta?.otherUser.name ?? "Chat";
  const avatarSrc = matchMeta?.otherUser.photo || FALLBACK_PHOTO;

  return (
    <Screen style={styles.screen} padded={false} safeTop={false}>
      <View style={[styles.flex, { paddingBottom: keyboardInset }]}>
        <View style={styles.header}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.back}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Volver"
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <NoctaImage
            src={avatarSrc}
            fallbackSrc={FALLBACK_PHOTO}
            variant="thumb"
            style={styles.avatar}
            contentFit="cover"
          />
          <View style={styles.headerText}>
            <Text style={styles.name} numberOfLines={1}>
              {displayName}
            </Text>
            {matchMeta?.venueName ? (
              <Text style={styles.venue} numberOfLines={1}>
                {matchMeta.venueName}
              </Text>
            ) : null}
          </View>
        </View>

        <FlatList
          ref={listRef}
          data={items}
          keyExtractor={(item) =>
            item.kind === "sep" ? item.id : item.message.id
          }
          style={styles.flex}
          contentContainerStyle={styles.list}
          onContentSizeChange={() =>
            listRef.current?.scrollToEnd({ animated: false })
          }
          ListEmptyComponent={
            <Text style={styles.empty}>Rompé el hielo.</Text>
          }
          renderItem={({ item }) => {
            if (item.kind === "sep") {
              return (
                <View style={styles.daySep}>
                  <Text style={styles.daySepText}>{item.label}</Text>
                </View>
              );
            }
            const mine = item.message.senderId === user?.id;
            return (
              <View
                style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}
              >
                <View
                  style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}
                >
                  <Text
                    style={[
                      styles.bubbleText,
                      mine && styles.bubbleTextMine,
                    ]}
                  >
                    {item.message.body}
                  </Text>
                  <Text
                    style={[
                      styles.bubbleTime,
                      mine && styles.bubbleTimeMine,
                    ]}
                  >
                    {timeLabel(item.message.createdAt)}
                  </Text>
                </View>
              </View>
            );
          }}
        />

        <View
          style={[
            styles.composer,
            {
              paddingBottom:
                keyboardInset > 0
                  ? spacing.sm
                  : Math.max(insets.bottom, spacing.sm) + 4,
            },
          ]}
        >
          <TextInput
            style={styles.input}
            value={body}
            onChangeText={setBody}
            placeholder="Mensaje…"
            placeholderTextColor={colors.textMuted}
            maxLength={2000}
            multiline
            blurOnSubmit={false}
            onSubmitEditing={() => void send()}
          />
          <Pressable
            onPress={() => void send()}
            disabled={sending || !body.trim()}
            style={({ pressed }) => [
              styles.sendBtn,
              (!body.trim() || sending) && styles.sendBtnDisabled,
              pressed && body.trim() && !sending && { opacity: 0.9 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Enviar"
          >
            {sending ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <Ionicons name="send" size={18} color={colors.onPrimary} />
            )}
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: "rgba(10,10,11,0.96)",
  },
  back: {
    padding: 4,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.elevated,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    color: colors.text,
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
  },
  venue: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: 1,
  },
  list: {
    flexGrow: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  empty: {
    marginTop: spacing.lg,
    textAlign: "center",
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  daySep: {
    alignSelf: "center",
    marginVertical: 6,
    maxWidth: "90%",
  },
  daySepText: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "rgba(24,24,27,0.92)",
    borderWidth: 1,
    borderColor: "rgba(242,240,235,0.08)",
    color: "rgba(242,240,235,0.72)",
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    letterSpacing: 0.02 * 11,
    textAlign: "center",
  },
  row: {
    width: "100%",
    flexDirection: "row",
    marginBottom: 7,
  },
  rowMine: { justifyContent: "flex-end" },
  rowTheirs: { justifyContent: "flex-start" },
  bubble: {
    maxWidth: "78%",
    paddingTop: 9,
    paddingBottom: 6,
    paddingLeft: 13,
    paddingRight: 11,
    borderRadius: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-end",
    justifyContent: "flex-end",
    columnGap: 9,
    rowGap: 2,
  },
  bubbleMine: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    backgroundColor: colors.elevated,
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 40,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 20,
  },
  bubbleTextMine: {
    color: colors.onPrimary,
  },
  bubbleTime: {
    flexGrow: 0,
    flexShrink: 0,
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 11,
    marginBottom: 1,
    opacity: 0.9,
  },
  bubbleTimeMine: {
    color: colors.onPrimary,
    opacity: 0.62,
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.canvas,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: "rgba(242,240,235,0.28)",
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 15,
    backgroundColor: "transparent",
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: {
    opacity: 0.45,
  },
});

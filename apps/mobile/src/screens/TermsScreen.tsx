import { useRef, useState, type ReactNode } from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  TERMS_SECTIONS,
  TERMS_UPDATED_AT,
  TERMS_UPDATED_LABEL,
  TERMS_VERSION,
  type TermsBlock,
} from "@nocta/shared";
import { NoctaWordmark } from "../components/NoctaWordmark";
import { Screen } from "../components/ui";
import { colors, fonts, radii, spacing } from "../theme/tokens";

const TAG =
  /<strong>([\s\S]*?)<\/strong>|<a href="(mailto:[^"]+)">([\s\S]*?)<\/a>|<br\s*\/?>/gi;

function tocLabel(title: string) {
  return title.replace(/^\d+\.\s*/, "");
}

function RichText({ text }: { text: string }) {
  const nodes: ReactNode[] = [];
  let last = 0;
  let index = 0;
  TAG.lastIndex = 0;
  let match = TAG.exec(text);
  while (match) {
    const at = match.index;
    if (at > last) nodes.push(text.slice(last, at));
    if (match[1] != null) {
      nodes.push(
        <Text key={index} style={styles.strong}>
          {match[1]}
        </Text>
      );
    } else if (match[2]) {
      const href = match[2];
      nodes.push(
        <Text
          key={index}
          style={styles.mail}
          onPress={() => void Linking.openURL(href)}
        >
          {match[3]}
        </Text>
      );
    } else {
      nodes.push("\n");
    }
    last = at + match[0].length;
    index += 1;
    match = TAG.exec(text);
  }
  if (last < text.length) nodes.push(text.slice(last));
  return <Text style={styles.p}>{nodes}</Text>;
}

function TermsBlockView({ block }: { block: TermsBlock }) {
  if (block.type === "ul") {
    return (
      <View style={styles.list}>
        {block.items.map((item) => (
          <View key={item} style={styles.listRow}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.listText}>{item}</Text>
          </View>
        ))}
      </View>
    );
  }
  if (block.type === "ol") {
    return (
      <View style={styles.list}>
        {block.items.map((item, index) => (
          <View key={item} style={styles.listRow}>
            <Text style={styles.bullet}>{index + 1}.</Text>
            <Text style={styles.listText}>{item}</Text>
          </View>
        ))}
      </View>
    );
  }
  if ("html" in block && block.html) {
    return <RichText text={block.text} />;
  }
  return <Text style={styles.p}>{block.text}</Text>;
}

export function TermsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const offsets = useRef<Record<string, number>>({});
  const [tocOpen, setTocOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  function goBack() {
    if (navigation.canGoBack()) navigation.goBack();
  }

  function jump(id: string) {
    setTocOpen(false);
    setPendingId(id);
  }

  return (
    <Screen padded={false} safeTop={false}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            paddingTop: Math.max(insets.top, spacing.md),
            paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.md,
            paddingHorizontal: spacing.md,
          }}
        >
        <View style={styles.top}>
          <NoctaWordmark size={28} />
          <Pressable
            onPress={goBack}
            style={styles.back}
            accessibilityRole="button"
            accessibilityLabel="Volver"
          >
            <Ionicons name="arrow-back" size={16} color={colors.onPrimary} />
            <Text style={styles.backText}>Volver</Text>
          </Pressable>
        </View>

        <Text style={styles.eyebrow}>Documento legal</Text>
        <Text style={styles.title}>Términos y Condiciones de uso de Nocta</Text>
        <View style={styles.meta}>
          <Text style={styles.metaText}>
            Última actualización:{" "}
            <Text accessibilityLabel={TERMS_UPDATED_AT}>{TERMS_UPDATED_LABEL}</Text>
          </Text>
          <Text style={styles.version}>Versión {TERMS_VERSION}</Text>
        </View>

        <View style={styles.toc}>
          <Pressable
            style={styles.tocToggle}
            onPress={() => setTocOpen((open) => !open)}
            accessibilityRole="button"
            accessibilityState={{ expanded: tocOpen }}
          >
            <Text style={styles.tocToggleText}>Índice</Text>
            <Ionicons
              name={tocOpen ? "chevron-up" : "chevron-down"}
              size={18}
              color={colors.text}
            />
          </Pressable>
          {tocOpen ? (
            <View style={styles.tocList}>
              {TERMS_SECTIONS.map((section, index) => (
                <Pressable
                  key={section.id}
                  style={styles.tocItem}
                  onPress={() => jump(section.id)}
                >
                  <Text style={styles.tocNum}>{index + 1}.</Text>
                  <Text style={styles.tocLabel}>{tocLabel(section.title)}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        {TERMS_SECTIONS.map((section) => (
          <View
            key={section.id}
            style={styles.section}
            onLayout={(event) => {
              const y = event.nativeEvent.layout.y;
              offsets.current[section.id] = y;
              if (pendingId !== section.id) return;
              setPendingId(null);
              scrollRef.current?.scrollTo({
                y: Math.max(0, y - 8),
                animated: true,
              });
            }}
          >
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.blocks.map((block, index) => (
              <TermsBlockView
                key={`${section.id}-${index}`}
                block={block}
              />
            ))}
          </View>
        ))}

        <View style={styles.foot}>
          <NoctaWordmark size={22} />
          <Text style={styles.footCopy}>© {new Date().getFullYear()} Nocta</Text>
        </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    minHeight: 34,
  },
  backText: {
    color: colors.onPrimary,
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
  },
  eyebrow: {
    color: colors.primary,
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: spacing.xs,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 28,
    letterSpacing: -0.03 * 28,
    lineHeight: 34,
  },
  meta: {
    marginTop: spacing.sm,
    gap: 4,
  },
  metaText: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  version: {
    color: colors.textFaint,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
  },
  toc: {
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    overflow: "hidden",
    backgroundColor: colors.panel,
  },
  tocToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  tocToggleText: {
    color: colors.text,
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
  },
  tocList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingVertical: spacing.xs,
  },
  tocItem: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  tocNum: {
    width: 28,
    color: colors.primary,
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
  },
  tocLabel: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 20,
    letterSpacing: -0.3,
    lineHeight: 26,
  },
  p: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
  },
  strong: {
    color: colors.text,
    fontFamily: fonts.bodySemiBold,
  },
  mail: {
    color: colors.primary,
    fontFamily: fonts.bodyMedium,
  },
  list: { gap: 6 },
  listRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  bullet: {
    color: colors.primary,
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    lineHeight: 22,
    width: 18,
  },
  listText: {
    flex: 1,
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
  },
  foot: {
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  footCopy: {
    color: colors.textFaint,
    fontFamily: fonts.body,
    fontSize: 13,
  },
});

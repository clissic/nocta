import { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  SOCIAL_NETWORKS,
  SOCIAL_NETWORK_LABELS,
  type FollowRequestItem,
  type FollowRequestProfile,
  type SocialNetwork,
} from "@nocta/shared";
import { NoctaImage } from "../NoctaImage";
import { NoctaLoading } from "../NoctaLoading";
import { useToast } from "../ToastProvider";
import { api, ApiError } from "../../lib/api";
import { colors, fonts, radii, spacing } from "../../theme/tokens";

type Props = {
  visible: boolean;
  requests: FollowRequestItem[];
  busyRequestId: string | null;
  onClose: () => void;
  onRespond: (
    requestId: string,
    action: "accept" | "reject"
  ) => void | Promise<void>;
};

const SOCIAL_ICONS: Record<SocialNetwork, keyof typeof Ionicons.glyphMap> = {
  instagram: "logo-instagram",
  tiktok: "logo-tiktok",
  x: "logo-twitter",
  facebook: "logo-facebook",
  linkedin: "logo-linkedin",
};

function socialUrl(network: SocialNetwork, handle: string) {
  const clean = handle.replace(/^@/, "").trim();
  if (!clean) return null;
  switch (network) {
    case "instagram":
      return `https://instagram.com/${clean}`;
    case "tiktok":
      return `https://www.tiktok.com/@${clean}`;
    case "x":
      return `https://x.com/${clean}`;
    case "facebook":
      return `https://facebook.com/${clean}`;
    case "linkedin":
      return `https://www.linkedin.com/in/${clean}`;
  }
}

export function FollowRequestsSheet({
  visible,
  requests,
  busyRequestId,
  onClose,
  onRespond,
}: Props) {
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(
    null
  );
  const [requestProfile, setRequestProfile] =
    useState<FollowRequestProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  function closeProfile() {
    setSelectedRequestId(null);
    setRequestProfile(null);
    setProfileLoading(false);
  }

  async function openRequestProfile(request: FollowRequestItem) {
    setSelectedRequestId(request.id);
    setRequestProfile(null);
    setProfileLoading(true);
    try {
      const response = await api<{ profile: FollowRequestProfile }>(
        `/api/me/follow-requests/${request.id}/profile`
      );
      setRequestProfile(response.profile);
    } catch (err) {
      closeProfile();
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo cargar el perfil"
      );
    } finally {
      setProfileLoading(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={() => {
        if (selectedRequestId) closeProfile();
        else onClose();
      }}
    >
      <View
        style={[
          styles.sheet,
          {
            paddingTop: Math.max(insets.top, spacing.sm),
            paddingBottom: Math.max(insets.bottom, spacing.sm),
          },
        ]}
      >
        <View style={styles.sheetHead}>
          <View style={styles.titleRow}>
            <Text style={styles.sheetTitle}>Solicitudes de seguimiento</Text>
            {requests.length > 0 ? (
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{requests.length}</Text>
              </View>
            ) : null}
          </View>
          <Pressable
            onPress={onClose}
            accessibilityLabel="Cerrar"
            hitSlop={8}
            style={styles.closeBtn}
          >
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.sheetBody}
          keyboardShouldPersistTaps="handled"
        >
          {requests.length === 0 ? (
            <Text style={styles.empty}>No tenés solicitudes pendientes.</Text>
          ) : (
            <View style={styles.list}>
              {requests.map((request) => {
                const busy = busyRequestId === request.id;
                const initial = request.fromUser.name.slice(0, 1).toUpperCase();
                return (
                  <View key={request.id} style={styles.item}>
                    <View style={styles.user}>
                      {request.fromUser.photo ? (
                        <NoctaImage
                          src={request.fromUser.photo}
                          variant="thumb"
                          style={styles.avatar}
                          contentFit="cover"
                        />
                      ) : (
                        <View style={[styles.avatar, styles.avatarFallback]}>
                          <Text style={styles.avatarInitial}>{initial}</Text>
                        </View>
                      )}
                      <View style={styles.userCopy}>
                        <Pressable
                          onPress={() => void openRequestProfile(request)}
                          accessibilityRole="button"
                          accessibilityLabel={`Ver perfil de ${request.fromUser.name}`}
                        >
                          <Text style={styles.name} numberOfLines={1}>
                            {request.fromUser.name}
                            {typeof request.fromUser.age === "number" ? (
                              <Text style={styles.age}>
                                {" "}
                                · {request.fromUser.age}
                              </Text>
                            ) : null}
                          </Text>
                        </Pressable>
                      </View>
                    </View>

                    <View style={styles.actions}>
                      <Pressable
                        disabled={busy}
                        onPress={() => void onRespond(request.id, "accept")}
                        style={({ pressed }) => [
                          styles.acceptBtn,
                          (busy || pressed) && {
                            opacity: busy ? 0.5 : 0.9,
                          },
                        ]}
                      >
                        {busy ? (
                          <ActivityIndicator
                            color={colors.onPrimary}
                            size="small"
                          />
                        ) : (
                          <Text style={styles.acceptText}>Aceptar</Text>
                        )}
                      </Pressable>
                      <Pressable
                        disabled={busy}
                        onPress={() => void onRespond(request.id, "reject")}
                        style={({ pressed }) => [
                          styles.rejectBtn,
                          (busy || pressed) && {
                            opacity: busy ? 0.5 : 0.9,
                          },
                        ]}
                      >
                        <Text style={styles.rejectText}>Rechazar</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </View>

      <Modal
        visible={selectedRequestId != null}
        transparent
        animationType="fade"
        onRequestClose={closeProfile}
      >
        <View style={styles.profileLayer}>
          <Pressable
            style={styles.profileBackdrop}
            onPress={closeProfile}
            accessibilityLabel="Cerrar perfil"
          />
          <View
            style={[
              styles.profileDialog,
              { paddingBottom: Math.max(insets.bottom, spacing.md) },
            ]}
          >
            <View style={styles.profileHead}>
              <Text style={styles.profileTitle}>Perfil</Text>
              <Pressable
                onPress={closeProfile}
                accessibilityLabel="Cerrar perfil"
                hitSlop={8}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={20} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.profileBody}>
              {profileLoading || !requestProfile ? (
                <NoctaLoading variant="inline" label="Cargando perfil" />
              ) : (
                <>
                  {requestProfile.photo ? (
                    <NoctaImage
                      src={requestProfile.photo}
                      variant="large"
                      style={styles.profilePhoto}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={[styles.profilePhoto, styles.profilePhotoEmpty]}>
                      <Text style={styles.profilePhotoInitial}>
                        {requestProfile.name.slice(0, 1).toUpperCase()}
                      </Text>
                    </View>
                  )}

                  <View style={styles.profileCopy}>
                    <Text style={styles.profileName}>
                      {requestProfile.name}
                      <Text style={styles.profileMeta}>
                        {" "}
                        · {requestProfile.age}
                      </Text>
                    </Text>
                    {requestProfile.heightCm ? (
                      <Text style={styles.profileMeta}>
                        {requestProfile.heightCm} cm
                      </Text>
                    ) : null}
                    {requestProfile.livesIn ? (
                      <Text style={styles.profileMeta}>
                        {requestProfile.livesIn.country},{" "}
                        {requestProfile.livesIn.city}
                      </Text>
                    ) : null}
                  </View>

                  {SOCIAL_NETWORKS.some((network) =>
                    Boolean(requestProfile.socials?.[network]?.trim())
                  ) ? (
                    <View style={styles.socials}>
                      {SOCIAL_NETWORKS.map((network) => {
                        const handle =
                          requestProfile.socials?.[network]?.trim();
                        const href = handle
                          ? socialUrl(network, handle)
                          : null;
                        if (!href || !handle) return null;
                        const label = SOCIAL_NETWORK_LABELS[network];
                        const clean = handle.replace(/^@/, "");
                        return (
                          <Pressable
                            key={network}
                            onPress={() => void Linking.openURL(href)}
                            style={styles.socialBtn}
                            accessibilityRole="link"
                            accessibilityLabel={`${label}: @${clean}`}
                          >
                            <Ionicons
                              name={SOCIAL_ICONS[network]}
                              size={20}
                              color={colors.primary}
                            />
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : null}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  sheetHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  titleRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
  },
  sheetTitle: {
    flexShrink: 1,
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 20,
    letterSpacing: -0.03 * 20,
  },
  countBadge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  countBadgeText: {
    color: colors.onPrimary,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.elevated,
  },
  sheetBody: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  empty: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  list: {
    gap: 12,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minHeight: 56,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  user: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.elevated,
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryDim,
  },
  avatarInitial: {
    color: colors.primary,
    fontFamily: fonts.bodyBold,
    fontSize: 16,
  },
  userCopy: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    color: colors.text,
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
  },
  age: {
    color: colors.textMuted,
    fontFamily: fonts.bodyMedium,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },
  acceptBtn: {
    minHeight: 34,
    minWidth: 78,
    paddingHorizontal: 12,
    borderRadius: radii.sm,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  acceptText: {
    color: colors.onPrimary,
    fontFamily: fonts.bodyBold,
    fontSize: 13,
  },
  rejectBtn: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: "rgba(242,240,235,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  rejectText: {
    color: colors.text,
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
  },
  profileLayer: {
    flex: 1,
    justifyContent: "flex-end",
  },
  profileBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.66)",
  },
  profileDialog: {
    backgroundColor: "#101012",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: "rgba(255,255,255,0.1)",
    maxHeight: "88%",
    overflow: "hidden",
  },
  profileHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  profileTitle: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 18,
    letterSpacing: -0.03 * 18,
  },
  profileBody: {
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  profilePhoto: {
    width: 220,
    height: 220,
    borderRadius: 18,
    backgroundColor: colors.elevated,
  },
  profilePhotoEmpty: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryDim,
  },
  profilePhotoInitial: {
    color: colors.primary,
    fontFamily: fonts.display,
    fontSize: 64,
  },
  profileCopy: {
    alignItems: "center",
    gap: 4,
  },
  profileName: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 22,
    letterSpacing: -0.03 * 22,
    textAlign: "center",
  },
  profileMeta: {
    color: colors.textMuted,
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    textAlign: "center",
  },
  socials: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
    marginTop: 4,
  },
  socialBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: "rgba(214,255,75,0.35)",
    backgroundColor: "rgba(214,255,75,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
});

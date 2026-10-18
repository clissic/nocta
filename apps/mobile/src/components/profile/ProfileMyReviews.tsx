import { useCallback, useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  MY_REVIEWS_PAGE_SIZE,
  VENUE_PHOTO_FALLBACK,
  type PaginatedReviewsResponse,
  type VenueReview,
} from "@nocta/shared";
import { api, ApiError } from "../../lib/api";
import { colors, fonts, radii, spacing } from "../../theme/tokens";
import { NoctaImage } from "../NoctaImage";
import { NoctaLoading } from "../NoctaLoading";
import { useToast } from "../ToastProvider";

type Props = {
  onOpenVenue: (venueId: string) => void;
};

function Stars({ rating }: { rating: number }) {
  return (
    <View
      style={styles.stars}
      accessibilityLabel={`${rating} de 5`}
    >
      {Array.from({ length: 5 }, (_, index) => (
        <Ionicons
          key={index}
          name={index < rating ? "star" : "star-outline"}
          size={12}
          color={colors.primary}
        />
      ))}
    </View>
  );
}

/** Acordeón “Mis reseñas” — parity web `ProfileMyReviewsAccordion`. */
export function ProfileMyReviews({ onOpenVenue }: Props) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [reviews, setReviews] = useState<VenueReview[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [lightbox, setLightbox] = useState<{
    photos: string[];
    index: number;
  } | null>(null);

  const loadReviews = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(MY_REVIEWS_PAGE_SIZE),
      });
      if (submittedQuery) params.set("q", submittedQuery);
      const response = await api<PaginatedReviewsResponse>(
        `/api/me/reviews?${params}`
      );
      setReviews(response.reviews ?? []);
      setTotal(response.pagination.total);
      setTotalPages(Math.max(1, response.pagination.totalPages));
      setLoadedOnce(true);
    } catch (error) {
      toast.error(
        error instanceof ApiError
          ? error.message
          : "No se pudieron cargar las reseñas"
      );
    } finally {
      setLoading(false);
    }
  }, [page, submittedQuery, toast]);

  useEffect(() => {
    if (!open) return;
    void loadReviews();
  }, [open, loadReviews]);

  function search(value: string) {
    setSubmittedQuery(value.trim());
    setPage(1);
  }

  return (
    <View style={styles.accordion}>
      <Pressable
        onPress={() => setOpen((value) => !value)}
        style={[styles.toggle, open && styles.toggleOpen]}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel="Mis reseñas"
      >
        <View style={styles.toggleCopy}>
          <Ionicons
            name="chatbox-ellipses-outline"
            size={18}
            color={colors.primary}
          />
          <Text style={styles.toggleLabel}>Mis reseñas</Text>
          {loadedOnce ? (
            <Text style={styles.toggleCount}>{total}</Text>
          ) : null}
        </View>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={18}
          color={colors.textMuted}
        />
      </Pressable>

      {open ? (
        <View style={styles.panel}>
          <View style={styles.search}>
            <Ionicons name="search" size={16} color={colors.textFaint} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => search(query)}
              placeholder="Buscar por espacio o texto…"
              placeholderTextColor={colors.textFaint}
              style={styles.searchInput}
              returnKeyType="search"
              accessibilityLabel="Buscar reseñas"
            />
          </View>

          {loading && reviews.length === 0 ? (
            <NoctaLoading variant="inline" compact />
          ) : reviews.length === 0 ? (
            <Text style={styles.empty}>
              {submittedQuery
                ? "No hay reseñas para esa búsqueda."
                : "Todavía no dejaste reseñas."}
            </Text>
          ) : (
            <View style={styles.list}>
              {reviews.map((review) => (
                <View key={review.id} style={styles.item}>
                  <View style={styles.head}>
                    {review.venuePhoto ? (
                      <NoctaImage
                        src={review.venuePhoto}
                        fallbackSrc={VENUE_PHOTO_FALLBACK}
                        variant="thumb"
                        style={styles.thumb}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={[styles.thumb, styles.thumbFallback]}>
                        <Text style={styles.thumbLetter}>
                          {(review.venueName ?? "E").slice(0, 1).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={styles.headCopy}>
                      {review.venueId ? (
                        <Pressable
                          onPress={() => onOpenVenue(review.venueId)}
                          accessibilityRole="button"
                          accessibilityLabel={review.venueName ?? "Espacio"}
                        >
                          <Text style={styles.venue} numberOfLines={1}>
                            {review.venueName ?? "Espacio"}
                          </Text>
                        </Pressable>
                      ) : (
                        <Text style={styles.venue} numberOfLines={1}>
                          {review.venueName ?? "Espacio"}
                        </Text>
                      )}
                      <View style={styles.meta}>
                        <Stars rating={review.rating} />
                        <Text style={styles.date}>
                          {new Date(review.createdAt).toLocaleDateString(
                            "es-UY",
                            { day: "numeric", month: "short" }
                          )}
                        </Text>
                      </View>
                    </View>
                  </View>
                  {review.body ? (
                    <Text style={styles.body}>{review.body}</Text>
                  ) : null}
                  {review.photos.length > 0 ? (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.photos}
                    >
                      {review.photos.map((src, index) => (
                        <Pressable
                          key={src}
                          onPress={() =>
                            setLightbox({ photos: review.photos, index })
                          }
                          accessibilityRole="button"
                          accessibilityLabel={`Ver foto ${index + 1}`}
                        >
                          <NoctaImage
                            src={src}
                            variant="thumb"
                            style={styles.photo}
                            contentFit="cover"
                          />
                        </Pressable>
                      ))}
                    </ScrollView>
                  ) : null}
                </View>
              ))}
            </View>
          )}

          {totalPages > 1 ? (
            <View style={styles.pager}>
              <Pressable
                disabled={page <= 1 || loading}
                onPress={() => setPage((current) => Math.max(1, current - 1))}
                accessibilityRole="button"
                accessibilityLabel="Anterior"
              >
                <Text
                  style={[
                    styles.pagerBtn,
                    (page <= 1 || loading) && styles.pagerBtnDisabled,
                  ]}
                >
                  Anterior
                </Text>
              </Pressable>
              <Text style={styles.pagerLabel}>
                {page} / {totalPages}
              </Text>
              <Pressable
                disabled={page >= totalPages || loading}
                onPress={() =>
                  setPage((current) => Math.min(totalPages, current + 1))
                }
                accessibilityRole="button"
                accessibilityLabel="Siguiente"
              >
                <Text
                  style={[
                    styles.pagerBtn,
                    (page >= totalPages || loading) && styles.pagerBtnDisabled,
                  ]}
                >
                  Siguiente
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : null}

      <Modal
        visible={Boolean(lightbox)}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setLightbox(null)}
      >
        <Pressable style={styles.lightbox} onPress={() => setLightbox(null)}>
          {lightbox ? (
            <NoctaImage
              src={lightbox.photos[lightbox.index] ?? ""}
              variant="medium"
              style={styles.lightboxPhoto}
              contentFit="contain"
            />
          ) : null}
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  accordion: {
    paddingHorizontal: 10,
    paddingTop: 8,
  },
  toggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(242,240,235,0.14)",
    borderRadius: radii.md,
    backgroundColor: "rgba(242,240,235,0.04)",
  },
  toggleOpen: {
    borderColor: "rgba(214,255,75,0.28)",
    backgroundColor: "rgba(214,255,75,0.06)",
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  toggleCopy: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  toggleLabel: {
    color: colors.text,
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
  },
  toggleCount: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  panel: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: "rgba(214,255,75,0.28)",
    borderBottomLeftRadius: radii.md,
    borderBottomRightRadius: radii.md,
    backgroundColor: "rgba(10,10,11,0.35)",
    padding: spacing.md,
    gap: 12,
  },
  search: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: "rgba(242,240,235,0.14)",
    backgroundColor: "rgba(242,240,235,0.04)",
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 14,
    paddingVertical: 8,
  },
  empty: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
  },
  list: {
    gap: 14,
  },
  item: {
    gap: 8,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(242,240,235,0.12)",
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
  },
  thumb: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.elevated,
  },
  thumbFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(214,255,75,0.16)",
  },
  thumbLetter: {
    color: colors.primary,
    fontFamily: fonts.bodyBold,
    fontSize: 16,
  },
  headCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  venue: {
    color: colors.text,
    fontFamily: fonts.bodyBold,
    fontSize: 15,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stars: {
    flexDirection: "row",
    gap: 1,
  },
  date: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  body: {
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
  },
  photos: {
    gap: 6,
  },
  photo: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: colors.elevated,
  },
  pager: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  pagerBtn: {
    color: "rgba(242,240,235,0.8)",
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
  },
  pagerBtnDisabled: {
    opacity: 0.28,
  },
  pagerLabel: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  lightbox: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.md,
  },
  lightboxPhoto: {
    width: "100%",
    height: "70%",
  },
});

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  MY_REVIEWS_PAGE_SIZE,
  type PaginatedReviewsResponse,
  type VenueReview,
} from "@nocta/shared";
import { api, ApiError } from "../lib/api";
import { PhotoLightbox } from "./PhotoLightbox";
import { useToast } from "./ToastProvider";
import { NoctaLoading } from "./NoctaLoading";
import { ManualSearchInput } from "./ManualSearchInput";

function Stars({ rating }: { rating: number }) {
  return (
    <span className="profile-my-review-stars" aria-label={`${rating} de 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <i
          key={i}
          className={`bi ${i < rating ? "bi-star-fill" : "bi-star"}`}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

export function ProfileMyReviewsAccordion() {
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
        error instanceof ApiError ? error.message : "No se pudieron cargar las reseñas"
      );
    } finally {
      setLoading(false);
    }
  }, [submittedQuery, page, toast]);

  useEffect(() => {
    if (!open) return;
    void loadReviews();
  }, [open, loadReviews]);

  return (
    <div className="profile-gallery-accordion profile-my-reviews-accordion">
      <button
        type="button"
        className={`profile-gallery-toggle${open ? " is-open" : ""}`}
        aria-expanded={open}
        aria-controls="profile-my-reviews-panel"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="profile-gallery-toggle-copy">
          <i className="bi bi-chat-square-quote" aria-hidden="true" />
          <span>Mis reseñas</span>
          {loadedOnce && (
            <span className="text-secondary">{total}</span>
          )}
        </span>
        <i
          className={`bi ${open ? "bi-chevron-up" : "bi-chevron-down"}`}
          aria-hidden="true"
        />
      </button>

      <div
        id="profile-my-reviews-panel"
        className={`profile-gallery-panel${open ? " is-open" : ""}`}
        hidden={!open}
      >
        <ManualSearchInput
          id="profile-my-reviews-search"
          className="profile-my-reviews-search"
          placeholder="Buscar por espacio o texto…"
          ariaLabel="Buscar reseñas"
          value={query}
          onValueChange={setQuery}
          onSearch={(value) => {
            setSubmittedQuery(value);
            setPage(1);
          }}
        />

        {loading && !reviews.length ? (
          <NoctaLoading variant="inline" />
        ) : reviews.length === 0 ? (
          <p className="text-secondary small mb-0">
            {submittedQuery
              ? "No hay reseñas para esa búsqueda."
              : "Todavía no dejaste reseñas."}
          </p>
        ) : (
          <ul className="profile-my-reviews-list">
            {reviews.map((review) => (
              <li key={review.id} className="profile-my-review-item">
                <div className="profile-my-review-head">
                  {review.venuePhoto ? (
                    <img src={review.venuePhoto} alt="" />
                  ) : (
                    <span aria-hidden="true">
                      {(review.venueName ?? "E").slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0">
                    {review.venueId ? (
                      <Link
                        to={`/venues/${review.venueId}`}
                        className="profile-my-review-venue"
                      >
                        {review.venueName ?? "Espacio"}
                      </Link>
                    ) : (
                      <strong>{review.venueName ?? "Espacio"}</strong>
                    )}
                    <div className="profile-my-review-meta">
                      <Stars rating={review.rating} />
                      <time dateTime={review.createdAt}>
                        {new Date(review.createdAt).toLocaleDateString("es-UY", {
                          day: "numeric",
                          month: "short",
                        })}
                      </time>
                    </div>
                  </div>
                </div>
                {review.body && (
                  <p className="profile-my-review-body mb-0">{review.body}</p>
                )}
                {review.photos.length > 0 && (
                  <div className="profile-my-review-photos">
                    {review.photos.map((src, index) => (
                      <button
                        key={src}
                        type="button"
                        className="profile-my-review-photo"
                        aria-label={`Ver foto ${index + 1}`}
                        onClick={() =>
                          setLightbox({ photos: review.photos, index })
                        }
                      >
                        <img src={src} alt="" />
                      </button>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {totalPages > 1 && (
          <nav
            className="profile-my-reviews-pager"
            aria-label="Paginación de reseñas"
          >
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Anterior
            </button>
            <span>
              {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
            >
              Siguiente
            </button>
          </nav>
        )}
      </div>

      {lightbox && (
        <PhotoLightbox
          photos={lightbox.photos}
          startIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}

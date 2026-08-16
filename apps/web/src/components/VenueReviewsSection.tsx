import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  ALLOWED_PHOTO_EXTENSIONS,
  ALLOWED_PHOTO_MIME_TYPES,
  MAX_REVIEW_BODY_LENGTH,
  MAX_REVIEW_PHOTOS,
  MAX_VENUE_RATING,
  MIN_VENUE_RATING,
  type Venue,
  type VenueReview,
} from "@nocta/shared";
import { api, ApiError } from "../lib/api";
import { PhotoLightbox } from "./PhotoLightbox";
import { useToast } from "./ToastProvider";
import { useAuth } from "../auth/AuthContext";

type Props = {
  venueId: string;
  venue: Venue;
  onVenuePatch: (patch: Partial<Venue>) => void;
};

function StarsInput({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="venue-review-stars" role="group" aria-label="Puntaje">
      {Array.from({ length: MAX_VENUE_RATING }, (_, i) => {
        const n = i + 1;
        const active = n <= value;
        return (
          <button
            key={n}
            type="button"
            className={`venue-review-star${active ? " is-active" : ""}`}
            aria-label={`${n} estrella${n === 1 ? "" : "s"}`}
            aria-pressed={active}
            disabled={disabled}
            onClick={() => onChange(n)}
          >
            <i className={`bi ${active ? "bi-star-fill" : "bi-star"}`} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}

function StarsDisplay({ rating }: { rating: number }) {
  return (
    <span className="venue-review-stars-static" aria-label={`${rating} de 5`}>
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

export function VenueReviewsSection({
  venueId,
  venue,
  onVenuePatch,
}: Props) {
  const toast = useToast();
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [reviews, setReviews] = useState<VenueReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [lightbox, setLightbox] = useState<{
    photos: string[];
    index: number;
  } | null>(null);

  const myReview = venue.myReview;
  const [rating, setRating] = useState(myReview?.rating ?? 5);
  const [body, setBody] = useState(myReview?.body ?? "");
  const [keptPhotos, setKeptPhotos] = useState<string[]>(myReview?.photos ?? []);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  useEffect(() => {
    setRating(myReview?.rating ?? 5);
    setBody(myReview?.body ?? "");
    setKeptPhotos(myReview?.photos ?? []);
    setNewFiles([]);
    setPreviews([]);
    if (fileRef.current) fileRef.current.value = "";
  }, [myReview?.id, myReview?.updatedAt]);

  useEffect(() => {
    const urls = newFiles.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [newFiles]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void api<{
      reviews: VenueReview[];
      ratingAvg?: number;
      ratingCount?: number;
    }>(`/api/venues/${venueId}/reviews?limit=8`)
      .then((res) => {
        if (!alive) return;
        setReviews(res.reviews);
        onVenuePatch({
          ratingAvg: res.ratingAvg,
          ratingCount: res.ratingCount ?? 0,
        });
      })
      .catch(() => {
        if (alive) setReviews([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [venueId]);

  const canReview = Boolean(user && user.role === "user" && user.profileComplete);
  const photoSlotsLeft = Math.max(
    0,
    MAX_REVIEW_PHOTOS - keptPhotos.length - newFiles.length
  );

  const summaryLabel = useMemo(() => {
    const count = venue.ratingCount ?? 0;
    if (!count || !venue.ratingAvg) return "Sin reseñas todavía";
    const avg = venue.ratingAvg.toFixed(1).replace(".", ",");
    return `${avg} · ${count} ${count === 1 ? "reseña" : "reseñas"}`;
  }, [venue.ratingAvg, venue.ratingCount]);

  function onPickFiles(files: FileList | null) {
    if (!files?.length) return;
    const picked = Array.from(files);
    const allowed = picked.filter((file) => {
      const mimeOk = (ALLOWED_PHOTO_MIME_TYPES as readonly string[]).includes(
        file.type
      );
      const ext = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
      const extOk = (ALLOWED_PHOTO_EXTENSIONS as readonly string[]).includes(
        ext
      );
      return mimeOk || extOk;
    });
    if (allowed.length === 0) {
      toast.error("Elegí una imagen JPG, PNG, WebP o similar");
      return;
    }
    if (allowed.length < picked.length) {
      toast.warning("Algunos archivos no son imágenes válidas");
    }
    setNewFiles((prev) => {
      const room = Math.max(
        0,
        MAX_REVIEW_PHOTOS - keptPhotos.length - prev.length
      );
      if (room <= 0) {
        toast.warning(`Máximo ${MAX_REVIEW_PHOTOS} fotos`);
        return prev;
      }
      return [...prev, ...allowed.slice(0, room)];
    });
  }

  function removeKept(url: string) {
    setKeptPhotos((prev) => prev.filter((p) => p !== url));
  }

  function removeNew(index: number) {
    setNewFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function openComposer() {
    setShowForm(true);
    setRating(myReview?.rating ?? 5);
    setBody(myReview?.body ?? "");
    setKeptPhotos(myReview?.photos ?? []);
    setNewFiles([]);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canReview) return;
    if (rating < MIN_VENUE_RATING || rating > MAX_VENUE_RATING) {
      toast.error("Elegí un puntaje de 1 a 5");
      return;
    }

    setBusy(true);
    try {
      const form = new FormData();
      form.append("rating", String(rating));
      form.append("body", body.trim());
      form.append("existingPhotos", JSON.stringify(keptPhotos));
      newFiles.forEach((file) => {
        form.append("photos", file);
      });

      const res = await api<{ review: VenueReview }>(
        `/api/venues/${venueId}/reviews`,
        { method: "POST", body: form }
      );

      onVenuePatch({ myReview: res.review });
      setReviews((prev) => {
        const without = prev.filter((r) => r.userId !== res.review.userId);
        return [res.review, ...without];
      });
      setShowForm(false);
      toast.success(myReview ? "Reseña actualizada" : "Reseña publicada");

      // Refetch agregados
      try {
        const list = await api<{
          ratingAvg?: number;
          ratingCount?: number;
        }>(`/api/venues/${venueId}/reviews?limit=1`);
        onVenuePatch({
          ratingAvg: list.ratingAvg,
          ratingCount: list.ratingCount ?? 0,
        });
      } catch {
        /* ignore */
      }
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo guardar la reseña"
      );
    } finally {
      setBusy(false);
    }
  }

  async function removeMyReview() {
    if (!myReview) return;
    setBusy(true);
    try {
      await api(`/api/venues/${venueId}/reviews/${myReview.id}`, {
        method: "DELETE",
      });
      onVenuePatch({ myReview: undefined });
      setReviews((prev) => prev.filter((r) => r.id !== myReview.id));
      setShowForm(false);
      toast.success("Reseña eliminada");
      try {
        const list = await api<{
          ratingAvg?: number;
          ratingCount?: number;
        }>(`/api/venues/${venueId}/reviews?limit=1`);
        onVenuePatch({
          ratingAvg: list.ratingAvg,
          ratingCount: list.ratingCount ?? 0,
          myReview: undefined,
        });
      } catch {
        onVenuePatch({ ratingCount: 0, ratingAvg: undefined, myReview: undefined });
      }
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo eliminar"
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="venue-detail-section venue-reviews" aria-labelledby="venue-reviews-title">
      <div className="venue-reviews-head">
        <div>
          <h2 id="venue-reviews-title" className="venue-detail-label">
            Reseñas
          </h2>
          <p className="venue-reviews-summary mb-0">
            {venue.ratingAvg != null && (venue.ratingCount ?? 0) > 0 && (
              <StarsDisplay rating={Math.round(venue.ratingAvg)} />
            )}
            <span>{summaryLabel}</span>
          </p>
        </div>
        {canReview && !showForm && (
          <button
            type="button"
            className={`venue-review-cta${myReview ? " is-editing" : ""}`}
            onClick={openComposer}
          >
            <i
              className={`bi ${myReview ? "bi-pencil" : "bi-star"}`}
              aria-hidden="true"
            />
            <span>{myReview ? "Editar mi reseña" : "Escribir reseña"}</span>
          </button>
        )}
      </div>

      {showForm && canReview && (
        <form className="venue-review-composer" onSubmit={(e) => void submit(e)}>
          <StarsInput value={rating} onChange={setRating} disabled={busy} />
          <label className="visually-hidden" htmlFor="venue-review-body">
            Comentario
          </label>
          <textarea
            id="venue-review-body"
            className="form-control"
            rows={3}
            maxLength={MAX_REVIEW_BODY_LENGTH}
            placeholder="Contá cómo estuvo la noche (opcional)"
            value={body}
            disabled={busy}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="venue-review-photo-row">
            {[...keptPhotos.map((url) => ({ kind: "kept" as const, url })), ...previews.map((url, i) => ({ kind: "new" as const, url, i }))].map(
              (item) => (
                <div key={item.url} className="venue-review-photo-thumb">
                  <img src={item.url} alt="" />
                  <button
                    type="button"
                    className="venue-review-photo-remove"
                    aria-label="Quitar foto"
                    disabled={busy}
                    onClick={() =>
                      item.kind === "kept"
                        ? removeKept(item.url)
                        : removeNew(item.i)
                    }
                  >
                    <i className="bi bi-x" aria-hidden="true" />
                  </button>
                </div>
              )
            )}
            {photoSlotsLeft > 0 && (
              <label
                className={`venue-review-photo-add${busy ? " is-disabled" : ""}`}
                aria-disabled={busy}
              >
                <input
                  ref={fileRef}
                  type="file"
                  className="visually-hidden"
                  accept={[...ALLOWED_PHOTO_EXTENSIONS, "image/*"].join(",")}
                  multiple
                  disabled={busy}
                  onChange={(e) => {
                    onPickFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
                <i className="bi bi-camera" aria-hidden="true" />
                <span>Foto</span>
              </label>
            )}
          </div>
          <div className="venue-review-actions">
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={busy}
            >
              {busy ? "Guardando…" : myReview ? "Guardar cambios" : "Publicar"}
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              disabled={busy}
              onClick={() => setShowForm(false)}
            >
              Cancelar
            </button>
            {myReview && (
              <button
                type="button"
                className="btn btn-link btn-sm text-danger text-decoration-none"
                disabled={busy}
                onClick={() => void removeMyReview()}
              >
                Eliminar
              </button>
            )}
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-secondary small mb-0">Cargando reseñas…</p>
      ) : reviews.length === 0 ? (
        <p className="text-secondary small mb-0">
          Sé el primero en reseñar este Espacio.
        </p>
      ) : (
        <ul className="venue-reviews-list">
          {reviews.map((review) => (
            <li key={review.id} className="venue-review-item">
              <div className="venue-review-item-top">
                <div className="venue-review-author">
                  {review.author?.photo ? (
                    <img src={review.author.photo} alt="" />
                  ) : (
                    <span>
                      {(review.author?.name ?? "?").slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0">
                    <strong>{review.author?.name ?? "Usuario"}</strong>
                    <StarsDisplay rating={review.rating} />
                  </div>
                </div>
                <time
                  className="venue-review-date text-secondary"
                  dateTime={review.createdAt}
                >
                  {new Date(review.createdAt).toLocaleDateString("es-UY", {
                    day: "numeric",
                    month: "short",
                  })}
                </time>
              </div>
              {review.body && (
                <p className="venue-review-item-body mb-0">{review.body}</p>
              )}
              {review.photos.length > 0 && (
                <div className="venue-review-item-photos">
                  {review.photos.map((src, index) => (
                    <button
                      key={src}
                      type="button"
                      className="venue-review-item-photo"
                      aria-label={`Ver foto ${index + 1} de ${review.photos.length}`}
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
      {lightbox && (
        <PhotoLightbox
          photos={lightbox.photos}
          startIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}
    </section>
  );
}

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  photos: string[];
  startIndex?: number;
  onClose: () => void;
};

export function PhotoLightbox({
  photos,
  startIndex = 0,
  onClose,
}: Props) {
  const [index, setIndex] = useState(() =>
    Math.min(Math.max(0, startIndex), Math.max(0, photos.length - 1))
  );

  useEffect(() => {
    setIndex(Math.min(Math.max(0, startIndex), Math.max(0, photos.length - 1)));
  }, [startIndex, photos.length]);

  useEffect(() => {
    if (photos.length === 0) {
      onClose();
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key === "ArrowRight" && photos.length > 1) {
        setIndex((current) => (current + 1) % photos.length);
      }
      if (event.key === "ArrowLeft" && photos.length > 1) {
        setIndex((current) => (current - 1 + photos.length) % photos.length);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose, photos.length]);

  if (photos.length === 0 || typeof document === "undefined") return null;

  const src = photos[index] ?? photos[0];
  const hasMany = photos.length > 1;

  return createPortal(
    <div
      className="photo-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Galería de fotos"
    >
      <button
        type="button"
        className="photo-lightbox-backdrop"
        aria-label="Cerrar galería"
        onClick={onClose}
      />

      <div className="photo-lightbox-stage">
        <button
          type="button"
          className="photo-lightbox-close"
          aria-label="Cerrar"
          onClick={onClose}
        >
          <i className="bi bi-x-lg" aria-hidden="true" />
        </button>

        {hasMany && (
          <button
            type="button"
            className="photo-lightbox-nav is-prev"
            aria-label="Foto anterior"
            onClick={() =>
              setIndex((current) => (current - 1 + photos.length) % photos.length)
            }
          >
            <i className="bi bi-chevron-left" aria-hidden="true" />
          </button>
        )}

        <img src={src} alt="" className="photo-lightbox-image" />

        {hasMany && (
          <button
            type="button"
            className="photo-lightbox-nav is-next"
            aria-label="Foto siguiente"
            onClick={() =>
              setIndex((current) => (current + 1) % photos.length)
            }
          >
            <i className="bi bi-chevron-right" aria-hidden="true" />
          </button>
        )}

        {hasMany && (
          <p className="photo-lightbox-counter" aria-live="polite">
            {index + 1} / {photos.length}
          </p>
        )}
      </div>
    </div>,
    document.body
  );
}

import { useEffect, useState } from "react";
import type { ImageVariant } from "./optimizedImage";

/** Variantes permitidas en la card compacta de Discover (sin large). */
export const DISCOVER_SWIPE_VARIANTS = ["thumb", "medium"] as const;

export const DISCOVER_SWIPE_SIZES =
  "(max-width: 767px) 100vw, (max-width: 991px) 70vw, 430px";

export const DISCOVER_DETAIL_SIZES =
  "(max-width: 767px) 100vw, (max-width: 991px) 70vw, 540px";

/**
 * thumb en viewports angostos; medium cuando el layout es más ancho.
 * No fuerza large en el deck (ahorro de bandwidth).
 */
export function discoverSwipePreferredVariant(
  viewportWidth: number
): ImageVariant {
  return viewportWidth <= 480 ? "thumb" : "medium";
}

/** Detalle ampliado: medium en mobile; large en tablet/desktop. */
export function discoverDetailPreferredVariant(
  viewportWidth: number
): ImageVariant {
  return viewportWidth < 768 ? "medium" : "large";
}

export function useDiscoverSwipePhotoVariant(): ImageVariant {
  const [variant, setVariant] = useState<ImageVariant>(() =>
    typeof window === "undefined"
      ? "medium"
      : discoverSwipePreferredVariant(window.innerWidth)
  );

  useEffect(() => {
    function sync() {
      setVariant(discoverSwipePreferredVariant(window.innerWidth));
    }
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  return variant;
}

export function useDiscoverDetailPhotoVariant(): ImageVariant {
  const [variant, setVariant] = useState<ImageVariant>(() =>
    typeof window === "undefined"
      ? "medium"
      : discoverDetailPreferredVariant(window.innerWidth)
  );

  useEffect(() => {
    function sync() {
      setVariant(discoverDetailPreferredVariant(window.innerWidth));
    }
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  return variant;
}

/**
 * Solo la 1.ª foto del perfil actual + opcionalmente la 1.ª del siguiente.
 * Nunca el álbum completo.
 */
export function discoverVisiblePhotoPlan(opts: {
  currentPhotos: string[];
  photoIndex: number;
  nextPrimaryPhoto?: string | null;
  detailOpen: boolean;
}): { renderSrc: string | undefined; preloadNext: string | undefined } {
  const photos = opts.currentPhotos.filter(Boolean);
  const renderSrc =
    photos[opts.photoIndex] ?? photos[0] ?? undefined;
  const preloadNext =
    !opts.detailOpen && opts.nextPrimaryPhoto
      ? opts.nextPrimaryPhoto
      : undefined;
  return { renderSrc, preloadNext };
}

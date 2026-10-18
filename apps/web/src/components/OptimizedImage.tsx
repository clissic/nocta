import {
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
  type SyntheticEvent,
} from "react";
import {
  imageCacheKey,
  isCacheableImageUrl,
  loadImageCache,
  readMemoryImageCache,
} from "../lib/imageCache";
import {
  DEFAULT_IMAGE_FALLBACK,
  OPTIMIZED_IMAGE_DEFAULTS,
  planOptimizedSource,
  type ImageVariant,
} from "../lib/optimizedImage";

export type OptimizedImageProps = {
  src?: string | null;
  alt: string;
  /** Variante preferida del <img> interno (default medium). */
  variant?: ImageVariant;
  /** Limita el srcset (p. ej. Discover swipe: thumb+medium). */
  variants?: readonly ImageVariant[];
  sizes?: string;
  className?: string;
  style?: CSSProperties;
  loading?: "lazy" | "eager";
  decoding?: "async" | "auto" | "sync";
  fetchPriority?: "high" | "low" | "auto";
  draggable?: boolean;
  /** Si falla la fuente principal. */
  fallbackSrc?: string;
  /** Contenido si no hay src (slot vacío). */
  placeholder?: ReactNode;
  onError?: (event: SyntheticEvent<HTMLImageElement>) => void;
  onLoad?: (event: SyntheticEvent<HTMLImageElement>) => void;
};

/**
 * Único componente de entrega para imágenes PUBLIC de producto.
 * Managed (Object Storage): <picture> AVIF → WebP + srcset.
 * Legacy `/uploads`, estáticas `/images`, blob/data: <img> simple.
 * `/api/media`, `/uploads` y `/images` se guardan en Cache API (clave estable).
 * NO usar para identity_verification / privados.
 */
export function OptimizedImage({
  src,
  alt,
  variant = OPTIMIZED_IMAGE_DEFAULTS.variant,
  variants,
  sizes = OPTIMIZED_IMAGE_DEFAULTS.sizes,
  className,
  style,
  loading = OPTIMIZED_IMAGE_DEFAULTS.loading,
  decoding = OPTIMIZED_IMAGE_DEFAULTS.decoding,
  fetchPriority,
  draggable,
  fallbackSrc,
  placeholder,
  onError,
  onLoad,
}: OptimizedImageProps) {
  const plan = planOptimizedSource(src, { preferred: variant, variants });
  const [failed, setFailed] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  const [cachedFor, setCachedFor] = useState("");
  const [cachedSrc, setCachedSrc] = useState<string | null>(null);

  const networkSrc = !plan
    ? ""
    : useFallback && fallbackSrc
      ? fallbackSrc
      : failed
        ? fallbackSrc ?? DEFAULT_IMAGE_FALLBACK
        : plan.imgSrc;
  const cacheable = Boolean(networkSrc && isCacheableImageUrl(networkSrc));
  const cacheKey = cacheable ? imageCacheKey(networkSrc) : "";
  const memorySrc = cacheKey ? readMemoryImageCache(cacheKey) : null;
  const displaySrc = !networkSrc
    ? null
    : !cacheable
      ? networkSrc
      : memorySrc
        ? memorySrc
        : cachedFor === cacheKey
          ? cachedSrc
          : null;

  useEffect(() => {
    setFailed(false);
    setUseFallback(false);
  }, [src, variant, variants]);

  useEffect(() => {
    if (!networkSrc || !cacheable || readMemoryImageCache(cacheKey)) return;
    let cancel = false;
    void loadImageCache(networkSrc, cacheKey).then((url) => {
      if (cancel) return;
      setCachedSrc(url);
      setCachedFor(cacheKey);
    });
    return () => {
      cancel = true;
    };
  }, [networkSrc, cacheable, cacheKey]);

  if (!plan) {
    if (placeholder) return <>{placeholder}</>;
    return null;
  }

  if (!displaySrc) {
    if (placeholder) return <>{placeholder}</>;
    return <span className={className} style={style} aria-hidden="true" />;
  }

  const activeSrc = displaySrc;

  function handleError(event: SyntheticEvent<HTMLImageElement>) {
    if (!useFallback && fallbackSrc && activeSrc !== fallbackSrc) {
      setUseFallback(true);
      onError?.(event);
      return;
    }
    if (!failed) {
      setFailed(true);
      onError?.(event);
      return;
    }
    onError?.(event);
  }

  const imgProps = {
    alt,
    className,
    style,
    loading,
    decoding,
    draggable,
    fetchPriority,
    onError: handleError,
    onLoad,
  };

  // Cache local o sin srcset: un solo <img>. CDN pública sigue en <picture>.
  if (failed || useFallback || cacheable || plan.kind === "img") {
    return <img src={activeSrc} {...imgProps} />;
  }

  return (
    <picture style={{ display: "contents" }}>
      <source type="image/avif" srcSet={plan.avifSrcSet} sizes={sizes} />
      <source type="image/webp" srcSet={plan.webpSrcSet} sizes={sizes} />
      <img
        src={plan.imgSrc}
        srcSet={plan.webpSrcSet}
        sizes={sizes}
        {...imgProps}
      />
    </picture>
  );
}

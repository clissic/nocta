import { apiUrl, mediaUrl } from "./api";

export type ImageVariant = "thumb" | "medium" | "large";
export type ImageFormat = "webp" | "avif";

/** Anchos del pipeline Sharp (variants_v1). */
export const VARIANT_WIDTHS: Record<ImageVariant, number> = {
  thumb: 320,
  medium: 640,
  large: 1080,
};

const VARIANT_FILE_RE =
  /\/([a-zA-Z0-9_-]{8,128})\/(thumb|medium|large)\.(webp|avif)(?:\?|$)/i;

const MEDIA_PATH_RE = /\/api\/media\/([a-zA-Z0-9_-]{8,128})(?:\?|$)/i;

export type OptimizedSourceKind =
  | "managed"
  | "legacy_upload"
  | "static"
  | "blob"
  | "external";

export type PicturePlan =
  | {
      kind: "picture";
      imageId: string;
      /** Preferido para el <img> interno. */
      imgSrc: string;
      avifSrcSet: string;
      webpSrcSet: string;
    }
  | {
      kind: "img";
      imgSrc: string;
      sourceKind: OptimizedSourceKind;
    };

function stripQuery(url: string): string {
  const q = url.indexOf("?");
  return q >= 0 ? url.slice(0, q) : url;
}

/** True si la URL parece firmada (no reescribible en el cliente). */
export function looksSignedUrl(url: string): boolean {
  if (!url.includes("?")) return false;
  return /[?&](X-Amz-|Signature=|token=|Expires=|AWSAccessKeyId=)/i.test(url);
}

/**
 * Extrae imageId de refs `/api/media/{id}` o paths Storage
 * `.../{imageId}/(thumb|medium|large).(webp|avif)`.
 */
export function extractManagedImageId(src: string): string | null {
  const trimmed = src.trim();
  if (!trimmed) return null;

  const media = trimmed.match(MEDIA_PATH_RE);
  if (media?.[1]) return media[1];

  try {
    const path = /^https?:\/\//i.test(trimmed)
      ? new URL(trimmed).pathname
      : stripQuery(trimmed);
    const hit = path.match(VARIANT_FILE_RE);
    if (hit?.[1]) return hit[1];
  } catch {
    /* ignore */
  }

  const loose = stripQuery(trimmed).match(VARIANT_FILE_RE);
  return loose?.[1] ?? null;
}

export function classifyImageSrc(src: string): OptimizedSourceKind {
  const v = src.trim();
  if (!v) return "external";
  if (v.startsWith("blob:") || v.startsWith("data:")) return "blob";
  if (v.startsWith("/uploads/") || v.includes("/uploads/")) return "legacy_upload";
  if (v.startsWith("/images/")) return "static";
  if (extractManagedImageId(v)) return "managed";
  return "external";
}

/** URL de variante vía redirect 302 (cada key se firma en el API). */
export function mediaVariantUrl(
  imageId: string,
  variant: ImageVariant,
  format: ImageFormat
): string {
  return apiUrl(`/api/media/${imageId}?v=${variant}&f=${format}`);
}

export function buildVariantSrcSet(
  imageId: string,
  format: ImageFormat,
  variants: readonly ImageVariant[] = ["thumb", "medium", "large"]
): string {
  return variants
    .map((variant) => `${mediaVariantUrl(imageId, variant, format)} ${VARIANT_WIDTHS[variant]}w`)
    .join(", ");
}

/**
 * Si la base es CDN pública (sin firma), reescribe el filename en el path.
 * Si no, deja que `mediaVariantUrl` firme vía API.
 */
export function rewritePublicVariantUrl(
  baseUrl: string,
  variant: ImageVariant,
  format: ImageFormat
): string | null {
  if (looksSignedUrl(baseUrl)) return null;
  try {
    const absolute = /^https?:\/\//i.test(baseUrl)
      ? new URL(baseUrl)
      : null;
    const path = absolute ? absolute.pathname : stripQuery(baseUrl);
    if (!/\/(thumb|medium|large)\.(webp|avif)$/i.test(path)) return null;
    const nextPath = path.replace(
      /\/(thumb|medium|large)\.(webp|avif)$/i,
      `/${variant}.${format}`
    );
    if (absolute) {
      absolute.pathname = nextPath;
      absolute.search = "";
      return absolute.toString();
    }
    return nextPath;
  } catch {
    return null;
  }
}

export function buildPublicCdnSrcSet(
  baseUrl: string,
  format: ImageFormat,
  variants: readonly ImageVariant[] = ["thumb", "medium", "large"]
): string | null {
  const parts: string[] = [];
  for (const variant of variants) {
    const url = rewritePublicVariantUrl(baseUrl, variant, format);
    if (!url) return null;
    parts.push(`${url} ${VARIANT_WIDTHS[variant]}w`);
  }
  return parts.join(", ");
}

export type PlanOptimizedOptions = {
  preferred?: ImageVariant;
  /** Subconjunto de variantes en srcset (p. ej. swipe: thumb+medium). */
  variants?: readonly ImageVariant[];
};

/**
 * Plan de entrega para OptimizedImage.
 * Managed → <picture> AVIF/WebP + srcset; legacy/static/blob → <img> simple.
 */
export function planOptimizedSource(
  rawSrc: string | null | undefined,
  preferredOrOpts: ImageVariant | PlanOptimizedOptions = "medium"
): PicturePlan | null {
  const opts: PlanOptimizedOptions =
    typeof preferredOrOpts === "string"
      ? { preferred: preferredOrOpts }
      : preferredOrOpts;
  const preferred = opts.preferred ?? "medium";
  const variants = opts.variants ?? (["thumb", "medium", "large"] as const);

  if (!rawSrc?.trim()) return null;
  const src = rawSrc.trim();
  const kind = classifyImageSrc(src);

  if (kind === "managed") {
    const imageId = extractManagedImageId(src)!;
    const resolved = mediaUrl(src);
    const cdnAvif = buildPublicCdnSrcSet(resolved, "avif", variants);
    const cdnWebp = buildPublicCdnSrcSet(resolved, "webp", variants);
    const useCdn = Boolean(cdnAvif && cdnWebp && !looksSignedUrl(resolved));

    const preferredUrl =
      (useCdn ? rewritePublicVariantUrl(resolved, preferred, "webp") : null) ??
      mediaVariantUrl(imageId, preferred, "webp");

    return {
      kind: "picture",
      imageId,
      imgSrc: preferredUrl,
      avifSrcSet: useCdn
        ? cdnAvif!
        : buildVariantSrcSet(imageId, "avif", variants),
      webpSrcSet: useCdn
        ? cdnWebp!
        : buildVariantSrcSet(imageId, "webp", variants),
    };
  }

  return {
    kind: "img",
    imgSrc: mediaUrl(src),
    sourceKind: kind,
  };
}

export const OPTIMIZED_IMAGE_DEFAULTS = {
  loading: "lazy" as const,
  decoding: "async" as const,
  variant: "medium" as const,
  sizes: "100vw",
};

export const DEFAULT_IMAGE_FALLBACK =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect fill="%231a1a1c" width="80" height="80"/><path fill="%23555" d="M20 52l12-14 10 10 8-8 10 12H20z"/><circle fill="%23555" cx="30" cy="28" r="6"/></svg>`
  );

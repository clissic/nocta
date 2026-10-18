/** Fotos de catálogo: Vite / API sirven `apps/web/public/images/venues`. */

/** Placeholder cuando falta el asset de catálogo (solo ~20 portadas en disco). */
export const VENUE_PHOTO_FALLBACK =
  "https://images.unsplash.com/photo-1571266028247-e6734c9d1d0c?w=1200";

export function venuePhotoFilename(name: string): string {
  const words = name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1));
  return `${words.join("")}Img.webp`;
}

export function venuePhotoUrl(name: string): string {
  return `/images/venues/${venuePhotoFilename(name)}`;
}

/** Portada: subida del organizador, URL gestionada/CDN, o asset derivado del nombre. */
export function venueCoverSrc(venue: { name: string; photos?: string[] }): string {
  const uploaded = venue.photos?.find(
    (photo) =>
      photo.startsWith("/uploads/") ||
      photo.startsWith("/api/media/") ||
      photo.includes("/api/media/") ||
      // Fase 3+: delivery directa Object Storage (CDN o firmada)
      /\/(thumb|medium|large)\.(webp|avif)(\?|$)/i.test(photo) ||
      (/^https?:\/\//i.test(photo) &&
        (photo.includes("/public/") || photo.includes("X-Amz-")))
  );
  if (uploaded) return uploaded;
  const stored = venue.photos?.find(Boolean);
  if (stored) return stored;
  return venuePhotoUrl(venue.name);
}

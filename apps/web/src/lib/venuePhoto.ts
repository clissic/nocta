import type { SyntheticEvent } from "react";
import { venueCoverSrc } from "@nocta/shared";

export { venueCoverSrc };

export const VENUE_PHOTO_FALLBACK =
  "https://images.unsplash.com/photo-1571266028247-e6734c9d1d0c?w=1200";

export function onVenuePhotoError(event: SyntheticEvent<HTMLImageElement>) {
  const img = event.currentTarget;
  if (img.dataset.fallbackApplied) return;
  img.dataset.fallbackApplied = "1";
  img.src = VENUE_PHOTO_FALLBACK;
}

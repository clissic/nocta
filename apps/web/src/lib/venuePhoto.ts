import type { SyntheticEvent } from "react";
import { VENUE_PHOTO_FALLBACK, venueCoverSrc } from "@nocta/shared";

export { venueCoverSrc, VENUE_PHOTO_FALLBACK };

export function onVenuePhotoError(event: SyntheticEvent<HTMLImageElement>) {
  const img = event.currentTarget;
  if (img.dataset.fallbackApplied) return;
  img.dataset.fallbackApplied = "1";
  img.src = VENUE_PHOTO_FALLBACK;
}

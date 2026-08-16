import { Venue } from "../models/Venue.js";
import { VenueReview } from "../models/VenueReview.js";

/** Recalcula ratingAvg / ratingCount de un Espacio a partir de reseñas activas. */
export async function recomputeVenueRatings(venueId: string | { toString(): string }) {
  const id = typeof venueId === "string" ? venueId : venueId.toString();
  const rows = await VenueReview.find({ venueId: id, active: true }).select(
    "rating"
  );
  const ratingCount = rows.length;
  const ratingAvg =
    ratingCount === 0
      ? 0
      : Math.round(
          (rows.reduce((sum, r) => sum + (r.rating ?? 0), 0) / ratingCount) * 10
        ) / 10;

  await Venue.findByIdAndUpdate(id, { ratingAvg, ratingCount });
  return { ratingAvg, ratingCount };
}

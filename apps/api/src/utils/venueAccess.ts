import type { AuthedRequest } from "../middleware/auth.js";
import type { VenueDocument } from "../models/Venue.js";

/** Admin o organizador asignado del espacio. */
export function canManageVenue(req: AuthedRequest, venue: VenueDocument) {
  if (req.user?.role === "admin") return true;
  if (!req.user || !venue.ownerId) return false;
  return venue.ownerId.toString() === req.user._id.toString();
}


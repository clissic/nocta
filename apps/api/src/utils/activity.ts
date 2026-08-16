import type { ActivityType } from "@nocta/shared";
import { ActivityEvent } from "../models/ActivityEvent.js";

type RecordActivityInput = {
  actorId: string;
  type: ActivityType;
  venueId?: string;
  reviewId?: string;
  postId?: string;
  payload?: Record<string, unknown>;
};

export async function recordActivity(input: RecordActivityInput) {
  return ActivityEvent.create({
    actorId: input.actorId,
    type: input.type,
    venueId: input.venueId,
    reviewId: input.reviewId,
    postId: input.postId,
    payload: input.payload ?? {},
    active: true,
  });
}

/** Soft-delete eventos ligados a una reseña (p.ej. al borrar la reseña). */
export async function deactivateReviewActivity(reviewId: string) {
  await ActivityEvent.updateMany(
    { reviewId },
    { $set: { active: false } }
  );
}

/** Soft-delete eventos ligados a una publicación del Muro. */
export async function deactivatePostActivity(postId: string) {
  await ActivityEvent.updateMany(
    { postId },
    { $set: { active: false } }
  );
}

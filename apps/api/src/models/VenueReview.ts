import mongoose, { Schema, type HydratedDocument, type InferSchemaType } from "mongoose";
import {
  MAX_REVIEW_BODY_LENGTH,
  MAX_REVIEW_PHOTOS,
  MAX_VENUE_RATING,
  MIN_VENUE_RATING,
} from "@nocta/shared";

const venueReviewSchema = new Schema(
  {
    venueId: {
      type: Schema.Types.ObjectId,
      ref: "Venue",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    rating: {
      type: Number,
      required: true,
      min: MIN_VENUE_RATING,
      max: MAX_VENUE_RATING,
    },
    body: { type: String, maxlength: MAX_REVIEW_BODY_LENGTH, trim: true },
    photos: {
      type: [String],
      default: [],
      validate: [
        (v: string[]) => v.length <= MAX_REVIEW_PHOTOS,
        `Máximo ${MAX_REVIEW_PHOTOS} fotos`,
      ],
    },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

venueReviewSchema.index({ userId: 1, venueId: 1 }, { unique: true });
venueReviewSchema.index({ venueId: 1, active: 1, createdAt: -1 });

export type VenueReviewDocument = HydratedDocument<
  InferSchemaType<typeof venueReviewSchema>
>;

export const VenueReview = mongoose.model("VenueReview", venueReviewSchema);

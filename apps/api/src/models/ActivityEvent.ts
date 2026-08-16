import mongoose, { Schema, type HydratedDocument, type InferSchemaType } from "mongoose";
import { ACTIVITY_TYPES } from "@nocta/shared";

const activityEventSchema = new Schema(
  {
    actorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ACTIVITY_TYPES,
      required: true,
      index: true,
    },
    venueId: {
      type: Schema.Types.ObjectId,
      ref: "Venue",
      index: true,
    },
    reviewId: {
      type: Schema.Types.ObjectId,
      ref: "VenueReview",
      index: true,
    },
    postId: {
      type: Schema.Types.ObjectId,
      ref: "UserPost",
      index: true,
    },
    payload: {
      type: Schema.Types.Mixed,
      default: {},
    },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

activityEventSchema.index({ createdAt: -1, active: 1 });
activityEventSchema.index({ actorId: 1, createdAt: -1 });

export type ActivityEventDocument = HydratedDocument<
  InferSchemaType<typeof activityEventSchema>
>;

export const ActivityEvent = mongoose.model(
  "ActivityEvent",
  activityEventSchema
);

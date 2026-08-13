import mongoose, { Schema, type InferSchemaType } from "mongoose";

const swipeSchema = new Schema(
  {
    fromUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    toUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    venueId: {
      type: Schema.Types.ObjectId,
      ref: "Venue",
      required: true,
      index: true,
    },
    direction: { type: String, enum: ["like", "pass"], required: true },
  },
  { timestamps: true }
);

swipeSchema.index(
  { fromUserId: 1, toUserId: 1, venueId: 1 },
  { unique: true }
);

export type SwipeDocument = InferSchemaType<typeof swipeSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Swipe = mongoose.model("Swipe", swipeSchema);

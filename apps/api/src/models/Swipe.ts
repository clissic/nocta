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
    /** Like especial 4 AM: revela identidad al destinatario. */
    isHeartshot: { type: Boolean, default: false },
  },
  { timestamps: true }
);

swipeSchema.index(
  { fromUserId: 1, toUserId: 1, venueId: 1 },
  { unique: true }
);
/** Deck / rewind: swipes del viewer en un espacio. */
swipeSchema.index({ fromUserId: 1, venueId: 1, createdAt: -1 });
/** Likes recibidos. */
swipeSchema.index({ toUserId: 1, direction: 1, createdAt: -1 });

export type SwipeDocument = InferSchemaType<typeof swipeSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const Swipe = mongoose.model("Swipe", swipeSchema);

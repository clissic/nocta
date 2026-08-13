import mongoose, { Schema, type HydratedDocument, type InferSchemaType } from "mongoose";

const presenceSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    venueId: {
      type: Schema.Types.ObjectId,
      ref: "Venue",
      required: true,
      index: true,
    },
    startsAt: { type: Date, required: true, default: Date.now },
    endsAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ["active", "expired", "revoked"],
      default: "active",
      index: true,
    },
  },
  { timestamps: true }
);

presenceSchema.index({ userId: 1, status: 1 });
presenceSchema.index({ venueId: 1, status: 1 });

export type PresenceDocument = HydratedDocument<
  InferSchemaType<typeof presenceSchema>
>;

export const Presence = mongoose.model("Presence", presenceSchema);

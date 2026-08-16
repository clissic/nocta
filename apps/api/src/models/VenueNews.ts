import mongoose, { Schema, type HydratedDocument, type InferSchemaType } from "mongoose";

const venueNewsSchema = new Schema(
  {
    venueId: {
      type: Schema.Types.ObjectId,
      ref: "Venue",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    body: { type: String, required: true, maxlength: 4000 },
    photos: { type: [String], default: [] },
    publishedAt: { type: Date, default: () => new Date() },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

venueNewsSchema.index({ venueId: 1, publishedAt: -1 });
venueNewsSchema.index({ active: 1, publishedAt: -1 });

export type VenueNewsDocument = HydratedDocument<
  InferSchemaType<typeof venueNewsSchema>
>;

export const VenueNews = mongoose.model("VenueNews", venueNewsSchema);

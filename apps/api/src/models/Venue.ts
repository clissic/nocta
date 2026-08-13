import mongoose, { Schema, type HydratedDocument, type InferSchemaType } from "mongoose";
import { VENUE_TYPES } from "@nocta/shared";

const venueSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: VENUE_TYPES, required: true },
    address: { type: String, required: true },
    city: { type: String, required: true, default: "Buenos Aires" },
    description: { type: String, maxlength: 1000 },
    photos: { type: [String], default: [] },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export type VenueDocument = HydratedDocument<InferSchemaType<typeof venueSchema>>;

export const Venue = mongoose.model("Venue", venueSchema);

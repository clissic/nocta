import mongoose, { Schema, type HydratedDocument, type InferSchemaType } from "mongoose";
import { VENUE_TYPES } from "@nocta/shared";

const locationSchema = new Schema(
  {
    lat: { type: Number, required: true, min: -90, max: 90 },
    lng: { type: Number, required: true, min: -180, max: 180 },
  },
  { _id: false }
);

const venueSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: VENUE_TYPES, required: true },
    address: { type: String, required: true },
    city: { type: String, required: true, default: "Buenos Aires" },
    description: { type: String, maxlength: 1000 },
    photos: { type: [String], default: [] },
    location: { type: locationSchema, default: undefined },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

venueSchema.index({ "location.lat": 1, "location.lng": 1 });

export type VenueDocument = HydratedDocument<InferSchemaType<typeof venueSchema>>;

export const Venue = mongoose.model("Venue", venueSchema);

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
    city: { type: String, required: true, default: "Montevideo" },
    description: { type: String, maxlength: 1000 },
    photos: { type: [String], default: [] },
    location: { type: locationSchema, default: undefined },
    /** Organizador del espacio (usuario). No es un rol: un user puede tener varios. */
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
      default: undefined,
    },
    followersCount: { type: Number, default: 0, min: 0 },
    /** Promedio de reseñas activas (1–5). */
    ratingAvg: { type: Number, default: 0, min: 0, max: 5 },
    /** Cantidad de reseñas activas. */
    ratingCount: { type: Number, default: 0, min: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

venueSchema.index({ "location.lat": 1, "location.lng": 1 });
venueSchema.index({ ownerId: 1, active: 1 });

export type VenueDocument = HydratedDocument<InferSchemaType<typeof venueSchema>>;

export const Venue = mongoose.model("Venue", venueSchema);


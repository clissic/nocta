import mongoose, { Schema, type HydratedDocument, type InferSchemaType } from "mongoose";
import { VENUE_REQUEST_STATUSES, VENUE_TYPES } from "@nocta/shared";

const venueRequestSchema = new Schema(
  {
    requesterId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    type: { type: String, enum: VENUE_TYPES, required: true },
    /** Dirección pública / para mostrar. */
    address: { type: String, required: true },
    city: { type: String, required: true, default: "Montevideo" },
    description: { type: String, maxlength: 1000 },
    photos: { type: [String], default: [] },
    contactEmail: { type: String, trim: true, lowercase: true },
    contactPhone: { type: String, trim: true, maxlength: 40 },
    location: {
      lat: { type: Number },
      lng: { type: Number },
    },
    geocodedAddress: { type: String, trim: true, maxlength: 300 },
    status: {
      type: String,
      enum: VENUE_REQUEST_STATUSES,
      default: "pending",
      index: true,
    },
    adminNote: { type: String, maxlength: 500 },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    venueId: { type: Schema.Types.ObjectId, ref: "Venue" },
  },
  { timestamps: true }
);

venueRequestSchema.index({ requesterId: 1, status: 1 });
venueRequestSchema.index({ status: 1, createdAt: -1 });

export type VenueRequestDocument = HydratedDocument<
  InferSchemaType<typeof venueRequestSchema>
>;

export const VenueRequest = mongoose.model("VenueRequest", venueRequestSchema);

import mongoose, { Schema, type HydratedDocument, type InferSchemaType } from "mongoose";
import {
  VENUE_REQUEST_STATUSES,
  VENUE_REQUEST_TYPES,
  VENUE_TYPES,
} from "@nocta/shared";

const evidenceFileSchema = new Schema(
  {
    id: { type: String, required: true },
    filename: { type: String, required: true },
    originalName: { type: String, required: true, maxlength: 255 },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
  },
  { _id: false }
);

const venueRequestSchema = new Schema(
  {
    requesterId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    requestType: {
      type: String,
      enum: VENUE_REQUEST_TYPES,
      required: true,
      default: "create",
      index: true,
    },
    targetVenueId: {
      type: Schema.Types.ObjectId,
      ref: "Venue",
      index: true,
    },
    /** Compatibilidad: las altas previas siempre asignaban al solicitante. */
    wantsToManage: { type: Boolean, required: true, default: true },
    managementMessage: { type: String, maxlength: 1000 },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    type: { type: String, enum: VENUE_TYPES, required: true },
    /** Dirección pública / para mostrar. */
    address: { type: String, required: true },
    country: { type: String, required: true, default: "Uruguay" },
    city: { type: String, required: true, default: "Montevideo" },
    description: { type: String, maxlength: 1000 },
    photos: { type: [String], default: [] },
    evidenceFiles: { type: [evidenceFileSchema], default: [] },
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
venueRequestSchema.index({
  requesterId: 1,
  targetVenueId: 1,
  requestType: 1,
  status: 1,
});
venueRequestSchema.index(
  { requesterId: 1, targetVenueId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      requestType: "claim",
      status: "pending",
      targetVenueId: { $exists: true },
    },
  }
);

export type VenueRequestDocument = HydratedDocument<
  InferSchemaType<typeof venueRequestSchema>
>;

export const VenueRequest = mongoose.model("VenueRequest", venueRequestSchema);

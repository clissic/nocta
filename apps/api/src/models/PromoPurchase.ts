import mongoose, { Schema, type HydratedDocument, type InferSchemaType } from "mongoose";
import { PROMO_PURCHASE_STATUSES } from "@nocta/shared";

const promoPurchaseSchema = new Schema(
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
    promotionId: {
      type: Schema.Types.ObjectId,
      ref: "Promotion",
      required: true,
      index: true,
    },
    /** Código único embebido en el QR. */
    code: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    priceUyu: { type: Number, min: 0 },
    status: {
      type: String,
      enum: PROMO_PURCHASE_STATUSES,
      default: "valid",
      index: true,
    },
    purchasedAt: { type: Date, default: Date.now },
    validUntil: { type: Date },
    redeemedAt: { type: Date },
  },
  { timestamps: true }
);

promoPurchaseSchema.index({ userId: 1, purchasedAt: -1 });

export type PromoPurchaseDocument = HydratedDocument<
  InferSchemaType<typeof promoPurchaseSchema>
>;

export const PromoPurchase = mongoose.model(
  "PromoPurchase",
  promoPurchaseSchema
);

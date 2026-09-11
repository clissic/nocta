import mongoose, { Schema, type HydratedDocument, type InferSchemaType } from "mongoose";
import {
  PREMIUM_PERIOD_MONTHS,
  PREMIUM_PLAN_IDS,
  PREMIUM_PURCHASE_STATUSES,
} from "@nocta/shared";

const premiumPurchaseSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    planId: {
      type: String,
      enum: PREMIUM_PLAN_IDS,
      required: true,
      index: true,
    },
    periodMonths: {
      type: Number,
      enum: [...PREMIUM_PERIOD_MONTHS],
      required: true,
    },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: "USD", maxlength: 8 },
    /** Preferencia one-shot (legado) o vacío si es suscripción. */
    mpPreferenceId: { type: String, index: true },
    /** ID de PreApproval / suscripción Mercado Pago. */
    mpPreapprovalId: { type: String, index: true },
    mpPaymentId: { type: String, index: true },
    status: {
      type: String,
      enum: PREMIUM_PURCHASE_STATUSES,
      default: "pending",
      index: true,
    },
    /** Cobro recurrente vs alta de suscripción pendiente. */
    kind: {
      type: String,
      enum: ["subscription", "charge"],
      default: "charge",
    },
    startsAt: { type: Date },
    endsAt: { type: Date },
  },
  { timestamps: true }
);

premiumPurchaseSchema.index({ userId: 1, createdAt: -1 });
premiumPurchaseSchema.index({ status: 1, createdAt: -1 });
premiumPurchaseSchema.index(
  { mpPaymentId: 1 },
  { unique: true, sparse: true }
);

export type PremiumPurchaseDocument = HydratedDocument<
  InferSchemaType<typeof premiumPurchaseSchema>
>;

export const PremiumPurchase = mongoose.model(
  "PremiumPurchase",
  premiumPurchaseSchema
);

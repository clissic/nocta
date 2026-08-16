import mongoose, { Schema, type HydratedDocument, type InferSchemaType } from "mongoose";

const promotionSchema = new Schema(
  {
    venueId: {
      type: Schema.Types.ObjectId,
      ref: "Venue",
      required: true,
      index: true,
    },
    title: { type: String, required: true },
    description: { type: String, required: true },
    /** Precio en UYU (pesos uruguayos). */
    priceUyu: { type: Number, min: 0 },
    /** Inicio de vigencia (UTC; día civil según zona del organizador). */
    validFrom: { type: Date },
    /** Fin de vigencia (UTC; fin del día civil según zona del organizador). */
    validUntil: { type: Date },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export type PromotionDocument = HydratedDocument<
  InferSchemaType<typeof promotionSchema>
>;

export const Promotion = mongoose.model("Promotion", promotionSchema);

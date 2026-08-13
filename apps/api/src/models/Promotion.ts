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
    validUntil: { type: Date },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export type PromotionDocument = HydratedDocument<
  InferSchemaType<typeof promotionSchema>
>;

export const Promotion = mongoose.model("Promotion", promotionSchema);

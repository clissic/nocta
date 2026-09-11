import mongoose, { Schema, type HydratedDocument, type InferSchemaType } from "mongoose";

const adSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    subtitle: { type: String, trim: true, maxlength: 160 },
    body: { type: String, trim: true, maxlength: 2000 },
    imageUrl: { type: String, required: true, trim: true, maxlength: 500 },
    ctaLabel: { type: String, required: true, trim: true, maxlength: 40, default: "Ver más" },
    /** URL externa del anunciante (landing in-app redirige o muestra CTA). */
    ctaUrl: { type: String, required: true, trim: true, maxlength: 500 },
    sponsorName: { type: String, trim: true, maxlength: 80 },
    active: { type: Boolean, default: true, index: true },
    weight: { type: Number, min: 1, max: 100, default: 1 },
  },
  { timestamps: true }
);

adSchema.index({ active: 1, weight: -1 });

export type AdDocument = HydratedDocument<InferSchemaType<typeof adSchema>>;

export const Ad = mongoose.model("Ad", adSchema);

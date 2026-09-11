import mongoose, { Schema, type HydratedDocument, type InferSchemaType } from "mongoose";
import { IMAGE_TYPES, type ImageType, type ImageVisibility } from "../image-service/types.js";

const variantFileSchema = new Schema(
  {
    key: { type: String, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    bytes: { type: Number, required: true },
  },
  { _id: false }
);

const variantSetSchema = new Schema(
  {
    webp: { type: variantFileSchema, required: true },
    avif: { type: variantFileSchema, required: true },
  },
  { _id: false }
);

const imageAssetSchema = new Schema(
  {
    imageId: { type: String, required: true, unique: true, index: true },
    ownerId: { type: String, required: true, index: true },
    /** Dominio de producto: user | space | review | news | identity | … */
    entityType: { type: String, required: true, index: true },
    entityId: { type: String, index: true },
    imageType: {
      type: String,
      required: true,
      enum: IMAGE_TYPES,
      index: true,
    },
    visibility: {
      type: String,
      required: true,
      enum: ["public", "private"],
      index: true,
    },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    /** Variantes públicas (variants_v1). */
    variants: {
      thumb: variantSetSchema,
      medium: variantSetSchema,
      large: variantSetSchema,
    },
    /**
     * Objeto principal privado (identity / evidence).
     * Nunca exponer como URL pública.
     */
    storageKey: { type: String },
    contentType: { type: String },
    bytes: { type: Number },
    legacySource: { type: String },
    keys: { type: [String], default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

imageAssetSchema.index({ ownerId: 1, imageType: 1, createdAt: -1 });

export type ImageAssetDocument = HydratedDocument<
  InferSchemaType<typeof imageAssetSchema>
> & {
  imageType: ImageType;
  visibility: ImageVisibility;
};

export const ImageAsset = mongoose.model("ImageAsset", imageAssetSchema);

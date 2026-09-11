import mongoose, { Schema, type HydratedDocument, type InferSchemaType } from "mongoose";
import { IMAGE_TYPES, type ImageType } from "../image-service/types.js";

const imageMigrationRecordSchema = new Schema(
  {
    /** Clave estable idempotente: collection:field:entityId:index:legacyRef */
    sourceKey: { type: String, required: true, unique: true, index: true },
    imageType: { type: String, enum: IMAGE_TYPES, required: true },
    legacyRef: { type: String, required: true },
    entityCollection: { type: String, required: true },
    entityId: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "done", "skipped", "error", "missing"],
      default: "pending",
      index: true,
    },
    mediaRef: { type: String },
    imageId: { type: String },
    error: { type: String },
    dryRun: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export type ImageMigrationRecordDocument = HydratedDocument<
  InferSchemaType<typeof imageMigrationRecordSchema>
> & { imageType: ImageType };

export const ImageMigrationRecord = mongoose.model(
  "ImageMigrationRecord",
  imageMigrationRecordSchema
);

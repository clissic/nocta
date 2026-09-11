import mongoose, { Schema, type HydratedDocument, type InferSchemaType } from "mongoose";

export const IMAGE_LIFECYCLE_JOB_NAMES = [
  "purge_deleted_accounts",
  "identity_retention",
  "orphan_classify",
] as const;

export type ImageLifecycleJobName = (typeof IMAGE_LIFECYCLE_JOB_NAMES)[number];

const imageLifecycleJobRunSchema = new Schema(
  {
    jobName: {
      type: String,
      enum: IMAGE_LIFECYCLE_JOB_NAMES,
      required: true,
      index: true,
    },
    /** p.ej. purge_deleted_accounts:2026-09-11T14 */
    idempotencyKey: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ["running", "success", "partial", "failed", "skipped"],
      required: true,
      index: true,
    },
    attempt: { type: Number, default: 1 },
    startedAt: { type: Date, required: true },
    finishedAt: { type: Date },
    durationMs: { type: Number },
    processed: { type: Number, default: 0 },
    deleted: { type: Number, default: 0 },
    errorCount: { type: Number, default: 0 },
    pending: { type: Number, default: 0 },
    errorMessages: { type: [String], default: [] },
    summary: { type: Schema.Types.Mixed },
    dryRun: { type: Boolean, default: false },
  },
  { timestamps: true, suppressReservedKeysWarning: true }
);

imageLifecycleJobRunSchema.index({ jobName: 1, createdAt: -1 });

export type ImageLifecycleJobRunDocument = HydratedDocument<
  InferSchemaType<typeof imageLifecycleJobRunSchema>
>;

export const ImageLifecycleJobRun = mongoose.model(
  "ImageLifecycleJobRun",
  imageLifecycleJobRunSchema
);

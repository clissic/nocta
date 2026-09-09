import mongoose, { Schema, type InferSchemaType } from "mongoose";
import { REPORT_REASONS, SUSPENSION_DURATIONS } from "@nocta/shared";

const reportResolutionSchema = new Schema(
  {
    action: {
      type: String,
      enum: ["dismiss", "suspend"],
      required: true,
    },
    reason: { type: String, trim: true, maxlength: 1000 },
    duration: { type: Schema.Types.Mixed, enum: SUSPENSION_DURATIONS },
    suspendedUntil: { type: Date },
    resolvedAt: { type: Date, required: true },
    resolvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { _id: false }
);

const reportSchema = new Schema(
  {
    reporterId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    reportedUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    matchId: { type: Schema.Types.ObjectId, ref: "Match" },
    source: {
      type: String,
      enum: ["profile", "match"],
      default: "match",
      required: true,
    },
    reason: { type: String, enum: REPORT_REASONS, required: true },
    details: { type: String, maxlength: 1000 },
    status: {
      type: String,
      enum: ["open", "reviewed", "dismissed"],
      default: "open",
    },
    resolution: { type: reportResolutionSchema },
  },
  { timestamps: true }
);

export type ReportDocument = InferSchemaType<typeof reportSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
};

export const Report = mongoose.model("Report", reportSchema);

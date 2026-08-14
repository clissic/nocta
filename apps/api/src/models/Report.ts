import mongoose, { Schema, type InferSchemaType } from "mongoose";
import { REPORT_REASONS } from "@nocta/shared";

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
    reason: { type: String, enum: REPORT_REASONS, required: true },
    details: { type: String, maxlength: 1000 },
    status: {
      type: String,
      enum: ["open", "reviewed", "dismissed"],
      default: "open",
    },
  },
  { timestamps: true }
);

export type ReportDocument = InferSchemaType<typeof reportSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
};

export const Report = mongoose.model("Report", reportSchema);

import mongoose, { Schema, type HydratedDocument, type InferSchemaType } from "mongoose";
import { FOLLOW_REQUEST_STATUSES } from "@nocta/shared";

const followRequestSchema = new Schema(
  {
    fromUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    toUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: FOLLOW_REQUEST_STATUSES,
      default: "pending",
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

followRequestSchema.index({ fromUserId: 1, toUserId: 1 }, { unique: true });
followRequestSchema.index({ toUserId: 1, status: 1, createdAt: -1 });

export type FollowRequestDocument = HydratedDocument<
  InferSchemaType<typeof followRequestSchema>
>;

export const FollowRequest = mongoose.model(
  "FollowRequest",
  followRequestSchema
);

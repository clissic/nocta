import mongoose, { Schema, type InferSchemaType } from "mongoose";
import { FOLLOW_TARGET_TYPES } from "@nocta/shared";

const followSchema = new Schema(
  {
    followerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    targetType: {
      type: String,
      enum: FOLLOW_TARGET_TYPES,
      required: true,
    },
    targetId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

followSchema.index(
  { followerId: 1, targetType: 1, targetId: 1 },
  { unique: true }
);
followSchema.index({ targetType: 1, targetId: 1 });

export type FollowDocument = InferSchemaType<typeof followSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
};

export const Follow = mongoose.model("Follow", followSchema);

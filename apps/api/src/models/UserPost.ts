import mongoose, { Schema, type HydratedDocument, type InferSchemaType } from "mongoose";
import { MAX_POST_BODY_LENGTH, MAX_POST_PHOTOS } from "@nocta/shared";

const userPostSchema = new Schema(
  {
    authorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    venueId: {
      type: Schema.Types.ObjectId,
      ref: "Venue",
      required: true,
      index: true,
    },
    body: {
      type: String,
      required: true,
      maxlength: MAX_POST_BODY_LENGTH,
      trim: true,
    },
    photos: {
      type: [String],
      default: [],
      validate: [
        (v: string[]) => v.length <= MAX_POST_PHOTOS,
        `Máximo ${MAX_POST_PHOTOS} fotos`,
      ],
    },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

userPostSchema.index({ authorId: 1, createdAt: -1 });
userPostSchema.index({ active: 1, createdAt: -1 });

export type UserPostDocument = HydratedDocument<
  InferSchemaType<typeof userPostSchema>
>;

export const UserPost = mongoose.model("UserPost", userPostSchema);

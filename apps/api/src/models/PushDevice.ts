import mongoose, { Schema, type HydratedDocument, type InferSchemaType } from "mongoose";

const pushDeviceSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    token: { type: String, required: true, trim: true, maxlength: 240 },
    platform: { type: String, enum: ["android"], required: true },
  },
  { timestamps: true }
);

pushDeviceSchema.index({ token: 1 }, { unique: true });

export type PushDeviceDocument = HydratedDocument<
  InferSchemaType<typeof pushDeviceSchema>
>;

export const PushDevice = mongoose.model("PushDevice", pushDeviceSchema);

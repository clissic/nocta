import mongoose, { Schema, type InferSchemaType } from "mongoose";

const blockSchema = new Schema(
  {
    blockerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    blockedId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

blockSchema.index({ blockerId: 1, blockedId: 1 }, { unique: true });

export type BlockDocument = InferSchemaType<typeof blockSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Block = mongoose.model("Block", blockSchema);

export async function blockedPeerIds(
  userId: mongoose.Types.ObjectId | string
) {
  const id = userId.toString();
  const rows = await Block.find({
    $or: [{ blockerId: id }, { blockedId: id }],
  }).select("blockerId blockedId");

  const peers = new Set<string>();
  for (const row of rows) {
    const a = row.blockerId.toString();
    const b = row.blockedId.toString();
    peers.add(a === id ? b : a);
  }
  return [...peers];
}

import mongoose, { Schema, type InferSchemaType } from "mongoose";

const matchSchema = new Schema(
  {
    users: {
      type: [{ type: Schema.Types.ObjectId, ref: "User" }],
      required: true,
      validate: [(v: unknown[]) => v.length === 2, "Match needs 2 users"],
    },
    venueId: {
      type: Schema.Types.ObjectId,
      ref: "Venue",
      required: true,
    },
  },
  { timestamps: true }
);

/** Orden canónico del par para índice único estable. */
matchSchema.pre("validate", function (next) {
  if (this.users?.length === 2) {
    this.users = [...this.users].sort((a, b) =>
      a.toString().localeCompare(b.toString())
    );
  }
  next();
});

matchSchema.index({ users: 1, venueId: 1 }, { unique: true });
matchSchema.index({ users: 1 });

export type MatchDocument = InferSchemaType<typeof matchSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const Match = mongoose.model("Match", matchSchema);

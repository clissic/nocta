import mongoose, { Schema, type InferSchemaType } from "mongoose";
import { matchPairKey, sortedUserPair } from "../utils/ids.js";
import { Swipe } from "./Swipe.js";

const matchSchema = new Schema(
  {
    users: {
      type: [{ type: Schema.Types.ObjectId, ref: "User" }],
      required: true,
      validate: [(v: unknown[]) => v.length === 2, "Match needs 2 users"],
    },
    /**
     * Par canónico `idA:idB` (ids ordenados).
     * Único junto con venueId: una persona puede tener muchos matches en el mismo Espacio.
     */
    pairKey: { type: String, required: true },
    venueId: {
      type: Schema.Types.ObjectId,
      ref: "Venue",
      required: true,
    },
    /** Hasta cuándo leyó cada participante. Mensajes del otro después de esa fecha = sin leer. */
    reads: {
      type: [
        {
          userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
          readAt: { type: Date, required: true },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

matchSchema.set("autoIndex", false);

/** Orden canónico del par para índice único estable. */
matchSchema.pre("validate", function (next) {
  if (this.users?.length === 2) {
    const sorted = [...this.users].sort((a, b) =>
      a.toString().localeCompare(b.toString())
    );
    this.users = sorted;
    this.pairKey = matchPairKey(sorted[0]!, sorted[1]!);
  }
  next();
});

matchSchema.index({ pairKey: 1, venueId: 1 }, { unique: true });
matchSchema.index({ users: 1 });

export type MatchDocument = InferSchemaType<typeof matchSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const Match = mongoose.model("Match", matchSchema);

/**
 * Likes mutuos que no llegaron a Match (el índice viejo rechazaba un segundo match
 * en el mismo Espacio). Unmatch deja los swipes en `pass`, así que no se recrean.
 */
export async function repairMissingMatches() {
  const likes = await Swipe.find({ direction: "like" })
    .select("fromUserId toUserId venueId")
    .lean();
  const likeKeys = new Set(
    likes.map(
      (s) =>
        `${s.fromUserId.toString()}|${s.toUserId.toString()}|${s.venueId.toString()}`
    )
  );
  const seen = new Set<string>();
  let created = 0;
  for (const swipe of likes) {
    const from = swipe.fromUserId.toString();
    const to = swipe.toUserId.toString();
    const venue = swipe.venueId.toString();
    const pair = matchPairKey(from, to);
    const dedupe = `${pair}|${venue}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    if (!likeKeys.has(`${to}|${from}|${venue}`)) continue;
    const exists = await Match.exists({ pairKey: pair, venueId: swipe.venueId });
    if (exists) continue;
    await Match.create({
      users: sortedUserPair(from, to),
      pairKey: pair,
      venueId: swipe.venueId,
    });
    created += 1;
  }
  if (created > 0) {
    console.log(`Matches reparados (likes mutuos sin match): ${created}`);
  }
}

/** Completa `pairKey` en matches viejos antes de crear el índice único. */
export async function backfillMatchPairKeys() {
  const docs = await Match.collection
    .find({
      $or: [{ pairKey: { $exists: false } }, { pairKey: null }, { pairKey: "" }],
    })
    .toArray();
  for (const doc of docs) {
    const users = doc.users as { toString(): string }[] | undefined;
    if (!users || users.length !== 2) continue;
    await Match.updateOne(
      { _id: doc._id },
      { $set: { pairKey: matchPairKey(users[0]!, users[1]!) } }
    );
  }
}

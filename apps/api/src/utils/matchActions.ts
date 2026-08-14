import mongoose from "mongoose";
import { Match } from "../models/Match.js";
import { Message } from "../models/Message.js";
import { Swipe } from "../models/Swipe.js";

/**
 * Borra match + mensajes y deja swipes en `pass` en ese venue
 * para que no vuelvan a matchear vía repair / likes mutuos.
 */
export async function dissolveMatch(
  matchId: mongoose.Types.ObjectId | string,
  opts?: { neutralizeSwipes?: boolean }
) {
  const match = await Match.findById(matchId);
  if (!match) return;

  const neutralize = opts?.neutralizeSwipes !== false;
  if (neutralize && match.users.length === 2) {
    const [a, b] = match.users;
    const venueId = match.venueId;
    await Promise.all([
      Swipe.findOneAndUpdate(
        { fromUserId: a, toUserId: b, venueId },
        { $set: { direction: "pass" } },
        { upsert: true }
      ),
      Swipe.findOneAndUpdate(
        { fromUserId: b, toUserId: a, venueId },
        { $set: { direction: "pass" } },
        { upsert: true }
      ),
    ]);
  }

  await Message.deleteMany({ matchId: match._id });
  await Match.deleteOne({ _id: match._id });
}

/** Elimina todos los matches (y chats) entre dos usuarios. */
export async function dissolveAllMatchesBetween(
  userA: mongoose.Types.ObjectId | string,
  userB: mongoose.Types.ObjectId | string
) {
  const matches = await Match.find({
    users: { $all: [userA, userB] },
  });
  for (const m of matches) {
    await dissolveMatch(m._id);
  }
}

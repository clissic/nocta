import mongoose from "mongoose";
import { Match } from "../models/Match.js";
import { Swipe } from "../models/Swipe.js";

/**
 * Disuelve el match: neutraliza swipes en ese venue y borra el documento Match.
 * Los mensajes del chat se conservan (auditoría / denuncias).
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

  await Match.deleteOne({ _id: match._id });
}

/** Elimina todos los matches entre dos usuarios (conserva mensajes). */
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

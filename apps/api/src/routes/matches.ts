import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { Match } from "../models/Match.js";
import { Message } from "../models/Message.js";
import { User } from "../models/User.js";
import { Venue } from "../models/Venue.js";
import { isObjectId, paramId } from "../utils/ids.js";

const router = Router();

router.get("/", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!._id;
  const matches = await Match.find({ users: userId }).sort({ updatedAt: -1 });

  const summaries = await Promise.all(
    matches.map(async (m) => {
      const otherId = m.users
        .map((id) => id.toString())
        .find((id) => id !== userId.toString())!;
      const other = await User.findById(otherId);
      const venue = await Venue.findById(m.venueId);
      const last = await Message.findOne({ matchId: m._id }).sort({
        createdAt: -1,
      });

      return {
        id: m._id.toString(),
        venueId: m.venueId.toString(),
        venueName: venue?.name,
        otherUser: {
          id: otherId,
          name: other?.profile?.name ?? "Usuario",
          photo: other?.profile?.photos?.[0],
        },
        createdAt: m.createdAt.toISOString(),
        lastMessage: last?.body,
      };
    })
  );

  return res.json({ matches: summaries });
});

router.get("/:id/messages", requireAuth, async (req: AuthedRequest, res) => {
  const id = paramId(req.params.id);
  if (!isObjectId(id)) {
    return res.status(400).json({ error: "Id inválido" });
  }
  const match = await Match.findById(id);
  if (!match) return res.status(404).json({ error: "Match no encontrado" });

  const userId = req.user!._id.toString();
  if (!match.users.map((u) => u.toString()).includes(userId)) {
    return res.status(403).json({ error: "No autorizado" });
  }

  const messages = await Message.find({ matchId: match._id }).sort({
    createdAt: 1,
  });

  return res.json({
    messages: messages.map((m) => ({
      id: m._id.toString(),
      matchId: m.matchId.toString(),
      senderId: m.senderId.toString(),
      body: m.body,
      createdAt: m.createdAt.toISOString(),
    })),
  });
});

const messageSchema = z.object({
  body: z.string().min(1).max(2000),
});

router.post("/:id/messages", requireAuth, async (req: AuthedRequest, res) => {
  const id = paramId(req.params.id);
  if (!isObjectId(id)) {
    return res.status(400).json({ error: "Id inválido" });
  }
  const parsed = messageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Mensaje inválido" });
  }

  const match = await Match.findById(id);
  if (!match) return res.status(404).json({ error: "Match no encontrado" });

  const userId = req.user!._id.toString();
  if (!match.users.map((u) => u.toString()).includes(userId)) {
    return res.status(403).json({ error: "No autorizado" });
  }

  const message = await Message.create({
    matchId: match._id,
    senderId: req.user!._id,
    body: parsed.data.body,
  });

  match.updatedAt = new Date();
  await match.save();

  return res.status(201).json({
    message: {
      id: message._id.toString(),
      matchId: message.matchId.toString(),
      senderId: message.senderId.toString(),
      body: message.body,
      createdAt: message.createdAt.toISOString(),
    },
  });
});

export default router;

import mongoose from "mongoose";
import { Router } from "express";
import { z } from "zod";
import { REPORT_REASONS } from "@nocta/shared";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { requireVerified } from "../middleware/gates.js";
import { Match } from "../models/Match.js";
import { Message } from "../models/Message.js";
import { User } from "../models/User.js";
import { Venue } from "../models/Venue.js";
import { Report } from "../models/Report.js";
import { Block, blockedPeerIds } from "../models/Block.js";
import { isObjectId, paramId } from "../utils/ids.js";
import {
  dissolveAllMatchesBetween,
  dissolveMatch,
} from "../utils/matchActions.js";

const router = Router();

router.use(requireAuth, requireVerified);

async function loadOwnedMatch(matchId: string, userId: string) {
  if (!isObjectId(matchId)) return null;
  const match = await Match.findById(matchId);
  if (!match) return null;
  if (!match.users.map((u) => u.toString()).includes(userId)) return null;
  return match;
}

function otherUserId(
  match: { users: mongoose.Types.ObjectId[] },
  userId: string
) {
  return match.users.map((u) => u.toString()).find((u) => u !== userId)!;
}

router.get("/", async (req: AuthedRequest, res) => {
  const userId = req.user!._id;
  const blocked = new Set(await blockedPeerIds(userId));
  const matches = await Match.find({ users: userId }).sort({ updatedAt: -1 });

  const summaries = await Promise.all(
    matches.map(async (m) => {
      const otherId = otherUserId(m, userId.toString());
      if (blocked.has(otherId)) return null;
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
        lastMessage: last
          ? {
              body: last.body,
              createdAt: last.createdAt.toISOString(),
              fromUserId: last.senderId.toString(),
            }
          : undefined,
      };
    })
  );

  return res.json({ matches: summaries.filter(Boolean) });
});

router.get("/:id/messages", async (req: AuthedRequest, res) => {
  const id = paramId(req.params.id);
  const userId = req.user!._id.toString();
  const match = await loadOwnedMatch(id, userId);
  if (!match) return res.status(404).json({ error: "Match no encontrado" });

  const peer = otherUserId(match, userId);
  if ((await blockedPeerIds(userId)).includes(peer)) {
    return res.status(403).json({ error: "Usuario bloqueado" });
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

router.post("/:id/messages", async (req: AuthedRequest, res) => {
  const id = paramId(req.params.id);
  const parsed = messageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Mensaje inválido" });
  }

  const userId = req.user!._id.toString();
  const match = await loadOwnedMatch(id, userId);
  if (!match) return res.status(404).json({ error: "Match no encontrado" });

  const peer = otherUserId(match, userId);
  if ((await blockedPeerIds(userId)).includes(peer)) {
    return res.status(403).json({ error: "Usuario bloqueado" });
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

router.delete("/:id", async (req: AuthedRequest, res) => {
  const id = paramId(req.params.id);
  const userId = req.user!._id.toString();
  const match = await loadOwnedMatch(id, userId);
  if (!match) return res.status(404).json({ error: "Match no encontrado" });

  await dissolveMatch(match._id);
  return res.json({ ok: true });
});

const reportSchema = z.object({
  reason: z.enum(REPORT_REASONS),
  details: z.string().max(1000).optional(),
  unmatch: z.boolean().optional(),
});

router.post("/:id/report", async (req: AuthedRequest, res) => {
  const id = paramId(req.params.id);
  const parsed = reportSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos" });
  }

  const userId = req.user!._id.toString();
  const match = await loadOwnedMatch(id, userId);
  if (!match) return res.status(404).json({ error: "Match no encontrado" });

  const reportedUserId = otherUserId(match, userId);
  await Report.create({
    reporterId: req.user!._id,
    reportedUserId,
    matchId: match._id,
    reason: parsed.data.reason,
    details: parsed.data.details,
  });

  if (parsed.data.unmatch !== false) {
    await dissolveMatch(match._id);
  }

  return res.status(201).json({ ok: true });
});

router.post("/:id/block", async (req: AuthedRequest, res) => {
  const id = paramId(req.params.id);
  const userId = req.user!._id.toString();
  const match = await loadOwnedMatch(id, userId);
  if (!match) return res.status(404).json({ error: "Match no encontrado" });

  const blockedId = otherUserId(match, userId);
  try {
    await Block.create({
      blockerId: req.user!._id,
      blockedId,
    });
  } catch (err: unknown) {
    if (
      !(
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code: number }).code === 11000
      )
    ) {
      throw err;
    }
  }

  await dissolveAllMatchesBetween(userId, blockedId);
  return res.json({ ok: true });
});

export default router;

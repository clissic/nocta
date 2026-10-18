import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import type { ChatMessage } from "@nocta/shared";
import { config } from "../config.js";
import type { AuthPayload } from "../middleware/auth.js";
import { blockedPeerIds } from "../models/Block.js";
import { Match } from "../models/Match.js";
import { User } from "../models/User.js";
import { isObjectId } from "../utils/ids.js";
import { refreshExpiredSuspension } from "../utils/moderation.js";
import { syncExpiredPremium } from "../utils/premium.js";

let io: Server | null = null;

function room(matchId: string) {
  return `match:${matchId}`;
}

async function userFromToken(token: string) {
  const payload = jwt.verify(token, config.jwtSecret) as AuthPayload;
  const user = await User.findById(payload.sub);
  if (!user) return null;
  const suspension = await refreshExpiredSuspension(user);
  if (suspension) return null;
  const synced = await syncExpiredPremium(user._id.toString());
  if (!synced) return null;
  if ((payload.ver ?? 0) !== (synced.authVersion ?? 0)) return null;
  if (!synced.emailVerified || synced.deletionRequestedAt) return null;
  return synced;
}

async function canJoinMatch(matchId: string, userId: string) {
  if (!isObjectId(matchId)) return false;
  const match = await Match.findById(matchId).select("users");
  if (!match) return false;
  const ids = match.users.map((id) => id.toString());
  if (!ids.includes(userId)) return false;
  const peer = ids.find((id) => id !== userId);
  if (!peer) return false;
  return !(await blockedPeerIds(userId)).includes(peer);
}

/** Socket del chat, en el mismo servidor HTTP que la API. */
export function attachChatRealtime(server: HttpServer) {
  io = new Server(server, {
    path: "/socket.io",
    cors: { origin: true, credentials: true },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (typeof token !== "string" || !token) {
      next(new Error("No autenticado"));
      return;
    }
    void userFromToken(token)
      .then((user) => {
        if (!user) {
          next(new Error("Token inválido"));
          return;
        }
        socket.data.userId = user._id.toString();
        next();
      })
      .catch(() => next(new Error("Token inválido")));
  });

  io.on("connection", (socket) => {
    socket.on("chat:join", (matchId: unknown) => {
      if (typeof matchId !== "string") return;
      const userId = socket.data.userId as string | undefined;
      if (!userId) return;
      void canJoinMatch(matchId, userId).then((allowed) => {
        if (!allowed) return;
        void socket.join(room(matchId));
      });
    });

    socket.on("chat:leave", (matchId: unknown) => {
      if (typeof matchId !== "string") return;
      void socket.leave(room(matchId));
    });
  });
}

export function emitChatMessage(matchId: string, message: ChatMessage) {
  io?.to(room(matchId)).emit("message:new", message);
}

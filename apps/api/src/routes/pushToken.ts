import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { PushDevice } from "../models/PushDevice.js";
import { isExpoPushToken } from "../utils/expoPush.js";
import { pushTokenLimiter } from "../middleware/rateLimits.js";

const router = Router();

const bodySchema = z.object({
  token: z.string().trim().min(1).max(240),
  platform: z.literal("android").optional(),
});

router.post("/", pushTokenLimiter, requireAuth, async (req: AuthedRequest, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success || !isExpoPushToken(parsed.data.token)) {
    return res.status(400).json({ error: "Token de avisos inválido" });
  }

  const token = parsed.data.token;
  await PushDevice.findOneAndUpdate(
    { token },
    { userId: req.user!._id, token, platform: "android" },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return res.json({ ok: true });
});

router.delete("/", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos" });
  }
  await PushDevice.deleteOne({
    token: parsed.data.token,
    userId: req.user!._id,
  });
  return res.json({ ok: true });
});

export default router;

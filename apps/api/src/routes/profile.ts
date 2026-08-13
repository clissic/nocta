import { Router } from "express";
import { z } from "zod";
import {
  INTERESTS,
  LOOKING_FOR,
  MIN_AGE,
  MIN_PHOTOS,
  WORK_STATUS,
} from "@nocta/shared";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { serializeUser, calcAge } from "../utils/serialize.js";

const router = Router();

const profileSchema = z.object({
  name: z.string().min(2).max(60),
  birthDate: z.string(),
  heightCm: z.number().int().min(100).max(250).optional(),
  lookingFor: z.array(z.enum(LOOKING_FOR)).min(1),
  photos: z.array(z.string().url()).min(MIN_PHOTOS),
  bio: z.string().max(500).optional(),
  interests: z.array(z.enum(INTERESTS)).default([]),
  workStatus: z.enum(WORK_STATUS).optional(),
  gender: z.string().optional(),
  interestedIn: z.array(z.string()).optional(),
});

router.put("/", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Perfil inválido", details: parsed.error.flatten() });
  }

  const birthDate = new Date(parsed.data.birthDate);
  if (Number.isNaN(birthDate.getTime())) {
    return res.status(400).json({ error: "Fecha de nacimiento inválida" });
  }

  const age = calcAge(birthDate);
  if (age < MIN_AGE) {
    return res.status(400).json({ error: `Debés tener al menos ${MIN_AGE} años` });
  }

  const user = req.user!;
  user.profile = {
    name: parsed.data.name,
    birthDate,
    heightCm: parsed.data.heightCm,
    lookingFor: parsed.data.lookingFor,
    photos: parsed.data.photos,
    bio: parsed.data.bio,
    interests: parsed.data.interests,
    workStatus: parsed.data.workStatus,
    gender: parsed.data.gender,
    interestedIn: parsed.data.interestedIn ?? [],
  } as typeof user.profile;
  user.profileComplete = true;
  await user.save();

  return res.json({ user: serializeUser(user) });
});

router.get("/", requireAuth, async (req: AuthedRequest, res) => {
  return res.json({ user: serializeUser(req.user!) });
});

export default router;

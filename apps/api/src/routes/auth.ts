import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { User } from "../models/User.js";
import { requireAuth, signToken, type AuthedRequest } from "../middleware/auth.js";
import { serializeUser } from "../utils/serialize.js";

const router = Router();

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

router.post("/register", async (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos", details: parsed.error.flatten() });
  }

  const email = parsed.data.email.toLowerCase();
  const exists = await User.findOne({ email });
  if (exists) {
    return res.status(409).json({ error: "El email ya está registrado" });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const user = await User.create({
    email,
    passwordHash,
    role: "user",
  });

  const token = signToken(user);
  return res.status(201).json({ token, user: serializeUser(user) });
});

router.post("/login", async (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos" });
  }

  const user = await User.findOne({ email: parsed.data.email.toLowerCase() });
  if (!user?.passwordHash) {
    return res.status(401).json({
      error: user
        ? "Esta cuenta usa login social. Entrá con Google, Apple o Microsoft."
        : "Credenciales incorrectas",
    });
  }

  const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: "Credenciales incorrectas" });
  }

  const token = signToken(user);
  return res.json({ token, user: serializeUser(user) });
});

router.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  return res.json({ user: serializeUser(req.user!) });
});

export default router;

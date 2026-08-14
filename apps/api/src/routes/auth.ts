import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import {
  EMAIL_VERIFICATION_CODE_LENGTH,
  EMAIL_VERIFICATION_TTL_MINUTES,
  isStrongPassword,
  PASSWORD_HINT,
} from "@nocta/shared";
import { User } from "../models/User.js";
import { requireAuth, signToken, type AuthedRequest } from "../middleware/auth.js";
import { optionalAuth } from "../middleware/optionalAuth.js";
import { serializeUser } from "../utils/serialize.js";
import {
  sendPasswordResetEmail,
  sendVerificationEmail,
} from "../mail/mailer.js";
import {
  generateEmailCode,
  generateToken,
  hashToken,
  rateLimit,
} from "../utils/tokens.js";

const router = Router();

const CODE_TTL_MS = EMAIL_VERIFICATION_TTL_MINUTES * 60 * 1000;

const strongPassword = z
  .string()
  .refine(isStrongPassword, { message: PASSWORD_HINT });

const registerSchema = z.object({
  email: z.string().email(),
  password: strongPassword,
  name: z.string().trim().min(2).max(60).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const emailSchema = z.object({ email: z.string().email() });

const verifyCodeSchema = z.object({
  email: z.string().email().optional(),
  code: z
    .string()
    .trim()
    .regex(
      new RegExp(`^\\d{${EMAIL_VERIFICATION_CODE_LENGTH}}$`),
      `Código de ${EMAIL_VERIFICATION_CODE_LENGTH} dígitos`
    ),
});

async function issueVerificationCode(user: InstanceType<typeof User>) {
  const code = generateEmailCode(EMAIL_VERIFICATION_CODE_LENGTH);
  user.emailVerificationToken = hashToken(code);
  user.emailVerificationExpires = new Date(Date.now() + CODE_TTL_MS);
  await user.save();
  await sendVerificationEmail({
    to: user.email,
    name: user.profile?.name || undefined,
    code,
    ttlMinutes: EMAIL_VERIFICATION_TTL_MINUTES,
  });
  return code;
}

router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: PASSWORD_HINT,
      details: parsed.error.flatten(),
    });
  }

  const email = parsed.data.email.toLowerCase();
  const exists = await User.findOne({ email });
  if (exists) {
    return res.status(409).json({ error: "El email ya está registrado" });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const pendingName = parsed.data.name?.trim();
  const user = await User.create({
    email,
    passwordHash,
    role: "user",
    emailVerified: false,
    ...(pendingName
      ? {
          profile: {
            name: pendingName,
            lookingFor: [],
            photos: [],
            interests: [],
            interestedIn: [],
          },
        }
      : {}),
  });

  try {
    await issueVerificationCode(user);
  } catch (err) {
    console.error("[mail] verification send failed", err);
  }

  // JWT con emailVerified:false — el FE debe pedir el código antes del onboarding
  const token = signToken(user);
  return res.status(201).json({
    token,
    user: serializeUser(user),
    code: "EMAIL_NOT_VERIFIED",
    expiresInMinutes: EMAIL_VERIFICATION_TTL_MINUTES,
    message: `Te enviamos un código de ${EMAIL_VERIFICATION_CODE_LENGTH} dígitos. Válido ${EMAIL_VERIFICATION_TTL_MINUTES} minutos.`,
  });
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
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

  if (!user.emailVerified && user.role !== "admin") {
    return res.status(403).json({
      error: "Confirmá tu email con el código que te enviamos",
      code: "EMAIL_NOT_VERIFIED",
      email: user.email,
      expiresInMinutes: EMAIL_VERIFICATION_TTL_MINUTES,
    });
  }

  const token = signToken(user);
  return res.json({ token, user: serializeUser(user) });
});

router.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  return res.json({ user: serializeUser(req.user!) });
});

router.post("/resend-verification", async (req, res) => {
  const parsed = emailSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Email inválido" });
  }
  const email = parsed.data.email.toLowerCase();
  if (!rateLimit(`resend:${email}`)) {
    return res
      .status(429)
      .json({ error: "Esperá un minuto antes de reenviar" });
  }

  const user = await User.findOne({ email });
  if (!user || user.emailVerified) {
    return res.json({
      ok: true,
      message: "Si la cuenta existe y no está verificada, enviamos un código",
      expiresInMinutes: EMAIL_VERIFICATION_TTL_MINUTES,
    });
  }

  try {
    await issueVerificationCode(user);
  } catch (err) {
    console.error("[mail] resend failed", err);
  }

  return res.json({
    ok: true,
    message: "Si la cuenta existe y no está verificada, enviamos un código",
    expiresInMinutes: EMAIL_VERIFICATION_TTL_MINUTES,
  });
});

/**
 * Verifica el código de 6 dígitos contra la BD (hash + vigencia).
 * Body: `{ email, code }` o `{ code }` con Bearer (usa el email del JWT).
 */
router.post("/verify-email", optionalAuth, async (req: AuthedRequest, res) => {
  const parsed = verifyCodeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: `Ingresá el código de ${EMAIL_VERIFICATION_CODE_LENGTH} dígitos`,
      code: "INVALID_CODE_FORMAT",
    });
  }

  const email =
    parsed.data.email?.toLowerCase() ?? req.user?.email?.toLowerCase();

  if (!email) {
    return res.status(400).json({
      error: "Indicá el email o enviá el token Bearer",
      code: "EMAIL_REQUIRED",
    });
  }

  const user = await User.findOne({ email });
  if (!user) {
    return res.status(400).json({
      error: "Código inválido o expirado",
      code: "CODE_INVALID",
    });
  }

  if (user.emailVerified) {
    return res.json({
      ok: true,
      alreadyVerified: true,
      token: signToken(user),
      user: serializeUser(user),
    });
  }

  if (
    !user.emailVerificationToken ||
    !user.emailVerificationExpires ||
    user.emailVerificationExpires.getTime() < Date.now()
  ) {
    return res.status(400).json({
      error: "Código expirado. Pedí uno nuevo.",
      code: "CODE_EXPIRED",
    });
  }

  if (user.emailVerificationToken !== hashToken(parsed.data.code)) {
    return res.status(400).json({
      error: "Código inválido o expirado",
      code: "CODE_INVALID",
    });
  }

  user.emailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();

  return res.json({
    ok: true,
    token: signToken(user),
    user: serializeUser(user),
    message: "Email confirmado",
  });
});

router.post("/forgot-password", async (req, res) => {
  const parsed = emailSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Email inválido" });
  }
  const email = parsed.data.email.toLowerCase();
  if (!rateLimit(`forgot:${email}`)) {
    return res
      .status(429)
      .json({ error: "Esperá un minuto antes de reintentar" });
  }

  const user = await User.findOne({ email });
  if (user?.passwordHash) {
    const rawToken = generateToken();
    user.passwordResetToken = hashToken(rawToken);
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();
    try {
      await sendPasswordResetEmail({
        to: email,
        name: user.profile?.name || undefined,
        token: rawToken,
      });
    } catch (err) {
      console.error("[mail] reset send failed", err);
    }
  }

  return res.json({
    ok: true,
    message: "Si la cuenta existe, enviamos instrucciones",
  });
});

router.post("/reset-password", async (req, res) => {
  const parsed = z
    .object({
      token: z.string().min(10),
      password: strongPassword,
    })
    .safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: PASSWORD_HINT });
  }

  const user = await User.findOne({
    passwordResetToken: hashToken(parsed.data.token),
    passwordResetExpires: { $gt: new Date() },
  });
  if (!user) {
    return res.status(400).json({ error: "Link expirado o inválido" });
  }

  user.passwordHash = await bcrypt.hash(parsed.data.password, 10);
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  return res.json({ ok: true, message: "Contraseña actualizada" });
});

export default router;

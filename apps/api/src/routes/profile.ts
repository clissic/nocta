import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import {
  INTERESTS,
  isStrongPassword,
  LOOKING_FOR,
  MAX_PHOTOS,
  MIN_AGE,
  MIN_PHOTOS,
  PASSWORD_HINT,
  WORK_STATUS,
} from "@nocta/shared";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { serializeUser, calcAge } from "../utils/serialize.js";
import { config } from "../config.js";
import {
  assertUploadsAreImages,
  collectUploadedFiles,
  deleteLocalUpload,
  deleteLocalUploads,
  handleMulterError,
  uploadPhotosFlexible,
} from "../uploads/index.js";

const router = Router();

const photoUrlSchema = z
  .string()
  .min(1)
  .refine(
    (v) => v.startsWith("/uploads/") || /^https?:\/\//i.test(v),
    "URL de foto inválida"
  );

const profileSchema = z.object({
  name: z.string().min(2).max(60),
  birthDate: z.string(),
  heightCm: z.number().int().min(100).max(250).optional(),
  lookingFor: z.array(z.enum(LOOKING_FOR)).min(1),
  /** photos[0] = avatar. Vacío permitido hasta completar la subida. */
  photos: z.array(photoUrlSchema).max(MAX_PHOTOS).default([]),
  bio: z.string().max(500).optional(),
  interests: z.array(z.enum(INTERESTS)).default([]),
  workStatus: z.enum(WORK_STATUS).optional(),
  gender: z.string().optional(),
  interestedIn: z.array(z.string()).optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .max(72)
    .refine(isStrongPassword, { message: PASSWORD_HINT }),
});

const reorderSchema = z.object({
  order: z.array(z.number().int().min(0)).min(MIN_PHOTOS).max(MAX_PHOTOS),
});

router.get("/", requireAuth, async (req: AuthedRequest, res) => {
  return res.json({ user: serializeUser(req.user!) });
});

router.put("/", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Perfil inválido", details: parsed.error.flatten() });
  }

  const birthDate = new Date(parsed.data.birthDate);
  if (Number.isNaN(birthDate.getTime())) {
    return res.status(400).json({ error: "Fecha de nacimiento inválida" });
  }

  const age = calcAge(birthDate);
  if (age < MIN_AGE) {
    return res
      .status(400)
      .json({ error: `Debés tener al menos ${MIN_AGE} años` });
  }

  const user = req.user!;
  const prevPhotos = user.profile?.photos ?? [];
  const nextPhotos = parsed.data.photos;

  for (const old of prevPhotos) {
    if (!nextPhotos.includes(old)) deleteLocalUpload(old);
  }

  user.profile = {
    name: parsed.data.name,
    birthDate,
    heightCm: parsed.data.heightCm,
    lookingFor: parsed.data.lookingFor,
    photos: nextPhotos,
    bio: parsed.data.bio,
    interests: parsed.data.interests,
    workStatus: parsed.data.workStatus,
    gender: parsed.data.gender,
    interestedIn: parsed.data.interestedIn ?? [],
  } as typeof user.profile;
  user.profileComplete = nextPhotos.length >= MIN_PHOTOS;
  await user.save();

  return res.json({ user: serializeUser(user) });
});

/**
 * Subida desde PC o teléfono (multipart).
 * Campos: `photo` (1 archivo) y/o `photos` (varios).
 * `accept` sugerido en FE: image/* ; capture opcional para cámara.
 */
router.post(
  "/photos",
  requireAuth,
  (req: AuthedRequest, res, next) => {
    uploadPhotosFlexible(req, res, (err) => {
      if (err) return handleMulterError(err, req, res, next);
      next();
    });
  },
  async (req: AuthedRequest, res) => {
    const user = req.user!;
    const collected = collectUploadedFiles(req);

    if (collected.length === 0) {
      return res.status(400).json({
        error: "Falta el archivo: enviá `photo` o `photos` (multipart)",
        code: "UPLOAD_MISSING",
      });
    }

    if (!user.profile) {
      deleteLocalUploads(collected.map((c) => c.url));
      return res.status(400).json({
        error: "Completá el perfil (nombre, fecha, etc.) antes de subir fotos",
        code: "PROFILE_INCOMPLETE",
      });
    }

    const checked = assertUploadsAreImages(collected);
    if (!checked.ok) {
      return res.status(400).json({
        error: checked.error,
        code: "UPLOAD_INVALID",
      });
    }

    const photos = [...(user.profile.photos ?? [])];
    const slots = MAX_PHOTOS - photos.length;
    if (slots <= 0) {
      deleteLocalUploads(checked.uploads.map((u) => u.url));
      return res.status(400).json({
        error: `Máximo ${MAX_PHOTOS} fotos`,
        code: "PHOTOS_LIMIT",
      });
    }

    const accepted = checked.uploads.slice(0, slots);
    const overflow = checked.uploads.slice(slots);
    deleteLocalUploads(overflow.map((u) => u.url));

    const newUrls = accepted.map((u) => u.url);
    photos.push(...newUrls);
    user.profile.photos = photos;
    if (photos.length >= MIN_PHOTOS) {
      user.profileComplete = true;
    }
    await user.save();

    return res.status(201).json({
      user: serializeUser(user),
      photos: newUrls,
      photo: newUrls[0],
      added: newUrls.length,
      skipped: overflow.length,
      apiBase: config.apiPublicUrl,
    });
  }
);

router.patch("/photos/reorder", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = reorderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Orden inválido" });
  }

  const user = req.user!;
  const photos = user.profile?.photos ?? [];
  if (photos.length < MIN_PHOTOS) {
    return res.status(400).json({ error: "No hay fotos para reordenar" });
  }

  const { order } = parsed.data;
  if (
    order.length !== photos.length ||
    new Set(order).size !== order.length ||
    order.some((i) => i < 0 || i >= photos.length)
  ) {
    return res
      .status(400)
      .json({ error: "order debe permutar todos los índices" });
  }

  user.profile!.photos = order.map((i) => photos[i]!);
  await user.save();
  return res.json({ user: serializeUser(user) });
});

router.delete("/photos/:index", requireAuth, async (req: AuthedRequest, res) => {
  const index = Number(req.params.index);
  if (!Number.isInteger(index) || index < 0) {
    return res.status(400).json({ error: "Índice inválido" });
  }

  const user = req.user!;
  const photos = [...(user.profile?.photos ?? [])];
  if (index >= photos.length) {
    return res.status(404).json({ error: "Foto no encontrada" });
  }
  if (photos.length <= MIN_PHOTOS) {
    return res
      .status(400)
      .json({ error: `Debés conservar al menos ${MIN_PHOTOS} foto(s)` });
  }

  const [removed] = photos.splice(index, 1);
  if (removed) deleteLocalUpload(removed);
  user.profile!.photos = photos;
  await user.save();
  return res.json({ user: serializeUser(user) });
});

router.post("/password", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = passwordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: PASSWORD_HINT });
  }

  const user = req.user!;
  if (!user.passwordHash) {
    return res.status(400).json({
      error: "Esta cuenta usa login social; no tiene contraseña local",
      code: "NO_LOCAL_PASSWORD",
    });
  }

  const ok = await bcrypt.compare(
    parsed.data.currentPassword,
    user.passwordHash
  );
  if (!ok) {
    return res.status(401).json({ error: "Contraseña actual incorrecta" });
  }

  user.passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
  await user.save();
  return res.json({ ok: true });
});

export default router;

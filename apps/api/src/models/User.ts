import mongoose, { Schema, type HydratedDocument, type InferSchemaType } from "mongoose";
import {
  DAILY_LIKE_LIMIT,
  DRINKING,
  EDUCATION_LEVELS,
  FITNESS,
  INTERESTS,
  LANGUAGES,
  LOOKING_FOR,
  MAX_PHOTOS,
  OAUTH_PROVIDERS,
  PETS,
  SEXUAL_ORIENTATIONS,
  WORK_STATUS,
  ZODIAC_SIGNS,
} from "@nocta/shared";

const profileLocationSchema = new Schema(
  {
    country: { type: String, trim: true, maxlength: 60, required: true },
    city: { type: String, trim: true, maxlength: 80, required: true },
  },
  { _id: false }
);

const profileSocialsSchema = new Schema(
  {
    instagram: { type: String, trim: true, maxlength: 80 },
    tiktok: { type: String, trim: true, maxlength: 80 },
    x: { type: String, trim: true, maxlength: 80 },
    facebook: { type: String, trim: true, maxlength: 80 },
    linkedin: { type: String, trim: true, maxlength: 80 },
  },
  { _id: false }
);

const profileSchema = new Schema(
  {
    name: { type: String, trim: true },
    birthDate: { type: Date },
    heightCm: { type: Number, min: 100, max: 250 },
    lookingFor: {
      type: [String],
      enum: LOOKING_FOR,
      default: [],
      validate: [
        (v: string[]) => Array.isArray(v) && v.length <= 1,
        "Solo una opción de búsqueda",
      ],
    },
    /** photos[0] = avatar. Puede estar vacío hasta el upload; profileComplete exige ≥ MIN_PHOTOS. */
    photos: {
      type: [String],
      default: [],
      validate: [
        (v: string[]) => Array.isArray(v) && v.length <= MAX_PHOTOS,
        `Máximo ${MAX_PHOTOS} fotos`,
      ],
    },
    bio: { type: String, maxlength: 500 },
    interests: {
      type: [String],
      enum: INTERESTS,
      default: [],
    },
    workStatus: { type: String, enum: WORK_STATUS },
    gender: { type: String },
    interestedIn: { type: [String], default: [] },
    livesIn: { type: profileLocationSchema },
    sexualOrientation: { type: String, enum: SEXUAL_ORIENTATIONS },
    languages: {
      type: [String],
      enum: LANGUAGES,
      default: [],
    },
    zodiac: { type: String, enum: ZODIAC_SIGNS },
    educationLevel: { type: String, enum: EDUCATION_LEVELS },
    pets: { type: String, enum: PETS },
    drinking: { type: String, enum: DRINKING },
    fitness: { type: String, enum: FITNESS },
    socials: { type: profileSocialsSchema },
    jobTitle: { type: String, trim: true, maxlength: 80 },
    company: { type: String, trim: true, maxlength: 80 },
    studiedAt: { type: String, trim: true, maxlength: 120 },
  },
  { _id: false }
);

const oauthAccountSchema = new Schema(
  {
    provider: { type: String, enum: OAUTH_PROVIDERS, required: true },
    providerUserId: { type: String, required: true },
  },
  { _id: false }
);

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    /** Ausente en cuentas solo-OAuth. */
    passwordHash: { type: String, required: false },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    profile: { type: profileSchema, default: null },
    profileComplete: { type: Boolean, default: false },
    /** Suscripción premium (MVP: flag booleano; pagos diferidos). */
    premium: { type: Boolean, default: false },
    /** Likes disponibles; el cooldown empieza al consumir el último. */
    remainingLikes: {
      type: Number,
      min: 0,
      max: DAILY_LIKE_LIMIT,
      default: DAILY_LIKE_LIMIT,
    },
    likesRechargeAt: { type: Date, default: null },
    emailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String, index: true },
    emailVerificationExpires: { type: Date },
    passwordResetToken: { type: String, index: true },
    passwordResetExpires: { type: Date },
    oauthAccounts: { type: [oauthAccountSchema], default: [] },
    authProvider: {
      type: String,
      enum: ["local", ...OAUTH_PROVIDERS],
      default: "local",
    },
    followersCount: { type: Number, default: 0 },
    followingUsersCount: { type: Number, default: 0 },
    followingVenuesCount: { type: Number, default: 0 },
    /** Si true, las solicitudes de follow se aceptan al instante. */
    autoAcceptFollowRequests: { type: Boolean, default: false },
    /** Si true, quienes me siguen no ven mi actividad en el Muro. */
    hideActivityFromFollowers: { type: Boolean, default: false },
  },
  { timestamps: true }
);

userSchema.index({ "oauthAccounts.provider": 1, "oauthAccounts.providerUserId": 1 });

export type UserDocument = HydratedDocument<InferSchemaType<typeof userSchema>>;

export const User = mongoose.model("User", userSchema);

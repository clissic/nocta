import mongoose, { Schema, type HydratedDocument, type InferSchemaType } from "mongoose";
import {
  INTERESTS,
  LOOKING_FOR,
  MAX_PHOTOS,
  OAUTH_PROVIDERS,
  WORK_STATUS,
} from "@nocta/shared";

const profileSchema = new Schema(
  {
    name: { type: String, trim: true },
    birthDate: { type: Date },
    heightCm: { type: Number, min: 100, max: 250 },
    lookingFor: {
      type: [String],
      enum: LOOKING_FOR,
      default: [],
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
  },
  { timestamps: true }
);

userSchema.index({ "oauthAccounts.provider": 1, "oauthAccounts.providerUserId": 1 });

export type UserDocument = HydratedDocument<InferSchemaType<typeof userSchema>>;

export const User = mongoose.model("User", userSchema);

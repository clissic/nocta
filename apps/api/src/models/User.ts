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
  PREMIUM_PERIOD_MONTHS,
  PREMIUM_PLAN_IDS,
  PREMIUM_SUBSCRIPTION_STATUSES,
  SEXUAL_ORIENTATIONS,
  SUSPENSION_DURATIONS,
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
    /** Suscripción premium (sincronizada con premiumExpiresAt vía isPremiumActive). */
    premium: { type: Boolean, default: false },
    premiumPlanId: { type: String, enum: PREMIUM_PLAN_IDS },
    premiumExpiresAt: { type: Date, default: null },
    premiumPeriodMonths: {
      type: Number,
      enum: [...PREMIUM_PERIOD_MONTHS],
    },
    premiumSubscriptionStatus: {
      type: String,
      enum: PREMIUM_SUBSCRIPTION_STATUSES,
      default: "none",
    },
    premiumCancelAtPeriodEnd: { type: Boolean, default: false },
    premiumNextPaymentAt: { type: Date, default: null },
    mpPreapprovalId: { type: String, index: true },
    /** Solo visible en Discover para quienes te dieron like (requiere Premium). */
    rogueMode: { type: Boolean, default: false },
    /** Explorar Espacios de otra ciudad (requiere Premium). */
    teleportMode: { type: Boolean, default: false },
    /** Ver conteo de personas publicadas por Espacio (requiere 6 AM + toggle). */
    spyMode: { type: Boolean, default: false },
    /**
     * Si true, no puede publicarse en Espacios ni aparecer en Discover.
     */
    discoverDisabled: { type: Boolean, default: false },
    teleportCity: {
      type: new Schema(
        {
          country: { type: String, trim: true, required: true },
          city: { type: String, trim: true, required: true },
          lat: { type: Number, required: true },
          lng: { type: Number, required: true },
        },
        { _id: false }
      ),
    },
    /** Likes disponibles; el cooldown empieza al consumir el último. */
    remainingLikes: {
      type: Number,
      min: 0,
      max: DAILY_LIKE_LIMIT,
      default: DAILY_LIKE_LIMIT,
    },
    likesRechargeAt: { type: Date, default: null },
    /** Cupos Boost (4 AM+); se cargan cada 30 días según el plan. */
    boostsRemaining: { type: Number, min: 0, default: 0 },
    /** Cupos Heartshot (4 AM+). */
    heartshotsRemaining: { type: Number, min: 0, default: 0 },
    /** Próxima recarga de Boost/Heartshot (ciclo de 30 días). */
    premiumAllowanceNextAt: { type: Date, default: null },
    /** Recargas mensuales pendientes (después de la carga inicial al comprar). */
    premiumAllowanceCyclesLeft: { type: Number, min: 0, default: 0 },
    /** Fin del Boost activo en Discover. */
    boostExpiresAt: { type: Date, default: null },
    emailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String, index: true },
    emailVerificationExpires: { type: Date },
    passwordResetToken: { type: String, index: true },
    passwordResetExpires: { type: Date },
    authVersion: { type: Number, min: 0, default: 0 },
    /**
     * Solicitud de borrado (términos: 30 días de recuperación).
     * Mientras esté set, la cuenta queda invisible; las imágenes se purgan
     * solo en la eliminación definitiva.
     */
    deletionRequestedAt: { type: Date, default: null, index: true },
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
    /**
     * Si true, quienes me siguen ven mi actividad.
     * Legado: `hideActivityFromFollowers` se interpreta al serializar si falta este campo.
     */
    showActivityToFollowers: { type: Boolean, default: false },
    /** @deprecated Preferir showActivityToFollowers. */
    hideActivityFromFollowers: { type: Boolean },
    /** Opt-in a comunicaciones promocionales por email. */
    marketingEmailsOptIn: { type: Boolean, default: false },
    moderationStatus: {
      type: String,
      enum: ["active", "suspended"],
      default: "active",
      index: true,
    },
    suspendedAt: { type: Date },
    suspendedUntil: { type: Date },
    suspensionDuration: { type: Schema.Types.Mixed, enum: SUSPENSION_DURATIONS },
    suspendedBy: { type: Schema.Types.ObjectId, ref: "User" },
    suspensionReportId: { type: Schema.Types.ObjectId, ref: "Report" },
    suspensionReason: { type: String, trim: true, maxlength: 1000 },
    identityVerification: {
      type: new Schema(
        {
          status: {
            type: String,
            enum: ["none", "pending", "approved", "rejected"],
            default: "none",
          },
          documentFrontPath: { type: String, trim: true },
          selfieWithDocumentPath: { type: String, trim: true },
          submittedAt: { type: Date },
          reviewedAt: { type: Date },
          reviewedById: { type: Schema.Types.ObjectId, ref: "User" },
          rejectionReason: { type: String, trim: true, maxlength: 1000 },
        },
        { _id: false }
      ),
      default: () => ({ status: "none" }),
    },
  },
  { timestamps: true }
);

userSchema.index({ "oauthAccounts.provider": 1, "oauthAccounts.providerUserId": 1 });
userSchema.index({ moderationStatus: 1, suspendedUntil: 1 });
userSchema.index({ "identityVerification.status": 1, "identityVerification.submittedAt": -1 });

export type UserDocument = HydratedDocument<InferSchemaType<typeof userSchema>>;

export const User = mongoose.model("User", userSchema);

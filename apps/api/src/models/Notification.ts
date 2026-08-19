import mongoose, { Schema, type HydratedDocument, type InferSchemaType } from "mongoose";
import { NOTIFICATION_TYPES } from "@nocta/shared";

const notificationSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    body: { type: String, trim: true, maxlength: 400 },
    href: { type: String, trim: true, maxlength: 300 },
    data: {
      type: Schema.Types.Mixed,
      default: {},
    },
    /** Clave opcional para dedupe (p.ej. likes_recharged:userId:timestampDay). */
    dedupeKey: { type: String, trim: true, index: true },
    readAt: { type: Date, default: null },
    /** Se setea al marcar como leída; Mongo TTL borra al llegar la fecha. */
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, readAt: 1 });
notificationSchema.index(
  { userId: 1, dedupeKey: 1 },
  {
    unique: true,
    partialFilterExpression: { dedupeKey: { $type: "string" } },
  }
);
notificationSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, partialFilterExpression: { expiresAt: { $type: "date" } } }
);

export type NotificationDocument = HydratedDocument<
  InferSchemaType<typeof notificationSchema>
>;

export const Notification = mongoose.model(
  "Notification",
  notificationSchema
);

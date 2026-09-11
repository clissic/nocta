import mongoose, { Schema, type HydratedDocument, type InferSchemaType } from "mongoose";

const adminAuditEventSchema = new Schema(
  {
    actorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    action: { type: String, required: true, trim: true, maxlength: 80, index: true },
    targetType: {
      type: String,
      required: true,
      trim: true,
      maxlength: 40,
      index: true,
    },
    targetId: { type: String, required: true, trim: true, maxlength: 64, index: true },
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

adminAuditEventSchema.index({ createdAt: -1, _id: -1 });

export type AdminAuditEventDocument = HydratedDocument<
  InferSchemaType<typeof adminAuditEventSchema>
>;

export const AdminAuditEvent = mongoose.model(
  "AdminAuditEvent",
  adminAuditEventSchema
);

import { AdminAuditEvent } from "../models/AdminAuditEvent.js";

export async function recordAdminAudit(opts: {
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  meta?: Record<string, unknown>;
}) {
  try {
    await AdminAuditEvent.create({
      actorId: opts.actorId,
      action: opts.action,
      targetType: opts.targetType,
      targetId: opts.targetId,
      meta: opts.meta ?? {},
    });
  } catch (err) {
    console.error("[admin-audit] failed to record", opts.action, err);
  }
}

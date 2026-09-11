import {
  ImageLifecycleJobRun,
  type ImageLifecycleJobName,
} from "../../models/ImageLifecycleJobRun.js";
import {
  emptyMetrics,
  hourlyIdempotencyKey,
  type JobContext,
  type JobRunResult,
} from "./types.js";

export type JobHandler = (ctx: JobContext) => Promise<JobRunResult>;

export type RunJobOptions = {
  dryRun?: boolean;
  force?: boolean;
  now?: Date;
  /** Override idempotency key (tests). */
  idempotencyKey?: string;
};

/**
 * Ejecuta un job con ledger Mongo: idempotente por ventana horaria,
 * reanudable (force re-run), registra métricas.
 */
export async function runImageLifecycleJob(
  jobName: ImageLifecycleJobName,
  handler: JobHandler,
  opts: RunJobOptions = {}
): Promise<{
  skipped: boolean;
  runId?: string;
  result?: JobRunResult;
  reason?: string;
}> {
  const now = opts.now ?? new Date();
  const dryRun = Boolean(opts.dryRun);
  const force = Boolean(opts.force);
  const idempotencyKey =
    opts.idempotencyKey ??
    `${hourlyIdempotencyKey(jobName, now)}${dryRun ? ":dry" : ""}`;

  const log = (msg: string) => {
    console.log(`[lifecycle:${jobName}] ${msg}`);
  };

  if (!force) {
    const prior = await ImageLifecycleJobRun.findOne({ idempotencyKey }).lean();
    if (prior?.status === "success" || prior?.status === "skipped") {
      log(`skip idempotent key=${idempotencyKey} status=${prior.status}`);
      return { skipped: true, runId: prior._id.toString(), reason: "idempotent" };
    }
    if (prior?.status === "running") {
      const age = Date.now() - new Date(prior.startedAt).getTime();
      if (age < 30 * 60 * 1000) {
        log(`skip already running key=${idempotencyKey}`);
        return { skipped: true, runId: prior._id.toString(), reason: "running" };
      }
      log(`stale running run (${age}ms) — reintentando`);
    }
  }

  const priorAttempt =
    (
      await ImageLifecycleJobRun.findOne({ idempotencyKey })
        .select("attempt")
        .lean()
    )?.attempt ?? 0;

  const startedAt = now;
  const doc = await ImageLifecycleJobRun.findOneAndUpdate(
    { idempotencyKey },
    {
      $set: {
        jobName,
        idempotencyKey,
        status: "running",
        startedAt,
        finishedAt: undefined,
        durationMs: undefined,
        dryRun,
        ...emptyMetrics(),
        attempt: priorAttempt + 1,
      },
      $setOnInsert: { createdAt: startedAt },
    },
    { upsert: true, new: true }
  );

  try {
    const result = await handler({ dryRun, force, now, log });
    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();
    doc.status = result.status;
    doc.finishedAt = finishedAt;
    doc.durationMs = durationMs;
    doc.processed = result.processed;
    doc.deleted = result.deleted;
    doc.errorCount = result.errors;
    doc.pending = result.pending;
    doc.errorMessages = result.errorMessages.slice(0, 50);
    doc.summary = result.summary ?? {};
    await doc.save();

    log(
      `done status=${result.status} processed=${result.processed} deleted=${result.deleted} errors=${result.errors} pending=${result.pending} durationMs=${durationMs}`
    );

    return { skipped: false, runId: doc._id.toString(), result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const finishedAt = new Date();
    doc.status = "failed";
    doc.finishedAt = finishedAt;
    doc.durationMs = finishedAt.getTime() - startedAt.getTime();
    doc.errorCount = (doc.errorCount ?? 0) + 1;
    doc.errorMessages = [...(doc.errorMessages ?? []), message].slice(0, 50);
    await doc.save();
    log(`FAILED ${message}`);
    throw err;
  }
}

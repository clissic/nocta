export type JobMetrics = {
  processed: number;
  deleted: number;
  errors: number;
  pending: number;
  errorMessages: string[];
  summary?: Record<string, unknown>;
};

export type JobRunResult = JobMetrics & {
  status: "success" | "partial" | "failed";
};

export type JobContext = {
  dryRun: boolean;
  force: boolean;
  now: Date;
  log: (msg: string) => void;
};

export function emptyMetrics(): JobMetrics {
  return {
    processed: 0,
    deleted: 0,
    errors: 0,
    pending: 0,
    errorMessages: [],
  };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Backoff exponencial con jitter ligero (1s, 2s, 4s…). */
export function backoffMs(attempt: number, baseMs = 1000, maxMs = 30_000): number {
  const exp = Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt - 1));
  const jitter = Math.floor(Math.random() * Math.min(250, exp * 0.1));
  return exp + jitter;
}

export async function withItemRetries<T>(
  label: string,
  fn: () => Promise<T>,
  opts: { maxAttempts?: number; log?: (msg: string) => void } = {}
): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  const maxAttempts = opts.maxAttempts ?? 3;
  const log = opts.log ?? (() => undefined);
  let lastError = "unknown";
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const value = await fn();
      return { ok: true, value };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      log(`${label} intento ${attempt}/${maxAttempts} falló: ${lastError}`);
      if (attempt < maxAttempts) {
        await sleep(backoffMs(attempt));
      }
    }
  }
  return { ok: false, error: lastError };
}

/** Bucket horario para idempotencia (re-runs en la misma hora se saltan si success). */
export function hourlyIdempotencyKey(jobName: string, now = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const h = String(now.getUTCHours()).padStart(2, "0");
  return `${jobName}:${y}-${m}-${d}T${h}`;
}

export function dailyIdempotencyKey(jobName: string, now = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${jobName}:${y}-${m}-${d}`;
}

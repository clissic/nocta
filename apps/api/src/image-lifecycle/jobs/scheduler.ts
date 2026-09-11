import { config } from "../../config.js";
import { runAllImageLifecycleJobs } from "./index.js";

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

/**
 * Scheduler in-process (sin Redis).
 * Activar con IMAGE_LIFECYCLE_JOBS=1.
 */
export function startImageLifecycleScheduler() {
  if (!config.imageLifecycleJobs.enabled) {
    console.log(
      "[lifecycle] scheduler desactivado (IMAGE_LIFECYCLE_JOBS≠1)"
    );
    return;
  }
  if (timer) return;

  const intervalMs = config.imageLifecycleJobs.intervalMs;
  console.log(
    `[lifecycle] scheduler activo cada ${Math.round(intervalMs / 60000)} min`
  );

  const tick = async () => {
    if (running) {
      console.warn("[lifecycle] tick solapado — skip");
      return;
    }
    running = true;
    try {
      const result = await runAllImageLifecycleJobs({ dryRun: false });
      console.log(
        "[lifecycle] tick",
        JSON.stringify({
          purge: result.purgeAccounts.skipped
            ? "skipped"
            : result.purgeAccounts.result?.status,
          identity: result.identityRetention.skipped
            ? "skipped"
            : result.identityRetention.result?.status,
          orphans: result.orphanClassify.skipped
            ? "skipped"
            : result.orphanClassify.result?.status,
        })
      );
    } catch (err) {
      console.error(
        "[lifecycle] tick error",
        err instanceof Error ? err.message : err
      );
    } finally {
      running = false;
    }
  };

  // Primer run diferido (no bloquear boot)
  const initialDelay = Math.min(60_000, intervalMs);
  setTimeout(() => {
    void tick();
  }, initialDelay);

  timer = setInterval(() => {
    void tick();
  }, intervalMs);
  // Unref para no mantener el proceso vivo solo por el timer en tests
  if (typeof timer === "object" && "unref" in timer) {
    timer.unref();
  }
}

export function stopImageLifecycleScheduler() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

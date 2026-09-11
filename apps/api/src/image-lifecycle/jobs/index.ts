import { runImageLifecycleJob, type RunJobOptions } from "./runner.js";
import { runPurgeDeletedAccountsJob } from "./purgeAccountsJob.js";
import { runIdentityRetentionJob } from "./identityRetentionJob.js";
import { runOrphanClassifyJob } from "./orphanClassifyJob.js";
import type { ImageLifecycleJobName } from "../../models/ImageLifecycleJobRun.js";

export type LifecycleJobsBundleResult = {
  purgeAccounts: Awaited<ReturnType<typeof runImageLifecycleJob>>;
  identityRetention: Awaited<ReturnType<typeof runImageLifecycleJob>>;
  orphanClassify: Awaited<ReturnType<typeof runImageLifecycleJob>>;
};

/** Ejecuta los 3 jobs de lifecycle en orden seguro. */
export async function runAllImageLifecycleJobs(
  opts: RunJobOptions = {}
): Promise<LifecycleJobsBundleResult> {
  const purgeAccounts = await runImageLifecycleJob(
    "purge_deleted_accounts",
    runPurgeDeletedAccountsJob,
    opts
  );

  // Identity: siempre separado; dryRun del bundle aplica, pero identity
  // nunca se mezcla con cleanup público.
  const identityRetention = await runImageLifecycleJob(
    "identity_retention",
    runIdentityRetentionJob,
    opts
  );

  // Orphans: classify-only (handler ignora borrado)
  const orphanClassify = await runImageLifecycleJob(
    "orphan_classify",
    runOrphanClassifyJob,
    { ...opts, dryRun: true }
  );

  return { purgeAccounts, identityRetention, orphanClassify };
}

export async function runNamedImageLifecycleJob(
  name: ImageLifecycleJobName,
  opts: RunJobOptions = {}
) {
  switch (name) {
    case "purge_deleted_accounts":
      return runImageLifecycleJob(name, runPurgeDeletedAccountsJob, opts);
    case "identity_retention":
      return runImageLifecycleJob(name, runIdentityRetentionJob, opts);
    case "orphan_classify":
      return runImageLifecycleJob(name, runOrphanClassifyJob, {
        ...opts,
        dryRun: true,
      });
    default: {
      const _exhaustive: never = name;
      throw new Error(`Job desconocido: ${_exhaustive}`);
    }
  }
}

export {
  runImageLifecycleJob,
  runPurgeDeletedAccountsJob,
  runIdentityRetentionJob,
  runOrphanClassifyJob,
};

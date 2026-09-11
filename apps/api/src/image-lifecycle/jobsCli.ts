/**
 * CLI: npm run jobs:images [-- --dry-run] [--force] [--job=name]
 *
 * Jobs: purge_deleted_accounts | identity_retention | orphan_classify | all
 */
import { connectDb, disconnectDb } from "../db.js";
import {
  runAllImageLifecycleJobs,
  runNamedImageLifecycleJob,
} from "./jobs/index.js";
import { IMAGE_LIFECYCLE_JOB_NAMES } from "../models/ImageLifecycleJobRun.js";

function parseArgs(argv: string[]) {
  const dryRun =
    argv.includes("--dry-run") ||
    argv.includes("--preview") ||
    process.env.DRY_RUN === "1";
  const force = argv.includes("--force");
  const jobArg = argv.find((a) => a.startsWith("--job="));
  const job = jobArg?.slice("--job=".length) ?? "all";
  return { dryRun, force, job };
}

async function main() {
  const { dryRun, force, job } = parseArgs(process.argv.slice(2));
  await connectDb();
  try {
    if (job === "all") {
      const result = await runAllImageLifecycleJobs({ dryRun, force });
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    if (
      !(IMAGE_LIFECYCLE_JOB_NAMES as readonly string[]).includes(job)
    ) {
      console.error(
        `Job inválido: ${job}. Usá: all | ${IMAGE_LIFECYCLE_JOB_NAMES.join(" | ")}`
      );
      process.exitCode = 1;
      return;
    }
    const result = await runNamedImageLifecycleJob(
      job as (typeof IMAGE_LIFECYCLE_JOB_NAMES)[number],
      { dryRun, force }
    );
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await disconnectDb();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

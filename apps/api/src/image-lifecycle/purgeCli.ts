/**
 * CLI legacy: npm run purge:deleted-accounts
 * Preferí `npm run jobs:images` (Fase 12).
 */
import { connectDb, disconnectDb } from "../db.js";
import { runAllImageLifecycleJobs } from "./jobs/index.js";

async function main() {
  const dryRun =
    process.argv.includes("--dry-run") || process.env.DRY_RUN === "1";
  const force = process.argv.includes("--force");
  await connectDb();
  try {
    const result = await runAllImageLifecycleJobs({ dryRun, force });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await disconnectDb();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

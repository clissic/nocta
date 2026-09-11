/**
 * Diagnóstico Image Service (siempre dry-run; sin deletes).
 * npm run diagnose:images -w @nocta/api
 */
import { connectDb, disconnectDb } from "../db.js";
import { getStorage, resetStorageSingleton } from "../storage/index.js";
import { runImageDiagnose } from "./diagnose.js";

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--execute") || argv.includes("--delete")) {
    console.error(
      "[diagnose:images] Este comando es solo DRY RUN. No acepta --execute/--delete."
    );
    console.error(
      "Para borrar tras revisar: npm run cleanup:images -w @nocta/api -- --execute"
    );
    process.exitCode = 1;
    return;
  }

  await connectDb();
  try {
    resetStorageSingleton();
    const storage = getStorage();
    const report = await runImageDiagnose({ storage, dryRun: true });
    console.log(JSON.stringify(report, null, 2));
    const total =
      report.counts.mongoWithoutObject +
      report.counts.objectWithoutMongo +
      report.counts.incompleteVariants +
      report.counts.inconsistentImageType +
      report.counts.deletedAccountObjects +
      report.counts.legacyResidues;
    console.error(
      `[diagnose:images] dry-run findings=${total} driver=${report.driver}`
    );
  } finally {
    await disconnectDb();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

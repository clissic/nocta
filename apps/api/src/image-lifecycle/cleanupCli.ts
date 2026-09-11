/**
 * CLI: npm run cleanup:images [-- --dry-run] [--execute]
 * Sin --execute nunca borra. --dry-run es el default.
 */
import { connectDb, disconnectDb } from "../db.js";
import { cleanupImages, parseCleanupArgs } from "./cleanup.js";

async function main() {
  const opts = parseCleanupArgs(process.argv.slice(2));
  await connectDb();
  try {
    const report = await cleanupImages(opts);
    console.log(
      JSON.stringify(
        {
          ...report,
          orphanUploadFiles: report.orphanUploadFiles.slice(0, 50),
          orphanClaimFiles: report.orphanClaimFiles.slice(0, 50),
          orphanIdentityFiles: report.orphanIdentityFiles.slice(0, 50),
          danglingAssets: report.danglingAssets.slice(0, 50),
          missingStorageKeys: report.missingStorageKeys.slice(0, 50),
          orphanUploadFilesTotal: report.orphanUploadFiles.length,
          orphanClaimFilesTotal: report.orphanClaimFiles.length,
          orphanIdentityFilesTotal: report.orphanIdentityFiles.length,
          danglingAssetsTotal: report.danglingAssets.length,
          missingStorageKeysTotal: report.missingStorageKeys.length,
        },
        null,
        2
      )
    );
  } finally {
    await disconnectDb();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

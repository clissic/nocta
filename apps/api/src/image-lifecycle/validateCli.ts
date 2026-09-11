/**
 * CLI: npm run validate:images
 * Post-migración: no modifica datos.
 */
import { connectDb, disconnectDb } from "../db.js";
import { validateMigratedImages } from "./validate.js";
import { buildImageInventory, formatBytes } from "./inventory.js";

async function main() {
  await connectDb();
  try {
    const inventory = await buildImageInventory();
    const validation = await validateMigratedImages();
    console.log(
      JSON.stringify(
        {
          audit: {
            legacyPublic: inventory.legacyPublicRefs,
            legacyPrivate: inventory.legacyPrivateRefs,
            migratable: inventory.migratableRefs,
            broken: inventory.brokenRefs,
            managedRefs: inventory.managedPublicRefs,
            alreadyMigratedLedger: inventory.alreadyMigratedLedger,
            approximateBytes: formatBytes(inventory.approximateBytesOnDisk),
            byType: inventory.byType,
            orphans: {
              uploads: inventory.orphanUploadFiles.length,
              claims: inventory.orphanClaimFiles.length,
              identity: inventory.orphanIdentityFiles.length,
            },
            paths: inventory.paths,
          },
          validation,
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

/**
 * CLI: npm run migrate:images [-- --preview] [--batch-size N] [--limit N] [--type T]
 * Migración REAL exige Object Storage Railway (no memory), salvo --allow-memory.
 */
import { connectDb, disconnectDb } from "../db.js";
import { migrateLegacyImages, parseMigrateArgs } from "./migrate.js";
import { hasRailwayCredentials, readStorageEnv } from "../storage/index.js";

async function main() {
  const argv = process.argv.slice(2);
  const opts = parseMigrateArgs(argv);
  const allowMemory = argv.includes("--allow-memory");
  const env = readStorageEnv();

  if (!opts.dryRun && !hasRailwayCredentials(env) && !allowMemory) {
    console.error(
      JSON.stringify(
        {
          error:
            "Migración real abortada: no hay credenciales Railway Object Storage en el entorno.",
          code: "STORAGE_NOT_CONFIGURED",
          hint: "Agregá AWS_ENDPOINT_URL / AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_S3_BUCKET_NAME (o STORAGE_*) a apps/api/.env. Para dry-run usá --preview o DRY_RUN=1.",
        },
        null,
        2
      )
    );
    process.exitCode = 1;
    return;
  }

  if (!opts.dryRun && !hasRailwayCredentials(env) && allowMemory) {
    console.warn(
      "[migrate:images] WARNING: --allow-memory — los objetos NO persistirán entre procesos"
    );
  }

  await connectDb();
  try {
    const report = await migrateLegacyImages(opts);
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await disconnectDb();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

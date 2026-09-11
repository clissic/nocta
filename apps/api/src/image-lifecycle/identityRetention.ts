/**
 * Retención identity_verification: TTL del registry (180 días).
 * Wrapper hacia el job Fase 12 (misma política SENSITIVE).
 * Preferí `runIdentityRetentionJob` / `npm run jobs:images -- --job=identity_retention`.
 */
export async function purgeExpiredIdentityImages(now = new Date()): Promise<{
  scanned: number;
  deleted: number;
  retentionDays: number;
  errors: string[];
}> {
  const { runIdentityRetentionJob } = await import(
    "./jobs/identityRetentionJob.js"
  );
  const result = await runIdentityRetentionJob({
    dryRun: false,
    force: true,
    now,
    log: (msg) => console.log(`[identity-retention] ${msg}`),
  });
  return {
    scanned: result.processed,
    deleted: result.deleted,
    retentionDays: Number(result.summary?.retentionDays ?? 180),
    errors: result.errorMessages,
  };
}

import { getImageTypeConfig } from "../../image-service/registry.js";
import { deleteManagedImage } from "../../image-service/ingest.js";
import { resolveDeliveryUrl } from "../../image-service/resolveDelivery.js";
import { ImageAsset } from "../../models/ImageAsset.js";
import { User } from "../../models/User.js";
import { withItemRetries, type JobContext, type JobRunResult } from "./types.js";

/**
 * Retención SENSITIVE de identity_verification (TTL registry, default 180d).
 * - NO publica URLs
 * - NO toca assets públicos
 * - Limpia refs en User.identityVerification al borrar
 */
export async function runIdentityRetentionJob(
  ctx: JobContext
): Promise<JobRunResult> {
  const config = getImageTypeConfig("identity_verification");
  const days =
    config.retention.kind === "ttl_days" ? config.retention.days : 180;
  const cutoff = new Date(ctx.now.getTime() - days * 24 * 60 * 60 * 1000);

  const docs = await ImageAsset.find({
    imageType: "identity_verification",
    createdAt: { $lte: cutoff },
  })
    .select("imageId visibility ownerId")
    .lean();

  ctx.log(
    `identity TTL days=${days} elegibles=${docs.length} cutoff=${cutoff.toISOString()} dryRun=${ctx.dryRun}`
  );

  const unsafe = docs.filter((d) => d.visibility === "public");
  if (unsafe.length > 0) {
    ctx.log(
      `ABORT: ${unsafe.length} identity assets con visibility=public (no se tocan)`
    );
    return {
      status: "failed",
      processed: docs.length,
      deleted: 0,
      errors: unsafe.length,
      pending: docs.length,
      errorMessages: unsafe.map(
        (d) => `${d.imageId}: identity no puede ser public`
      ),
      summary: { retentionDays: days, aborted: true },
    };
  }

  if (ctx.dryRun) {
    return {
      status: "success",
      processed: docs.length,
      deleted: 0,
      errors: 0,
      pending: docs.length,
      errorMessages: [],
      summary: {
        retentionDays: days,
        eligibleImageIds: docs.slice(0, 30).map((d) => d.imageId),
      },
    };
  }

  let deleted = 0;
  const errorMessages: string[] = [];

  for (const doc of docs) {
    const imageId = doc.imageId;

    const leaked = await resolveDeliveryUrl(`/api/media/${imageId}`);
    if (leaked) {
      errorMessages.push(
        `${imageId}: filtración pública detectada — skip delete`
      );
      continue;
    }

    const result = await withItemRetries(
      `identity-purge:${imageId}`,
      async () => {
        await deleteManagedImage(imageId);
        await User.updateMany(
          { "identityVerification.documentFrontPath": imageId },
          { $set: { "identityVerification.documentFrontPath": null } }
        );
        await User.updateMany(
          { "identityVerification.selfieWithDocumentPath": imageId },
          { $set: { "identityVerification.selfieWithDocumentPath": null } }
        );
      },
      { log: ctx.log }
    );

    if (result.ok) {
      deleted += 1;
    } else {
      errorMessages.push(`${imageId}: ${result.error}`);
    }
  }

  const errors = errorMessages.length;
  const status =
    errors === 0
      ? "success"
      : deleted > 0
        ? "partial"
        : docs.length === 0
          ? "success"
          : "failed";

  return {
    status,
    processed: docs.length,
    deleted,
    errors,
    pending: Math.max(0, docs.length - deleted - errors),
    errorMessages,
    summary: {
      retentionDays: days,
      cutoff: cutoff.toISOString(),
      sensitive: true,
      visibility: "private",
    },
  };
}

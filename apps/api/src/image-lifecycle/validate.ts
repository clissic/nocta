import { getStorage } from "../storage/index.js";
import { ImageAsset } from "../models/ImageAsset.js";
import { ImageMigrationRecord } from "../models/ImageMigrationRecord.js";
import { getImageTypeConfig } from "../image-service/registry.js";
import { resolveDeliveryUrl } from "../image-service/resolveDelivery.js";
import { looksLikeManagedImageId } from "../image-service/privateAccess.js";
import { parseMediaImageId, isManagedMediaRef } from "../image-service/refs.js";
import { buildImageInventory } from "./inventory.js";

export type ValidateMigrationReport = {
  ledgerDone: number;
  ledgerError: number;
  ledgerMissing: number;
  validatedOk: number;
  mismatches: Array<{ imageId?: string; sourceKey?: string; issue: string }>;
  remainingLegacyMigratable: number;
  remainingBroken: number;
  orphans: number;
  sampleDeliveryOk: number;
  sampleDeliveryFail: number;
  complete: boolean;
};

/**
 * Valida post-migración: ledger done → ImageAsset + keys en storage + variants.
 * No modifica ni borra nada.
 */
export async function validateMigratedImages(): Promise<ValidateMigrationReport> {
  const storage = getStorage();
  const mismatches: ValidateMigrationReport["mismatches"] = [];

  const [done, errors, missing] = await Promise.all([
    ImageMigrationRecord.find({ status: "done" }).lean(),
    ImageMigrationRecord.countDocuments({ status: "error" }),
    ImageMigrationRecord.countDocuments({ status: "missing" }),
  ]);

  let validatedOk = 0;
  let sampleDeliveryOk = 0;
  let sampleDeliveryFail = 0;

  for (const rec of done) {
    const imageId = rec.imageId ?? parseMediaImageId(rec.mediaRef ?? "");
    const issues: string[] = [];
    if (!imageId) {
      mismatches.push({
        sourceKey: rec.sourceKey,
        issue: "ledger done sin imageId/mediaRef",
      });
      continue;
    }

    const doc = await ImageAsset.findOne({ imageId }).lean();
    if (!doc) {
      mismatches.push({
        sourceKey: rec.sourceKey,
        imageId,
        issue: "ImageAsset ausente",
      });
      continue;
    }

    const cfg = getImageTypeConfig(doc.imageType as never);
    if (doc.imageType !== rec.imageType) {
      issues.push(`ImageType mismatch ledger=${rec.imageType} asset=${doc.imageType}`);
    }
    if (doc.visibility !== cfg.visibility) {
      issues.push(
        `visibility mismatch expected=${cfg.visibility} got=${doc.visibility}`
      );
    }

    if (cfg.visibility === "public") {
      const v = doc.variants;
      const needed = [
        v?.thumb?.webp?.key,
        v?.thumb?.avif?.key,
        v?.medium?.webp?.key,
        v?.medium?.avif?.key,
        v?.large?.webp?.key,
        v?.large?.avif?.key,
      ];
      if (needed.some((k) => !k)) {
        issues.push("variantes públicas incompletas");
      }
      for (const key of needed.filter(Boolean) as string[]) {
        if (!(await storage.exists(key))) {
          issues.push(`objeto ausente en storage: ${key}`);
        }
      }

      const delivered = await resolveDeliveryUrl(
        rec.mediaRef ?? `/api/media/${imageId}`
      );
      if (delivered && /^https?:\/\//i.test(delivered)) {
        sampleDeliveryOk += 1;
      } else {
        sampleDeliveryFail += 1;
        issues.push("serialize/delivery no resolvió URL pública");
      }
    } else {
      if (!doc.storageKey) {
        issues.push("private sin storageKey");
      } else if (!(await storage.exists(doc.storageKey))) {
        issues.push(`objeto privado ausente: ${doc.storageKey}`);
      }
      const leaked = await resolveDeliveryUrl(`/api/media/${imageId}`);
      if (leaked) {
        issues.push("private filtrada por resolveDeliveryUrl");
      }
    }

    if (issues.length === 0) {
      validatedOk += 1;
    } else {
      for (const issue of issues) {
        mismatches.push({ sourceKey: rec.sourceKey, imageId, issue });
      }
    }
  }

  const inventory = await buildImageInventory();
  const remainingLegacyMigratable = inventory.migratableRefs;
  const remainingBroken = inventory.brokenRefs;
  const orphans =
    inventory.orphanUploadFiles.length +
    inventory.orphanClaimFiles.length +
    inventory.orphanIdentityFiles.length;

  const complete =
    remainingLegacyMigratable === 0 &&
    mismatches.length === 0 &&
    errors === 0;

  return {
    ledgerDone: done.length,
    ledgerError: errors,
    ledgerMissing: missing,
    validatedOk,
    mismatches: mismatches.slice(0, 50),
    remainingLegacyMigratable,
    remainingBroken,
    orphans,
    sampleDeliveryOk,
    sampleDeliveryFail,
    complete,
  };
}

export function isMigratedStoredValue(value: string): boolean {
  return (
    isManagedMediaRef(value) ||
    looksLikeManagedImageId(value) ||
    Boolean(parseMediaImageId(value))
  );
}

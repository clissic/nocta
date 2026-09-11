import { isValidObjectId } from "mongoose";
import { unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { getStorage } from "../storage/index.js";
import { deleteManagedImage } from "../image-service/ingest.js";
import { imageMetricFromError } from "../image-service/observability.js";
import { ImageAsset } from "../models/ImageAsset.js";
import { User } from "../models/User.js";
import { Venue } from "../models/Venue.js";
import { VenueReview } from "../models/VenueReview.js";
import { VenueNews } from "../models/VenueNews.js";
import { UserPost } from "../models/UserPost.js";
import { VenueRequest } from "../models/VenueRequest.js";
import {
  CLAIM_EVIDENCE_DIR,
  IDENTITY_VERIFICATION_DIR,
  UPLOADS_DIR,
} from "../uploads/paths.js";
import {
  buildImageInventory,
  countManagedAssetsMissingVariants,
} from "./inventory.js";
import { looksLikeManagedImageId } from "../image-service/privateAccess.js";
import { parseMediaImageId } from "../image-service/refs.js";

export type CleanupOptions = {
  /** Por defecto true: solo reporta. */
  dryRun: boolean;
  /** Requiere --execute explícito para borrar. */
  execute: boolean;
};

export type CleanupReport = {
  dryRun: boolean;
  executed: boolean;
  orphanUploadFiles: string[];
  orphanClaimFiles: string[];
  orphanIdentityFiles: string[];
  brokenRefs: number;
  incompleteVariants: number;
  danglingAssets: Array<{ imageId: string; reason: string }>;
  missingStorageKeys: Array<{ imageId: string; key: string }>;
  deleted: {
    uploadFiles: number;
    claimFiles: number;
    identityFiles: number;
    assets: number;
  };
};

function log(msg: string) {
  console.log(`[cleanup:images] ${msg}`);
}

async function collectReferencedImageIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  const add = (ref: string | null | undefined) => {
    if (!ref) return;
    const id = parseMediaImageId(ref) ?? (looksLikeManagedImageId(ref) ? ref : null);
    if (id) ids.add(id);
  };

  const users = await User.find({}).select(
    "profile.photos identityVerification.documentFrontPath identityVerification.selfieWithDocumentPath"
  );
  for (const u of users) {
    for (const p of u.profile?.photos ?? []) add(p);
    const v = u.identityVerification as
      | {
          documentFrontPath?: string | null;
          selfieWithDocumentPath?: string | null;
        }
      | undefined;
    add(v?.documentFrontPath ?? undefined);
    add(v?.selfieWithDocumentPath ?? undefined);
  }

  for (const venue of await Venue.find({}).select("photos")) {
    for (const p of venue.photos ?? []) add(p);
  }
  for (const review of await VenueReview.find({}).select("photos")) {
    for (const p of review.photos ?? []) add(p);
  }
  for (const news of await VenueNews.find({}).select("photos")) {
    for (const p of news.photos ?? []) add(p);
  }
  for (const post of await UserPost.find({}).select("photos")) {
    for (const p of post.photos ?? []) add(p);
  }
  for (const request of await VenueRequest.find({}).select(
    "photos evidenceFiles"
  )) {
    for (const p of request.photos ?? []) add(p);
    for (const f of request.evidenceFiles ?? []) add(f.filename);
  }

  return ids;
}

async function entityExists(
  entityType: string | undefined,
  entityId: string | undefined,
  ownerId: string
): Promise<boolean> {
  if (!entityId && !ownerId) return false;
  const id = entityId || ownerId;
  if (!isValidObjectId(id) && !isValidObjectId(ownerId)) {
    return false;
  }
  try {
    switch (entityType) {
      case "user":
      case "identity":
        return Boolean(
          await User.exists({
            _id: isValidObjectId(id) ? id : ownerId,
          })
        );
      case "space":
        return Boolean(
          await Venue.exists({
            _id: isValidObjectId(id) ? id : ownerId,
          })
        );
      case "news":
        return isValidObjectId(entityId)
          ? Boolean(await VenueNews.exists({ _id: entityId }))
          : false;
      case "review":
        return isValidObjectId(entityId)
          ? Boolean(await VenueReview.exists({ _id: entityId }))
          : false;
      case "post":
        return isValidObjectId(entityId)
          ? Boolean(await UserPost.exists({ _id: entityId }))
          : false;
      case "space_request":
      case "claim":
        return isValidObjectId(entityId)
          ? Boolean(await VenueRequest.exists({ _id: entityId }))
          : false;
      default:
        return isValidObjectId(ownerId)
          ? Boolean(await User.exists({ _id: ownerId }))
          : false;
    }
  } catch {
    return false;
  }
}

/** Detecta huérfanos; borra solo con execute=true (y dryRun=false). */
export async function cleanupImages(
  opts: CleanupOptions
): Promise<CleanupReport> {
  const execute = opts.execute && !opts.dryRun;
  if (opts.execute && opts.dryRun) {
    log("aviso: --execute ignorado porque también está --dry-run");
  }
  if (!opts.execute) {
    log("modo dry-run (default). Para borrar: --execute (sin --dry-run)");
  }

  const inventory = await buildImageInventory();
  const incompleteVariants = await countManagedAssetsMissingVariants();
  const referencedIds = await collectReferencedImageIds();
  const storage = getStorage();

  const danglingAssets: Array<{ imageId: string; reason: string }> = [];
  const missingStorageKeys: Array<{ imageId: string; key: string }> = [];

  const assets = await ImageAsset.find({}).lean();
  for (const doc of assets) {
    if (!referencedIds.has(doc.imageId)) {
      danglingAssets.push({
        imageId: doc.imageId,
        reason: "sin referencia en entidades de producto",
      });
    } else {
      const okEntity = await entityExists(
        doc.entityType,
        doc.entityId ?? undefined,
        doc.ownerId
      );
      if (!okEntity) {
        danglingAssets.push({
          imageId: doc.imageId,
          reason: "entidad dueña inexistente",
        });
      }
    }

    const keys = [
      ...(doc.keys ?? []),
      doc.storageKey,
      doc.variants?.thumb?.webp?.key,
      doc.variants?.thumb?.avif?.key,
      doc.variants?.medium?.webp?.key,
      doc.variants?.medium?.avif?.key,
      doc.variants?.large?.webp?.key,
      doc.variants?.large?.avif?.key,
    ].filter((k): k is string => Boolean(k));

    for (const key of keys) {
      try {
        const ok = await storage.exists(key);
        if (!ok) {
          missingStorageKeys.push({ imageId: doc.imageId, key });
        }
      } catch {
        missingStorageKeys.push({ imageId: doc.imageId, key });
      }
    }
  }

  const deleted = {
    uploadFiles: 0,
    claimFiles: 0,
    identityFiles: 0,
    assets: 0,
  };

  if (execute) {
    for (const name of inventory.orphanUploadFiles) {
      const abs = join(UPLOADS_DIR, name);
      if (existsSync(abs)) {
        try {
          unlinkSync(abs);
          deleted.uploadFiles += 1;
        } catch (err) {
          imageMetricFromError("cleanup_error", err, { op: "unlink_upload" });
          log(`no se pudo borrar upload ${name}: ${err}`);
        }
      }
    }
    for (const name of inventory.orphanClaimFiles) {
      const abs = join(CLAIM_EVIDENCE_DIR, name);
      if (existsSync(abs)) {
        try {
          unlinkSync(abs);
          deleted.claimFiles += 1;
        } catch (err) {
          imageMetricFromError("cleanup_error", err, { op: "unlink_claim" });
          log(`no se pudo borrar claim ${name}: ${err}`);
        }
      }
    }
    for (const name of inventory.orphanIdentityFiles) {
      const abs = join(IDENTITY_VERIFICATION_DIR, name);
      if (existsSync(abs)) {
        try {
          unlinkSync(abs);
          deleted.identityFiles += 1;
        } catch (err) {
          imageMetricFromError("cleanup_error", err, { op: "unlink_identity" });
          log(`no se pudo borrar identity ${name}: ${err}`);
        }
      }
    }
    for (const asset of danglingAssets) {
      try {
        await deleteManagedImage(asset.imageId);
        deleted.assets += 1;
      } catch (err) {
        imageMetricFromError("cleanup_error", err, { op: "delete_asset" });
        log(`no se pudo borrar asset ${asset.imageId}: ${err}`);
      }
    }
  }

  const report: CleanupReport = {
    dryRun: !execute,
    executed: execute,
    orphanUploadFiles: inventory.orphanUploadFiles,
    orphanClaimFiles: inventory.orphanClaimFiles,
    orphanIdentityFiles: inventory.orphanIdentityFiles,
    brokenRefs: inventory.brokenRefs,
    incompleteVariants,
    danglingAssets,
    missingStorageKeys,
    deleted,
  };

  log(
    `huérfanos disco uploads=${report.orphanUploadFiles.length} claims=${report.orphanClaimFiles.length} identity=${report.orphanIdentityFiles.length}`
  );
  log(
    `brokenRefs=${report.brokenRefs} incompleteVariants=${report.incompleteVariants} danglingAssets=${report.danglingAssets.length} missingKeys=${report.missingStorageKeys.length}`
  );
  if (execute) {
    log(
      `eliminado uploads=${deleted.uploadFiles} claims=${deleted.claimFiles} identity=${deleted.identityFiles} assets=${deleted.assets}`
    );
  }

  return report;
}

export function parseCleanupArgs(argv: string[]): CleanupOptions {
  const execute =
    argv.includes("--execute") || process.env.CLEANUP_EXECUTE === "1";
  const dryRun =
    argv.includes("--dry-run") ||
    argv.includes("--preview") ||
    process.env.DRY_RUN === "1" ||
    !execute;
  return { dryRun, execute };
}

import { readFileSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  ingestPublicImage,
  ingestIdentityImage,
  ingestPrivateEvidence,
} from "../image-service/ingest.js";
import { imageMetricFromError } from "../image-service/observability.js";
import type { ImagePathContext, ImageType } from "../image-service/types.js";
import { ImageAsset } from "../models/ImageAsset.js";
import { ImageMigrationRecord } from "../models/ImageMigrationRecord.js";
import { User } from "../models/User.js";
import { Venue } from "../models/Venue.js";
import { VenueReview } from "../models/VenueReview.js";
import { VenueNews } from "../models/VenueNews.js";
import { UserPost } from "../models/UserPost.js";
import { VenueRequest } from "../models/VenueRequest.js";
import {
  buildImageInventory,
  formatBytes,
  type LegacyRefHit,
  type InventoryReport,
} from "./inventory.js";

export type MigrateOptions = {
  dryRun: boolean;
  batchSize: number;
  /** Máximo de ítems a procesar en esta corrida (después de filtros). */
  limit?: number;
  /** Solo este ImageType. */
  type?: ImageType;
  /** Si true, borra el archivo legacy de disco tras migrar OK (no en dry-run). */
  deleteLegacyFiles: boolean;
};

export type MigrateCounters = {
  scanned: number;
  migrated: number;
  skipped: number;
  missing: number;
  errors: number;
  byType: Record<string, number>;
  errorSamples: Array<{ sourceKey: string; error: string }>;
};

export type MigrateReport = {
  dryRun: boolean;
  summary: {
    totalLegacyRefs: number;
    migratable: number;
    alreadyMigratedLedger: number;
    brokenRefs: number;
    orphanFiles: number;
    approximateBytesOnDisk: number;
    approximateBytesLabel: string;
    byType: Record<string, number>;
  };
  inventory: Pick<
    InventoryReport,
    | "legacyPublicRefs"
    | "legacyPrivateRefs"
    | "brokenRefs"
    | "byType"
    | "orphanUploadFiles"
    | "orphanClaimFiles"
    | "orphanIdentityFiles"
    | "migratableRefs"
    | "alreadyMigratedLedger"
    | "approximateBytesOnDisk"
    | "managedPublicRefs"
    | "paths"
  >;
  counters: MigrateCounters;
};

function log(msg: string) {
  console.log(`[migrate:images] ${msg}`);
}

async function alreadyDone(sourceKey: string): Promise<boolean> {
  const rec = await ImageMigrationRecord.findOne({ sourceKey }).lean();
  return rec?.status === "done";
}

async function upsertRecord(input: {
  sourceKey: string;
  imageType: ImageType;
  legacyRef: string;
  entityCollection: string;
  entityId: string;
  status: "pending" | "done" | "skipped" | "error" | "missing";
  mediaRef?: string;
  imageId?: string;
  error?: string;
  dryRun: boolean;
}) {
  if (input.dryRun && input.status === "done") {
    // Dry-run no marca done para no saltar la migración real.
    return;
  }
  await ImageMigrationRecord.findOneAndUpdate(
    { sourceKey: input.sourceKey },
    {
      $set: {
        imageType: input.imageType,
        legacyRef: input.legacyRef,
        entityCollection: input.entityCollection,
        entityId: input.entityId,
        status: input.status,
        mediaRef: input.mediaRef,
        imageId: input.imageId,
        error: input.error,
        dryRun: input.dryRun,
      },
    },
    { upsert: true }
  );
}

function contextFor(hit: LegacyRefHit): ImagePathContext {
  switch (hit.imageType) {
    case "user_profile":
    case "identity_verification":
      return { userId: hit.entityId };
    case "user_post":
      return { userId: hit.entityId, postId: hit.entityId };
    case "space":
      return { spaceId: hit.entityId };
    case "space_news":
    case "space_promotion":
      return { spaceId: hit.entityId };
    case "review":
      return { reviewId: hit.entityId };
    case "space_request":
      return { requestId: hit.entityId, userId: hit.entityId };
    case "claim_evidence":
      return { userId: hit.entityId, requestId: hit.entityId };
    case "report_evidence":
      return { reportId: hit.entityId };
    default:
      return {};
  }
}

async function resolveOwnerAndContext(
  hit: LegacyRefHit
): Promise<{ ownerId: string; context: ImagePathContext; entityType: string }> {
  switch (hit.imageType) {
    case "user_profile":
    case "identity_verification":
      return {
        ownerId: hit.entityId,
        context: { userId: hit.entityId },
        entityType: hit.imageType === "identity_verification" ? "identity" : "user",
      };
    case "user_post": {
      const post = await UserPost.findById(hit.entityId).select("authorId").lean();
      const ownerId = post?.authorId?.toString() ?? hit.entityId;
      return {
        ownerId,
        context: { userId: ownerId, postId: hit.entityId },
        entityType: "post",
      };
    }
    case "space": {
      const venue = await Venue.findById(hit.entityId).select("ownerId").lean();
      const ownerId =
        venue?.ownerId?.toString() ?? hit.entityId;
      return {
        ownerId,
        context: { spaceId: hit.entityId },
        entityType: "space",
      };
    }
    case "space_news":
    case "space_promotion": {
      const news = await VenueNews.findById(hit.entityId).select("venueId").lean();
      const spaceId = news?.venueId?.toString() ?? hit.entityId;
      return {
        ownerId: spaceId,
        context: { spaceId },
        entityType: "news",
      };
    }
    case "review": {
      const review = await VenueReview.findById(hit.entityId)
        .select("userId")
        .lean();
      const ownerId = review?.userId?.toString() ?? hit.entityId;
      return {
        ownerId,
        context: { reviewId: hit.entityId, userId: ownerId },
        entityType: "review",
      };
    }
    case "space_request": {
      const req = await VenueRequest.findById(hit.entityId)
        .select("requesterId")
        .lean();
      const ownerId = req?.requesterId?.toString() ?? hit.entityId;
      return {
        ownerId,
        context: { requestId: hit.entityId, userId: ownerId },
        entityType: "space_request",
      };
    }
    case "claim_evidence": {
      const req = await VenueRequest.findById(hit.entityId)
        .select("requesterId")
        .lean();
      const ownerId = req?.requesterId?.toString() ?? hit.entityId;
      return {
        ownerId,
        context: { requestId: hit.entityId, userId: ownerId },
        entityType: "claim",
      };
    }
    default:
      return {
        ownerId: hit.entityId,
        context: contextFor(hit),
        entityType: hit.imageType,
      };
  }
}

async function applyEntityUpdate(
  hit: LegacyRefHit,
  storedValue: string
): Promise<void> {
  const { entityCollection, entityId, field, index } = hit;

  if (entityCollection === "users" && field === "profile.photos" && index != null) {
    const user = await User.findById(entityId);
    if (!user?.profile?.photos) return;
    const photos = [...(user.profile.photos as string[])];
    if (photos[index] !== hit.legacyRef) return;
    photos[index] = storedValue;
    user.profile.photos = photos;
    user.markModified("profile.photos");
    await user.save();
    return;
  }

  if (
    entityCollection === "users" &&
    field.startsWith("identityVerification.")
  ) {
    const sub = field.split(".")[1];
    await User.updateOne(
      { _id: entityId, [`identityVerification.${sub}`]: hit.legacyRef },
      { $set: { [`identityVerification.${sub}`]: storedValue } }
    );
    return;
  }

  if (entityCollection === "venues" && field === "photos" && index != null) {
    const venue = await Venue.findById(entityId);
    if (!venue) return;
    const photos = [...(venue.photos ?? [])];
    if (photos[index] !== hit.legacyRef) return;
    photos[index] = storedValue;
    venue.photos = photos;
    await venue.save();
    return;
  }

  if (
    entityCollection === "venuereviews" &&
    field === "photos" &&
    index != null
  ) {
    const review = await VenueReview.findById(entityId);
    if (!review) return;
    const photos = [...(review.photos ?? [])];
    if (photos[index] !== hit.legacyRef) return;
    photos[index] = storedValue;
    review.photos = photos;
    await review.save();
    return;
  }

  if (entityCollection === "venuenews" && field === "photos" && index != null) {
    const news = await VenueNews.findById(entityId);
    if (!news) return;
    const photos = [...(news.photos ?? [])];
    if (photos[index] !== hit.legacyRef) return;
    photos[index] = storedValue;
    news.photos = photos;
    await news.save();
    return;
  }

  if (entityCollection === "userposts" && field === "photos" && index != null) {
    const post = await UserPost.findById(entityId);
    if (!post) return;
    const photos = [...(post.photos ?? [])];
    if (photos[index] !== hit.legacyRef) return;
    photos[index] = storedValue;
    post.photos = photos;
    await post.save();
    return;
  }

  if (
    entityCollection === "venuerequests" &&
    field === "photos" &&
    index != null
  ) {
    const request = await VenueRequest.findById(entityId);
    if (!request) return;
    const photos = [...(request.photos ?? [])];
    if (photos[index] !== hit.legacyRef) return;
    photos[index] = storedValue;
    request.photos = photos;
    await request.save();
    return;
  }

  if (entityCollection === "venuerequests" && field === "evidenceFiles") {
    await VenueRequest.updateOne(
      {
        _id: entityId,
        "evidenceFiles.filename": hit.legacyRef,
      },
      {
        $set: { "evidenceFiles.$.filename": storedValue },
      }
    );
  }
}

function sniffMime(buffer: Buffer, fallback?: string): string {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  if (buffer.length >= 4 && buffer.toString("ascii", 0, 4) === "%PDF") {
    return "application/pdf";
  }
  return fallback ?? "image/jpeg";
}

async function migrateOne(
  hit: LegacyRefHit,
  opts: MigrateOptions,
  counters: MigrateCounters
): Promise<void> {
  counters.scanned += 1;

  if (await alreadyDone(hit.sourceKey)) {
    counters.skipped += 1;
    log(`skip done ${hit.sourceKey}`);
    return;
  }

  if (!hit.existsOnDisk || !hit.absolutePath || !existsSync(hit.absolutePath)) {
    counters.missing += 1;
    await upsertRecord({
      sourceKey: hit.sourceKey,
      imageType: hit.imageType,
      legacyRef: hit.legacyRef,
      entityCollection: hit.entityCollection,
      entityId: hit.entityId,
      status: "missing",
      error: "Archivo ausente en disco",
      dryRun: opts.dryRun,
    });
    log(`missing ${hit.sourceKey}`);
    return;
  }

  if (opts.dryRun) {
    counters.migrated += 1;
    counters.byType[hit.imageType] = (counters.byType[hit.imageType] ?? 0) + 1;
    log(
      `dry-run would migrate ${hit.imageType} ${hit.legacyRef} → ${hit.visibility}`
    );
    return;
  }

  try {
    const buffer = readFileSync(hit.absolutePath);
    const mime = sniffMime(buffer);
    const { ownerId, context, entityType } = await resolveOwnerAndContext(hit);

    let mediaRef: string;
    let imageId: string;

    if (hit.imageType === "identity_verification") {
      const result = await ingestIdentityImage({
        ownerId,
        context,
        buffer,
        declaredMime: mime,
      });
      imageId = result.imageId;
      mediaRef = result.imageId; // se guarda imageId, no URL pública
    } else if (hit.imageType === "claim_evidence") {
      const result = await ingestPrivateEvidence({
        type: "claim_evidence",
        ownerId,
        entityType,
        entityId: hit.entityId,
        context,
        buffer,
        declaredMime: mime,
      });
      imageId = result.imageId;
      mediaRef = result.imageId;
    } else {
      const result = await ingestPublicImage({
        type: hit.imageType,
        ownerId,
        entityType,
        entityId: hit.entityId,
        context,
        buffer,
        declaredMime: mime,
      });
      imageId = result.imageId;
      mediaRef = result.mediaRef;
    }

    await ImageAsset.updateOne(
      { imageId },
      { $set: { legacySource: hit.legacyRef } }
    );

    await applyEntityUpdate(hit, mediaRef);

    await upsertRecord({
      sourceKey: hit.sourceKey,
      imageType: hit.imageType,
      legacyRef: hit.legacyRef,
      entityCollection: hit.entityCollection,
      entityId: hit.entityId,
      status: "done",
      mediaRef,
      imageId,
      dryRun: false,
    });

    if (opts.deleteLegacyFiles && hit.absolutePath) {
      try {
        unlinkSync(hit.absolutePath);
      } catch {
        /* best-effort */
      }
    }

    counters.migrated += 1;
    counters.byType[hit.imageType] = (counters.byType[hit.imageType] ?? 0) + 1;
    log(`ok ${hit.imageType} ${hit.sourceKey} → ${mediaRef}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    counters.errors += 1;
    imageMetricFromError("migration_error", err, {
      imageType: hit.imageType,
      op: "migrateLegacyHit",
    });
    if (counters.errorSamples.length < 20) {
      counters.errorSamples.push({ sourceKey: hit.sourceKey, error: message });
    }
    await upsertRecord({
      sourceKey: hit.sourceKey,
      imageType: hit.imageType,
      legacyRef: hit.legacyRef,
      entityCollection: hit.entityCollection,
      entityId: hit.entityId,
      status: "error",
      error: message,
      dryRun: false,
    });
    log(`error ${hit.sourceKey}: ${message}`);
  }
}

/** Migra refs legacy al Image Service. Idempotente y reanudable. */
export async function migrateLegacyImages(
  opts: MigrateOptions
): Promise<MigrateReport> {
  log(
    `inicio dryRun=${opts.dryRun} batchSize=${opts.batchSize} type=${opts.type ?? "all"}`
  );
  const inventory = await buildImageInventory();
  let hits = inventory.hits;
  if (opts.type) {
    hits = hits.filter((h) => h.imageType === opts.type);
  }

  const counters: MigrateCounters = {
    scanned: 0,
    migrated: 0,
    skipped: 0,
    missing: 0,
    errors: 0,
    byType: {},
    errorSamples: [],
  };

  const limit = opts.limit ?? hits.length;
  const toProcess = hits.slice(0, limit);

  for (let i = 0; i < toProcess.length; i += opts.batchSize) {
    const batch = toProcess.slice(i, i + opts.batchSize);
    log(`lote ${i / opts.batchSize + 1} size=${batch.length}`);
    for (const hit of batch) {
      await migrateOne(hit, opts, counters);
    }
  }

  log(
    `fin migrated=${counters.migrated} skipped=${counters.skipped} missing=${counters.missing} errors=${counters.errors}`
  );

  return {
    dryRun: opts.dryRun,
    summary: {
      totalLegacyRefs: inventory.legacyPublicRefs + inventory.legacyPrivateRefs,
      migratable: inventory.migratableRefs,
      alreadyMigratedLedger: inventory.alreadyMigratedLedger,
      brokenRefs: inventory.brokenRefs,
      orphanFiles:
        inventory.orphanUploadFiles.length +
        inventory.orphanClaimFiles.length +
        inventory.orphanIdentityFiles.length,
      approximateBytesOnDisk: inventory.approximateBytesOnDisk,
      approximateBytesLabel: formatBytes(inventory.approximateBytesOnDisk),
      byType: inventory.byType,
    },
    inventory: {
      legacyPublicRefs: inventory.legacyPublicRefs,
      legacyPrivateRefs: inventory.legacyPrivateRefs,
      brokenRefs: inventory.brokenRefs,
      byType: inventory.byType,
      orphanUploadFiles: inventory.orphanUploadFiles,
      orphanClaimFiles: inventory.orphanClaimFiles,
      orphanIdentityFiles: inventory.orphanIdentityFiles,
      migratableRefs: inventory.migratableRefs,
      alreadyMigratedLedger: inventory.alreadyMigratedLedger,
      approximateBytesOnDisk: inventory.approximateBytesOnDisk,
      managedPublicRefs: inventory.managedPublicRefs,
      paths: inventory.paths,
    },
    counters,
  };
}

export function parseMigrateArgs(argv: string[]): MigrateOptions {
  // npm puede interceptar `--dry-run` global; también --preview y DRY_RUN=1
  const dryRun =
    argv.includes("--dry-run") ||
    argv.includes("--preview") ||
    process.env.DRY_RUN === "1" ||
    process.env.MIGRATE_DRY_RUN === "1";
  const deleteLegacyFiles = argv.includes("--delete-legacy-files");
  let batchSize = 25;
  let limit: number | undefined;
  let type: ImageType | undefined;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith("--batch-size=")) {
      batchSize = Math.max(1, Number(a.split("=")[1]) || 25);
    } else if (a === "--batch-size" && argv[i + 1]) {
      batchSize = Math.max(1, Number(argv[++i]) || 25);
    } else if (a.startsWith("--limit=")) {
      limit = Math.max(1, Number(a.slice("--limit=".length)) || 1);
    } else if (a === "--limit" && argv[i + 1]) {
      limit = Math.max(1, Number(argv[++i]) || 1);
    } else if (a.startsWith("--type=")) {
      type = a.slice("--type=".length) as ImageType;
    } else if (a === "--type" && argv[i + 1]) {
      type = argv[++i] as ImageType;
    }
  }
  return { dryRun, batchSize, limit, type, deleteLegacyFiles };
}

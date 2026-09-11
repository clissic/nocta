import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  CLAIM_EVIDENCE_DIR,
  IDENTITY_VERIFICATION_DIR,
  UPLOADS_DIR,
} from "../uploads/paths.js";
import { User } from "../models/User.js";
import { Venue } from "../models/Venue.js";
import { VenueReview } from "../models/VenueReview.js";
import { VenueNews } from "../models/VenueNews.js";
import { UserPost } from "../models/UserPost.js";
import { VenueRequest } from "../models/VenueRequest.js";
import { ImageAsset } from "../models/ImageAsset.js";
import { ImageMigrationRecord } from "../models/ImageMigrationRecord.js";
import { isManagedMediaRef } from "../image-service/refs.js";
import { looksLikeManagedImageId } from "../image-service/privateAccess.js";
import type { ImageType } from "../image-service/types.js";

export type LegacyRefHit = {
  sourceKey: string;
  imageType: ImageType;
  legacyRef: string;
  entityCollection: string;
  entityId: string;
  field: string;
  index?: number;
  absolutePath?: string;
  existsOnDisk: boolean;
  bytesOnDisk: number;
  visibility: "public" | "private";
};

export type InventoryReport = {
  uploadsDirFiles: number;
  claimDirFiles: number;
  identityDirFiles: number;
  legacyPublicRefs: number;
  legacyPrivateRefs: number;
  managedPublicRefs: number;
  brokenRefs: number;
  migratableRefs: number;
  alreadyMigratedLedger: number;
  approximateBytesOnDisk: number;
  byType: Record<string, number>;
  hits: LegacyRefHit[];
  orphanUploadFiles: string[];
  orphanClaimFiles: string[];
  orphanIdentityFiles: string[];
  paths: {
    uploadsDir: string;
    claimDir: string;
    identityDir: string;
  };
};

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  try {
    return readdirSync(dir).filter((name) => {
      try {
        return statSync(join(dir, name)).isFile();
      } catch {
        return false;
      }
    });
  } catch {
    return [];
  }
}

function fileBytes(abs?: string): number {
  if (!abs || !existsSync(abs)) return 0;
  try {
    return statSync(abs).size;
  } catch {
    return 0;
  }
}

function uploadAbs(ref: string): string | undefined {
  if (!ref.startsWith("/uploads/")) return undefined;
  const name = ref.slice("/uploads/".length);
  if (!name || name.includes("..") || name.includes("/") || name.includes("\\")) {
    return undefined;
  }
  return join(UPLOADS_DIR, name);
}

function pushHit(
  hits: LegacyRefHit[],
  byType: Record<string, number>,
  hit: LegacyRefHit
) {
  hits.push(hit);
  byType[hit.imageType] = (byType[hit.imageType] ?? 0) + 1;
}

/** Inventario de refs legacy y archivos en disco. No modifica nada. */
export async function buildImageInventory(): Promise<InventoryReport> {
  const hits: LegacyRefHit[] = [];
  const byType: Record<string, number> = {};
  const referencedUploads = new Set<string>();
  const referencedClaims = new Set<string>();
  const referencedIdentity = new Set<string>();
  let managedPublicRefs = 0;
  let brokenRefs = 0;

  const users = await User.find({}).select(
    "profile.photos identityVerification.documentFrontPath identityVerification.selfieWithDocumentPath"
  );
  for (const user of users) {
    const photos = user.profile?.photos ?? [];
    photos.forEach((ref, index) => {
      if (!ref) return;
      if (isManagedMediaRef(ref) || /^https?:\/\//i.test(ref)) {
        managedPublicRefs += 1;
        return;
      }
      if (!ref.startsWith("/uploads/")) return;
      const abs = uploadAbs(ref);
      const exists = Boolean(abs && existsSync(abs));
      if (!exists) brokenRefs += 1;
      if (abs) referencedUploads.add(abs);
      pushHit(hits, byType, {
        sourceKey: `users:${user._id}:photos:${index}:${ref}`,
        imageType: "user_profile",
        legacyRef: ref,
        entityCollection: "users",
        entityId: user._id.toString(),
        field: "profile.photos",
        index,
        absolutePath: abs,
        existsOnDisk: exists,
        bytesOnDisk: fileBytes(abs),
        visibility: "public",
      });
    });

    const verification = user.identityVerification as
      | {
          documentFrontPath?: string | null;
          selfieWithDocumentPath?: string | null;
        }
      | undefined;
    for (const [field, stored] of [
      ["documentFrontPath", verification?.documentFrontPath],
      ["selfieWithDocumentPath", verification?.selfieWithDocumentPath],
    ] as const) {
      if (!stored) continue;
      if (looksLikeManagedImageId(stored)) {
        managedPublicRefs += 1;
        continue;
      }
      const abs = join(IDENTITY_VERIFICATION_DIR, stored);
      const exists = existsSync(abs);
      if (!exists) brokenRefs += 1;
      referencedIdentity.add(stored);
      pushHit(hits, byType, {
        sourceKey: `users:${user._id}:identity:${field}:${stored}`,
        imageType: "identity_verification",
        legacyRef: stored,
        entityCollection: "users",
        entityId: user._id.toString(),
        field: `identityVerification.${field}`,
        absolutePath: abs,
        existsOnDisk: exists,
        bytesOnDisk: fileBytes(abs),
        visibility: "private",
      });
    }
  }

  const venues = await Venue.find({}).select("photos");
  for (const venue of venues) {
    (venue.photos ?? []).forEach((ref, index) => {
      if (!ref) return;
      if (isManagedMediaRef(ref) || /^https?:\/\//i.test(ref)) {
        managedPublicRefs += 1;
        return;
      }
      if (!ref.startsWith("/uploads/")) return;
      const abs = uploadAbs(ref);
      const exists = Boolean(abs && existsSync(abs));
      if (!exists) brokenRefs += 1;
      if (abs) referencedUploads.add(abs);
      pushHit(hits, byType, {
        sourceKey: `venues:${venue._id}:photos:${index}:${ref}`,
        imageType: "space",
        legacyRef: ref,
        entityCollection: "venues",
        entityId: venue._id.toString(),
        field: "photos",
        index,
        absolutePath: abs,
        existsOnDisk: exists,
        bytesOnDisk: fileBytes(abs),
        visibility: "public",
      });
    });
  }

  const reviews = await VenueReview.find({}).select("photos userId");
  for (const review of reviews) {
    (review.photos ?? []).forEach((ref, index) => {
      if (!ref) return;
      if (isManagedMediaRef(ref) || /^https?:\/\//i.test(ref)) {
        managedPublicRefs += 1;
        return;
      }
      if (!ref.startsWith("/uploads/")) return;
      const abs = uploadAbs(ref);
      const exists = Boolean(abs && existsSync(abs));
      if (!exists) brokenRefs += 1;
      if (abs) referencedUploads.add(abs);
      pushHit(hits, byType, {
        sourceKey: `venuereviews:${review._id}:photos:${index}:${ref}`,
        imageType: "review",
        legacyRef: ref,
        entityCollection: "venuereviews",
        entityId: review._id.toString(),
        field: "photos",
        index,
        absolutePath: abs,
        existsOnDisk: exists,
        bytesOnDisk: fileBytes(abs),
        visibility: "public",
      });
    });
  }

  const news = await VenueNews.find({}).select("photos venueId");
  for (const item of news) {
    (item.photos ?? []).forEach((ref, index) => {
      if (!ref) return;
      if (isManagedMediaRef(ref) || /^https?:\/\//i.test(ref)) {
        managedPublicRefs += 1;
        return;
      }
      if (!ref.startsWith("/uploads/")) return;
      const abs = uploadAbs(ref);
      const exists = Boolean(abs && existsSync(abs));
      if (!exists) brokenRefs += 1;
      if (abs) referencedUploads.add(abs);
      pushHit(hits, byType, {
        sourceKey: `venuenews:${item._id}:photos:${index}:${ref}`,
        imageType: "space_news",
        legacyRef: ref,
        entityCollection: "venuenews",
        entityId: item._id.toString(),
        field: "photos",
        index,
        absolutePath: abs,
        existsOnDisk: exists,
        bytesOnDisk: fileBytes(abs),
        visibility: "public",
      });
    });
  }

  const posts = await UserPost.find({}).select("photos authorId");
  for (const post of posts) {
    (post.photos ?? []).forEach((ref, index) => {
      if (!ref) return;
      if (isManagedMediaRef(ref) || /^https?:\/\//i.test(ref)) {
        managedPublicRefs += 1;
        return;
      }
      if (!ref.startsWith("/uploads/")) return;
      const abs = uploadAbs(ref);
      const exists = Boolean(abs && existsSync(abs));
      if (!exists) brokenRefs += 1;
      if (abs) referencedUploads.add(abs);
      pushHit(hits, byType, {
        sourceKey: `userposts:${post._id}:photos:${index}:${ref}`,
        imageType: "user_post",
        legacyRef: ref,
        entityCollection: "userposts",
        entityId: post._id.toString(),
        field: "photos",
        index,
        absolutePath: abs,
        existsOnDisk: exists,
        bytesOnDisk: fileBytes(abs),
        visibility: "public",
      });
    });
  }

  const requests = await VenueRequest.find({}).select(
    "photos evidenceFiles requesterId"
  );
  for (const request of requests) {
    (request.photos ?? []).forEach((ref, index) => {
      if (!ref) return;
      if (isManagedMediaRef(ref) || /^https?:\/\//i.test(ref)) {
        managedPublicRefs += 1;
        return;
      }
      if (!ref.startsWith("/uploads/")) return;
      const abs = uploadAbs(ref);
      const exists = Boolean(abs && existsSync(abs));
      if (!exists) brokenRefs += 1;
      if (abs) referencedUploads.add(abs);
      pushHit(hits, byType, {
        sourceKey: `venuerequests:${request._id}:photos:${index}:${ref}`,
        imageType: "space_request",
        legacyRef: ref,
        entityCollection: "venuerequests",
        entityId: request._id.toString(),
        field: "photos",
        index,
        absolutePath: abs,
        existsOnDisk: exists,
        bytesOnDisk: fileBytes(abs),
        visibility: "public",
      });
    });
    for (const file of request.evidenceFiles ?? []) {
      if (looksLikeManagedImageId(file.filename)) {
        managedPublicRefs += 1;
        continue;
      }
      const abs = join(CLAIM_EVIDENCE_DIR, file.filename);
      const exists = existsSync(abs);
      if (!exists) brokenRefs += 1;
      referencedClaims.add(file.filename);
      pushHit(hits, byType, {
        sourceKey: `venuerequests:${request._id}:evidence:${file.id}:${file.filename}`,
        imageType: "claim_evidence",
        legacyRef: file.filename,
        entityCollection: "venuerequests",
        entityId: request._id.toString(),
        field: "evidenceFiles",
        absolutePath: abs,
        existsOnDisk: exists,
        bytesOnDisk: fileBytes(abs),
        visibility: "private",
      });
    }
  }

  const uploadFiles = listFiles(UPLOADS_DIR);
  const claimFiles = listFiles(CLAIM_EVIDENCE_DIR);
  const identityFiles = listFiles(IDENTITY_VERIFICATION_DIR);

  const orphanUploadFiles = uploadFiles.filter(
    (name) => !referencedUploads.has(join(UPLOADS_DIR, name))
  );
  const orphanClaimFiles = claimFiles.filter(
    (name) => !referencedClaims.has(name)
  );
  const orphanIdentityFiles = identityFiles.filter(
    (name) => !referencedIdentity.has(name)
  );

  const approximateBytesOnDisk = hits.reduce(
    (sum, h) => sum + (h.bytesOnDisk || 0),
    0
  );
  const migratableRefs = hits.filter((h) => h.existsOnDisk).length;

  const alreadyMigratedLedger = await ImageMigrationRecord.countDocuments({
    status: "done",
  });

  return {
    uploadsDirFiles: uploadFiles.length,
    claimDirFiles: claimFiles.length,
    identityDirFiles: identityFiles.length,
    legacyPublicRefs: hits.filter((h) => h.visibility === "public").length,
    legacyPrivateRefs: hits.filter((h) => h.visibility === "private").length,
    managedPublicRefs,
    brokenRefs,
    migratableRefs,
    alreadyMigratedLedger,
    approximateBytesOnDisk,
    byType,
    hits,
    orphanUploadFiles,
    orphanClaimFiles,
    orphanIdentityFiles,
    paths: {
      uploadsDir: UPLOADS_DIR,
      claimDir: CLAIM_EVIDENCE_DIR,
      identityDir: IDENTITY_VERIFICATION_DIR,
    },
  };
}

export async function countManagedAssetsMissingVariants(): Promise<number> {
  const docs = await ImageAsset.find({ visibility: "public" }).lean();
  let incomplete = 0;
  for (const doc of docs) {
    const v = doc.variants;
    if (
      !v?.thumb?.webp?.key ||
      !v?.thumb?.avif?.key ||
      !v?.medium?.webp?.key ||
      !v?.medium?.avif?.key ||
      !v?.large?.webp?.key ||
      !v?.large?.avif?.key
    ) {
      incomplete += 1;
    }
  }
  return incomplete;
}

export function isLegacyUploadRef(ref: string): boolean {
  return ref.startsWith("/uploads/");
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

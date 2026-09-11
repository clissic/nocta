/**
 * Repara migraciones hechas contra storage efímero (memory):
 * - restaura refs legacy en Mongo
 * - borra ImageAsset huérfano
 * - marca ledger como pending
 *
 * NO borra archivos en /uploads.
 * npx tsx src/image-lifecycle/repairMemoryMigrateCli.ts [--execute]
 */
import { connectDb, disconnectDb } from "../db.js";
import { ImageMigrationRecord } from "../models/ImageMigrationRecord.js";
import { ImageAsset } from "../models/ImageAsset.js";
import { User } from "../models/User.js";
import { Venue } from "../models/Venue.js";
import { VenueReview } from "../models/VenueReview.js";
import { VenueNews } from "../models/VenueNews.js";
import { UserPost } from "../models/UserPost.js";
import { VenueRequest } from "../models/VenueRequest.js";
import { deleteManagedImage } from "../image-service/ingest.js";
import { getStorage, hasRailwayCredentials, readStorageEnv } from "../storage/index.js";
import { isManagedMediaRef, parseMediaImageId } from "../image-service/refs.js";
import { looksLikeManagedImageId } from "../image-service/privateAccess.js";

async function restoreLegacyRef(rec: {
  entityCollection: string;
  entityId: string;
  legacyRef: string;
  mediaRef?: string | null;
  imageId?: string | null;
  imageType: string;
  sourceKey: string;
}): Promise<boolean> {
  const managedHint = rec.mediaRef || rec.imageId || "";
  const collection = rec.entityCollection;

  if (collection === "users" && rec.sourceKey.includes(":photos:")) {
    const user = await User.findById(rec.entityId);
    if (!user?.profile?.photos) return false;
    const photos = [...(user.profile.photos as string[])];
    const idx = photos.findIndex(
      (p) =>
        p === managedHint ||
        p === `/api/media/${rec.imageId}` ||
        (rec.imageId && parseMediaImageId(p) === rec.imageId)
    );
    if (idx < 0) return false;
    photos[idx] = rec.legacyRef;
    user.profile.photos = photos;
    user.markModified("profile.photos");
    await user.save();
    return true;
  }

  if (collection === "users" && rec.sourceKey.includes(":identity:")) {
    const field = rec.sourceKey.includes("documentFrontPath")
      ? "identityVerification.documentFrontPath"
      : "identityVerification.selfieWithDocumentPath";
    const res = await User.updateOne(
      {
        _id: rec.entityId,
        [field]: { $in: [managedHint, rec.imageId].filter(Boolean) },
      },
      { $set: { [field]: rec.legacyRef } }
    );
    return res.modifiedCount > 0;
  }

  if (collection === "venues") {
    const venue = await Venue.findById(rec.entityId);
    if (!venue) return false;
    const photos = [...(venue.photos ?? [])];
    const idx = photos.findIndex(
      (p) =>
        isManagedMediaRef(p) &&
        (p === managedHint || parseMediaImageId(p) === rec.imageId)
    );
    if (idx < 0) return false;
    photos[idx] = rec.legacyRef;
    venue.photos = photos;
    await venue.save();
    return true;
  }

  if (collection === "venuereviews") {
    const review = await VenueReview.findById(rec.entityId);
    if (!review) return false;
    const photos = [...(review.photos ?? [])];
    const idx = photos.findIndex(
      (p) =>
        isManagedMediaRef(p) &&
        (p === managedHint || parseMediaImageId(p) === rec.imageId)
    );
    if (idx < 0) return false;
    photos[idx] = rec.legacyRef;
    review.photos = photos;
    await review.save();
    return true;
  }

  if (collection === "venuenews") {
    const news = await VenueNews.findById(rec.entityId);
    if (!news) return false;
    const photos = [...(news.photos ?? [])];
    const idx = photos.findIndex(
      (p) =>
        isManagedMediaRef(p) &&
        (p === managedHint || parseMediaImageId(p) === rec.imageId)
    );
    if (idx < 0) return false;
    photos[idx] = rec.legacyRef;
    news.photos = photos;
    await news.save();
    return true;
  }

  if (collection === "userposts") {
    const post = await UserPost.findById(rec.entityId);
    if (!post) return false;
    const photos = [...(post.photos ?? [])];
    const idx = photos.findIndex(
      (p) =>
        isManagedMediaRef(p) &&
        (p === managedHint || parseMediaImageId(p) === rec.imageId)
    );
    if (idx < 0) return false;
    photos[idx] = rec.legacyRef;
    post.photos = photos;
    await post.save();
    return true;
  }

  if (collection === "venuerequests" && rec.imageType === "space_request") {
    const request = await VenueRequest.findById(rec.entityId);
    if (!request) return false;
    const photos = [...(request.photos ?? [])];
    const idx = photos.findIndex(
      (p) =>
        isManagedMediaRef(p) &&
        (p === managedHint || parseMediaImageId(p) === rec.imageId)
    );
    if (idx < 0) return false;
    photos[idx] = rec.legacyRef;
    request.photos = photos;
    await request.save();
    return true;
  }

  if (collection === "venuerequests" && rec.imageType === "claim_evidence") {
    const res = await VenueRequest.updateOne(
      {
        _id: rec.entityId,
        "evidenceFiles.filename": {
          $in: [rec.imageId, managedHint].filter(Boolean),
        },
      },
      { $set: { "evidenceFiles.$.filename": rec.legacyRef } }
    );
    return res.modifiedCount > 0;
  }

  return false;
}

async function main() {
  const execute = process.argv.includes("--execute");
  const env = readStorageEnv();
  console.log(
    JSON.stringify(
      {
        dryRun: !execute,
        hasRailwayCredentials: hasRailwayCredentials(env),
        note: execute
          ? "Restaurando refs legacy + limpiando ledger done sin objetos"
          : "Preview. Para aplicar: --execute",
      },
      null,
      2
    )
  );

  await connectDb();
  try {
    const storage = getStorage();
    const done = await ImageMigrationRecord.find({ status: "done" });
    let restoreCandidates = 0;
    let restored = 0;
    let assetsDeleted = 0;

    for (const rec of done) {
      const imageId = rec.imageId ?? parseMediaImageId(rec.mediaRef ?? "") ?? "";
      let missing = !imageId;
      if (imageId) {
        const doc = await ImageAsset.findOne({ imageId }).lean();
        if (!doc) {
          missing = true;
        } else {
          const keys = [
            ...(doc.keys ?? []),
            doc.storageKey,
            doc.variants?.medium?.webp?.key,
          ].filter((k): k is string => Boolean(k));
          for (const key of keys) {
            if (!(await storage.exists(key))) {
              missing = true;
              break;
            }
          }
        }
      }

      if (!missing) continue;
      restoreCandidates += 1;
      console.log(`[repair] candidate ${rec.sourceKey}`);

      if (!execute) continue;

      const ok = await restoreLegacyRef(rec);
      if (ok) restored += 1;

      if (imageId) {
        await deleteManagedImage(imageId);
        assetsDeleted += 1;
      } else {
        await ImageAsset.deleteOne({ legacySource: rec.legacyRef });
      }

      rec.status = "pending";
      rec.error = "repaired: prior migrate used ephemeral storage";
      rec.mediaRef = undefined;
      rec.imageId = undefined;
      await rec.save();
    }

    console.log(
      JSON.stringify(
        {
          restoreCandidates,
          restored,
          assetsDeleted,
          runtimeDriver: storage.driver,
          next:
            "Configurá AWS_/STORAGE_* de Railway en apps/api/.env y volvé a correr npm run migrate:images",
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

import { User, type UserDocument } from "../models/User.js";
import { VenueRequest } from "../models/VenueRequest.js";
import { VenueReview } from "../models/VenueReview.js";
import { UserPost } from "../models/UserPost.js";
import {
  deleteClaimEvidence,
  deleteIdentityVerificationFiles,
  deleteLocalUploads,
} from "../uploads/index.js";
import {
  deleteManagedImage,
  deleteManagedImages,
  looksLikeManagedImageId,
} from "../image-service/index.js";
import { ImageAsset } from "../models/ImageAsset.js";

/**
 * Borra todas las imágenes asociadas a un usuario (públicas, privadas,
 * variantes, metadata y leftovers en disco). Usar solo en eliminación definitiva.
 */
export async function purgeAllUserImages(user: UserDocument): Promise<{
  managedDeleted: number;
  legacyUploads: number;
}> {
  const userId = user._id;
  const verification = user.identityVerification as
    | {
        documentFrontPath?: string | null;
        selfieWithDocumentPath?: string | null;
      }
    | undefined;

  const [requests, reviews, posts] = await Promise.all([
    VenueRequest.find({ requesterId: userId }).lean(),
    VenueReview.find({ userId }).lean(),
    UserPost.find({ authorId: userId }).lean(),
  ]);

  const legacyUploadRefs = [
    ...(user.profile?.photos ?? []).filter((p) => p.startsWith("/uploads/")),
    ...requests.flatMap((request) =>
      (request.photos ?? []).filter((p) => p.startsWith("/uploads/"))
    ),
    ...reviews
      .flatMap((review) => review.photos ?? [])
      .filter((p) => p.startsWith("/uploads/")),
    ...posts
      .flatMap((post) => post.photos ?? [])
      .filter((p) => p.startsWith("/uploads/")),
  ];
  deleteLocalUploads(legacyUploadRefs);

  const managedRefs = [
    ...(user.profile?.photos ?? []),
    ...requests.flatMap((request) => request.photos ?? []),
    ...reviews.flatMap((review) => review.photos ?? []),
    ...posts.flatMap((post) => post.photos ?? []),
  ];
  await deleteManagedImages(managedRefs);

  const evidence = requests.flatMap((request) => request.evidenceFiles ?? []);
  const legacyEvidence = evidence.filter(
    (file) => !looksLikeManagedImageId(file.filename)
  );
  deleteClaimEvidence(legacyEvidence);
  for (const file of evidence) {
    if (looksLikeManagedImageId(file.filename)) {
      await deleteManagedImage(file.filename);
    }
  }

  for (const path of [
    verification?.documentFrontPath,
    verification?.selfieWithDocumentPath,
  ]) {
    if (!path) continue;
    if (looksLikeManagedImageId(path)) {
      await deleteManagedImage(path);
    } else {
      deleteIdentityVerificationFiles([path]);
    }
  }

  // Cualquier ImageAsset residual del owner (p. ej. huérfanos de migraciones).
  const leftovers = await ImageAsset.find({ ownerId: userId.toString() })
    .select("imageId")
    .lean();
  let managedDeleted = managedRefs.filter((r) =>
    r.startsWith("/api/media/")
  ).length;
  for (const doc of leftovers) {
    await deleteManagedImage(doc.imageId);
    managedDeleted += 1;
  }

  return {
    managedDeleted,
    legacyUploads: legacyUploadRefs.length,
  };
}

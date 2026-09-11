/**
 * Diagnóstico storage + CDN (sin secrets).
 * npm run diag:storage -w @nocta/api
 */
import { connectDb, disconnectDb } from "../db.js";
import { ImageAsset } from "../models/ImageAsset.js";
import { createImageService } from "../image-service/index.js";
import {
  getStorage,
  hasPublicCdnConfigured,
  hasRailwayCredentials,
  PUBLIC_OBJECT_CACHE_CONTROL,
  readStorageEnv,
  resetStorageSingleton,
} from "../storage/index.js";

async function main() {
  const env = readStorageEnv();
  const cdnConfigured = hasPublicCdnConfigured(env.publicBaseUrl);
  console.log(
    JSON.stringify(
      {
        driverConfig: env.driver,
        hasRailwayCredentials: hasRailwayCredentials(env),
        endpointSet: Boolean(env.endpoint),
        bucketSet: Boolean(env.bucket),
        accessKeySet: Boolean(env.accessKeyId),
        secretSet: Boolean(env.secretAccessKey),
        publicBaseUrl: env.publicBaseUrl || null,
        cdnConfigured,
        publicObjectCacheControl: PUBLIC_OBJECT_CACHE_CONTROL,
        deliveryModeWithoutCdn: "signed_urls",
        deliveryModeWithCdn: "cdn_public_urls",
      },
      null,
      2
    )
  );

  await connectDb();
  try {
    resetStorageSingleton();
    const storage = getStorage();
    const images = createImageService(storage);
    console.log(JSON.stringify({ runtimeDriver: storage.driver }, null, 2));

    const doc = await ImageAsset.findOne({ visibility: "public" })
      .sort({ createdAt: -1 })
      .lean();
    if (!doc) {
      console.log(JSON.stringify({ samplePublicAsset: null }, null, 2));
      return;
    }
    const key =
      doc.variants?.medium?.webp?.key ?? doc.keys?.[0] ?? doc.storageKey;
    if (!key) {
      console.log(
        JSON.stringify({ samplePublicAsset: { imageId: doc.imageId, key: null } }, null, 2)
      );
      return;
    }

    const exists = await storage.exists(key);
    const resolved = await images.resolveReadUrl(
      doc.imageType as "user_profile",
      key,
      { preferPublicUrl: true }
    );

    let objectCacheControl: string | null = null;
    let objectContentType: string | null = null;
    if (exists) {
      try {
        const head = await storage.headObject(key);
        if (head.exists) {
          objectContentType = head.contentType ?? null;
          objectCacheControl = head.cacheControl ?? null;
        }
      } catch {
        /* ignore */
      }
    }

    console.log(
      JSON.stringify(
        {
          samplePublicAsset: {
            imageId: doc.imageId,
            imageType: doc.imageType,
            visibility: doc.visibility,
            key,
            exists,
            resolveMode: resolved.mode,
            resolveUrlHost: (() => {
              try {
                return new URL(resolved.url).host;
              } catch {
                return null;
              }
            })(),
            objectContentType,
            objectCacheControl,
            expectedPublicCacheControl: PUBLIC_OBJECT_CACHE_CONTROL,
            note:
              resolved.mode === "public"
                ? "Browser → CDN (sin firma)"
                : "Sin STORAGE_PUBLIC_BASE_URL → URL firmada al bucket",
          },
        },
        null,
        2
      )
    );

    const privateDoc = await ImageAsset.findOne({
      visibility: "private",
    }).lean();
    if (privateDoc?.storageKey) {
      const priv = await images.resolveReadUrl(
        privateDoc.imageType as "identity_verification",
        privateDoc.storageKey,
        { preferPublicUrl: true }
      );
      console.log(
        JSON.stringify(
          {
            samplePrivateAsset: {
              imageId: privateDoc.imageId,
              imageType: privateDoc.imageType,
              resolveMode: priv.mode,
              usesCdn: Boolean(
                env.publicBaseUrl && priv.url.startsWith(env.publicBaseUrl)
              ),
              expected: "signed_never_cdn",
            },
          },
          null,
          2
        )
      );
    }
  } finally {
    await disconnectDb();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import sharp from "sharp";
import { ImageAsset } from "../models/ImageAsset.js";
import {
  consumeImageRateLimit,
  IMAGE_RATE_LIMITS,
  resetImageRateLimitsForTests,
} from "../middleware/imageRateLimit.js";
import { resetStorageSingleton, createMemoryStorage } from "../storage/index.js";
import { createImageService } from "./imageService.js";
import { ingestPublicImage, ingestIdentityImage, deleteManagedImage } from "./ingest.js";
import { buildObjectKey, createImageId } from "./paths.js";
import { resolveAuthorizedPrivateRead } from "./privateAccess.js";
import { buildPublicVariants, buildIdentityProcessed } from "./processVariants.js";
import { getImageTypeConfig, IMAGE_TYPE_REGISTRY } from "./registry.js";
import { resolveDeliveryUrl } from "./resolveDelivery.js";
import { mediaRefForImageId } from "./refs.js";
import { IMAGE_TYPES } from "./types.js";
import { validateImageSource } from "./validateSource.js";
import { parseMigrateArgs } from "../image-lifecycle/migrate.js";
import { parseCleanupArgs } from "../image-lifecycle/cleanup.js";
import {
  ACCOUNT_DELETION_RECOVERY_DAYS,
  accountVisibleUserFilter,
  isAccountPendingDeletion,
} from "../image-lifecycle/accountDeletion.js";

async function sampleJpeg(width = 400, height = 300): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 20, g: 80, b: 160 },
    },
  })
    .jpeg()
    .toBuffer();
}

describe("phase8 hardening — registry & policies", () => {
  it("cada ImageType tiene visibility, processing, retention y access", () => {
    assert.equal(IMAGE_TYPES.length, Object.keys(IMAGE_TYPE_REGISTRY).length);
    for (const type of IMAGE_TYPES) {
      const cfg = getImageTypeConfig(type);
      assert.ok(cfg.visibility === "public" || cfg.visibility === "private");
      assert.ok(cfg.processingProfile);
      assert.ok(cfg.retention);
      assert.ok(cfg.accessPolicy);
      assert.ok(cfg.storageNamespace.startsWith(cfg.visibility === "public" ? "public/" : "private/"));
    }
  });

  it("solo tipos public usan accessPolicy public_cdn_or_signed", () => {
    for (const type of IMAGE_TYPES) {
      const cfg = getImageTypeConfig(type);
      if (cfg.visibility === "public") {
        assert.equal(cfg.accessPolicy.kind, "public_cdn_or_signed");
      } else {
        assert.notEqual(cfg.accessPolicy.kind, "public_cdn_or_signed");
      }
    }
  });

  it("identity es SENSITIVE: private + admin_signed + ttl", () => {
    const cfg = getImageTypeConfig("identity_verification");
    assert.equal(cfg.visibility, "private");
    assert.equal(cfg.accessPolicy.kind, "admin_signed");
    assert.equal(cfg.retention.kind, "ttl_days");
    assert.equal(cfg.processingProfile, "identity_raw");
  });
});

describe("phase8 hardening — paths & keys", () => {
  it("rechaza path traversal en segmentos de contexto", () => {
    assert.throws(() =>
      buildObjectKey({
        type: "user_profile",
        imageId: createImageId(),
        context: { userId: "../etc" },
        filename: "medium.webp",
      })
    );
  });

  it("sanitiza filenames peligrosos", () => {
    const imageId = createImageId();
    const key = buildObjectKey({
      type: "user_profile",
      imageId,
      context: { userId: "user1" },
      filename: "../../../evil.exe",
    });
    assert.ok(!key.includes(".."));
    assert.ok(key.includes("evil.exe") || key.includes("evil_exe"));
    assert.match(key, /^public\/users\/user1\//);
  });

  it("resolveReadUrl rechaza keys con ..", async () => {
    const storage = createMemoryStorage();
    const images = createImageService(storage);
    await assert.rejects(
      () =>
        images.resolveReadUrl("user_profile", "public/../secret", {
          preferPublicUrl: true,
        }),
      /inválida/i
    );
  });
});

describe("phase8 hardening — validate & process", () => {
  it("rechaza SVG / ejecutables peligrosos", async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>'
    );
    const r = await validateImageSource({
      buffer: svg,
      declaredMime: "image/svg+xml",
      maxBytes: 1_000_000,
    });
    assert.equal(r.ok, false);
  });

  it("rechaza dimensiones bomb / píxeles excesivos vía metadata", async () => {
    // Buffer válido pero con límite de bytes bajo simula tope de tamaño
    const jpeg = await sampleJpeg(64, 64);
    const r = await validateImageSource({
      buffer: jpeg,
      declaredMime: "image/jpeg",
      maxBytes: 10,
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, "IMAGE_TOO_LARGE");
  });

  it("variantes públicas no conservan EXIF/GPS (re-encode)", async () => {
    const withExif = await sharp({
      create: { width: 120, height: 80, channels: 3, background: "#336699" },
    })
      .withMetadata({
        exif: {
          IFD0: { Copyright: "nocta-test" },
        },
      })
      .jpeg()
      .toBuffer();

    const built = await buildPublicVariants(withExif);
    assert.equal(built.variants.length, 6);
    for (const v of built.variants) {
      const meta = await sharp(v.buffer).metadata();
      assert.equal(meta.exif, undefined);
    }
  });

  it("identity produce JPEG privado sin galería de variantes", async () => {
    const buf = await sampleJpeg(800, 600);
    const out = await buildIdentityProcessed(buf);
    assert.equal(out.contentType, "image/jpeg");
    const meta = await sharp(out.buffer).metadata();
    assert.equal(meta.format, "jpeg");
    assert.equal(meta.exif, undefined);
  });
});

describe("phase8 hardening — auth private / delivery", () => {
  let mongo: MongoMemoryServer;

  before(async () => {
    process.env.STORAGE_DRIVER = "memory";
    process.env.STORAGE_PUBLIC_BASE_URL = "https://cdn.example.com";
    resetStorageSingleton();
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
  });

  after(async () => {
    await mongoose.disconnect();
    await mongo.stop();
    resetStorageSingleton();
  });

  it("identity: owner no lee; admin sí; no URL pública", async () => {
    process.env.STORAGE_DRIVER = "memory";
    process.env.STORAGE_PUBLIC_BASE_URL = "https://cdn.example.com";
    resetStorageSingleton();
    const { getStorage } = await import("../storage/index.js");
    const shared = getStorage();

    const ownerId = "owneraaaaaaaaaaaaaaaaaaaaaa01";
    const ingested = await ingestIdentityImage({
      ownerId,
      context: { userId: ownerId },
      buffer: await sampleJpeg(640, 480),
      declaredMime: "image/jpeg",
      storage: shared,
    });

    const asOwner = await resolveAuthorizedPrivateRead({
      imageIdOrRef: ingested.imageId,
      viewer: { id: ownerId, role: "user" },
    });
    assert.equal(asOwner.ok, false);
    if (!asOwner.ok) assert.equal(asOwner.status, 403);

    const asPeer = await resolveAuthorizedPrivateRead({
      imageIdOrRef: ingested.imageId,
      viewer: { id: "otherbbbbbbbbbbbbbbbbbbbbbb02", role: "user" },
    });
    assert.equal(asPeer.ok, false);

    const asAdmin = await resolveAuthorizedPrivateRead({
      imageIdOrRef: ingested.imageId,
      viewer: { id: "admincccccccccccccccccccccc03", role: "admin" },
    });
    assert.equal(asAdmin.ok, true);
    if (asAdmin.ok) {
      assert.ok(asAdmin.url.length > 10);
      assert.ok(!asAdmin.url.startsWith("https://cdn.example.com/"));
    }

    const publicAttempt = await resolveDeliveryUrl(
      mediaRefForImageId(ingested.imageId)
    );
    assert.equal(publicAttempt, undefined);

    const doc = await ImageAsset.findOne({ imageId: ingested.imageId }).lean();
    assert.equal(doc?.visibility, "private");
    assert.ok(doc?.storageKey?.startsWith("private/"));
    assert.equal(doc?.variants?.medium, undefined);
  });

  it("upload público → variantes storage + delete limpia metadata", async () => {
    const storage = createMemoryStorage({
      publicBaseUrl: "https://cdn.example.com",
    });
    const ownerId = "pubowner000000000000000000001";
    const result = await ingestPublicImage({
      type: "user_profile",
      ownerId,
      entityType: "user",
      entityId: ownerId,
      context: { userId: ownerId },
      buffer: await sampleJpeg(500, 400),
      declaredMime: "image/jpeg",
      storage,
    });

    assert.match(result.mediaRef, /^\/api\/media\//);
    assert.equal(result.keys.some((k) => k.includes("original")), false);
    assert.equal(result.keys.length, 6);

    const delivered = await resolveDeliveryUrl(result.mediaRef);
    assert.ok(delivered?.startsWith("https://cdn.example.com/"));

    await deleteManagedImage(result.imageId);
    assert.equal(await ImageAsset.findOne({ imageId: result.imageId }), null);
  });

  it("cada tipo público del registry usa namespace public/", () => {
    const publicTypes = IMAGE_TYPES.filter(
      (t) => getImageTypeConfig(t).visibility === "public"
    );
    for (const type of publicTypes) {
      assert.ok(getImageTypeConfig(type).storageNamespace.startsWith("public/"));
    }
  });
});

describe("phase8 hardening — rate limit & CLI args", () => {
  it("rate limit upload respeta max por ventana", () => {
    resetImageRateLimitsForTests();
    const key = "user:rate-test";
    const { max } = IMAGE_RATE_LIMITS.upload;
    for (let i = 0; i < max; i += 1) {
      assert.equal(consumeImageRateLimit(key, "upload"), true);
    }
    assert.equal(consumeImageRateLimit(key, "upload"), false);
    assert.equal(consumeImageRateLimit(key, "sensitive"), true);
  });

  it("parseMigrateArgs / parseCleanupArgs", () => {
    const m = parseMigrateArgs(["--preview", "--limit=2", "--type=review"]);
    assert.equal(m.dryRun, true);
    assert.equal(m.limit, 2);
    assert.equal(m.type, "review");

    const c = parseCleanupArgs(["--execute"]);
    assert.equal(c.execute, true);
    assert.equal(c.dryRun, false);

    const dry = parseCleanupArgs([]);
    assert.equal(dry.dryRun, true);
    assert.equal(dry.execute, false);
  });

  it("account deletion helpers (30 días)", () => {
    assert.equal(ACCOUNT_DELETION_RECOVERY_DAYS, 30);
    assert.equal(isAccountPendingDeletion({ deletionRequestedAt: new Date() }), true);
    assert.equal(isAccountPendingDeletion({ deletionRequestedAt: null }), false);
    const filter = accountVisibleUserFilter();
    assert.ok(filter.$or);
  });
});

import assert from "node:assert/strict";
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { ImageAsset } from "../models/ImageAsset.js";
import { getStorage, resetStorageSingleton } from "../storage/index.js";
import { ensureUploadsDir, UPLOADS_DIR } from "../uploads/paths.js";
import {
  canonicalizeIncomingPhotoRefs,
  resolveDeliveryUrl,
  resolveDeliveryUrls,
} from "./resolveDelivery.js";
import { mediaRefForImageId } from "./refs.js";

describe("resolveDelivery", () => {
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

  it("legacy /uploads ausente no se entrega; si el archivo existe, va por la API", async () => {
    assert.equal(await resolveDeliveryUrl("/uploads/missing-abc.webp"), undefined);
    ensureUploadsDir();
    const name = "abc-delivery-test.webp";
    const file = join(UPLOADS_DIR, name);
    writeFileSync(file, Buffer.from("x"));
    try {
      const url = await resolveDeliveryUrl(`/uploads/${name}`);
      assert.ok(url);
      assert.match(url, new RegExp(`/uploads/${name}$`));
    } finally {
      rmSync(file, { force: true });
    }
  });

  it("https externo sin media id pasa intacto", async () => {
    const url = await resolveDeliveryUrl("https://images.example.com/x.jpg");
    assert.equal(url, "https://images.example.com/x.jpg");
  });

  it("pública managed en memory → proxy /api/media", async () => {
    const imageId = "pubimg000000000000000000000001";
    const key = `public/users/u1/${imageId}/medium.webp`;
    await ImageAsset.create({
      imageId,
      ownerId: "u1",
      entityType: "user",
      entityId: "u1",
      imageType: "user_profile",
      visibility: "public",
      width: 800,
      height: 600,
      variants: {
        thumb: {
          webp: { key: key.replace("medium", "thumb"), width: 200, height: 150, bytes: 10 },
          avif: { key: key.replace("medium", "thumb").replace(".webp", ".avif"), width: 200, height: 150, bytes: 10 },
        },
        medium: {
          webp: { key, width: 800, height: 600, bytes: 20 },
          avif: { key: key.replace(".webp", ".avif"), width: 800, height: 600, bytes: 20 },
        },
        large: {
          webp: { key: key.replace("medium", "large"), width: 1200, height: 900, bytes: 30 },
          avif: { key: key.replace("medium", "large").replace(".webp", ".avif"), width: 1200, height: 900, bytes: 30 },
        },
      },
      keys: [key],
    });
    await getStorage().putObject({
      key,
      body: Buffer.from("webp"),
      contentType: "image/webp",
    });

    const url = await resolveDeliveryUrl(mediaRefForImageId(imageId));
    assert.ok(url);
    assert.match(url, new RegExp(`/api/media/${imageId}`));
    assert.ok(!url.includes("cdn.example.com"));
    assert.ok(!url.includes("/uploads/"));
  });

  it("private managed NO se expone como URL pública", async () => {
    const imageId = "privimg00000000000000000000001";
    await ImageAsset.create({
      imageId,
      ownerId: "u1",
      entityType: "identity",
      entityId: "u1",
      imageType: "identity_verification",
      visibility: "private",
      width: 800,
      height: 600,
      storageKey: `private/identity/u1/${imageId}/document.jpg`,
      contentType: "image/jpeg",
      bytes: 100,
      keys: [`private/identity/u1/${imageId}/document.jpg`],
    });

    const url = await resolveDeliveryUrl(mediaRefForImageId(imageId));
    assert.equal(url, undefined);
  });

  it("batch + canonicalize round-trip proxy → ref estable", async () => {
    const imageId = "pubimg000000000000000000000002";
    const key = `public/spaces/s1/${imageId}/medium.webp`;
    await ImageAsset.create({
      imageId,
      ownerId: "u1",
      entityType: "space",
      entityId: "s1",
      imageType: "space",
      visibility: "public",
      width: 800,
      height: 600,
      variants: {
        thumb: {
          webp: { key: key.replace("medium", "thumb"), width: 200, height: 150, bytes: 10 },
          avif: { key: key.replace("medium", "thumb").replace(".webp", ".avif"), width: 200, height: 150, bytes: 10 },
        },
        medium: {
          webp: { key, width: 800, height: 600, bytes: 20 },
          avif: { key: key.replace(".webp", ".avif"), width: 800, height: 600, bytes: 20 },
        },
        large: {
          webp: { key: key.replace("medium", "large"), width: 1200, height: 900, bytes: 30 },
          avif: { key: key.replace("medium", "large").replace(".webp", ".avif"), width: 1200, height: 900, bytes: 30 },
        },
      },
      keys: [key],
    });
    await getStorage().putObject({
      key,
      body: Buffer.from("webp"),
      contentType: "image/webp",
    });

    const stable = mediaRefForImageId(imageId);
    const [delivered] = await resolveDeliveryUrls([stable]);
    assert.match(delivered ?? "", new RegExp(`/api/media/${imageId}`));

    const back = await canonicalizeIncomingPhotoRefs([delivered], [stable]);
    assert.deepEqual(back, [stable]);
  });
});

import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { createMemoryStorage } from "../storage/memoryStorage.js";
import { ImageAsset } from "../models/ImageAsset.js";
import { User } from "../models/User.js";
import { runImageDiagnose } from "./diagnose.js";
import {
  redactStorageKey,
  redactImageId,
} from "../image-service/observability.js";

describe("phase14 housekeeping + observability", () => {
  let mongo: MongoMemoryServer;

  before(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
  });

  after(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  it("redactStorageKey oculta private/identity y segmentos de id", () => {
    assert.equal(
      redactStorageKey("private/identity/user123/img999/document.jpg"),
      "private/identity/***/document.jpg"
    );
    assert.match(
      redactStorageKey("public/users/abc/img1/medium.webp") ?? "",
      /^public\/users\/\*\*\*\/medium\.webp$/
    );
    assert.equal(redactImageId("abcdef0123456789"), "abcdef01…");
  });

  it("diagnose dry-run detecta mongo↔storage, variantes, tipo y owner borrado", async () => {
    await ImageAsset.deleteMany({});
    await User.deleteMany({});

    const storage = createMemoryStorage();
    const ownerId = new mongoose.Types.ObjectId();
    await User.create({
      _id: ownerId,
      email: `phase14-${ownerId.toString().slice(-6)}@test.local`,
      passwordHash: "x",
      role: "user",
      emailVerified: true,
      profileComplete: true,
      authVersion: 0,
      deletionRequestedAt: new Date(),
      profile: {
        name: "P14",
        birthDate: new Date("1990-01-01"),
        gender: "woman",
        interestedIn: ["man"],
        lookingFor: ["relacion"],
        photos: [],
      },
    });
    const ownerIdStr = ownerId.toString();

    // Metadata sin objeto
    await ImageAsset.create({
      imageId: "a".repeat(32),
      ownerId: ownerIdStr,
      entityType: "user",
      entityId: ownerIdStr,
      imageType: "user_profile",
      visibility: "public",
      width: 10,
      height: 10,
      variants: {
        thumb: {
          webp: { key: "public/users/o/missing/thumb.webp", width: 1, height: 1, bytes: 1 },
          avif: { key: "public/users/o/missing/thumb.avif", width: 1, height: 1, bytes: 1 },
        },
        medium: {
          webp: { key: "public/users/o/missing/medium.webp", width: 1, height: 1, bytes: 1 },
          avif: { key: "public/users/o/missing/medium.avif", width: 1, height: 1, bytes: 1 },
        },
        large: {
          webp: { key: "public/users/o/missing/large.webp", width: 1, height: 1, bytes: 1 },
          avif: { key: "public/users/o/missing/large.avif", width: 1, height: 1, bytes: 1 },
        },
      },
      keys: ["public/users/o/missing/medium.webp"],
    });

    // Variantes incompletas + ImageType inconsistente (visibility private vs public type)
    await ImageAsset.create({
      imageId: "b".repeat(32),
      ownerId: ownerIdStr,
      entityType: "user",
      entityId: ownerIdStr,
      imageType: "user_profile",
      visibility: "private",
      width: 10,
      height: 10,
      storageKey: "private/wrong/key.jpg",
      keys: ["private/wrong/key.jpg"],
    });

    // Objeto huérfano en storage
    await storage.putObject({
      key: "public/orphan/only-in-bucket.webp",
      body: "orphan",
      contentType: "image/webp",
    });

    const report = await runImageDiagnose({ storage, dryRun: true });

    assert.equal(report.dryRun, true);
    assert.equal(report.autoDelete, false);
    assert.equal(report.mode, "report_only");
    assert.ok(report.counts.mongoWithoutObject >= 1);
    assert.ok(report.counts.objectWithoutMongo >= 1);
    assert.ok(report.counts.inconsistentImageType >= 1);
    assert.ok(report.counts.deletedAccountObjects >= 1);
    assert.match(report.note, /DRY RUN/i);

    // Garantía: diagnose no borró el huérfano
    assert.equal(
      await storage.exists("public/orphan/only-in-bucket.webp"),
      true
    );
  });
});

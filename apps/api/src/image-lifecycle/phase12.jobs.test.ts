import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import bcrypt from "bcryptjs";
import sharp from "sharp";
import { User } from "../models/User.js";
import { ImageAsset } from "../models/ImageAsset.js";
import { ImageLifecycleJobRun } from "../models/ImageLifecycleJobRun.js";
import { resetStorageSingleton, getStorage } from "../storage/index.js";
import {
  ingestIdentityImage,
  ingestPublicImage,
} from "../image-service/ingest.js";
import { runImageLifecycleJob } from "./jobs/runner.js";
import { runPurgeDeletedAccountsJob } from "./jobs/purgeAccountsJob.js";
import { runIdentityRetentionJob } from "./jobs/identityRetentionJob.js";
import { runOrphanClassifyJob } from "./jobs/orphanClassifyJob.js";
import { ACCOUNT_DELETION_RECOVERY_DAYS } from "./accountDeletion.js";
import { backoffMs } from "./jobs/types.js";

async function jpeg(w = 200, h = 200) {
  return sharp({
    create: { width: w, height: h, channels: 3, background: "#336699" },
  })
    .jpeg()
    .toBuffer();
}

describe("phase12 image lifecycle jobs", () => {
  let mongod: MongoMemoryServer;

  before(async () => {
    process.env.STORAGE_DRIVER = "memory";
    process.env.STORAGE_PUBLIC_BASE_URL = "https://cdn.jobs.test";
    resetStorageSingleton();
    getStorage();
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri("nocta_jobs"));
  });

  after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
    resetStorageSingleton();
  });

  it("backoff crece con el intento", () => {
    assert.ok(backoffMs(1, 100, 10_000) >= 100);
    assert.ok(backoffMs(3, 100, 10_000) >= 400);
  });

  it("purge_deleted_accounts: dry-run no borra; execute purga tras 30d", async () => {
    const passwordHash = await bcrypt.hash("x", 4);
    const user = await User.create({
      email: `purge-${Date.now()}@jobs.test`,
      passwordHash,
      role: "user",
      emailVerified: true,
      profileComplete: true,
      authVersion: 0,
      deletionRequestedAt: new Date(
        Date.now() - (ACCOUNT_DELETION_RECOVERY_DAYS + 1) * 86400000
      ),
      profile: {
        name: "Purge",
        birthDate: new Date("1990-01-01"),
        gender: "woman",
        interestedIn: ["man"],
        lookingFor: ["relacion"],
        photos: [],
      },
    });

    const dry = await runImageLifecycleJob(
      "purge_deleted_accounts",
      runPurgeDeletedAccountsJob,
      {
        dryRun: true,
        force: true,
        idempotencyKey: `test-purge-dry-${Date.now()}`,
      }
    );
    assert.equal(dry.skipped, false);
    assert.equal(dry.result?.deleted, 0);
    assert.ok(await User.findById(user._id));

    const run = await runImageLifecycleJob(
      "purge_deleted_accounts",
      runPurgeDeletedAccountsJob,
      {
        dryRun: false,
        force: true,
        idempotencyKey: `test-purge-${Date.now()}`,
      }
    );
    assert.equal(run.result?.status, "success");
    assert.ok((run.result?.deleted ?? 0) >= 1);
    assert.equal(await User.findById(user._id), null);

    const ledger = await ImageLifecycleJobRun.findById(run.runId).lean();
    assert.ok(ledger);
    assert.equal(ledger!.status, "success");
    assert.ok((ledger!.durationMs ?? 0) >= 0);
  });

  it("identity_retention: solo private TTL; no toca públicas", async () => {
    const storage = getStorage();
    const buf = await jpeg();
    const ownerId = new mongoose.Types.ObjectId().toString();

    const pub = await ingestPublicImage({
      type: "user_profile",
      ownerId,
      entityType: "user",
      entityId: ownerId,
      context: { userId: ownerId },
      buffer: buf,
      declaredMime: "image/jpeg",
      storage,
    });

    const id = await ingestIdentityImage({
      ownerId,
      context: { userId: ownerId },
      buffer: buf,
      declaredMime: "image/jpeg",
      storage,
    });

    await ImageAsset.collection.updateOne(
      { imageId: id.imageId },
      { $set: { createdAt: new Date(Date.now() - 200 * 86400000) } }
    );

    await User.create({
      email: `idret-${Date.now()}@jobs.test`,
      passwordHash: await bcrypt.hash("x", 4),
      role: "user",
      emailVerified: true,
      profileComplete: true,
      authVersion: 0,
      profile: {
        name: "Id",
        birthDate: new Date("1990-01-01"),
        gender: "man",
        interestedIn: ["woman"],
        lookingFor: ["relacion"],
        photos: [pub.mediaRef],
      },
      identityVerification: {
        status: "pending",
        documentFrontPath: id.imageId,
        selfieWithDocumentPath: null,
        submittedAt: new Date(),
      },
    });

    const result = await runImageLifecycleJob(
      "identity_retention",
      runIdentityRetentionJob,
      {
        dryRun: false,
        force: true,
        idempotencyKey: `test-id-${Date.now()}`,
      }
    );
    assert.ok(result.result);
    assert.ok((result.result!.deleted ?? 0) >= 1);
    assert.equal(await ImageAsset.findOne({ imageId: id.imageId }), null);
    assert.ok(await ImageAsset.findOne({ imageId: pub.imageId }));
  });

  it("orphan_classify: nunca borra; reporta pending", async () => {
    const result = await runImageLifecycleJob(
      "orphan_classify",
      runOrphanClassifyJob,
      {
        dryRun: false,
        force: true,
        idempotencyKey: `test-orphan-${Date.now()}`,
      }
    );
    assert.equal(result.result?.deleted, 0);
    assert.equal(result.result?.status, "success");
    assert.equal(result.result?.summary?.autoDelete, false);
  });

  it("idempotencia: segundo run en misma key se salta", async () => {
    const key = `test-idem-${Date.now()}`;
    const first = await runImageLifecycleJob(
      "orphan_classify",
      runOrphanClassifyJob,
      { force: false, idempotencyKey: key }
    );
    assert.equal(first.skipped, false);
    const second = await runImageLifecycleJob(
      "orphan_classify",
      runOrphanClassifyJob,
      { force: false, idempotencyKey: key }
    );
    assert.equal(second.skipped, true);
    assert.equal(second.reason, "idempotent");
  });
});

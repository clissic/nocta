import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createMemoryStorage } from "./memoryStorage.js";
import { createStorage, resetStorageSingleton } from "./createStorage.js";
import { StorageObjectNotFoundError } from "./errors.js";
import {
  createImageService,
  getImageTypeConfig,
  buildObjectKey,
} from "../image-service/index.js";

describe("memory storage", () => {
  it("put / exists / head / get / delete", async () => {
    const storage = createMemoryStorage();
    const key = "public/users/u1/img1/medium.webp";

    await storage.putObject({
      key,
      body: Buffer.from("webp-bytes"),
      contentType: "image/webp",
      cacheControl: "public, max-age=31536000, immutable",
    });

    assert.equal(await storage.exists(key), true);
    const head = await storage.headObject(key);
    assert.equal(head.exists, true);
    if (head.exists) {
      assert.equal(head.contentType, "image/webp");
      assert.equal(head.contentLength, 10);
    }

    const got = await storage.getObject(key);
    assert.equal(got.body.toString(), "webp-bytes");

    await storage.deleteObject(key);
    assert.equal(await storage.exists(key), false);
  });

  it("listObjects / deleteByPrefix", async () => {
    const storage = createMemoryStorage();
    await storage.putObject({
      key: "public/users/a/1.webp",
      body: "1",
      contentType: "image/webp",
    });
    await storage.putObject({
      key: "public/users/a/2.webp",
      body: "2",
      contentType: "image/webp",
    });
    await storage.putObject({
      key: "private/identity/u/x.jpg",
      body: "x",
      contentType: "image/jpeg",
    });

    const listed = await storage.listObjects("public/users/");
    assert.equal(listed.keys.length, 2);
    assert.equal(listed.isTruncated, false);

    const del = await storage.deleteByPrefix("public/users/");
    assert.equal(del.deleted, 2);
    assert.equal(await storage.exists("public/users/a/1.webp"), false);
    assert.equal(await storage.exists("private/identity/u/x.jpg"), true);
  });

  it("deleteObjects es idempotente con keys faltantes", async () => {
    const storage = createMemoryStorage();
    await storage.putObject({
      key: "a",
      body: "1",
      contentType: "text/plain",
    });
    await storage.deleteObjects(["a", "missing", "also-missing"]);
    assert.equal(await storage.exists("a"), false);
  });

  it("getPublicUrl requiere base; signed siempre disponible; private/ bloqueado", async () => {
    const bare = createMemoryStorage();
    assert.equal(bare.getPublicUrl("public/x.webp"), null);

    const withCdn = createMemoryStorage({
      publicBaseUrl: "https://cdn.example.com",
    });
    assert.equal(
      withCdn.getPublicUrl("public/x.webp"),
      "https://cdn.example.com/public/x.webp"
    );
    assert.equal(withCdn.getPublicUrl("private/identity/x.jpg"), null);

    await bare.putObject({
      key: "public/x.webp",
      body: "x",
      contentType: "image/webp",
    });
    const signed = await bare.getSignedReadUrl("public/x.webp", {
      expiresInSeconds: 60,
    });
    assert.match(signed, /^memory:\/\/signed\//);
  });

  it("getObject lanza si no existe", async () => {
    const storage = createMemoryStorage();
    await assert.rejects(
      () => storage.getObject("nope"),
      (err: unknown) => err instanceof StorageObjectNotFoundError
    );
  });
});

describe("createStorage auto", () => {
  it("sin credenciales Railway usa memory", () => {
    resetStorageSingleton();
    const storage = createStorage({
      driver: "memory",
      env: {
        driver: "auto",
        endpoint: "",
        region: "auto",
        bucket: "",
        accessKeyId: "",
        secretAccessKey: "",
        urlStyle: "virtual",
        publicBaseUrl: "",
        signedUrlTtlSeconds: 3600,
      },
    });
    assert.equal(storage.driver, "memory");
  });
});

describe("image-service", () => {
  it("paths respetan namespaces public/private por tipo", () => {
    const profileKey = buildObjectKey({
      type: "user_profile",
      imageId: "abc123def456abc123def456abc123de",
      context: { userId: "user1" },
      filename: "medium.webp",
    });
    assert.equal(
      profileKey,
      "public/users/user1/abc123def456abc123def456abc123de/medium.webp"
    );

    const identityKey = buildObjectKey({
      type: "identity_verification",
      imageId: "abc123def456abc123def456abc123de",
      context: { userId: "user1" },
      filename: "doc.jpg",
    });
    assert.equal(
      identityKey,
      "private/identity/user1/abc123def456abc123def456abc123de/doc.jpg"
    );

    const reportKey = buildObjectKey({
      type: "report_evidence",
      imageId: "abc123def456abc123def456abc123de",
      context: { reportId: "rep1" },
      filename: "shot.webp",
    });
    assert.equal(
      reportKey,
      "private/reports/rep1/abc123def456abc123def456abc123de/shot.webp"
    );
  });

  it("private nunca obtiene URL pública permanente", async () => {
    const storage = createMemoryStorage({
      publicBaseUrl: "https://cdn.example.com",
    });
    const images = createImageService(storage);

    const uploaded = await images.uploadObject({
      type: "identity_verification",
      context: { userId: "user1" },
      ownerId: "user1",
      body: Buffer.from("secret"),
      contentType: "image/jpeg",
      filename: "selfie.jpg",
    });

    assert.equal(uploaded.visibility, "private");
    assert.equal(images.getPublicUrlOrNull("identity_verification", uploaded.key), null);

    const resolved = await images.resolveReadUrl(
      "identity_verification",
      uploaded.key,
      { preferPublicUrl: true }
    );
    assert.equal(resolved.mode, "signed");
    assert.doesNotMatch(resolved.url, /^https:\/\/cdn\.example\.com\//);
  });

  it("public usa CDN cuando hay STORAGE_PUBLIC_BASE_URL", async () => {
    const storage = createMemoryStorage({
      publicBaseUrl: "https://cdn.example.com",
    });
    const images = createImageService(storage);

    const uploaded = await images.uploadObject({
      type: "user_profile",
      context: { userId: "user1" },
      ownerId: "user1",
      body: Buffer.from("face"),
      contentType: "image/webp",
      filename: "medium.webp",
    });

    const resolved = await images.resolveReadUrl("user_profile", uploaded.key);
    assert.equal(resolved.mode, "public");
    assert.equal(
      resolved.url,
      `https://cdn.example.com/${uploaded.key}`
    );
  });

  it("rechaza MIME no permitido según tipo", async () => {
    const images = createImageService(createMemoryStorage());
    await assert.rejects(
      () =>
        images.uploadObject({
          type: "user_profile",
          context: { userId: "u1" },
          ownerId: "u1",
          body: "<svg/>",
          contentType: "image/svg+xml",
          filename: "x.svg",
        }),
      (err: unknown) =>
        err instanceof Error &&
        "code" in err &&
        (err as { code: string }).code === "IMAGE_MIME_NOT_ALLOWED"
    );
  });

  it("registry marca identity y claims como private", () => {
    assert.equal(getImageTypeConfig("identity_verification").visibility, "private");
    assert.equal(getImageTypeConfig("claim_evidence").visibility, "private");
    assert.equal(getImageTypeConfig("report_evidence").visibility, "private");
    assert.equal(getImageTypeConfig("user_profile").visibility, "public");
  });
});

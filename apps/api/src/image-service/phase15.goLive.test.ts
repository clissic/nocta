/**
 * Fase 15 — regresión go-live del Image Service.
 * Invariantes críticas; no agrega producto.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ALLOWED_PHOTO_MIME_TYPES,
  ALLOWED_PHOTO_EXTENSIONS,
} from "@nocta/shared";
import { createMemoryStorage } from "../storage/memoryStorage.js";
import {
  createStorage,
  resetStorageSingleton,
} from "../storage/createStorage.js";
import { StorageNotConfiguredError } from "../storage/errors.js";
import { buildPublicObjectUrl } from "../storage/publicUrl.js";
import { createImageService, getImageTypeConfig } from "../image-service/index.js";
import { matchesImageMagicBytes } from "../uploads/validate.js";
import { noteLegacyUploadBlockedWrite } from "../uploads/legacyAccess.js";

describe("phase15 go-live regression", () => {
  it("MIME edge alineado: sin GIF; AVIF/HEIC permitidos en shared", () => {
    assert.ok(!ALLOWED_PHOTO_MIME_TYPES.includes("image/gif" as never));
    assert.ok(!ALLOWED_PHOTO_EXTENSIONS.includes(".gif" as never));
    assert.ok(ALLOWED_PHOTO_MIME_TYPES.includes("image/avif"));
    assert.ok(ALLOWED_PHOTO_MIME_TYPES.includes("image/heic"));
  });

  it("magic bytes rechaza GIF", () => {
    const gif = Buffer.from("GIF89a....................");
    assert.equal(matchesImageMagicBytes(gif), false);
  });

  it("CDN / getPublicUrl nunca para private/", () => {
    assert.equal(
      buildPublicObjectUrl("https://cdn.example.com", "private/identity/x.jpg"),
      null
    );
    const storage = createMemoryStorage({
      publicBaseUrl: "https://cdn.example.com",
    });
    assert.equal(storage.getPublicUrl("private/identity/x.jpg"), null);
    const images = createImageService(storage);
    assert.equal(
      images.getPublicUrlOrNull(
        "identity_verification",
        "private/identity/u/i/document.jpg"
      ),
      null
    );
  });

  it("identity registry: private + admin_signed + TTL", () => {
    const cfg = getImageTypeConfig("identity_verification");
    assert.equal(cfg.visibility, "private");
    assert.equal(cfg.accessPolicy.kind, "admin_signed");
    assert.equal(cfg.retention.kind, "ttl_days");
  });

  it("producción bloquea driver memory sin override", () => {
    resetStorageSingleton();
    const prevNode = process.env.NODE_ENV;
    const prevAllow = process.env.STORAGE_ALLOW_MEMORY;
    const prevE2e = process.env.NOCTA_E2E;
    try {
      process.env.NODE_ENV = "production";
      delete process.env.STORAGE_ALLOW_MEMORY;
      delete process.env.NOCTA_E2E;
      assert.throws(
        () =>
          createStorage({
            driver: "memory",
            env: {
              driver: "memory",
              endpoint: "",
              region: "auto",
              bucket: "",
              accessKeyId: "",
              secretAccessKey: "",
              urlStyle: "virtual",
              publicBaseUrl: "",
              signedUrlTtlSeconds: 3600,
            },
          }),
        (err: unknown) => err instanceof StorageNotConfiguredError
      );

      process.env.STORAGE_ALLOW_MEMORY = "1";
      const ok = createStorage({
        driver: "memory",
        env: {
          driver: "memory",
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
      assert.equal(ok.driver, "memory");
    } finally {
      if (prevNode === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = prevNode;
      if (prevAllow === undefined) delete process.env.STORAGE_ALLOW_MEMORY;
      else process.env.STORAGE_ALLOW_MEMORY = prevAllow;
      if (prevE2e === undefined) delete process.env.NOCTA_E2E;
      else process.env.NOCTA_E2E = prevE2e;
      resetStorageSingleton();
    }
  });

  it("legacy write telemetry helper no lanza", () => {
    assert.doesNotThrow(() => noteLegacyUploadBlockedWrite("POST", "/x.webp"));
  });
});

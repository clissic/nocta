import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPublicObjectUrl,
  hasPublicCdnConfigured,
  PRIVATE_OBJECT_CACHE_CONTROL,
  PUBLIC_OBJECT_CACHE_CONTROL,
} from "../storage/publicUrl.js";
import { createMemoryStorage } from "../storage/memoryStorage.js";
import { createImageService } from "./imageService.js";

describe("phase13 CDN public serving", () => {
  it("STORAGE_PUBLIC_BASE_URL: hasPublicCdnConfigured", () => {
    assert.equal(hasPublicCdnConfigured(""), false);
    assert.equal(hasPublicCdnConfigured(undefined), false);
    assert.equal(hasPublicCdnConfigured("https://cdn.nocta.app"), true);
  });

  it("buildPublicObjectUrl rechaza private/ y encodea segmentos", () => {
    assert.equal(
      buildPublicObjectUrl("https://cdn.example.com", "private/identity/x.jpg"),
      null
    );
    assert.equal(
      buildPublicObjectUrl(
        "https://cdn.example.com/",
        "public/users/u1/abc/medium.webp"
      ),
      "https://cdn.example.com/public/users/u1/abc/medium.webp"
    );
  });

  it("público con CDN → mode public sin firma; sin CDN → signed", async () => {
    const withCdn = createImageService(
      createMemoryStorage({ publicBaseUrl: "https://cdn.example.com" })
    );
    const uploaded = await withCdn.uploadObject({
      type: "user_profile",
      context: { userId: "u1" },
      ownerId: "u1",
      body: Buffer.from("webp"),
      contentType: "image/webp",
      filename: "medium.webp",
    });
    const resolved = await withCdn.resolveReadUrl(
      "user_profile",
      uploaded.key
    );
    assert.equal(resolved.mode, "public");
    assert.equal(
      resolved.url,
      `https://cdn.example.com/${uploaded.key}`
    );
    assert.doesNotMatch(resolved.url, /[?&](X-Amz-|token=)/i);

    const noCdn = createImageService(createMemoryStorage());
    const uploaded2 = await noCdn.uploadObject({
      type: "user_profile",
      context: { userId: "u2" },
      ownerId: "u2",
      body: Buffer.from("webp"),
      contentType: "image/webp",
      filename: "medium.webp",
    });
    const signed = await noCdn.resolveReadUrl("user_profile", uploaded2.key);
    assert.equal(signed.mode, "signed");
    assert.match(signed.url, /^memory:\/\/signed\//);
  });

  it("identity/sensitive nunca usa CDN aunque preferPublicUrl=true", async () => {
    const storage = createMemoryStorage({
      publicBaseUrl: "https://cdn.example.com",
    });
    const images = createImageService(storage);
    const uploaded = await images.uploadObject({
      type: "identity_verification",
      context: { userId: "u1" },
      ownerId: "u1",
      body: Buffer.from("jpeg"),
      contentType: "image/jpeg",
      filename: "selfie.jpg",
    });

    assert.ok(uploaded.key.startsWith("private/"));
    assert.equal(
      images.getPublicUrlOrNull("identity_verification", uploaded.key),
      null
    );
    assert.equal(storage.getPublicUrl(uploaded.key), null);

    const resolved = await images.resolveReadUrl(
      "identity_verification",
      uploaded.key,
      { preferPublicUrl: true }
    );
    assert.equal(resolved.mode, "signed");
    assert.doesNotMatch(resolved.url, /^https:\/\/cdn\.example\.com\//);
  });

  it("upload público aplica Cache-Control immutable + content-type", async () => {
    const storage = createMemoryStorage({
      publicBaseUrl: "https://cdn.example.com",
    });
    const images = createImageService(storage);
    const uploaded = await images.uploadObject({
      type: "space",
      context: { spaceId: "s1" },
      ownerId: "o1",
      body: Buffer.from("webp-bytes"),
      contentType: "image/webp",
      filename: "thumb.webp",
    });
    const head = await storage.headObject(uploaded.key);
    assert.ok(head.exists);
    if (head.exists) {
      assert.equal(head.contentType, "image/webp");
      assert.equal(head.cacheControl, PUBLIC_OBJECT_CACHE_CONTROL);
    }
    assert.match(PRIVATE_OBJECT_CACHE_CONTROL, /no-store/);
  });

  it("variantes canónicas siguen siendo thumb/medium/large", async () => {
    const { VARIANT_NAMES } = await import("./processingConstants.js");
    assert.deepEqual([...VARIANT_NAMES], ["thumb", "medium", "large"]);
  });
});

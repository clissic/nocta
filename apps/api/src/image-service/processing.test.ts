import assert from "node:assert/strict";
import { describe, it } from "node:test";
import sharp from "sharp";
import { createMemoryStorage } from "../storage/memoryStorage.js";
import {
  buildIdentityProcessed,
  buildPublicVariants,
} from "./processVariants.js";
import { validateImageSource } from "./validateSource.js";
import { mediaRefForImageId, parseMediaImageId } from "./refs.js";

async function sampleJpeg(width = 900, height = 600): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 40, g: 120, b: 200 },
    },
  })
    .jpeg()
    .toBuffer();
}

describe("validateImageSource", () => {
  it("acepta JPEG válido", async () => {
    const buffer = await sampleJpeg();
    const result = await validateImageSource({
      buffer,
      declaredMime: "image/jpeg",
      maxBytes: 10 * 1024 * 1024,
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.width, 900);
      assert.equal(result.heic, false);
    }
  });

  it("rechaza SVG / MIME falsificado", async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>'
    );
    const asSvg = await validateImageSource({
      buffer: svg,
      declaredMime: "image/svg+xml",
      maxBytes: 10 * 1024 * 1024,
    });
    assert.equal(asSvg.ok, false);

    const jpeg = await sampleJpeg(64, 64);
    const mismatch = await validateImageSource({
      buffer: jpeg,
      declaredMime: "image/png",
      maxBytes: 10 * 1024 * 1024,
    });
    assert.equal(mismatch.ok, false);
    if (!mismatch.ok) assert.equal(mismatch.code, "IMAGE_MIME_MISMATCH");
  });
});

describe("buildPublicVariants", () => {
  it("genera 6 variantes sin upscale y sin original", async () => {
    const buffer = await sampleJpeg(500, 400);
    const built = await buildPublicVariants(buffer);
    assert.equal(built.variants.length, 6);
    assert.ok(built.width <= 500);
    for (const v of built.variants) {
      assert.ok(v.width <= 500);
      assert.ok(v.bytes > 0);
      assert.match(v.filename, /^(thumb|medium|large)\.(webp|avif)$/);
    }
    const names = new Set(built.variants.map((v) => v.filename));
    assert.equal(names.size, 6);
  });
});

describe("buildIdentityProcessed", () => {
  it("produce JPEG privado", async () => {
    const buffer = await sampleJpeg(1200, 800);
    const out = await buildIdentityProcessed(buffer);
    assert.equal(out.contentType, "image/jpeg");
    assert.equal(out.filename, "document.jpg");
    assert.ok(out.width <= 2048);
  });
});

describe("refs", () => {
  it("parsea media refs absolutas y relativas", () => {
    const id = "abc123def456abc123def456abc122";
    assert.equal(parseMediaImageId(mediaRefForImageId(id)), id);
    assert.equal(
      parseMediaImageId(`https://api.example.com/api/media/${id}`),
      id
    );
    assert.equal(parseMediaImageId(`nocta:img:${id}`), id);
  });
});

describe("ingest with memory storage", () => {
  it("público: sube variantes y no deja key original", async () => {
    const storage = createMemoryStorage({
      publicBaseUrl: "https://cdn.example.com",
    });
    // ImageAsset necesita Mongo — este test solo ejercita Sharp+storage vía build+upload manual
    const buffer = await sampleJpeg(640, 480);
    const built = await buildPublicVariants(buffer);
    assert.equal(built.variants.length, 6);
    for (const file of built.variants) {
      await storage.putObject({
        key: `public/users/u1/img1/${file.filename}`,
        body: file.buffer,
        contentType: file.contentType,
      });
    }
    assert.equal(await storage.exists("public/users/u1/img1/original.jpg"), false);
    assert.equal(await storage.exists("public/users/u1/img1/medium.webp"), true);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import sharp from "sharp";
import {
  buildBlurredTeaserFromPhotoRef,
  buildLikeTeaserUrl,
  resetLikeTeaserCacheForTests,
  verifyLikeTeaserSig,
} from "./likePhotoTeaser.js";
import { join } from "node:path";
import { writeFile, mkdir, unlink } from "node:fs/promises";
import { UPLOADS_DIR, ensureUploadsDir } from "../uploads/paths.js";

describe("likePhotoTeaser", () => {
  it("firma y verifica URL de teaser", () => {
    const likeId = "507f1f77bcf86cd799439011";
    const viewerId = "507f1f77bcf86cd799439012";
    const url = buildLikeTeaserUrl(likeId, viewerId);
    assert.match(url, /\/api\/discover\/likes\/507f1f77bcf86cd799439011\/teaser\?/);
    const u = new URL(url, "http://localhost");
    const exp = Number(u.searchParams.get("exp"));
    const vid = u.searchParams.get("vid") || "";
    const sig = u.searchParams.get("sig") || "";
    assert.equal(vid, viewerId);
    assert.equal(verifyLikeTeaserSig(likeId, viewerId, exp, sig), true);
    assert.equal(verifyLikeTeaserSig(likeId, viewerId, exp, "bad"), false);
    assert.equal(verifyLikeTeaserSig(likeId, viewerId, exp - 10_000, sig), false);
  });

  it("genera webp blur desde upload legacy", async () => {
    resetLikeTeaserCacheForTests();
    ensureUploadsDir();
    const name = `teaser-test-${Date.now()}.jpg`;
    const path = join(UPLOADS_DIR, name);
    const jpeg = await sharp({
      create: {
        width: 400,
        height: 500,
        channels: 3,
        background: { r: 200, g: 80, b: 40 },
      },
    })
      .jpeg()
      .toBuffer();
    await mkdir(UPLOADS_DIR, { recursive: true });
    await writeFile(path, jpeg);
    try {
      const teaser = await buildBlurredTeaserFromPhotoRef(`/uploads/${name}`);
      assert.ok(teaser);
      assert.ok(teaser!.length > 0);
      const meta = await sharp(teaser!).metadata();
      assert.equal(meta.format, "webp");
      assert.ok((meta.width ?? 0) <= 320);
    } finally {
      await unlink(path).catch(() => undefined);
    }
  });
});

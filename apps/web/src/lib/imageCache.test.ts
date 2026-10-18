import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { imageCacheKey, isCacheableImageUrl } from "./imageCache.js";

describe("imageCache", () => {
  const id = "abc123def456abc123def456abc122";

  it("arma la misma clave aunque cambie la firma", () => {
    const stable = imageCacheKey(`/api/media/${id}?v=thumb&f=avif`);
    const signed = imageCacheKey(
      `https://bucket.example.com/public/users/u1/${id}/thumb.avif?X-Amz-Signature=aaa`
    );
    const signedAgain = imageCacheKey(
      `https://bucket.example.com/public/users/u1/${id}/thumb.avif?X-Amz-Signature=bbb`
    );
    assert.equal(stable, `nocta:${id}:thumb:avif`);
    assert.equal(signed, stable);
    assert.equal(signedAgain, stable);
  });

  it("cachea media, uploads e imágenes de catálogo", () => {
    assert.equal(isCacheableImageUrl(`/api/media/${id}?v=medium&f=webp`), true);
    assert.equal(isCacheableImageUrl("/uploads/foto.webp"), true);
    assert.equal(isCacheableImageUrl("/images/venues/x.webp"), true);
    assert.equal(isCacheableImageUrl("blob:http://localhost/1"), false);
    assert.equal(
      isCacheableImageUrl("https://cdn.example.com/public/a/medium.webp"),
      false
    );
  });
});

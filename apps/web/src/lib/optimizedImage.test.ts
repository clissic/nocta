import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildVariantSrcSet,
  classifyImageSrc,
  extractManagedImageId,
  looksSignedUrl,
  OPTIMIZED_IMAGE_DEFAULTS,
  planOptimizedSource,
  rewritePublicVariantUrl,
} from "./optimizedImage.js";

describe("optimizedImage helpers", () => {
  it("extrae imageId de /api/media y paths Storage", () => {
    const id = "abc123def456abc123def456abc122";
    assert.equal(extractManagedImageId(`/api/media/${id}`), id);
    assert.equal(
      extractManagedImageId(`https://api.example.com/api/media/${id}?v=medium`),
      id
    );
    assert.equal(
      extractManagedImageId(
        `https://cdn.example.com/public/users/u1/${id}/medium.webp`
      ),
      id
    );
  });

  it("clasifica legacy, static, blob y managed", () => {
    assert.equal(classifyImageSrc("/uploads/a.webp"), "legacy_upload");
    assert.equal(classifyImageSrc("/images/venues/XImg.webp"), "static");
    assert.equal(classifyImageSrc("blob:http://localhost/1"), "blob");
    assert.equal(
      classifyImageSrc("/api/media/abc123def456abc123def456abc122"),
      "managed"
    );
  });

  it("detecta URLs firmadas", () => {
    assert.equal(looksSignedUrl("https://cdn.example.com/x.webp"), false);
    assert.equal(
      looksSignedUrl(
        "https://bucket.example.com/key/medium.webp?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=abc"
      ),
      true
    );
  });

  it("arma srcset AVIF y WebP con thumb/medium/large", () => {
    const id = "abc123def456abc123def456abc122";
    const webp = buildVariantSrcSet(id, "webp");
    const avif = buildVariantSrcSet(id, "avif");
    assert.match(webp, /v=thumb&f=webp 320w/);
    assert.match(webp, /v=medium&f=webp 640w/);
    assert.match(webp, /v=large&f=webp 1080w/);
    assert.match(avif, /v=thumb&f=avif 320w/);
    assert.match(avif, /f=avif/);
    assert.doesNotMatch(avif, /f=webp/);
  });

  it("reescribe CDN pública a otra variante", () => {
    const base = "https://cdn.example.com/public/users/u1/abc123def456abc123def456abc122/medium.webp";
    assert.equal(
      rewritePublicVariantUrl(base, "thumb", "avif"),
      "https://cdn.example.com/public/users/u1/abc123def456abc123def456abc122/thumb.avif"
    );
    assert.equal(
      rewritePublicVariantUrl(
        `${base}?X-Amz-Signature=zzz`,
        "thumb",
        "avif"
      ),
      null
    );
  });

  it("plan: managed → picture; legacy → img; blob → img", () => {
    const id = "abc123def456abc123def456abc122";
    const managed = planOptimizedSource(`/api/media/${id}`, "medium");
    assert.ok(managed);
    assert.equal(managed.kind, "picture");
    if (managed.kind === "picture") {
      assert.match(managed.avifSrcSet, /f=avif/);
      assert.match(managed.webpSrcSet, /f=webp/);
      assert.match(managed.imgSrc, /v=medium&f=webp/);
    }

    const legacy = planOptimizedSource("/uploads/old.webp");
    assert.ok(legacy);
    assert.equal(legacy.kind, "img");
    if (legacy.kind === "img") {
      assert.equal(legacy.sourceKind, "legacy_upload");
      assert.match(legacy.imgSrc, /\/uploads\/old\.webp/);
    }

    const blob = planOptimizedSource("blob:http://localhost/xyz");
    assert.ok(blob);
    assert.equal(blob.kind, "img");
    if (blob.kind === "img") assert.equal(blob.sourceKind, "blob");
  });

  it("plan null si no hay src (fallback/placeholder en el componente)", () => {
    assert.equal(planOptimizedSource(null), null);
    assert.equal(planOptimizedSource(""), null);
  });

  it("plan CDN: picture con AVIF/WebP srcset directo (sin /api/media)", () => {
    const id = "abc123def456abc123def456abc122";
    const cdn = `https://cdn.example.com/public/users/u1/${id}/medium.webp`;
    const plan = planOptimizedSource(cdn, "medium");
    assert.ok(plan && plan.kind === "picture");
    if (plan.kind === "picture") {
      assert.match(plan.avifSrcSet, /cdn\.example\.com/);
      assert.match(plan.avifSrcSet, /thumb\.avif 320w/);
      assert.match(plan.webpSrcSet, /large\.webp 1080w/);
      assert.doesNotMatch(plan.avifSrcSet, /\/api\/media\//);
      assert.match(plan.imgSrc, /medium\.webp$/);
    }
  });

  it("defaults de lazy / decoding / variant", () => {
    assert.equal(OPTIMIZED_IMAGE_DEFAULTS.loading, "lazy");
    assert.equal(OPTIMIZED_IMAGE_DEFAULTS.decoding, "async");
    assert.equal(OPTIMIZED_IMAGE_DEFAULTS.variant, "medium");
  });

  it("perfiles/espacios/reviews managed → picture con AVIF+WebP srcset", () => {
    const id = "abc123def456abc123def456abc122";
    for (const src of [
      `/api/media/${id}`,
      `https://cdn.example.com/public/spaces/s1/${id}/medium.webp`,
      `https://cdn.example.com/public/reviews/r1/${id}/large.avif`,
    ]) {
      const plan = planOptimizedSource(src, "medium");
      assert.ok(plan && plan.kind === "picture", src);
      if (plan?.kind === "picture") {
        assert.match(plan.avifSrcSet, /\.avif|f=avif/);
        assert.match(plan.webpSrcSet, /\.webp|f=webp/);
      }
    }
  });
});

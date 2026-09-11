import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  discoverDetailPreferredVariant,
  discoverSwipePreferredVariant,
  discoverVisiblePhotoPlan,
  DISCOVER_SWIPE_VARIANTS,
} from "./discoverImages.js";
import { planOptimizedSource } from "./optimizedImage.js";

describe("discoverImages", () => {
  it("swipe: thumb en viewport angosto, medium en ancho", () => {
    assert.equal(discoverSwipePreferredVariant(390), "thumb");
    assert.equal(discoverSwipePreferredVariant(800), "medium");
  });

  it("detalle: medium mobile, large desktop", () => {
    assert.equal(discoverDetailPreferredVariant(400), "medium");
    assert.equal(discoverDetailPreferredVariant(992), "large");
  });

  it("plan visible: solo foto actual + preload 1ª del next", () => {
    const photos = ["/a", "/b", "/c"];
    const compact = discoverVisiblePhotoPlan({
      currentPhotos: photos,
      photoIndex: 0,
      nextPrimaryPhoto: "/next",
      detailOpen: false,
    });
    assert.equal(compact.renderSrc, "/a");
    assert.equal(compact.preloadNext, "/next");

    const mid = discoverVisiblePhotoPlan({
      currentPhotos: photos,
      photoIndex: 2,
      nextPrimaryPhoto: "/next",
      detailOpen: false,
    });
    assert.equal(mid.renderSrc, "/c");
    assert.equal(mid.preloadNext, "/next");

    const detail = discoverVisiblePhotoPlan({
      currentPhotos: photos,
      photoIndex: 0,
      nextPrimaryPhoto: "/next",
      detailOpen: true,
    });
    assert.equal(detail.preloadNext, undefined);
  });

  it("srcset de swipe no incluye large", () => {
    const id = "abc123def456abc123def456abc122";
    const plan = planOptimizedSource(`/api/media/${id}`, {
      preferred: "thumb",
      variants: DISCOVER_SWIPE_VARIANTS,
    });
    assert.ok(plan && plan.kind === "picture");
    if (plan?.kind === "picture") {
      assert.match(plan.webpSrcSet, /v=thumb/);
      assert.match(plan.webpSrcSet, /v=medium/);
      assert.doesNotMatch(plan.webpSrcSet, /v=large/);
    }
  });

  it("preload solo siguiente card; nunca álbum completo", () => {
    const photos = ["/p0", "/p1", "/p2"];
    const plan = discoverVisiblePhotoPlan({
      currentPhotos: photos,
      photoIndex: 0,
      nextPrimaryPhoto: "/next-only",
      detailOpen: false,
    });
    assert.equal(plan.renderSrc, "/p0");
    assert.equal(plan.preloadNext, "/next-only");
    assert.notEqual(plan.preloadNext, "/p1");
  });
});

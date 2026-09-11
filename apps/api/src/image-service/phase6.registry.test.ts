import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { looksLikeManagedImageId } from "./privateAccess.js";
import { getImageTypeConfig, IMAGE_TYPE_REGISTRY } from "./registry.js";

describe("image-service phase 6 registry", () => {
  it("todos los ImageTypes tienen visibility y accessPolicy", () => {
    for (const type of Object.keys(IMAGE_TYPE_REGISTRY) as Array<
      keyof typeof IMAGE_TYPE_REGISTRY
    >) {
      const cfg = getImageTypeConfig(type);
      assert.ok(cfg.visibility === "public" || cfg.visibility === "private");
      assert.ok(cfg.accessPolicy);
      assert.ok(cfg.processingProfile);
    }
  });

  it("identity y claims son private sin CDN público", () => {
    assert.equal(
      getImageTypeConfig("identity_verification").visibility,
      "private"
    );
    assert.equal(getImageTypeConfig("claim_evidence").visibility, "private");
    assert.equal(getImageTypeConfig("report_evidence").visibility, "private");
    assert.equal(
      getImageTypeConfig("identity_verification").accessPolicy.kind,
      "admin_signed"
    );
  });

  it("detecta imageIds managed vs filenames legacy", () => {
    const id = "abc123def456abc123def456abc122ab";
    assert.equal(looksLikeManagedImageId(id), true);
    assert.equal(looksLikeManagedImageId(`/api/media/${id}`), true);
    assert.equal(
      looksLikeManagedImageId("user-123-169999-abcdef.jpg"),
      false
    );
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createSignedUrlCache } from "./signedUrlCache.js";

describe("signedUrlCache", () => {
  it("get/set y hit", () => {
    const cache = createSignedUrlCache({ maxEntries: 10, ttlMs: 60_000 });
    assert.equal(cache.get("a"), undefined);
    cache.set("a", "https://signed/a");
    assert.equal(cache.get("a"), "https://signed/a");
  });

  it("expira por TTL", async () => {
    const cache = createSignedUrlCache({ maxEntries: 10, ttlMs: 20 });
    cache.set("a", "url");
    assert.equal(cache.get("a"), "url");
    await new Promise((r) => setTimeout(r, 35));
    assert.equal(cache.get("a"), undefined);
  });

  it("evict LRU al superar maxEntries", () => {
    const cache = createSignedUrlCache({ maxEntries: 2, ttlMs: 60_000 });
    cache.set("a", "1");
    cache.set("b", "2");
    // touch a → b es el más viejo
    assert.equal(cache.get("a"), "1");
    cache.set("c", "3");
    assert.equal(cache.get("b"), undefined);
    assert.equal(cache.get("a"), "1");
    assert.equal(cache.get("c"), "3");
    assert.equal(cache.size(), 2);
  });
});

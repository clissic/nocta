import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { writeFileSync, existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import {
  TEMP_UPLOAD_DIR,
  UPLOADS_DIR,
  ensureTempUploadDir,
  ensureUploadsDir,
} from "../uploads/paths.js";
import {
  findForbiddenNewLegacyUploadRefs,
  canonicalizePhotoRef,
} from "./uploadBridge.js";
import {
  getLegacyUploadAccessStats,
  noteLegacyUploadBlockedWrite,
  noteLegacyUploadGet,
  resetLegacyUploadAccessStats,
} from "../uploads/legacyAccess.js";

describe("phase11 — legacy deprecation", () => {
  it("staging TEMP no es el corpus /uploads", () => {
    assert.notEqual(TEMP_UPLOAD_DIR, UPLOADS_DIR);
    assert.match(TEMP_UPLOAD_DIR.replace(/\\/g, "/"), /tmp\/upload-staging$/);
    assert.match(UPLOADS_DIR.replace(/\\/g, "/"), /uploads$/);
  });

  it("ensureTemp escribe fuera de UPLOADS_DIR", () => {
    const temp = ensureTempUploadDir();
    const legacy = ensureUploadsDir();
    const marker = join(temp, `phase11-${Date.now()}.bin`);
    writeFileSync(marker, Buffer.from("tmp"));
    assert.equal(existsSync(marker), true);
    assert.ok(!marker.startsWith(legacy) || marker.includes("tmp"));
    assert.ok(marker.startsWith(temp));
    unlinkSync(marker);
  });

  it("bloquea nuevas refs /uploads no presentes en previous", () => {
    const forbidden = findForbiddenNewLegacyUploadRefs(
      ["/uploads/nuevo.webp", "/api/media/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
      ["/uploads/viejo.webp"]
    );
    assert.deepEqual(forbidden, ["/uploads/nuevo.webp"]);

    const ok = findForbiddenNewLegacyUploadRefs(
      ["/uploads/viejo.webp"],
      ["/uploads/viejo.webp"]
    );
    assert.equal(ok.length, 0);
  });

  it("canonicalize conserva legacy y media", () => {
    assert.equal(
      canonicalizePhotoRef("/uploads/a.webp"),
      "/uploads/a.webp"
    );
    assert.equal(
      canonicalizePhotoRef("/api/media/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
      "/api/media/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    );
  });

  it("telemetría de acceso legacy", () => {
    resetLegacyUploadAccessStats();
    noteLegacyUploadGet("/foo.webp");
    noteLegacyUploadBlockedWrite("POST", "/foo.webp");
    const stats = getLegacyUploadAccessStats();
    assert.equal(stats.getHits, 1);
    assert.equal(stats.blockedWrites, 1);
  });
});

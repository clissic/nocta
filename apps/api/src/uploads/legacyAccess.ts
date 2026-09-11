/**
 * Telemetría y modo read-only de `/uploads` legacy (Fase 11).
 * No sirve bytes; se monta delante de express.static.
 */
let legacyGetHits = 0;
let legacyBlockedWrites = 0;

export function getLegacyUploadAccessStats() {
  return {
    getHits: legacyGetHits,
    blockedWrites: legacyBlockedWrites,
  };
}

export function resetLegacyUploadAccessStats() {
  legacyGetHits = 0;
  legacyBlockedWrites = 0;
}

export function noteLegacyUploadGet(path: string) {
  legacyGetHits += 1;
  console.warn(`[legacy-uploads] GET ${path}`);
}

export function noteLegacyUploadBlockedWrite(method: string, path: string) {
  legacyBlockedWrites += 1;
  console.warn(`[legacy-uploads] BLOCKED ${method} ${path}`);
}

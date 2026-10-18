import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isExpoPushToken, tokensToDrop } from "./expoPush.js";

describe("expoPush", () => {
  it("acepta tokens de Expo", () => {
    assert.equal(isExpoPushToken("ExponentPushToken[abc123]"), true);
    assert.equal(isExpoPushToken("ExpoPushToken[abc]"), true);
    assert.equal(isExpoPushToken("fcm-raw-token"), false);
  });

  it("marca solo los tokens que Expo ya no reconoce", () => {
    const drop = tokensToDrop(
      [
        { status: "ok" },
        { status: "error", details: { error: "DeviceNotRegistered" } },
        { status: "error", details: { error: "MessageRateExceeded" } },
      ],
      ["ExponentPushToken[a]", "ExponentPushToken[b]", "ExponentPushToken[c]"]
    );
    assert.deepEqual(drop, ["ExponentPushToken[b]"]);
  });
});

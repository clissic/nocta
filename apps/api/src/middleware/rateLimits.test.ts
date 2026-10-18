import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";
import express from "express";
import { loginIpLimiter } from "./rateLimits.js";

function listen(app: express.Express) {
  const server = createServer(app);
  return new Promise<{ port: number; close: () => Promise<void> }>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const port = (server.address() as AddressInfo).port;
      resolve({
        port,
        close: () =>
          new Promise((done, reject) => {
            server.close((err) => (err ? reject(err) : done()));
          }),
      });
    });
  });
}

test("login por IP responde 429 al undécimo intento", async () => {
  const app = express();
  app.set("trust proxy", 1);
  app.post("/login", loginIpLimiter, (_req, res) => {
    res.json({ ok: true });
  });
  const server = await listen(app);
  try {
    const statuses: number[] = [];
    for (let i = 0; i < 11; i += 1) {
      const response = await fetch(`http://127.0.0.1:${server.port}/login`, {
        method: "POST",
      });
      statuses.push(response.status);
      if (response.status === 429) {
        const body = (await response.json()) as { error?: string };
        assert.match(body.error ?? "", /Demasiadas solicitudes/);
      }
    }
    assert.deepEqual(statuses.slice(0, 10), Array(10).fill(200));
    assert.equal(statuses[10], 429);
  } finally {
    await server.close();
  }
});

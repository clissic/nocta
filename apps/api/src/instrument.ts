import { config as loadDotenv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as Sentry from "@sentry/node";

// Misma regla que config.ts: cargar apps/api/.env aunque el cwd sea la raíz.
const apiDir = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: resolve(apiDir, "../.env") });

function env(key: string, fallback = ""): string {
  const raw = process.env[key] ?? fallback;
  return String(raw).replace(/^["']|["']$/g, "").trim();
}

function tracesSampleRate(): number {
  const parsed = Number(env("SENTRY_TRACES_SAMPLE_RATE", "0.1"));
  return Number.isFinite(parsed) ? parsed : 0.1;
}

const dsn = env("SENTRY_DSN");

/** true cuando hay DSN y Sentry quedó inicializado. */
export const sentryEnabled = Boolean(dsn);

if (sentryEnabled && !Sentry.getClient()) {
  Sentry.init({
    dsn,
    environment: env("SENTRY_ENVIRONMENT") || env("NODE_ENV", "development"),
    tracesSampleRate: tracesSampleRate(),
    // v11 reemplazó sendDefaultPii por dataCollection. Conservador: sin PII por defecto.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpBodies: [],
    },
  });
}

import { config as loadDotenv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Siempre carga apps/api/.env (aunque el cwd sea la raíz del monorepo)
const apiDir = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: resolve(apiDir, "../.env") });

function env(key: string, fallback = ""): string {
  const raw = process.env[key] ?? fallback;
  return String(raw).replace(/^["']|["']$/g, "").trim();
}

/**
 * Resuelve la URI de Mongo:
 * - `memory` → Mongo embebido
 * - `MONGODB_URI` completa (Atlas / local)
 * - o arma `mongodb+srv://USER:PASS@HOST/...` con USER/PASS
 */
function resolveMongoUri(): string {
  const raw = env("MONGODB_URI", "memory");
  if (!raw || raw === "memory") return "memory";

  const username = env("MONGODB_USERNAME");
  const password = env("MONGODB_PASSWORD");
  const dbName = env("MONGODB_DB", "nocta");

  let uri = raw;

  // Si la URI no trae credenciales pero sí hay USER/PASS en env, las inserta
  if (username && password && !uri.includes("@")) {
    const scheme = uri.startsWith("mongodb+srv://")
      ? "mongodb+srv://"
      : uri.startsWith("mongodb://")
        ? "mongodb://"
        : "mongodb+srv://";
    const host = uri.replace(/^mongodb(\+srv)?:\/\//, "");
    uri = `${scheme}${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}`;
  }

  // Fuerza el nombre de base de `MONGODB_DB` (Mongo distingue mayúsculas)
  try {
    const parsed = new URL(uri);
    parsed.pathname = `/${dbName}`;
    if (!parsed.searchParams.has("retryWrites")) {
      parsed.searchParams.set("retryWrites", "true");
    }
    if (!parsed.searchParams.has("w")) {
      parsed.searchParams.set("w", "majority");
    }
    uri = parsed.toString();
  } catch {
    // URI no parseable como URL estándar; se usa tal cual
  }

  return uri;
}

export const config = {
  port: Number(env("PORT", "4000")),
  mongoUri: resolveMongoUri(),
  mongoDbName: env("MONGODB_DB", "nocta"),
  /** Reintentos de conexión al arranque antes de abortar. */
  mongoRetries: Math.max(1, Number(env("MONGODB_RETRIES", "5"))),
  /** Si true, corre seed al boot aunque no sea memory (solo si la DB está vacía). */
  seedOnEmpty: env("SEED_ON_EMPTY", "true") !== "false",
  jwtSecret: env("JWT_SECRET", "nocta-dev-secret"),
  clientOrigin: env("CLIENT_ORIGIN", "http://localhost:5173"),
  apiPublicUrl: env("API_PUBLIC_URL", "http://localhost:4000"),
  adminEmail: env("ADMIN_EMAIL", "admin@nocta.app"),
  adminPassword: env("ADMIN_PASSWORD", "Admin1234!"),
  mail: {
    host: env("SMTP_HOST"),
    port: Number(env("SMTP_PORT", "587")),
    user: env("SMTP_USER"),
    /** App passwords de Gmail pueden venir con espacios; se normalizan. */
    pass: env("SMTP_PASS").replace(/\s+/g, ""),
    from: env("MAIL_FROM", "Nocta <noreply@nocta.app>"),
    /** Bandeja interna que recibe nuevas solicitudes de Espacios. */
    notifyTo:
      env("MAIL_NOTIFY_TO") ||
      env("SMTP_USER") ||
      env("ADMIN_EMAIL", "admin@nocta.app"),
    /** Si true, además loguea el mail en consola (aunque haya SMTP). */
    devLog: env("MAIL_DEV_LOG", "true") !== "false",
  },
  oauth: {
    google: {
      clientId: env("GOOGLE_CLIENT_ID"),
      clientSecret: env("GOOGLE_CLIENT_SECRET"),
    },
    apple: {
      clientId: env("APPLE_CLIENT_ID"),
      teamId: env("APPLE_TEAM_ID"),
      keyId: env("APPLE_KEY_ID"),
      privateKey: env("APPLE_PRIVATE_KEY").replace(/\\n/g, "\n"),
    },
    microsoft: {
      clientId: env("MICROSOFT_CLIENT_ID"),
      clientSecret: env("MICROSOFT_CLIENT_SECRET"),
      tenant: env("MICROSOFT_TENANT", "common"),
    },
  },
};

export const isMemoryDb = config.mongoUri === "memory";

import path from "node:path";
import { fileURLToPath } from "node:url";
import { hasRailwayCredentials, readStorageEnv, type StorageEnv } from "./env.js";
import { StorageNotConfiguredError } from "./errors.js";
import { createMemoryStorage } from "./memoryStorage.js";
import { createRailwayStorage } from "./railwayStorage.js";
import type { ObjectStorage } from "./types.js";

const API_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** Persistencia local del driver memory (sobrevive reinicios de la API). */
function memoryPersistDir(): string | undefined {
  if (process.env.NOCTA_E2E === "1") return undefined;
  const nodeEnv = (process.env.NODE_ENV ?? "").toLowerCase();
  if (nodeEnv === "test") return undefined;
  const fromEnv = (process.env.MEMORY_STORAGE_DIR ?? "").trim();
  if (fromEnv === "0" || fromEnv.toLowerCase() === "off") return undefined;
  if (fromEnv) return path.resolve(fromEnv);
  return path.join(API_ROOT, ".data", "memory-storage");
}

let singleton: ObjectStorage | null = null;

export type CreateStorageOptions = {
  env?: StorageEnv;
  /** Fuerza driver (tests). */
  driver?: "memory" | "railway";
};

function isProductionLikeRuntime(): boolean {
  const nodeEnv = (process.env.NODE_ENV ?? "").toLowerCase();
  if (nodeEnv === "production") return true;
  const railway = (process.env.RAILWAY_ENVIRONMENT ?? "").toLowerCase();
  return railway === "production";
}

function allowMemoryDriver(): boolean {
  return (
    process.env.STORAGE_ALLOW_MEMORY === "1" ||
    process.env.NOCTA_E2E === "1"
  );
}

/**
 * Factory del object storage.
 * `auto`: Railway si hay credenciales; si no, memory (dev/tests).
 * Producción: memory está bloqueado salvo STORAGE_ALLOW_MEMORY=1 / NOCTA_E2E.
 */
export function createStorage(opts: CreateStorageOptions = {}): ObjectStorage {
  const env = opts.env ?? readStorageEnv();
  const driver =
    opts.driver ??
    (env.driver === "auto"
      ? hasRailwayCredentials(env)
        ? "railway"
        : "memory"
      : env.driver);

  if (driver === "railway") {
    if (!hasRailwayCredentials(env)) {
      throw new StorageNotConfiguredError(
        "STORAGE_DRIVER=railway pero faltan credenciales del bucket"
      );
    }
    return createRailwayStorage(env);
  }

  if (isProductionLikeRuntime() && !allowMemoryDriver()) {
    throw new StorageNotConfiguredError(
      "Object Storage memory no permitido en producción. Configurá Railway (AWS_* / STORAGE_*) o STORAGE_ALLOW_MEMORY=1 solo en emergencia."
    );
  }

  return createMemoryStorage({
    publicBaseUrl: env.publicBaseUrl,
    persistDir: memoryPersistDir(),
  });
}

/** Instancia compartida (lazy). No usar en tests que mutan env. */
export function getStorage(): ObjectStorage {
  if (!singleton) singleton = createStorage();
  return singleton;
}

/** Solo tests. */
export function resetStorageSingleton(): void {
  singleton = null;
}
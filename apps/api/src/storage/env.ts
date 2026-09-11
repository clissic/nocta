/**
 * Resolución de variables de Object Storage (Railway Buckets).
 *
 * Railway puede inyectar credenciales con el preset AWS SDK:
 *   AWS_ENDPOINT_URL, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY,
 *   AWS_S3_BUCKET_NAME, AWS_DEFAULT_REGION, AWS_S3_URL_STYLE
 *
 * O como referencias nativas del bucket:
 *   ENDPOINT, ACCESS_KEY_ID, SECRET_ACCESS_KEY, BUCKET, REGION
 *
 * Prefijo opcional Nocta: STORAGE_*
 */

function raw(key: string): string {
  const value = process.env[key];
  if (value == null) return "";
  return String(value).replace(/^["']|["']$/g, "").trim();
}

function first(...keys: string[]): string {
  for (const key of keys) {
    const value = raw(key);
    if (value) return value;
  }
  return "";
}

export type StorageEnv = {
  driver: "auto" | "memory" | "railway";
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** `virtual` (default Railway nuevo) | `path` (buckets legacy). */
  urlStyle: "virtual" | "path";
  /**
   * Base pública (CDN / custom domain) delante del bucket.
   * Sin esto no hay URL pública permanente (Railway buckets son privados).
   */
  publicBaseUrl: string;
  /** TTL default de URLs firmadas de lectura (segundos). */
  signedUrlTtlSeconds: number;
};

export function readStorageEnv(): StorageEnv {
  const driverRaw = first("STORAGE_DRIVER").toLowerCase();
  const driver =
    driverRaw === "memory" || driverRaw === "railway" || driverRaw === "auto"
      ? driverRaw
      : "auto";

  const urlStyleRaw = first(
    "STORAGE_URL_STYLE",
    "AWS_S3_URL_STYLE"
  ).toLowerCase();
  const urlStyle = urlStyleRaw === "path" ? "path" : "virtual";

  const ttl = Number(
    first("STORAGE_SIGNED_URL_TTL_SECONDS", "3600") || "3600"
  );

  return {
    driver,
    endpoint: first(
      "STORAGE_ENDPOINT",
      "AWS_ENDPOINT_URL",
      "ENDPOINT"
    ),
    region: first(
      "STORAGE_REGION",
      "AWS_DEFAULT_REGION",
      "REGION"
    ) || "auto",
    bucket: first(
      "STORAGE_BUCKET",
      "AWS_S3_BUCKET_NAME",
      "BUCKET"
    ),
    accessKeyId: first(
      "STORAGE_ACCESS_KEY_ID",
      "AWS_ACCESS_KEY_ID",
      "ACCESS_KEY_ID"
    ),
    secretAccessKey: first(
      "STORAGE_SECRET_ACCESS_KEY",
      "AWS_SECRET_ACCESS_KEY",
      "SECRET_ACCESS_KEY"
    ),
    urlStyle,
    publicBaseUrl: first("STORAGE_PUBLIC_BASE_URL").replace(/\/$/, ""),
    signedUrlTtlSeconds:
      Number.isFinite(ttl) && ttl > 0 ? Math.floor(ttl) : 3600,
  };
}

export function hasRailwayCredentials(env: StorageEnv = readStorageEnv()): boolean {
  return Boolean(
    env.endpoint &&
      env.bucket &&
      env.accessKeyId &&
      env.secretAccessKey
  );
}

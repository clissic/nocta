/** Cuerpo aceptado por el driver de object storage. */
export type StorageBody = Buffer | Uint8Array | string;

export type PutObjectInput = {
  key: string;
  body: StorageBody;
  contentType: string;
  cacheControl?: string;
  /** Metadata HTTP (solo ASCII; valores string). */
  metadata?: Record<string, string>;
};

export type PutObjectResult = {
  key: string;
  etag?: string;
};

export type HeadObjectResult = {
  key: string;
  exists: true;
  contentType?: string;
  contentLength?: number;
  etag?: string;
  lastModified?: Date;
  metadata?: Record<string, string>;
  /** Presente si el driver lo guarda (memory; Railway vía HeadObject si se mapea). */
  cacheControl?: string;
};

export type GetObjectResult = {
  key: string;
  body: Buffer;
  contentType?: string;
  contentLength?: number;
  etag?: string;
  metadata?: Record<string, string>;
};

export type SignedUrlOptions = {
  /** Segundos de validez. */
  expiresInSeconds: number;
};

export type ListObjectsOptions = {
  /** Máximo por página (default driver-dependent; Railway ≤1000). */
  maxKeys?: number;
  /** Token de continuación de una página anterior. */
  continuationToken?: string;
};

export type ListObjectsResult = {
  keys: string[];
  isTruncated: boolean;
  nextContinuationToken?: string;
};

export type DeleteByPrefixResult = {
  deleted: number;
  keys: string[];
};

/**
 * Abstracción de object storage.
 * La lógica de negocio NUNCA debe importar el SDK de Railway/S3 directamente.
 *
 * Housekeeping (Fase 14): `listObjects` / `exists` / `deleteObject` / `deleteByPrefix`.
 * (`delete` = `deleteObject`; no se duplica el nombre en la API pública.)
 */
export type ObjectStorage = {
  readonly driver: "memory" | "railway";

  putObject(input: PutObjectInput): Promise<PutObjectResult>;
  /** Delete de un objeto (idempotente si la key no existe). */
  deleteObject(key: string): Promise<void>;
  deleteObjects(keys: string[]): Promise<void>;
  exists(key: string): Promise<boolean>;
  headObject(key: string): Promise<HeadObjectResult | { key: string; exists: false }>;
  getObject(key: string): Promise<GetObjectResult>;

  /**
   * Lista keys bajo un prefix (paginado).
   * Usar para diagnóstico / housekeeping; no para hot path de request.
   */
  listObjects(
    prefix: string,
    opts?: ListObjectsOptions
  ): Promise<ListObjectsResult>;

  /**
   * Borra todos los objetos bajo un prefix (lista + deleteObjects).
   * Destructivo: solo desde CLIs con --execute, nunca desde diagnose.
   */
  deleteByPrefix(prefix: string): Promise<DeleteByPrefixResult>;

  /**
   * URL firmada de lectura (bucket privado Railway).
   * Usar para objetos private y, si no hay CDN, también para public.
   */
  getSignedReadUrl(key: string, opts: SignedUrlOptions): Promise<string>;

  /**
   * URL “pública” estable si hay base CDN/custom (`STORAGE_PUBLIC_BASE_URL`).
   * Sin base configurada → `null` (Railway no soporta buckets públicos).
   */
  getPublicUrl(key: string): string | null;
};

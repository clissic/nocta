import { createHash, randomBytes } from "node:crypto";
import { StorageObjectNotFoundError } from "./errors.js";
import { buildPublicObjectUrl } from "./publicUrl.js";
import type {
  DeleteByPrefixResult,
  GetObjectResult,
  HeadObjectResult,
  ListObjectsOptions,
  ListObjectsResult,
  ObjectStorage,
  PutObjectInput,
  PutObjectResult,
  SignedUrlOptions,
  StorageBody,
} from "./types.js";

type StoredObject = {
  body: Buffer;
  contentType: string;
  cacheControl?: string;
  metadata?: Record<string, string>;
  etag: string;
  lastModified: Date;
};

function toBuffer(body: StorageBody): Buffer {
  if (typeof body === "string") return Buffer.from(body);
  return Buffer.from(body);
}

/**
 * Driver in-memory para tests y desarrollo local sin bucket Railway.
 * No persiste entre procesos.
 */
export function createMemoryStorage(opts?: {
  publicBaseUrl?: string;
}): ObjectStorage {
  const store = new Map<string, StoredObject>();
  const publicBaseUrl = (opts?.publicBaseUrl ?? "").replace(/\/$/, "");
  const tokens = new Map<string, { key: string; expiresAt: number }>();

  return {
    driver: "memory",

    async putObject(input: PutObjectInput): Promise<PutObjectResult> {
      const body = toBuffer(input.body);
      const etag = createHash("md5").update(body).digest("hex");
      store.set(input.key, {
        body,
        contentType: input.contentType,
        cacheControl: input.cacheControl,
        metadata: input.metadata,
        etag,
        lastModified: new Date(),
      });
      return { key: input.key, etag };
    },

    async deleteObject(key: string): Promise<void> {
      store.delete(key);
    },

    async deleteObjects(keys: string[]): Promise<void> {
      for (const key of keys) store.delete(key);
    },

    async exists(key: string): Promise<boolean> {
      return store.has(key);
    },

    async listObjects(
      prefix: string,
      opts?: ListObjectsOptions
    ): Promise<ListObjectsResult> {
      const maxKeys = Math.min(Math.max(opts?.maxKeys ?? 1000, 1), 5000);
      const all = [...store.keys()]
        .filter((k) => (prefix ? k.startsWith(prefix) : true))
        .sort();
      const start = opts?.continuationToken
        ? Number.parseInt(opts.continuationToken, 10) || 0
        : 0;
      const slice = all.slice(start, start + maxKeys);
      const next = start + slice.length;
      const isTruncated = next < all.length;
      return {
        keys: slice,
        isTruncated,
        nextContinuationToken: isTruncated ? String(next) : undefined,
      };
    },

    async deleteByPrefix(prefix: string): Promise<DeleteByPrefixResult> {
      if (!prefix) {
        return { deleted: 0, keys: [] };
      }
      const keys: string[] = [];
      let token: string | undefined;
      do {
        const page = await this.listObjects(prefix, {
          maxKeys: 1000,
          continuationToken: token,
        });
        keys.push(...page.keys);
        token = page.nextContinuationToken;
      } while (token);
      await this.deleteObjects(keys);
      return { deleted: keys.length, keys };
    },

    async headObject(
      key: string
    ): Promise<HeadObjectResult | { key: string; exists: false }> {
      const obj = store.get(key);
      if (!obj) return { key, exists: false };
      return {
        key,
        exists: true,
        contentType: obj.contentType,
        contentLength: obj.body.length,
        etag: obj.etag,
        lastModified: obj.lastModified,
        metadata: obj.metadata,
        cacheControl: obj.cacheControl,
      };
    },

    async getObject(key: string): Promise<GetObjectResult> {
      const obj = store.get(key);
      if (!obj) throw new StorageObjectNotFoundError(key);
      return {
        key,
        body: Buffer.from(obj.body),
        contentType: obj.contentType,
        contentLength: obj.body.length,
        etag: obj.etag,
        metadata: obj.metadata,
      };
    },

    async getSignedReadUrl(
      key: string,
      opts: SignedUrlOptions
    ): Promise<string> {
      if (!store.has(key)) throw new StorageObjectNotFoundError(key);
      const token = randomBytes(16).toString("hex");
      const expiresAt = Date.now() + opts.expiresInSeconds * 1000;
      tokens.set(token, { key, expiresAt });
      return `memory://signed/${encodeURIComponent(key)}?token=${token}&exp=${expiresAt}`;
    },

    getPublicUrl(key: string): string | null {
      return buildPublicObjectUrl(publicBaseUrl, key);
    },
  };
}

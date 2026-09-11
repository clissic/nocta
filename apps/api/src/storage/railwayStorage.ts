import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  StorageError,
  StorageNotConfiguredError,
  StorageObjectNotFoundError,
} from "./errors.js";
import type { StorageEnv } from "./env.js";
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

function toUint8Array(body: StorageBody): Uint8Array {
  if (typeof body === "string") return Buffer.from(body);
  return body instanceof Buffer ? body : Buffer.from(body);
}

function createClient(env: StorageEnv): S3Client {
  return new S3Client({
    endpoint: env.endpoint,
    region: env.region || "auto",
    credentials: {
      accessKeyId: env.accessKeyId,
      secretAccessKey: env.secretAccessKey,
    },
    // Railway docs: buckets nuevos → virtual-hosted; legacy → path-style.
    forcePathStyle: env.urlStyle === "path",
  });
}

/**
 * Adapter Railway Object Storage (Buckets S3-compatibles).
 * Encapsula el SDK; el resto de la app no debe importar @aws-sdk aquí fuera.
 */
export function createRailwayStorage(env: StorageEnv): ObjectStorage {
  if (
    !env.endpoint ||
    !env.bucket ||
    !env.accessKeyId ||
    !env.secretAccessKey
  ) {
    throw new StorageNotConfiguredError(
      "Faltan credenciales de Railway Object Storage"
    );
  }

  const client = createClient(env);
  const bucket = env.bucket;
  const publicBaseUrl = env.publicBaseUrl;

  return {
    driver: "railway",

    async putObject(input: PutObjectInput): Promise<PutObjectResult> {
      try {
        const result = await client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: input.key,
            Body: toUint8Array(input.body),
            ContentType: input.contentType,
            CacheControl: input.cacheControl,
            Metadata: input.metadata,
          })
        );
        return { key: input.key, etag: result.ETag?.replaceAll('"', "") };
      } catch (err) {
        throw new StorageError(
          "STORAGE_PUT_FAILED",
          `No se pudo subir ${input.key}`,
          { cause: err }
        );
      }
    },

    async deleteObject(key: string): Promise<void> {
      try {
        await client.send(
          new DeleteObjectCommand({ Bucket: bucket, Key: key })
        );
      } catch (err) {
        throw new StorageError(
          "STORAGE_DELETE_FAILED",
          `No se pudo eliminar ${key}`,
          { cause: err }
        );
      }
    },

    async deleteObjects(keys: string[]): Promise<void> {
      const unique = [...new Set(keys.filter(Boolean))];
      if (!unique.length) return;
      // S3 DeleteObjects acepta hasta 1000 keys por request.
      for (let i = 0; i < unique.length; i += 1000) {
        const chunk = unique.slice(i, i + 1000);
        try {
          await client.send(
            new DeleteObjectsCommand({
              Bucket: bucket,
              Delete: {
                Objects: chunk.map((Key) => ({ Key })),
                Quiet: true,
              },
            })
          );
        } catch (err) {
          throw new StorageError(
            "STORAGE_DELETE_MANY_FAILED",
            `No se pudieron eliminar ${chunk.length} objetos`,
            { cause: err }
          );
        }
      }
    },

    async exists(key: string): Promise<boolean> {
      const head = await this.headObject(key);
      return head.exists;
    },

    async listObjects(
      prefix: string,
      opts?: ListObjectsOptions
    ): Promise<ListObjectsResult> {
      try {
        const maxKeys = Math.min(Math.max(opts?.maxKeys ?? 1000, 1), 1000);
        const result = await client.send(
          new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: prefix || undefined,
            MaxKeys: maxKeys,
            ContinuationToken: opts?.continuationToken,
          })
        );
        const keys = (result.Contents ?? [])
          .map((obj) => obj.Key)
          .filter((k): k is string => Boolean(k));
        return {
          keys,
          isTruncated: Boolean(result.IsTruncated),
          nextContinuationToken: result.NextContinuationToken,
        };
      } catch (err) {
        throw new StorageError(
          "STORAGE_LIST_FAILED",
          `No se pudo listar prefix=${prefix || "(root)"}`,
          { cause: err }
        );
      }
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
      try {
        const result = await client.send(
          new HeadObjectCommand({ Bucket: bucket, Key: key })
        );
        return {
          key,
          exists: true,
          contentType: result.ContentType,
          contentLength: result.ContentLength,
          etag: result.ETag?.replaceAll('"', ""),
          lastModified: result.LastModified,
          metadata: result.Metadata,
          cacheControl: result.CacheControl ?? undefined,
        };
      } catch (err) {
        const status =
          err && typeof err === "object" && "$metadata" in err
            ? (err as { $metadata?: { httpStatusCode?: number } }).$metadata
                ?.httpStatusCode
            : undefined;
        const name =
          err && typeof err === "object" && "name" in err
            ? String((err as { name: string }).name)
            : "";
        if (status === 404 || name === "NotFound" || name === "NoSuchKey") {
          return { key, exists: false };
        }
        throw new StorageError(
          "STORAGE_HEAD_FAILED",
          `No se pudo consultar ${key}`,
          { cause: err }
        );
      }
    },

    async getObject(key: string): Promise<GetObjectResult> {
      try {
        const result = await client.send(
          new GetObjectCommand({ Bucket: bucket, Key: key })
        );
        if (!result.Body) throw new StorageObjectNotFoundError(key);
        const bytes = await result.Body.transformToByteArray();
        return {
          key,
          body: Buffer.from(bytes),
          contentType: result.ContentType,
          contentLength: result.ContentLength ?? bytes.byteLength,
          etag: result.ETag?.replaceAll('"', ""),
          metadata: result.Metadata,
        };
      } catch (err) {
        if (err instanceof StorageObjectNotFoundError) throw err;
        const status =
          err && typeof err === "object" && "$metadata" in err
            ? (err as { $metadata?: { httpStatusCode?: number } }).$metadata
                ?.httpStatusCode
            : undefined;
        const name =
          err && typeof err === "object" && "name" in err
            ? String((err as { name: string }).name)
            : "";
        if (status === 404 || name === "NoSuchKey" || name === "NotFound") {
          throw new StorageObjectNotFoundError(key);
        }
        throw new StorageError(
          "STORAGE_GET_FAILED",
          `No se pudo leer ${key}`,
          { cause: err }
        );
      }
    },

    async getSignedReadUrl(
      key: string,
      opts: SignedUrlOptions
    ): Promise<string> {
      try {
        return await getSignedUrl(
          client,
          new GetObjectCommand({ Bucket: bucket, Key: key }),
          { expiresIn: opts.expiresInSeconds }
        );
      } catch (err) {
        throw new StorageError(
          "STORAGE_SIGN_FAILED",
          `No se pudo firmar URL para ${key}`,
          { cause: err }
        );
      }
    },

    getPublicUrl(key: string): string | null {
      return buildPublicObjectUrl(publicBaseUrl, key);
    },
  };
}

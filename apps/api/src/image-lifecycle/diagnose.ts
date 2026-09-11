/**
 * Diagnóstico operable del Image Service (Fase 14).
 * Siempre DRY RUN: informa inconsistencias; NUNCA borra.
 */
import { getStorage, type ObjectStorage } from "../storage/index.js";
import { ImageAsset } from "../models/ImageAsset.js";
import { User } from "../models/User.js";
import {
  getImageTypeConfig,
  isImageType,
} from "../image-service/registry.js";
import {
  imageMetric,
  redactImageId,
  redactStorageKey,
} from "../image-service/observability.js";
import type { ImageType } from "../image-service/types.js";
import { buildImageInventory } from "./inventory.js";

const SAMPLE_CAP = 40;
const LIST_PREFIXES = ["public/", "private/"] as const;

export type DiagnoseOptions = {
  /** Siempre true en la práctica; se fuerza en runImageDiagnose. */
  dryRun?: boolean;
  /** Prefijos a listar en storage (default public/ + private/). */
  listPrefixes?: string[];
  storage?: ObjectStorage;
};

export type DiagnoseFinding = {
  imageId?: string;
  ownerId?: string;
  keyHint?: string;
  issue: string;
};

export type DiagnoseReport = {
  dryRun: true;
  mode: "report_only";
  autoDelete: false;
  driver: string;
  counts: {
    mongoWithoutObject: number;
    objectWithoutMongo: number;
    incompleteVariants: number;
    inconsistentImageType: number;
    deletedAccountObjects: number;
    legacyResidues: number;
  };
  mongoWithoutObject: DiagnoseFinding[];
  objectWithoutMongo: DiagnoseFinding[];
  incompleteVariants: DiagnoseFinding[];
  inconsistentImageType: DiagnoseFinding[];
  deletedAccountObjects: DiagnoseFinding[];
  legacyResidues: {
    orphanUploadFiles: number;
    orphanClaimFiles: number;
    orphanIdentityFiles: number;
    brokenRefs: number;
    legacyPublicRefs: number;
    legacyPrivateRefs: number;
    samples: {
      orphanUploadFiles: string[];
      orphanClaimFiles: string[];
      orphanIdentityFiles: string[];
    };
  };
  note: string;
};

function collectAssetKeys(doc: {
  keys?: string[] | null;
  storageKey?: string | null;
  variants?: {
    thumb?: { webp?: { key?: string }; avif?: { key?: string } };
    medium?: { webp?: { key?: string }; avif?: { key?: string } };
    large?: { webp?: { key?: string }; avif?: { key?: string } };
  } | null;
}): string[] {
  return [
    ...(doc.keys ?? []),
    doc.storageKey,
    doc.variants?.thumb?.webp?.key,
    doc.variants?.thumb?.avif?.key,
    doc.variants?.medium?.webp?.key,
    doc.variants?.medium?.avif?.key,
    doc.variants?.large?.webp?.key,
    doc.variants?.large?.avif?.key,
  ].filter((k): k is string => Boolean(k));
}

async function listAllKeys(
  storage: ObjectStorage,
  prefixes: string[]
): Promise<string[]> {
  const out: string[] = [];
  for (const prefix of prefixes) {
    let token: string | undefined;
    do {
      const page = await storage.listObjects(prefix, {
        maxKeys: 1000,
        continuationToken: token,
      });
      out.push(...page.keys);
      token = page.nextContinuationToken;
    } while (token);
  }
  return out;
}

function incompleteVariantIssues(doc: {
  visibility?: string;
  variants?: {
    thumb?: { webp?: { key?: string }; avif?: { key?: string } };
    medium?: { webp?: { key?: string }; avif?: { key?: string } };
    large?: { webp?: { key?: string }; avif?: { key?: string } };
  } | null;
}): string[] {
  if (doc.visibility !== "public") return [];
  const missing: string[] = [];
  const v = doc.variants;
  const slots = [
    ["thumb.webp", v?.thumb?.webp?.key],
    ["thumb.avif", v?.thumb?.avif?.key],
    ["medium.webp", v?.medium?.webp?.key],
    ["medium.avif", v?.medium?.avif?.key],
    ["large.webp", v?.large?.webp?.key],
    ["large.avif", v?.large?.avif?.key],
  ] as const;
  for (const [label, key] of slots) {
    if (!key) missing.push(label);
  }
  return missing;
}

function imageTypeConsistencyIssues(doc: {
  imageId: string;
  imageType: string;
  visibility: string;
  storageKey?: string | null;
  variants?: unknown;
  entityType?: string;
}): string[] {
  const issues: string[] = [];
  if (!isImageType(doc.imageType)) {
    issues.push(`imageType desconocido: ${doc.imageType}`);
    return issues;
  }
  const cfg = getImageTypeConfig(doc.imageType as ImageType);
  if (doc.visibility !== cfg.visibility) {
    issues.push(
      `visibility=${doc.visibility} esperado=${cfg.visibility}`
    );
  }
  const keys = collectAssetKeys(doc as never);
  for (const key of keys) {
    if (!key.startsWith(cfg.storageNamespace)) {
      issues.push(
        `key fuera de namespace ${cfg.storageNamespace}: ${redactStorageKey(key)}`
      );
      break;
    }
  }
  if (cfg.visibility === "private") {
    if (doc.variants) {
      issues.push("private con variants públicas");
    }
    if (!doc.storageKey) {
      issues.push("private sin storageKey");
    }
  }
  if (cfg.visibility === "public" && doc.storageKey?.startsWith("private/")) {
    issues.push("public con storageKey private/");
  }
  if (
    doc.imageType === "identity_verification" &&
    doc.entityType &&
    doc.entityType !== "identity" &&
    doc.entityType !== "user"
  ) {
    issues.push(`identity con entityType=${doc.entityType}`);
  }
  return issues;
}

/**
 * Corre el diagnóstico completo. Siempre dry-run (sin deletes).
 */
export async function runImageDiagnose(
  opts: DiagnoseOptions = {}
): Promise<DiagnoseReport> {
  const storage = opts.storage ?? getStorage();
  const prefixes = opts.listPrefixes ?? [...LIST_PREFIXES];

  const mongoWithoutObject: DiagnoseFinding[] = [];
  const objectWithoutMongo: DiagnoseFinding[] = [];
  const incompleteVariants: DiagnoseFinding[] = [];
  const inconsistentImageType: DiagnoseFinding[] = [];
  const deletedAccountObjects: DiagnoseFinding[] = [];

  const assets = await ImageAsset.find({}).lean();
  const referencedKeys = new Set<string>();

  const ownerIds = [
    ...new Set(assets.map((a) => a.ownerId).filter(Boolean)),
  ];
  const owners = await User.find({ _id: { $in: ownerIds } })
    .select("_id deletionRequestedAt")
    .lean();
  const ownerMap = new Map(
    owners.map((u) => [
      u._id.toString(),
      {
        exists: true as const,
        pendingDeletion: Boolean(u.deletionRequestedAt),
      },
    ])
  );

  for (const doc of assets) {
    const imageId = doc.imageId;
    const keys = collectAssetKeys(doc);
    for (const key of keys) referencedKeys.add(key);

    for (const key of keys) {
      try {
        const ok = await storage.exists(key);
        if (!ok) {
          mongoWithoutObject.push({
            imageId,
            keyHint: redactStorageKey(key),
            issue: "metadata Mongo sin objeto en storage",
          });
          imageMetric("missing_object", {
            imageType: doc.imageType,
            visibility: doc.visibility as "public" | "private",
            keyHint: redactStorageKey(key),
            imageIdHint: redactImageId(imageId),
          });
        }
      } catch {
        mongoWithoutObject.push({
          imageId,
          keyHint: redactStorageKey(key),
          issue: "error al consultar exists()",
        });
      }
    }

    const missingSlots = incompleteVariantIssues(doc);
    if (missingSlots.length) {
      incompleteVariants.push({
        imageId,
        issue: `variantes incompletas: ${missingSlots.join(",")}`,
      });
    }

    const typeIssues = imageTypeConsistencyIssues({
      imageId: doc.imageId,
      imageType: doc.imageType,
      visibility: doc.visibility,
      storageKey: doc.storageKey,
      variants: doc.variants,
      entityType: doc.entityType,
    });
    for (const issue of typeIssues) {
      inconsistentImageType.push({ imageId, issue });
    }

    const owner = ownerMap.get(doc.ownerId);
    if (!owner) {
      deletedAccountObjects.push({
        imageId,
        ownerId: doc.ownerId,
        issue: "owner ausente (cuenta ya borrada o id huérfano)",
      });
    } else if (owner.pendingDeletion) {
      deletedAccountObjects.push({
        imageId,
        ownerId: doc.ownerId,
        issue: "owner con soft-delete pendiente",
      });
    }
  }

  const storageKeys = await listAllKeys(storage, prefixes);
  for (const key of storageKeys) {
    if (!referencedKeys.has(key)) {
      objectWithoutMongo.push({
        keyHint: redactStorageKey(key),
        issue: "objeto en storage sin metadata ImageAsset",
      });
    }
  }

  const inventory = await buildImageInventory();
  const legacyCount =
    inventory.orphanUploadFiles.length +
    inventory.orphanClaimFiles.length +
    inventory.orphanIdentityFiles.length +
    inventory.brokenRefs;

  const report: DiagnoseReport = {
    dryRun: true,
    mode: "report_only",
    autoDelete: false,
    driver: storage.driver,
    counts: {
      mongoWithoutObject: mongoWithoutObject.length,
      objectWithoutMongo: objectWithoutMongo.length,
      incompleteVariants: incompleteVariants.length,
      inconsistentImageType: inconsistentImageType.length,
      deletedAccountObjects: deletedAccountObjects.length,
      legacyResidues: legacyCount,
    },
    mongoWithoutObject: mongoWithoutObject.slice(0, SAMPLE_CAP),
    objectWithoutMongo: objectWithoutMongo.slice(0, SAMPLE_CAP),
    incompleteVariants: incompleteVariants.slice(0, SAMPLE_CAP),
    inconsistentImageType: inconsistentImageType.slice(0, SAMPLE_CAP),
    deletedAccountObjects: deletedAccountObjects.slice(0, SAMPLE_CAP),
    legacyResidues: {
      orphanUploadFiles: inventory.orphanUploadFiles.length,
      orphanClaimFiles: inventory.orphanClaimFiles.length,
      orphanIdentityFiles: inventory.orphanIdentityFiles.length,
      brokenRefs: inventory.brokenRefs,
      legacyPublicRefs: inventory.legacyPublicRefs,
      legacyPrivateRefs: inventory.legacyPrivateRefs,
      samples: {
        orphanUploadFiles: inventory.orphanUploadFiles.slice(0, 20),
        orphanClaimFiles: inventory.orphanClaimFiles.slice(0, 20),
        orphanIdentityFiles: inventory.orphanIdentityFiles.slice(0, 20),
      },
    },
    note:
      "DRY RUN: no se borró nada. Revisá el reporte y, si corresponde, usá cleanup:images --execute o jobs:images a mano.",
  };

  return report;
}

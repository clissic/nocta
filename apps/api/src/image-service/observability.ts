/**
 * Logs/métricas del Image Service (Fase 14).
 * Nunca loguear: documentos de identidad, URLs privadas/firmadas, tokens,
 * cuerpos de imagen, emails, ni keys private/ completas.
 */

export type ImageMetricEvent =
  | "upload"
  | "processing_error"
  | "sharp_error"
  | "storage_error"
  | "signing"
  | "migration_error"
  | "cleanup_error"
  | "missing_object";

export type ImageMetricFields = {
  imageType?: string;
  visibility?: "public" | "private";
  code?: string;
  op?: string;
  ms?: number;
  mode?: "public" | "signed";
  /** Key ya redactada (usar redactStorageKey). */
  keyHint?: string;
  imageIdHint?: string;
  count?: number;
};

const IDENTITY_OR_PRIVATE =
  /(^|\/)(private\/|identity\/|claims\/|reports\/)/i;

/** Redacta storage keys: conserva namespace + leaf; oculta segmentos de id. */
export function redactStorageKey(key: string | null | undefined): string | undefined {
  if (!key) return undefined;
  const parts = key.replace(/\\/g, "/").split("/").filter(Boolean);
  if (parts.length === 0) return undefined;
  if (IDENTITY_OR_PRIVATE.test(key)) {
    const leaf = parts[parts.length - 1] ?? "obj";
    const root = parts[0] ?? "private";
    const ns = parts[1] ?? "sensitive";
    return `${root}/${ns}/***/${leaf}`;
  }
  if (parts.length <= 2) return key;
  const leaf = parts[parts.length - 1]!;
  return `${parts[0]}/${parts[1]}/***/${leaf}`;
}

/** Solo primeros 8 chars del imageId (no es secreto, reduce correlación). */
export function redactImageId(imageId: string | null | undefined): string | undefined {
  if (!imageId) return undefined;
  return imageId.length <= 8 ? imageId : `${imageId.slice(0, 8)}…`;
}

function safeCode(err: unknown): string {
  if (err && typeof err === "object" && "code" in err) {
    const c = (err as { code?: unknown }).code;
    if (typeof c === "string" && c.length < 80) return c;
  }
  if (err instanceof Error && err.name) return err.name;
  return "UNKNOWN";
}

/**
 * Emite una línea JSON estructurada a stdout.
 * Prefijo estable para grepear en Railway/logs.
 */
export function imageMetric(
  event: ImageMetricEvent,
  fields: ImageMetricFields = {}
): void {
  const payload: Record<string, unknown> = {
    ns: "image-service",
    event,
    t: Date.now(),
  };
  if (fields.imageType) payload.imageType = fields.imageType;
  if (fields.visibility) payload.visibility = fields.visibility;
  if (fields.code) payload.code = fields.code;
  if (fields.op) payload.op = fields.op;
  if (typeof fields.ms === "number") payload.ms = Math.round(fields.ms);
  if (fields.mode) payload.mode = fields.mode;
  if (fields.keyHint) payload.keyHint = fields.keyHint;
  if (fields.imageIdHint) payload.imageIdHint = fields.imageIdHint;
  if (typeof fields.count === "number") payload.count = fields.count;

  // Prefijo estable para grepear en Railway/logs.
  console.log(`[image-metric] ${JSON.stringify(payload)}`);
}

export function imageMetricFromError(
  event: Extract<
    ImageMetricEvent,
    | "processing_error"
    | "sharp_error"
    | "storage_error"
    | "migration_error"
    | "cleanup_error"
    | "missing_object"
  >,
  err: unknown,
  extra: ImageMetricFields = {}
): void {
  imageMetric(event, {
    ...extra,
    code: extra.code ?? safeCode(err),
  });
}

export async function withTiming<T>(
  run: () => Promise<T>
): Promise<{ result: T; ms: number }> {
  const t0 = performance.now();
  const result = await run();
  return { result, ms: performance.now() - t0 };
}

import sharp from "sharp";
import {
  PROCESSING,
  SOCIAL_SOURCE_MIMES,
} from "./processingConstants.js";

export type SourceValidationOk = {
  ok: true;
  mime: string;
  width: number;
  height: number;
  format: string;
  buffer: Buffer;
  heic: boolean;
};

export type SourceValidationErr = {
  ok: false;
  code: string;
  error: string;
};

const MIME_BY_FORMAT: Record<string, string> = {
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  heif: "image/heif",
  heic: "image/heic",
};

function normalizeDeclared(mime: string): string {
  const d = mime.toLowerCase().trim();
  if (d === "image/jpg") return "image/jpeg";
  if (d === "image/heif") return "image/heic";
  return d;
}

/**
 * Valida buffer de imagen (MIME real vía Sharp, tamaño, dims, bombs).
 * No persiste nada.
 */
export async function validateImageSource(opts: {
  buffer: Buffer;
  declaredMime?: string;
  maxBytes: number;
  allowHeic?: boolean;
}): Promise<SourceValidationOk | SourceValidationErr> {
  const { buffer, maxBytes } = opts;
  const allowHeic = opts.allowHeic !== false;
  const declared = opts.declaredMime
    ? normalizeDeclared(opts.declaredMime)
    : undefined;

  if (!buffer?.length) {
    return { ok: false, code: "IMAGE_EMPTY", error: "Archivo vacío" };
  }
  if (buffer.length > maxBytes) {
    return {
      ok: false,
      code: "IMAGE_TOO_LARGE",
      error: `La imagen supera el máximo de ${Math.round(maxBytes / (1024 * 1024))} MB`,
    };
  }
  if (buffer.length > PROCESSING.maxInputBytes) {
    return {
      ok: false,
      code: "IMAGE_BOMB",
      error: "La imagen es demasiado grande para procesar",
    };
  }

  if (
    declared &&
    (declared.includes("svg") ||
      declared === "image/gif" ||
      declared.includes("xml") ||
      declared.includes("javascript") ||
      declared.includes("executable"))
  ) {
    return {
      ok: false,
      code: "IMAGE_FORMAT",
      error: "Formato no permitido",
    };
  }

  let meta: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
  try {
    meta = await sharp(buffer, {
      failOn: "error",
      limitInputPixels: PROCESSING.maxPixels,
    }).metadata();
  } catch {
    return {
      ok: false,
      code: "IMAGE_CORRUPT",
      error: "Archivo de imagen corrupto o no soportado",
    };
  }

  const format = (meta.format ?? "").toLowerCase();
  if (!format || format === "svg" || format === "gif") {
    return {
      ok: false,
      code: "IMAGE_FORMAT",
      error: "Formato no permitido (JPEG, PNG, WebP o AVIF)",
    };
  }

  const heic = format === "heif" || format === "heic";
  if (heic && !allowHeic) {
    return {
      ok: false,
      code: "IMAGE_FORMAT",
      error: "HEIC/HEIF no está habilitado en este entorno",
    };
  }

  const mime = MIME_BY_FORMAT[format] ?? `image/${format}`;
  const allowedSocial = new Set<string>([
    ...SOCIAL_SOURCE_MIMES,
    "image/jpeg",
  ]);
  if (!heic && !allowedSocial.has(mime)) {
    return {
      ok: false,
      code: "IMAGE_FORMAT",
      error: "Formato no permitido (JPEG, PNG, WebP o AVIF)",
    };
  }

  if (declared) {
    const actual = heic ? "image/heic" : mime === "image/jpg" ? "image/jpeg" : mime;
    const declaredComparable =
      declared === "image/heif" ? "image/heic" : declared;
    if (declaredComparable !== actual && !(heic && declaredComparable === "image/heic")) {
      // Permitir image/jpg vs image/jpeg ya normalizado
      if (!(declaredComparable === "image/jpeg" && actual === "image/jpeg")) {
        return {
          ok: false,
          code: "IMAGE_MIME_MISMATCH",
          error: "El tipo de archivo no coincide con el contenido",
        };
      }
    }
  }

  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (width < 1 || height < 1) {
    return {
      ok: false,
      code: "IMAGE_DIMENSIONS",
      error: "Dimensiones de imagen inválidas",
    };
  }
  if (width > PROCESSING.maxWidthPx || height > PROCESSING.maxHeightPx) {
    return {
      ok: false,
      code: "IMAGE_DIMENSIONS",
      error: `Dimensiones máximas ${PROCESSING.maxWidthPx}×${PROCESSING.maxHeightPx}px`,
    };
  }
  if (width * height > PROCESSING.maxPixels) {
    return {
      ok: false,
      code: "IMAGE_BOMB",
      error: "La imagen supera el límite de píxeles permitidos",
    };
  }

  if ((meta.pages ?? 1) > 1 && !heic) {
    return {
      ok: false,
      code: "IMAGE_ANIMATED",
      error: "No se permiten imágenes animadas",
    };
  }

  return {
    ok: true,
    mime: heic ? "image/heic" : mime,
    width,
    height,
    format,
    buffer,
    heic,
  };
}

/** Prueba si Sharp puede decodificar HEIC en este runtime. */
export async function isHeicSupported(): Promise<boolean> {
  try {
    const formats = sharp.format;
    return Boolean(formats.heif?.input?.file || formats.heif?.input?.buffer);
  } catch {
    return false;
  }
}

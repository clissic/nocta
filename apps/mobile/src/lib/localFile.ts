import { File, Paths } from "expo-file-system";
import * as FileSystem from "expo-file-system/legacy";

/**
 * Android a veces entrega la foto sin esquema (`/data/...`) o como `file:/` / `content:/`.
 * `copyAsync` trata eso como un recurso de la app y falla con
 * "No resource found with the name".
 */
export function normalizeLocalUri(uri: string): string {
  const value = uri.trim();
  if (!value) {
    throw new Error("No se pudo leer la foto. Elegila de nuevo.");
  }
  if (/^file:/i.test(value)) {
    const path = value.replace(/^file:\/*/i, "/");
    return `file://${path}`;
  }
  if (/^content:/i.test(value)) {
    const rest = value.replace(/^content:\/*/i, "");
    return `content://${rest}`;
  }
  if (value.startsWith("/")) return `file://${value}`;
  return value;
}

/** Copia content:// (y rutas raras) a un file:// de caché. file:// se deja igual. */
export async function prepareUploadUri(uri: string, ext: string): Promise<string> {
  const normalized = normalizeLocalUri(uri);
  if (normalized.startsWith("file://")) return normalized;
  if (/^https?:\/\//i.test(normalized)) {
    throw new Error("No se pudo leer la foto. Elegila de nuevo.");
  }
  const safeExt = (ext || "jpg").replace(/[^a-z0-9]/gi, "") || "jpg";
  const dest = `${FileSystem.cacheDirectory}nocta-upload-${Date.now()}.${safeExt}`;
  try {
    await FileSystem.copyAsync({ from: normalized, to: dest });
    return dest;
  } catch {
    try {
      const source = new File(normalized);
      const target = new File(Paths.cache, `nocta-upload-${Date.now()}.${safeExt}`);
      await source.copy(target);
      return target.uri;
    } catch {
      throw new Error("No se pudo leer la foto. Elegila de nuevo.");
    }
  }
}

/** Adjunta un archivo local a FormData. En Android copia content:// a caché. */
export async function appendLocalFile(
  form: FormData,
  field: string,
  file: { uri: string; name: string; mimeType: string }
) {
  const ext = file.name.includes(".")
    ? file.name.slice(file.name.lastIndexOf(".") + 1)
    : "jpg";
  const uri = await prepareUploadUri(file.uri, ext);
  form.append(field, {
    uri,
    name: file.name,
    type: file.mimeType,
  } as unknown as Blob);
}

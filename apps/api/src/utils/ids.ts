import mongoose from "mongoose";

export function isObjectId(id: unknown): id is string {
  return typeof id === "string" && mongoose.Types.ObjectId.isValid(id);
}

/** Extrae un id string desde ObjectId, string o doc poblado. */
export function refId(ref: unknown): string {
  if (ref == null) return "";
  if (typeof ref === "string") return ref;
  if (typeof ref === "object" && "_id" in (ref as object)) {
    return String((ref as { _id: unknown })._id);
  }
  return String(ref);
}

export function sortedUserPair(
  a: mongoose.Types.ObjectId | string,
  b: mongoose.Types.ObjectId | string
): [mongoose.Types.ObjectId, mongoose.Types.ObjectId] {
  const aId = new mongoose.Types.ObjectId(a.toString());
  const bId = new mongoose.Types.ObjectId(b.toString());
  return aId.toString() < bId.toString() ? [aId, bId] : [bId, aId];
}

/** Normaliza param de Express (string | string[]) a string. */
export function paramId(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

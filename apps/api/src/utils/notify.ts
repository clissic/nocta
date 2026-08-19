import type { NotificationType } from "@nocta/shared";
import { Notification } from "../models/Notification.js";

export type CreateNotificationInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  href?: string;
  data?: Record<string, unknown>;
  /** Si se setea, no crea otra con la misma clave para ese user. */
  dedupeKey?: string;
};

export async function createNotification(input: CreateNotificationInput) {
  try {
    return await Notification.create({
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      href: input.href,
      data: input.data ?? {},
      dedupeKey: input.dedupeKey,
      readAt: null,
    });
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: number }).code === 11000
    ) {
      return null;
    }
    throw err;
  }
}

export async function notifyMany(
  userIds: string[],
  input: Omit<CreateNotificationInput, "userId" | "dedupeKey"> & {
    dedupeKeyFor?: (userId: string) => string | undefined;
  }
) {
  const unique = [...new Set(userIds.filter(Boolean))];
  await Promise.all(
    unique.map((userId) =>
      createNotification({
        userId,
        type: input.type,
        title: input.title,
        body: input.body,
        href: input.href,
        data: input.data,
        dedupeKey: input.dedupeKeyFor?.(userId),
      })
    )
  );
}

export function serializeNotification(doc: InstanceType<typeof Notification>) {
  const isLike = doc.type === "like_received";
  const rawData = (doc.data ?? {}) as Record<string, unknown>;
  const safeData = isLike
    ? Object.fromEntries(
        Object.entries(rawData).filter(([key]) => key !== "actorId")
      )
    : rawData;
  return {
    id: doc._id.toString(),
    type: doc.type as NotificationType,
    title: isLike ? "Tenés un like nuevo" : doc.title,
    body: isLike
      ? "Alguien te dio like. Abrí Likes para ver más."
      : (doc.body ?? undefined),
    href: doc.href ?? undefined,
    data: safeData,
    readAt: doc.readAt ? doc.readAt.toISOString() : null,
    createdAt: doc.createdAt.toISOString(),
  };
}

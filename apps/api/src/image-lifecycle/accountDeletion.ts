import { Presence } from "../models/Presence.js";
import { User, type UserDocument } from "../models/User.js";
import { deleteUserAccount } from "../utils/deleteUserAccount.js";

/** Período de recuperación alineado a términos §15. */
export const ACCOUNT_DELETION_RECOVERY_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

export function isAccountPendingDeletion(
  user: { deletionRequestedAt?: Date | null },
  now = new Date()
): boolean {
  return Boolean(
    user.deletionRequestedAt &&
      user.deletionRequestedAt.getTime() <= now.getTime()
  );
}

export function accountDeletionPurgeAt(
  deletionRequestedAt: Date
): Date {
  return new Date(
    deletionRequestedAt.getTime() + ACCOUNT_DELETION_RECOVERY_DAYS * DAY_MS
  );
}

/** Filtro Mongo: usuarios visibles en Discover / perfiles públicos. */
export function accountVisibleUserFilter() {
  return {
    $or: [
      { deletionRequestedAt: null },
      { deletionRequestedAt: { $exists: false } },
    ],
  };
}

/**
 * Soft-delete: marca solicitud, invalida sesiones y apaga presencia.
 * No borra imágenes ni datos de producto durante los 30 días.
 */
export async function requestAccountDeletion(
  user: UserDocument
): Promise<UserDocument> {
  if (user.deletionRequestedAt) {
    return user;
  }
  user.deletionRequestedAt = new Date();
  user.authVersion = (user.authVersion ?? 0) + 1;
  await user.save();
  await Presence.updateMany(
    { userId: user._id, status: "active" },
    { $set: { status: "revoked" } }
  );
  return user;
}

/** Reactiva la cuenta dentro del período de recuperación. */
export async function restoreAccount(user: UserDocument): Promise<UserDocument> {
  if (!user.deletionRequestedAt) {
    return user;
  }
  user.deletionRequestedAt = null;
  await user.save();
  return user;
}

/**
 * Eliminación definitiva de cuentas cuyo período de 30 días venció.
 * Incluye purge de imágenes vía deleteUserAccount.
 */
export async function purgeExpiredDeletedAccounts(
  now = new Date()
): Promise<{ scanned: number; purged: number; errors: string[] }> {
  const cutoff = new Date(
    now.getTime() - ACCOUNT_DELETION_RECOVERY_DAYS * DAY_MS
  );
  const users = await User.find({
    deletionRequestedAt: { $ne: null, $lte: cutoff },
  });

  let purged = 0;
  const errors: string[] = [];
  for (const user of users) {
    try {
      await deleteUserAccount(user);
      purged += 1;
      console.log(
        `[purge:deleted-accounts] purged ${user._id.toString()} (${user.email})`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${user._id}: ${message}`);
      console.error(
        `[purge:deleted-accounts] error ${user._id}: ${message}`
      );
    }
  }

  return { scanned: users.length, purged, errors };
}

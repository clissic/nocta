import { deleteUserAccount } from "../../utils/deleteUserAccount.js";
import { User } from "../../models/User.js";
import {
  ACCOUNT_DELETION_RECOVERY_DAYS,
} from "../accountDeletion.js";
import { withItemRetries, type JobContext, type JobRunResult } from "./types.js";

/**
 * Purge definitivo de cuentas cuyo soft-delete superó 30 días.
 * Idempotente: cuentas ya borradas no aparecen en el query.
 */
export async function runPurgeDeletedAccountsJob(
  ctx: JobContext
): Promise<JobRunResult> {
  const cutoff = new Date(
    ctx.now.getTime() - ACCOUNT_DELETION_RECOVERY_DAYS * 24 * 60 * 60 * 1000
  );

  const users = await User.find({
    deletionRequestedAt: { $ne: null, $lte: cutoff },
  });

  ctx.log(
    `elegibles=${users.length} cutoff=${cutoff.toISOString()} dryRun=${ctx.dryRun}`
  );

  if (ctx.dryRun) {
    return {
      status: "success",
      processed: users.length,
      deleted: 0,
      errors: 0,
      pending: users.length,
      errorMessages: [],
      summary: {
        recoveryDays: ACCOUNT_DELETION_RECOVERY_DAYS,
        eligibleUserIds: users.slice(0, 20).map((u) => u._id.toString()),
      },
    };
  }

  let deleted = 0;
  const errorMessages: string[] = [];

  for (const user of users) {
    const id = user._id.toString();
    const result = await withItemRetries(
      `purge-account:${id}`,
      async () => {
        await deleteUserAccount(user);
      },
      { log: ctx.log }
    );
    if (result.ok) {
      deleted += 1;
      ctx.log(`purged ${id} (${user.email})`);
    } else {
      errorMessages.push(`${id}: ${result.error}`);
    }
  }

  const errors = errorMessages.length;
  const status =
    errors === 0 ? "success" : deleted > 0 ? "partial" : "failed";

  return {
    status,
    processed: users.length,
    deleted,
    errors,
    pending: users.length - deleted - errors,
    errorMessages,
    summary: {
      recoveryDays: ACCOUNT_DELETION_RECOVERY_DAYS,
      cutoff: cutoff.toISOString(),
    },
  };
}

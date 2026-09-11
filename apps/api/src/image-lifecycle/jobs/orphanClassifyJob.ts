import { runImageDiagnose } from "../diagnose.js";
import type { JobContext, JobRunResult } from "./types.js";

/**
 * Clasifica huérfanos / inconsistencias vía diagnose (Fase 14).
 * NUNCA borra automáticamente (ni con force): solo reporta.
 * Borrado destructivo sigue siendo `cleanup:images --execute` manual.
 */
export async function runOrphanClassifyJob(
  ctx: JobContext
): Promise<JobRunResult> {
  ctx.log("clasificando huérfanos (solo reporte; sin borrado automático)");

  const report = await runImageDiagnose({ dryRun: true });

  const pending =
    report.counts.mongoWithoutObject +
    report.counts.objectWithoutMongo +
    report.counts.incompleteVariants +
    report.counts.inconsistentImageType +
    report.counts.deletedAccountObjects +
    report.counts.legacyResidues;

  ctx.log(
    `pending mongoWithoutObject=${report.counts.mongoWithoutObject} objectWithoutMongo=${report.counts.objectWithoutMongo} incomplete=${report.counts.incompleteVariants} typeIssues=${report.counts.inconsistentImageType} deletedOwners=${report.counts.deletedAccountObjects} legacy=${report.counts.legacyResidues}`
  );

  return {
    status: "success",
    processed:
      report.counts.mongoWithoutObject +
      report.counts.objectWithoutMongo +
      report.counts.incompleteVariants +
      report.counts.inconsistentImageType +
      report.counts.deletedAccountObjects,
    deleted: 0,
    errors: 0,
    pending,
    errorMessages: [],
    summary: {
      autoDelete: false,
      note: "diagnose dry-run; listObjects enabled",
      counts: report.counts,
      samples: {
        mongoWithoutObject: report.mongoWithoutObject.slice(0, 20),
        objectWithoutMongo: report.objectWithoutMongo.slice(0, 20),
        incompleteVariants: report.incompleteVariants.slice(0, 20),
        inconsistentImageType: report.inconsistentImageType.slice(0, 20),
        deletedAccountObjects: report.deletedAccountObjects.slice(0, 20),
        legacyResidues: report.legacyResidues.samples,
      },
      dryRunForced: true,
      jobDryRun: ctx.dryRun,
    },
  };
}

import { z } from "zod";
import type {
  NormalisedActivity,
  PerformanceRecord,
  ProjectConfigurationInput,
} from "../domain/records";
import { strictIsoDateSchema } from "./fields";
import { importManifestSchema } from "./manifest";

export const BACKUP_FORMAT = "project-controls-dashboard" as const;
export const BACKUP_FORMAT_VERSION = 1 as const;
export const MAX_BACKUP_BYTES = 20 * 1024 * 1024;

const identifier = z
  .string()
  .max(1_000)
  .regex(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/);
const isoDate = strictIsoDateSchema;
const pence = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

const predecessorLinkSchema = z
  .object({
    activityId: identifier,
    type: z.enum(["FS", "SS", "FF", "SF"]),
    lagDays: z.number().int().safe(),
  })
  .strict();

const normalisedActivitySchema = z
  .object({
    projectId: identifier,
    baselineVersion: identifier,
    activityId: identifier,
    wbsId: identifier,
    activityName: z.string().min(3).max(120),
    owner: z.string().min(2).max(80),
    baselineStart: isoDate,
    baselineFinish: isoDate,
    forecastStart: isoDate,
    forecastFinish: isoDate,
    actualStart: isoDate.optional(),
    actualFinish: isoDate.optional(),
    predecessorLinks: z.array(predecessorLinkSchema),
    calendarId: identifier,
    constraintType: z.enum([
      "none",
      "start-no-earlier-than",
      "finish-no-later-than",
      "must-start-on",
      "must-finish-on",
    ]),
    constraintDate: isoDate.optional(),
    isMilestone: z.boolean(),
    baselineBudget: pence,
    progressMethod: z.literal("percent_complete"),
    commentary: z.string().max(500),
  })
  .strict()
  .superRefine((activity, context) => {
    if (activity.baselineStart > activity.baselineFinish) {
      context.addIssue({
        code: "custom",
        path: ["baselineFinish"],
        message: "Baseline finish must be on or after baseline start.",
      });
    }
    if (activity.forecastStart > activity.forecastFinish) {
      context.addIssue({
        code: "custom",
        path: ["forecastFinish"],
        message: "Forecast finish must be on or after forecast start.",
      });
    }
    if (activity.actualFinish !== undefined && activity.actualStart === undefined) {
      context.addIssue({
        code: "custom",
        path: ["actualFinish"],
        message: "Actual finish requires an actual start.",
      });
    }
    if (
      activity.actualStart !== undefined &&
      activity.actualFinish !== undefined &&
      activity.actualStart > activity.actualFinish
    ) {
      context.addIssue({
        code: "custom",
        path: ["actualFinish"],
        message: "Actual finish must be on or after actual start.",
      });
    }
    const hasConstraint = activity.constraintType !== "none";
    if (hasConstraint !== (activity.constraintDate !== undefined)) {
      context.addIssue({
        code: "custom",
        path: ["constraintDate"],
        message: "Constraint type and constraint date must be supplied together.",
      });
    }
    if (
      activity.isMilestone &&
      (activity.baselineStart !== activity.baselineFinish ||
        activity.forecastStart !== activity.forecastFinish)
    ) {
      context.addIssue({
        code: "custom",
        path: ["isMilestone"],
        message: "A milestone must have zero baseline and forecast duration.",
      });
    }
  })
  .transform((value) => value as unknown as NormalisedActivity);

const performanceRecordSchema = z
  .object({
    projectId: identifier,
    baselineVersion: identifier,
    periodEnd: isoDate,
    activityId: identifier,
    pvPeriod: pence,
    evPeriod: pence,
    acPeriod: pence,
    physicalPercentComplete: z.number().min(0).max(100),
    remainingCostForecast: pence.optional(),
    progressCommentary: z.string().max(500),
  })
  .strict()
  .transform((value) => value as PerformanceRecord);

const projectConfigurationSchema = z
  .object({
    source: z.literal("active"),
    projectId: identifier,
    workPackageIds: z.array(identifier).min(1),
    calendarIds: z.array(identifier).min(1),
    authorisedStartActivityIds: z.array(identifier),
    authorisedFinishActivityIds: z.array(identifier),
  })
  .strict()
  .superRefine((configuration, context) => {
    for (const field of [
      "workPackageIds",
      "calendarIds",
      "authorisedStartActivityIds",
      "authorisedFinishActivityIds",
    ] as const) {
      if (new Set(configuration[field]).size === configuration[field].length) {
        continue;
      }
      context.addIssue({
        code: "custom",
        path: [field],
        message: "Registry identifiers must be unique.",
      });
    }
  })
  .transform((value) => value as unknown as ProjectConfigurationInput);

export const backupEnvelopeSchema = z
  .object({
    format: z.literal(BACKUP_FORMAT),
    formatVersion: z.literal(BACKUP_FORMAT_VERSION),
    exportedAt: z.iso.datetime({ offset: true }),
    scope: z.literal("active-generation"),
    dataset: z
      .object({
        activeImportId: z.string().min(1).max(100),
        manifest: importManifestSchema,
        configuration: projectConfigurationSchema,
        activities: z.array(normalisedActivitySchema).min(1).max(10_000),
        performance: z.array(performanceRecordSchema).min(1).max(250_000),
      })
      .strict(),
    applicationRecords: z
      .object({
        risks: z.array(z.never()).max(0),
        changes: z.array(z.never()).max(0),
        reportDrafts: z.array(z.never()).max(0),
      })
      .strict(),
  })
  .strict()
  .superRefine((backup, context) => {
    const { manifest } = backup.dataset;
    if (backup.dataset.activeImportId !== manifest.importId) {
      context.addIssue({
        code: "custom",
        path: ["dataset", "activeImportId"],
        message: "The backup pointer must identify its included manifest.",
      });
    }
    if (backup.dataset.configuration.projectId !== manifest.projectId) {
      context.addIssue({
        code: "custom",
        path: ["dataset", "configuration", "projectId"],
        message: "The backup registry must match the manifest project.",
      });
    }
    if (
      manifest.totals.acceptedRows !==
      backup.dataset.activities.length + backup.dataset.performance.length
    ) {
      context.addIssue({
        code: "custom",
        path: ["dataset"],
        message: "Backup rows must reconcile with manifest accepted counts.",
      });
    }
    if (manifest.files[0].counts.acceptedRows !== backup.dataset.activities.length) {
      context.addIssue({
        code: "custom",
        path: ["dataset", "activities"],
        message: "Schedule rows must reconcile with the schedule manifest count.",
      });
    }
    if (manifest.files[1].counts.acceptedRows !== backup.dataset.performance.length) {
      context.addIssue({
        code: "custom",
        path: ["dataset", "performance"],
        message: "Performance rows must reconcile with the performance manifest count.",
      });
    }
  });

export type BackupEnvelope = z.infer<typeof backupEnvelopeSchema>;

export class BackupValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackupValidationError";
  }
}

export function parseBackupJson(text: string): BackupEnvelope {
  if (new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES) {
    throw new BackupValidationError("Backup exceeds the 20 MB restore limit.");
  }

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new BackupValidationError("Backup is not valid JSON.");
  }
  const parsed = backupEnvelopeSchema.safeParse(value);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    throw new BackupValidationError(
      firstIssue === undefined
        ? "Backup does not match the supported versioned schema."
        : `Backup schema error at ${firstIssue.path.join(".") || "root"}: ${firstIssue.message}`,
    );
  }
  return parsed.data;
}

export const encodeBackupJson = (backup: BackupEnvelope) =>
  JSON.stringify(backupEnvelopeSchema.parse(backup), null, 2) + "\n";

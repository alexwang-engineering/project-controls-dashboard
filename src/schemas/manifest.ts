import { z } from "zod";

export const IMPORT_SCHEMA_VERSION = "1" as const;

const fileCountsSchema = z
  .object({
    sourceRows: z.number().int().nonnegative(),
    acceptedRows: z.number().int().nonnegative(),
    blockedRows: z.number().int().nonnegative(),
    quarantinedRows: z.number().int().nonnegative(),
    warningIssues: z.number().int().nonnegative(),
  })
  .superRefine((counts, context) => {
    if (counts.sourceRows !== counts.acceptedRows + counts.blockedRows) {
      context.addIssue({
        code: "custom",
        message: "Source rows must equal accepted rows plus blocked rows.",
      });
    }
    if (counts.quarantinedRows > counts.blockedRows) {
      context.addIssue({
        code: "custom",
        message: "Quarantined rows must be a subset of blocked rows.",
      });
    }
  });

export type ManifestFileCounts = z.infer<typeof fileCountsSchema>;

const manifestFileSchema = (kind: "schedule" | "performance") => z.object({
  kind: z.literal(kind),
  originalFileName: z.string().min(1).max(255),
  byteSize: z.number().int().nonnegative(),
  checksumSha256: z.string().regex(/^[a-f0-9]{64}$/),
  counts: fileCountsSchema,
});

const quarantinedRecordSchema = z.object({
  fileName: z.string().min(1).max(255),
  recordNumber: z.number().int().min(2),
  reasonCodes: z.array(z.string().min(1)).min(1),
  rationale: z.string().min(1).max(500),
});

const totalsSchema = fileCountsSchema;

const manifestDraftShape = {
  importId: z.string().min(1).max(100),
  schemaVersion: z.literal(IMPORT_SCHEMA_VERSION),
  projectId: z.string().min(1),
  baselineVersion: z.string().min(1),
  dataDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  importedAt: z.iso.datetime({ offset: true }),
  files: z.tuple([
    manifestFileSchema("schedule"),
    manifestFileSchema("performance"),
  ]),
  totals: totalsSchema,
  quarantinedRecords: z.array(quarantinedRecordSchema),
  projectConfigurationConfirmed: z.boolean(),
  duplicateChecksumConfirmed: z.boolean(),
} as const;

const reconcileManifest = (
  manifest: {
    files: readonly { counts: ManifestFileCounts }[];
    totals: ManifestFileCounts;
    quarantinedRecords: readonly { fileName: string; recordNumber: number }[];
  },
  context: z.RefinementCtx,
) => {
  const sum = (field: keyof ManifestFileCounts) =>
    manifest.files.reduce((total, file) => total + file.counts[field], 0);

  for (const field of [
    "sourceRows",
    "acceptedRows",
    "blockedRows",
    "quarantinedRows",
    "warningIssues",
  ] as const) {
    if (manifest.totals[field] === sum(field)) continue;
    context.addIssue({
      code: "custom",
      path: ["totals", field],
      message: "Manifest total does not equal the two file totals.",
    });
  }

  if (manifest.totals.quarantinedRows !== manifest.quarantinedRecords.length) {
    context.addIssue({
      code: "custom",
      path: ["quarantinedRecords"],
      message: "Quarantined record details must reconcile with the total.",
    });
  }
  const uniqueQuarantineKeys = new Set(
    manifest.quarantinedRecords.map(
      (record) => record.fileName + "\u0000" + String(record.recordNumber),
    ),
  );
  if (uniqueQuarantineKeys.size !== manifest.quarantinedRecords.length) {
    context.addIssue({
      code: "custom",
      path: ["quarantinedRecords"],
      message: "Each quarantined source record must appear exactly once.",
    });
  }
};

export const importManifestDraftSchema = z
  .object(manifestDraftShape)
  .superRefine(reconcileManifest);

export const importManifestSchema = z
  .object({
    ...manifestDraftShape,
    previousImportId: z.string().min(1).max(100).optional(),
    duplicateChecksumMatches: z.array(
      z.object({
        checksumSha256: z.string().regex(/^[a-f0-9]{64}$/),
        previousImportId: z.string().min(1).max(100),
      }),
    ),
  })
  .superRefine((manifest, context) => {
    reconcileManifest(manifest, context);
    if (
      manifest.duplicateChecksumMatches.length > 0 &&
      !manifest.duplicateChecksumConfirmed
    ) {
      context.addIssue({
        code: "custom",
        path: ["duplicateChecksumConfirmed"],
        message: "Duplicate checksum matches require recorded confirmation.",
      });
    }
  });

export type ImportManifestDraft = z.infer<typeof importManifestDraftSchema>;
export type ImportManifest = z.infer<typeof importManifestSchema>;
export type QuarantinedRecord = z.infer<typeof quarantinedRecordSchema>;

import type { CsvParseResult } from "./parseCsv";
import type {
  NormalisedActivity,
  PerformanceRecord,
  ProjectConfigurationInput,
  SourcedRecord,
} from "../records";
import { validateCrossFile } from "./crossFile";
import { analyseScheduleGraph } from "./scheduleGraph";
import {
  validatePerformanceCsvRows,
} from "../../schemas/performanceCsv";
import { validateScheduleCsvRows } from "../../schemas/scheduleCsv";
import type { ValidationIssue } from "../../schemas/validationIssue";
import {
  IMPORT_SCHEMA_VERSION,
  importManifestDraftSchema,
  type ImportManifestDraft,
  type ManifestFileCounts,
  type QuarantinedRecord,
} from "../../schemas/manifest";

export type ImportFileKind = "schedule" | "performance";

export interface CandidateCsvFile {
  kind: ImportFileKind;
  fileName: string;
  byteSize: number;
  checksumSha256: string;
  parseResult: CsvParseResult;
}

export interface ImportCandidateInput {
  schedule: CandidateCsvFile;
  performance: CandidateCsvFile;
  configuration: ProjectConfigurationInput;
  quarantinedRecords?: readonly QuarantinedRecord[];
}

export interface ImportFilePreview {
  sourceRows: number;
  acceptedRows: number;
  blockedRows: number;
  quarantinedRows: number;
  warningIssues: number;
}

export interface ImportCandidatePreview {
  activities: readonly SourcedRecord<NormalisedActivity>[];
  performance: readonly SourcedRecord<PerformanceRecord>[];
  issues: readonly ValidationIssue[];
  quarantinedRecords: readonly QuarantinedRecord[];
  scheduleCounts: ImportFilePreview;
  performanceCounts: ImportFilePreview;
  dataDate?: string;
  canCommit: boolean;
}

export interface ManifestMetadata {
  importId: string;
  importedAt: string;
  projectConfigurationConfirmed: boolean;
  duplicateChecksumConfirmed: boolean;
}

const recordKey = (fileName: string, recordNumber: number) =>
  fileName + "\u0000" + String(recordNumber);

const sourceKey = (record: SourcedRecord<unknown>) =>
  recordKey(record.source.fileName, record.source.recordNumber);

const isBlocking = (issue: ValidationIssue) => issue.severity === "blocking";

const activeParseStage = (
  file: CandidateCsvFile,
  quarantineKeys: ReadonlySet<string>,
) => {
  const activeRecords = file.parseResult.records.filter(
    (record) => !quarantineKeys.has(recordKey(file.fileName, record.recordNumber)),
  );
  const activeIssues = file.parseResult.issues.filter(
    (issue) =>
      issue.recordNumber === undefined ||
      !quarantineKeys.has(recordKey(issue.fileName, issue.recordNumber)),
  );
  const blocksWholeFile = activeIssues.some(
    (issue) =>
      isBlocking(issue) &&
      (issue.recordNumber === undefined || issue.recordNumber === 1),
  );
  const blockedRecordNumbers = new Set(
    activeIssues
      .filter(
        (issue) =>
          isBlocking(issue) &&
          issue.recordNumber !== undefined &&
          issue.recordNumber > 1,
      )
      .map((issue) => issue.recordNumber as number),
  );

  return {
    issues: activeIssues,
    records: blocksWholeFile
      ? []
      : activeRecords.filter(
          (record) => !blockedRecordNumbers.has(record.recordNumber),
        ),
  };
};

const blockingSourceKeys = (issues: readonly ValidationIssue[]) =>
  new Set(
    issues
      .filter(
        (issue) => isBlocking(issue) && issue.recordNumber !== undefined,
      )
      .map((issue) => recordKey(issue.fileName, issue.recordNumber as number)),
  );

const countsFor = (
  file: CandidateCsvFile,
  accepted: readonly SourcedRecord<unknown>[],
  issues: readonly ValidationIssue[],
  quarantines: readonly QuarantinedRecord[],
): ImportFilePreview => {
  const acceptedKeys = new Set(accepted.map(sourceKey));
  const quarantinedKeys = new Set(
    quarantines
      .filter((record) => record.fileName === file.fileName)
      .map((record) => recordKey(record.fileName, record.recordNumber)),
  );
  const sourceKeys = file.parseResult.records.map((record) =>
    recordKey(file.fileName, record.recordNumber),
  );

  return {
    sourceRows: sourceKeys.length,
    acceptedRows: sourceKeys.filter((key) => acceptedKeys.has(key)).length,
    blockedRows: sourceKeys.filter((key) => !acceptedKeys.has(key)).length,
    quarantinedRows: quarantinedKeys.size,
    warningIssues: issues.filter(
      (issue) =>
        issue.fileName === file.fileName && issue.severity === "warning",
    ).length,
  };
};

const batchIssue = (
  fileName: string,
  code: string,
  rule: string,
): ValidationIssue => ({
  severity: "blocking",
  code,
  fileName,
  rule,
  suggestion: "Retain at least one valid, unquarantined data record.",
});

const runImportCandidate = (
  input: ImportCandidateInput,
  quarantinedRecords: readonly QuarantinedRecord[],
  decisionIssues: readonly ValidationIssue[] = [],
): ImportCandidatePreview => {
  const quarantineKeys = new Set(
    quarantinedRecords.map((record) =>
      recordKey(record.fileName, record.recordNumber),
    ),
  );
  const scheduleParse = activeParseStage(input.schedule, quarantineKeys);
  const performanceParse = activeParseStage(input.performance, quarantineKeys);
  const scheduleRows = validateScheduleCsvRows(
    input.schedule.fileName,
    input.schedule.parseResult.header,
    scheduleParse.records,
  );
  const performanceRows = validatePerformanceCsvRows(
    input.performance.fileName,
    input.performance.parseResult.header,
    performanceParse.records,
  );

  const crossFile = validateCrossFile({
    activities: scheduleRows.records,
    performance: performanceRows.records,
    configuration: input.configuration,
  });
  const crossFileBlocked = blockingSourceKeys(crossFile.issues);
  const graphInput = scheduleRows.records.filter(
    (record) => !crossFileBlocked.has(sourceKey(record)),
  );
  const graph = analyseScheduleGraph({
    activities: graphInput,
    configuration: input.configuration,
  });
  const activities = graphInput.filter(
    (record) => !graph.blockedActivityIds.has(record.value.activityId),
  );
  const performance = performanceRows.records.filter(
    (record) => !crossFileBlocked.has(sourceKey(record)),
  );

  const issues: ValidationIssue[] = [
    ...decisionIssues,
    ...scheduleParse.issues,
    ...performanceParse.issues,
    ...scheduleRows.issues,
    ...performanceRows.issues,
    ...crossFile.issues,
    ...graph.issues,
  ];
  if (activities.length === 0) {
    issues.push(
      batchIssue(
        input.schedule.fileName,
        "no_accepted_schedule_rows",
        "The candidate contains no accepted schedule records.",
      ),
    );
  }
  if (performance.length === 0) {
    issues.push(
      batchIssue(
        input.performance.fileName,
        "no_accepted_performance_rows",
        "The candidate contains no accepted performance records.",
      ),
    );
  }

  const scheduleCounts = countsFor(
    input.schedule,
    activities,
    issues,
    quarantinedRecords,
  );
  const performanceCounts = countsFor(
    input.performance,
    performance,
    issues,
    quarantinedRecords,
  );

  return {
    activities,
    performance,
    issues,
    quarantinedRecords,
    scheduleCounts,
    performanceCounts,
    dataDate: crossFile.dataDate,
    canCommit: !issues.some(isBlocking),
  };
};

export function orchestrateImportCandidate(
  input: ImportCandidateInput,
): ImportCandidatePreview {
  const requested = input.quarantinedRecords ?? [];
  const sourceKeys = new Set(
    [input.schedule, input.performance].flatMap((file) =>
      file.parseResult.records.map((record) =>
        recordKey(file.fileName, record.recordNumber),
      ),
    ),
  );
  const seen = new Set<string>();
  const acceptedDecisions: QuarantinedRecord[] = [];
  const decisionIssues: ValidationIssue[] = [];

  for (const decision of requested) {
    const key = recordKey(decision.fileName, decision.recordNumber);
    if (!sourceKeys.has(key)) {
      decisionIssues.push({
        severity: "blocking",
        code: "invalid_quarantine_reference",
        fileName: decision.fileName,
        recordNumber: decision.recordNumber,
        rule: "Quarantine decision does not reference a parsed source record.",
        suggestion: "Refresh the preview and select an existing blocked record.",
      });
      continue;
    }
    if (seen.has(key)) {
      decisionIssues.push({
        severity: "blocking",
        code: "duplicate_quarantine_decision",
        fileName: decision.fileName,
        recordNumber: decision.recordNumber,
        rule: "A source record can have only one quarantine decision.",
        suggestion: "Combine the reasons into one explicit decision.",
      });
      continue;
    }
    seen.add(key);

    const current = runImportCandidate(input, acceptedDecisions);
    const matchesCurrentBlock = current.issues.some(
      (issue) =>
        issue.severity === "blocking" &&
        issue.fileName === decision.fileName &&
        issue.recordNumber === decision.recordNumber &&
        decision.reasonCodes.includes(issue.code),
    );
    if (!matchesCurrentBlock) {
      decisionIssues.push({
        severity: "blocking",
        code: "invalid_quarantine_reason",
        fileName: decision.fileName,
        recordNumber: decision.recordNumber,
        suppliedValue: decision.reasonCodes.join(", "),
        rule:
          "Quarantine reason must match a current blocking issue for this record.",
        suggestion: "Refresh the preview and select a displayed blocking reason.",
      });
      continue;
    }
    acceptedDecisions.push(decision);
  }

  return runImportCandidate(input, acceptedDecisions, decisionIssues);
}

const addCounts = (
  schedule: ManifestFileCounts,
  performance: ManifestFileCounts,
): ManifestFileCounts => ({
  sourceRows: schedule.sourceRows + performance.sourceRows,
  acceptedRows: schedule.acceptedRows + performance.acceptedRows,
  blockedRows: schedule.blockedRows + performance.blockedRows,
  quarantinedRows: schedule.quarantinedRows + performance.quarantinedRows,
  warningIssues: schedule.warningIssues + performance.warningIssues,
});

export function createImportManifestDraft(
  input: ImportCandidateInput,
  preview: ImportCandidatePreview,
  metadata: ManifestMetadata,
): ImportManifestDraft {
  if (!preview.canCommit || preview.dataDate === undefined) {
    throw new Error("A manifest can be created only from a committable preview.");
  }
  const baselineVersion = preview.activities[0]?.value.baselineVersion;
  if (baselineVersion === undefined) {
    throw new Error("A manifest requires an accepted schedule baseline.");
  }
  const scheduleCounts = { ...preview.scheduleCounts };
  const performanceCounts = { ...preview.performanceCounts };

  return importManifestDraftSchema.parse({
    importId: metadata.importId,
    schemaVersion: IMPORT_SCHEMA_VERSION,
    projectId: input.configuration.projectId,
    baselineVersion,
    dataDate: preview.dataDate,
    importedAt: metadata.importedAt,
    files: [
      {
        kind: "schedule",
        originalFileName: input.schedule.fileName,
        byteSize: input.schedule.byteSize,
        checksumSha256: input.schedule.checksumSha256,
        counts: scheduleCounts,
      },
      {
        kind: "performance",
        originalFileName: input.performance.fileName,
        byteSize: input.performance.byteSize,
        checksumSha256: input.performance.checksumSha256,
        counts: performanceCounts,
      },
    ],
    totals: addCounts(scheduleCounts, performanceCounts),
    quarantinedRecords: preview.quarantinedRecords,
    projectConfigurationConfirmed: metadata.projectConfigurationConfirmed,
    duplicateChecksumConfirmed: metadata.duplicateChecksumConfirmed,
  });
}

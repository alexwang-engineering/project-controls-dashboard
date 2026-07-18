import type { ActivityId, ProjectConfigurationInput } from "../../domain/records";
import {
  createImportManifestDraft,
  orchestrateImportCandidate,
  type CandidateCsvFile,
  type ImportCandidateInput,
  type ImportCandidatePreview,
  type ImportFileKind,
} from "../../domain/import/orchestrateImport";
import { parseCsvBytes } from "../../domain/import/parseCsv";
import { proposeProjectConfiguration } from "../../domain/import/projectConfiguration";
import type { DatasetRepository } from "../../repositories/datasetRepository";
import type {
  DuplicateChecksumMatch,
  ImportRepository,
} from "../../repositories/importRepository";
import {
  PERFORMANCE_CSV_HEADERS,
  validatePerformanceCsvRows,
} from "../../schemas/performanceCsv";
import {
  SCHEDULE_CSV_HEADERS,
  validateScheduleCsvRows,
} from "../../schemas/scheduleCsv";
import type { ImportManifest } from "../../schemas/manifest";
import type { ValidationIssue } from "../../schemas/validationIssue";
import { encodeCsv } from "../../utils/safeCsvExport";

export interface ImportWorkflowRepositories {
  datasets: DatasetRepository;
  imports: ImportRepository;
}

export interface ImportReview {
  schedule: CandidateCsvFile;
  performance: CandidateCsvFile;
  candidate?: ImportCandidateInput;
  preview?: ImportCandidatePreview;
  issues: readonly ValidationIssue[];
  configuration?: ProjectConfigurationInput;
  configurationRequiresConfirmation: boolean;
  duplicateChecksumMatches: readonly DuplicateChecksumMatch[];
  expectedActiveImportId: string | null;
}

export interface CommitImportOptions {
  configurationConfirmed: boolean;
  duplicateChecksumConfirmed: boolean;
  importId?: string;
  importedAt?: string;
}

const checksumHex = async (buffer: ArrayBuffer) => {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const candidateFile = async (
  file: File,
  kind: ImportFileKind,
): Promise<CandidateCsvFile> => {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const requiredHeaders =
    kind === "schedule" ? SCHEDULE_CSV_HEADERS : PERFORMANCE_CSV_HEADERS;

  return {
    kind,
    fileName: file.name,
    byteSize: bytes.byteLength,
    checksumSha256: await checksumHex(buffer),
    parseResult: parseCsvBytes(bytes, {
      fileName: file.name,
      requiredHeaders,
    }),
  };
};

const proposedBoundaryIds = (
  activities: ReturnType<typeof validateScheduleCsvRows>["records"],
) => {
  const predecessorIds = new Set(
    activities.flatMap((record) =>
      record.value.predecessorLinks.map((link) => link.activityId),
    ),
  );
  const starts = activities
    .filter((record) => record.value.predecessorLinks.length === 0)
    .map((record) => record.value.activityId);
  const finishes = activities
    .filter((record) => !predecessorIds.has(record.value.activityId))
    .map((record) => record.value.activityId);

  return {
    starts: [...new Set(starts)] as ActivityId[],
    finishes: [...new Set(finishes)] as ActivityId[],
  };
};

const noConfigurationIssue = (fileName: string): ValidationIssue => ({
  severity: "blocking",
  code: "project_configuration_unavailable",
  fileName,
  rule: "A project registry could not be proposed from the accepted schedule rows.",
  suggestion: "Correct the blocking schedule fields, then validate both files again.",
});

export async function reviewImportFiles(
  scheduleFile: File,
  performanceFile: File,
  repositories: ImportWorkflowRepositories,
): Promise<ImportReview> {
  const [schedule, performance, activeDataset] = await Promise.all([
    candidateFile(scheduleFile, "schedule"),
    candidateFile(performanceFile, "performance"),
    repositories.datasets.getActiveDataset(),
  ]);
  const scheduleRows = validateScheduleCsvRows(
    schedule.fileName,
    schedule.parseResult.header,
    schedule.parseResult.records,
  );
  const performanceRows = validatePerformanceCsvRows(
    performance.fileName,
    performance.parseResult.header,
    performance.parseResult.records,
  );
  const boundaries = proposedBoundaryIds(scheduleRows.records);
  const configuration =
    activeDataset?.configuration ??
    proposeProjectConfiguration(
      scheduleRows.records,
      boundaries.starts,
      boundaries.finishes,
    );

  if (configuration === undefined) {
    return {
      schedule,
      performance,
      issues: [
        ...schedule.parseResult.issues,
        ...performance.parseResult.issues,
        ...scheduleRows.issues,
        ...performanceRows.issues,
        noConfigurationIssue(schedule.fileName),
      ],
      configurationRequiresConfirmation: activeDataset === undefined,
      duplicateChecksumMatches: [],
      expectedActiveImportId: activeDataset?.importId ?? null,
    };
  }

  const candidate: ImportCandidateInput = {
    schedule,
    performance,
    configuration,
  };
  const preview = orchestrateImportCandidate(candidate);
  const duplicateChecksumMatches = await repositories.imports.findDuplicateChecksums(
    configuration.projectId,
    [schedule.checksumSha256, performance.checksumSha256],
  );

  return {
    schedule,
    performance,
    candidate,
    preview,
    issues: preview.issues,
    configuration,
    configurationRequiresConfirmation: activeDataset === undefined,
    duplicateChecksumMatches,
    expectedActiveImportId: activeDataset?.importId ?? null,
  };
}

const createImportId = (importedAt: string) =>
  "IMPORT-" +
  importedAt.replaceAll(/[-:.TZ]/g, "").slice(0, 14) +
  "-" +
  globalThis.crypto.randomUUID().slice(0, 8).toUpperCase();

export async function commitImportReview(
  review: ImportReview,
  options: CommitImportOptions,
  repository: ImportRepository,
): Promise<ImportManifest> {
  if (
    review.candidate === undefined ||
    review.preview === undefined ||
    !review.preview.canCommit
  ) {
    throw new Error("Only a valid, committable preview can be imported.");
  }
  if (
    review.configurationRequiresConfirmation &&
    !options.configurationConfirmed
  ) {
    throw new Error("Confirm the proposed project registry before importing.");
  }
  if (
    review.duplicateChecksumMatches.length > 0 &&
    !options.duplicateChecksumConfirmed
  ) {
    throw new Error("Confirm the repeated file checksums before importing.");
  }

  const importedAt = options.importedAt ?? new Date().toISOString();
  const importId = options.importId ?? createImportId(importedAt);
  const manifest = createImportManifestDraft(
    review.candidate,
    review.preview,
    {
      importId,
      importedAt,
      projectConfigurationConfirmed: options.configurationConfirmed,
      duplicateChecksumConfirmed: options.duplicateChecksumConfirmed,
    },
  );

  return repository.commitGeneration({
    manifest,
    activities: review.preview.activities,
    performance: review.preview.performance,
    configuration: review.candidate.configuration,
    expectedActiveImportId: review.expectedActiveImportId,
  });
}

export function buildValidationReportCsv(
  issues: readonly ValidationIssue[],
): string {
  return encodeCsv([
    [
      "severity",
      "code",
      "file",
      "record",
      "physical_line",
      "field",
      "supplied_value",
      "rule",
      "suggestion",
    ],
    ...issues.map((issue) => [
      issue.severity,
      issue.code,
      issue.fileName,
      issue.recordNumber === undefined ? "" : String(issue.recordNumber),
      issue.physicalLineStart === undefined
        ? ""
        : String(issue.physicalLineStart),
      issue.column ?? "",
      issue.suppliedValue ?? "",
      issue.rule,
      issue.suggestion,
    ]),
  ]);
}

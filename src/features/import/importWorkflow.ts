import type { ProjectConfigurationInput } from "../../domain/records";
import {
  createImportManifestDraft,
  type CandidateCsvFile,
  type ImportCandidateInput,
  type ImportCandidatePreview,
} from "../../domain/import/orchestrateImport";
import type { DatasetRepository } from "../../repositories/datasetRepository";
import type {
  DuplicateChecksumMatch,
  ImportRepository,
} from "../../repositories/importRepository";
import type {
  ProjectConfigurationRepository,
  ProjectConfigurationUpdatePreview,
} from "../../repositories/projectConfigurationRepository";
import type { ImportManifest } from "../../schemas/manifest";
import type { ValidationIssue } from "../../schemas/validationIssue";
import { encodeCsv } from "../../utils/safeCsvExport";
import {
  executeImportProcessing,
  type ImportRuntimeEvidence,
} from "./importWorkerClient";

export interface ImportWorkflowRepositories {
  datasets: DatasetRepository;
  imports: ImportRepository;
  configurations: ProjectConfigurationRepository;
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
  runtime: ImportRuntimeEvidence;
  configurationUpdate?: ProjectConfigurationUpdatePreview;
}

export interface CommitImportOptions {
  configurationConfirmed: boolean;
  duplicateChecksumConfirmed: boolean;
  importId?: string;
  importedAt?: string;
}

export async function reviewImportFiles(
  scheduleFile: File,
  performanceFile: File,
  repositories: ImportWorkflowRepositories,
): Promise<ImportReview> {
  const [scheduleBytes, performanceBytes, activeDataset] = await Promise.all([
    scheduleFile.arrayBuffer(),
    performanceFile.arrayBuffer(),
    repositories.datasets.getActiveDataset(),
  ]);
  const executed = await executeImportProcessing({
    schedule: {
      kind: "schedule",
      fileName: scheduleFile.name,
      bytes: scheduleBytes,
    },
    performance: {
      kind: "performance",
      fileName: performanceFile.name,
      bytes: performanceBytes,
    },
    activeConfiguration: activeDataset?.configuration,
  });
  const {
    schedule,
    performance,
    candidate,
    preview,
    issues,
    configuration,
    inferredConfiguration,
  } = executed.result;

  if (configuration === undefined) {
    return {
      schedule,
      performance,
      issues,
      configurationRequiresConfirmation: activeDataset === undefined,
      duplicateChecksumMatches: [],
      expectedActiveImportId: activeDataset?.importId ?? null,
      runtime: executed.runtime,
    };
  }

  const duplicateChecksumMatches = await repositories.imports.findDuplicateChecksums(
    configuration.projectId,
    [schedule.checksumSha256, performance.checksumSha256],
  );
  const configurationUpdate =
    activeDataset !== undefined && inferredConfiguration !== undefined
      ? await repositories.configurations.previewAdditiveUpdate(
          inferredConfiguration,
          activeDataset.importId,
        )
      : undefined;

  return {
    schedule,
    performance,
    candidate,
    preview,
    issues,
    configuration,
    configurationRequiresConfirmation: activeDataset === undefined,
    duplicateChecksumMatches,
    expectedActiveImportId: activeDataset?.importId ?? null,
    runtime: executed.runtime,
    configurationUpdate,
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

import type { ActivityId, ProjectConfigurationInput } from "../../domain/records";
import {
  orchestrateImportCandidate,
  type CandidateCsvFile,
  type ImportCandidateInput,
  type ImportCandidatePreview,
  type ImportFileKind,
} from "../../domain/import/orchestrateImport";
import { parseCsvBytes } from "../../domain/import/parseCsv";
import { proposeProjectConfiguration } from "../../domain/import/projectConfiguration";
import {
  PERFORMANCE_CSV_HEADERS,
  validatePerformanceCsvRows,
} from "../../schemas/performanceCsv";
import {
  SCHEDULE_CSV_HEADERS,
  validateScheduleCsvRows,
} from "../../schemas/scheduleCsv";
import type { ValidationIssue } from "../../schemas/validationIssue";

export interface BinaryCsvInput {
  kind: ImportFileKind;
  fileName: string;
  bytes: ArrayBuffer;
}

export interface ImportProcessingInput {
  schedule: BinaryCsvInput;
  performance: BinaryCsvInput;
  activeConfiguration?: ProjectConfigurationInput;
}

export interface ImportProcessingResult {
  schedule: CandidateCsvFile;
  performance: CandidateCsvFile;
  candidate?: ImportCandidateInput;
  preview?: ImportCandidatePreview;
  issues: readonly ValidationIssue[];
  configuration?: ProjectConfigurationInput;
  inferredConfiguration?: ProjectConfigurationInput;
}

const checksumHex = async (buffer: ArrayBuffer) => {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const candidateFile = async (
  input: BinaryCsvInput,
): Promise<CandidateCsvFile> => {
  const requiredHeaders =
    input.kind === "schedule"
      ? SCHEDULE_CSV_HEADERS
      : PERFORMANCE_CSV_HEADERS;
  return {
    kind: input.kind,
    fileName: input.fileName,
    byteSize: input.bytes.byteLength,
    checksumSha256: await checksumHex(input.bytes),
    parseResult: parseCsvBytes(new Uint8Array(input.bytes), {
      fileName: input.fileName,
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

export async function processImportFiles(
  input: ImportProcessingInput,
): Promise<ImportProcessingResult> {
  const [schedule, performance] = await Promise.all([
    candidateFile(input.schedule),
    candidateFile(input.performance),
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
  const inferredConfiguration = proposeProjectConfiguration(
    scheduleRows.records,
    boundaries.starts,
    boundaries.finishes,
  );
  const configuration = input.activeConfiguration ?? inferredConfiguration;

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
    };
  }

  const candidate: ImportCandidateInput = {
    schedule,
    performance,
    configuration,
  };
  const preview = orchestrateImportCandidate(candidate);
  return {
    schedule,
    performance,
    candidate,
    preview,
    issues: preview.issues,
    configuration,
    inferredConfiguration,
  };
}

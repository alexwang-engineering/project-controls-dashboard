import { describe, expect, it } from "vitest";
import type { ActivityId } from "../records";
import type { CsvParseResult } from "./parseCsv";
import {
  projectConfiguration,
  rawRecord,
  sourcedActivity,
  type PerformanceCsvRow,
  type ScheduleCsvRow,
  validPerformanceRow,
  validScheduleRow,
} from "../../test/factories/importRows";
import { PERFORMANCE_CSV_HEADERS } from "../../schemas/performanceCsv";
import { SCHEDULE_CSV_HEADERS } from "../../schemas/scheduleCsv";
import {
  createImportManifestDraft,
  orchestrateImportCandidate,
  type CandidateCsvFile,
  type ImportCandidateInput,
} from "./orchestrateImport";

const candidateFile = <Row extends Record<string, string>>(
  kind: CandidateCsvFile["kind"],
  fileName: string,
  headers: readonly (keyof Row & string)[],
  rows: readonly Row[],
  checksumCharacter: string,
  issues: CsvParseResult["issues"] = [],
): CandidateCsvFile => ({
  kind,
  fileName,
  byteSize: 500 + rows.length,
  checksumSha256: checksumCharacter.repeat(64),
  parseResult: {
    header: [...headers],
    records: rows.map((row, index) => rawRecord(headers, row, index + 2)),
    issues,
    hadBom: false,
  },
});

const candidate = (
  scheduleRows: readonly ScheduleCsvRow[],
  performanceRows: readonly PerformanceCsvRow[],
  quarantinedRecords: ImportCandidateInput["quarantinedRecords"] = [],
): ImportCandidateInput => {
  const normalised = scheduleRows.map((row, index) =>
    sourcedActivity(row, index + 2),
  );
  return {
    schedule: candidateFile(
      "schedule",
      "schedule.csv",
      SCHEDULE_CSV_HEADERS,
      scheduleRows,
      "a",
    ),
    performance: candidateFile(
      "performance",
      "performance.csv",
      PERFORMANCE_CSV_HEADERS,
      performanceRows,
      "b",
    ),
    configuration: projectConfiguration(normalised, {
      authorisedStartActivityIds: ["A-001" as ActivityId],
      authorisedFinishActivityIds: ["A-002" as ActivityId],
    }),
    quarantinedRecords,
  };
};

const validCandidate = () =>
  candidate(
    [
      validScheduleRow({ activity_id: "A-001", predecessor_links: "" }),
      validScheduleRow({
        activity_id: "A-002",
        activity_name: "Complete design review",
        predecessor_links: "A-001|FS|0",
      }),
    ],
    [
      validPerformanceRow({ activity_id: "A-001" }),
      validPerformanceRow({ activity_id: "A-002" }),
    ],
  );

describe("pure import candidate orchestration", () => {
  it("accepts a valid pair and reconciles every source row", () => {
    const input = validCandidate();
    const preview = orchestrateImportCandidate(input);

    expect(preview.canCommit).toBe(true);
    expect(preview.issues.filter((issue) => issue.severity === "blocking")).toEqual(
      [],
    );
    expect(preview.activities).toHaveLength(2);
    expect(preview.performance).toHaveLength(2);
    expect(preview.scheduleCounts).toMatchObject({
      sourceRows: 2,
      acceptedRows: 2,
      blockedRows: 0,
      quarantinedRows: 0,
    });
    expect(preview.performanceCounts).toMatchObject({
      sourceRows: 2,
      acceptedRows: 2,
      blockedRows: 0,
      quarantinedRows: 0,
    });
  });

  it("never sends duplicate-blocked activities into graph validation", () => {
    const input = candidate(
      [
        validScheduleRow({ activity_id: "A-001", predecessor_links: "" }),
        validScheduleRow({
          activity_id: "A-001",
          predecessor_links: "A-001|FS|0",
        }),
      ],
      [validPerformanceRow({ activity_id: "A-001" })],
    );
    const preview = orchestrateImportCandidate(input);

    expect(
      preview.issues.filter((issue) => issue.code === "duplicate_activity_id"),
    ).toHaveLength(2);
    expect(preview.issues.some((issue) => issue.code === "self_link")).toBe(false);
    expect(preview.activities).toEqual([]);
  });

  it("re-runs cross-file validation after explicit quarantine without cascading", () => {
    const scheduleRows = [
      validScheduleRow({ activity_id: "A-001", predecessor_links: "" }),
      validScheduleRow({
        activity_id: "A-002",
        activity_name: "Blocked self-linked activity",
        predecessor_links: "A-002|FS|0",
      }),
    ];
    const performanceRows = [
      validPerformanceRow({ activity_id: "A-001" }),
      validPerformanceRow({ activity_id: "A-002" }),
    ];
    const scheduleDecision = {
      fileName: "schedule.csv",
      recordNumber: 3,
      reasonCodes: ["self_link"],
      rationale: "Exclude the invalid self-linked record.",
    };

    const initial = orchestrateImportCandidate(
      candidate(scheduleRows, performanceRows),
    );
    const afterScheduleDecision = orchestrateImportCandidate(
      candidate(scheduleRows, performanceRows, [scheduleDecision]),
    );

    expect(initial.issues.some((issue) => issue.code === "self_link")).toBe(true);
    expect(afterScheduleDecision.issues).toContainEqual(
      expect.objectContaining({
        code: "unknown_activity_reference",
        fileName: "performance.csv",
        recordNumber: 3,
      }),
    );
    expect(afterScheduleDecision.canCommit).toBe(false);

    const finalInput = candidate(scheduleRows, performanceRows, [
      scheduleDecision,
      {
        fileName: "performance.csv",
        recordNumber: 3,
        reasonCodes: ["unknown_activity_reference"],
        rationale: "Exclude the explicitly orphaned performance record.",
      },
    ]);
    finalInput.configuration = {
      ...finalInput.configuration,
      authorisedFinishActivityIds: ["A-001" as ActivityId],
    };
    const final = orchestrateImportCandidate(finalInput);

    expect(final.canCommit).toBe(true);
    expect(final.activities.map((record) => record.value.activityId)).toEqual([
      "A-001",
    ]);
    expect(final.performance.map((record) => record.value.activityId)).toEqual([
      "A-001",
    ]);
    expect(final.scheduleCounts).toMatchObject({
      sourceRows: 2,
      acceptedRows: 1,
      blockedRows: 1,
      quarantinedRows: 1,
    });
    expect(final.performanceCounts).toMatchObject({
      sourceRows: 2,
      acceptedRows: 1,
      blockedRows: 1,
      quarantinedRows: 1,
    });

    const manifest = createImportManifestDraft(finalInput, final, {
      importId: "IMPORT-001",
      importedAt: "2026-07-18T12:00:00.000Z",
      projectConfigurationConfirmed: true,
      duplicateChecksumConfirmed: false,
    });
    expect(manifest.totals).toMatchObject({
      sourceRows: 4,
      acceptedRows: 2,
      blockedRows: 2,
      quarantinedRows: 2,
    });
    expect(manifest.quarantinedRecords).toHaveLength(2);
  });

  it("rejects a stale quarantine reference as a blocking preview problem", () => {
    const input = validCandidate();
    input.quarantinedRecords = [
      {
        fileName: "schedule.csv",
        recordNumber: 99,
        reasonCodes: ["self_link"],
        rationale: "Stale preview decision.",
      },
    ];
    const preview = orchestrateImportCandidate(input);

    expect(preview.canCommit).toBe(false);
    expect(preview.issues).toContainEqual(
      expect.objectContaining({ code: "invalid_quarantine_reference" }),
    );
  });

  it("refuses to quarantine a valid row under an invented reason", () => {
    const input = validCandidate();
    input.quarantinedRecords = [
      {
        fileName: "schedule.csv",
        recordNumber: 2,
        reasonCodes: ["self_link"],
        rationale: "This row has no such issue.",
      },
    ];
    const preview = orchestrateImportCandidate(input);

    expect(preview.canCommit).toBe(false);
    expect(preview.quarantinedRecords).toEqual([]);
    expect(preview.activities).toHaveLength(2);
    expect(preview.issues).toContainEqual(
      expect.objectContaining({ code: "invalid_quarantine_reason" }),
    );
  });
});

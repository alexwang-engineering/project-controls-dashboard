import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DatasetRepository } from "../../repositories/datasetRepository";
import { ProjectControlsDb } from "../../repositories/db";
import { ImportRepository } from "../../repositories/importRepository";
import { createSyntheticImportFiles } from "./demoImportFiles";
import {
  buildValidationReportCsv,
  commitImportReview,
  reviewImportFiles,
} from "./importWorkflow";

let sequence = 0;

describe("browser import workflow", () => {
  let db: ProjectControlsDb;
  let datasets: DatasetRepository;
  let imports: ImportRepository;

  beforeEach(() => {
    sequence += 1;
    db = new ProjectControlsDb("import-workflow-test-" + String(sequence), {
      indexedDB,
      IDBKeyRange,
    });
    datasets = new DatasetRepository(db);
    imports = new ImportRepository(db);
  });

  afterEach(async () => {
    await db.delete();
  });

  it("reviews and atomically commits the synthetic first-import pair", async () => {
    const files = createSyntheticImportFiles();
    const review = await reviewImportFiles(files.schedule, files.performance, {
      datasets,
      imports,
    });

    expect(review.preview?.canCommit).toBe(true);
    expect(review.preview?.dataDate).toBe("2026-06-14");
    expect(review.preview?.scheduleCounts).toMatchObject({
      sourceRows: 5,
      acceptedRows: 5,
      blockedRows: 0,
    });
    expect(review.preview?.performanceCounts).toMatchObject({
      sourceRows: 5,
      acceptedRows: 5,
      blockedRows: 0,
    });
    expect(review.configuration).toMatchObject({
      source: "proposed",
      projectId: "ASTER",
      authorisedStartActivityIds: ["A-001"],
      authorisedFinishActivityIds: ["A-005"],
    });
    expect(review.configuration?.workPackageIds).toEqual([
      "WP100",
      "WP200",
      "WP300",
      "WP400",
      "WP500",
    ]);

    await expect(
      commitImportReview(
        review,
        {
          configurationConfirmed: false,
          duplicateChecksumConfirmed: false,
          importId: "IMPORT-UI-001",
          importedAt: "2026-07-18T19:00:00.000Z",
        },
        imports,
      ),
    ).rejects.toThrow("Confirm the proposed project registry");
    expect(await datasets.getActiveDataset()).toBeUndefined();

    const manifest = await commitImportReview(
      review,
      {
        configurationConfirmed: true,
        duplicateChecksumConfirmed: false,
        importId: "IMPORT-UI-001",
        importedAt: "2026-07-18T19:00:00.000Z",
      },
      imports,
    );

    expect(manifest.totals).toMatchObject({
      sourceRows: 10,
      acceptedRows: 10,
      blockedRows: 0,
    });
    expect(await datasets.getActiveDataset()).toMatchObject({
      importId: "IMPORT-UI-001",
      activities: expect.arrayContaining([
        expect.objectContaining({ activityId: "A-001" }),
        expect.objectContaining({ activityId: "A-005" }),
      ]),
      configuration: { source: "active" },
    });
  });

  it("blocks malformed performance data without changing the active pointer", async () => {
    const files = createSyntheticImportFiles();
    const invalidPerformance = new File(
      ["wrong_header\r\n=1+1\r\n"],
      "invalid-performance.csv",
      { type: "text/csv" },
    );
    const review = await reviewImportFiles(files.schedule, invalidPerformance, {
      datasets,
      imports,
    });

    expect(review.preview?.canCommit).toBe(false);
    expect(review.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "header_contract" }),
        expect.objectContaining({ severity: "blocking" }),
      ]),
    );
    await expect(
      commitImportReview(
        review,
        {
          configurationConfirmed: true,
          duplicateChecksumConfirmed: false,
        },
        imports,
      ),
    ).rejects.toThrow("Only a valid, committable preview");
    expect(await datasets.getActiveImportId()).toBeUndefined();
  });

  it("requires explicit repeated-checksum confirmation on a later review", async () => {
    const firstFiles = createSyntheticImportFiles();
    const firstReview = await reviewImportFiles(
      firstFiles.schedule,
      firstFiles.performance,
      { datasets, imports },
    );
    await commitImportReview(
      firstReview,
      {
        configurationConfirmed: true,
        duplicateChecksumConfirmed: false,
        importId: "IMPORT-UI-001",
        importedAt: "2026-07-18T19:00:00.000Z",
      },
      imports,
    );

    const repeatedFiles = createSyntheticImportFiles();
    const repeatedReview = await reviewImportFiles(
      repeatedFiles.schedule,
      repeatedFiles.performance,
      { datasets, imports },
    );

    expect(repeatedReview.configurationRequiresConfirmation).toBe(false);
    expect(repeatedReview.configuration?.source).toBe("active");
    expect(repeatedReview.duplicateChecksumMatches).toHaveLength(2);
    await expect(
      commitImportReview(
        repeatedReview,
        {
          configurationConfirmed: false,
          duplicateChecksumConfirmed: false,
          importId: "IMPORT-UI-002",
          importedAt: "2026-07-18T20:00:00.000Z",
        },
        imports,
      ),
    ).rejects.toThrow("Confirm the repeated file checksums");

    await expect(
      commitImportReview(
        repeatedReview,
        {
          configurationConfirmed: false,
          duplicateChecksumConfirmed: true,
          importId: "IMPORT-UI-002",
          importedAt: "2026-07-18T20:00:00.000Z",
        },
        imports,
      ),
    ).resolves.toMatchObject({
      importId: "IMPORT-UI-002",
      duplicateChecksumConfirmed: true,
    });
    expect(await datasets.getActiveImportId()).toBe("IMPORT-UI-002");
  });
});

describe("validation report export", () => {
  it("neutralises hostile values and preserves stable issue codes", () => {
    const report = buildValidationReportCsv([
      {
        severity: "blocking",
        code: "formula_like",
        fileName: "schedule.csv",
        recordNumber: 2,
        column: "activity_id",
        suppliedValue: "=1+1",
        rule: "Identifier resembles a spreadsheet formula.",
        suggestion: "Replace the formula-like input with a literal value.",
      },
    ]);

    expect(report).toContain("blocking,formula_like,schedule.csv,2");
    expect(report).toContain('activity_id,"\'=1+1"');
    expect(report.endsWith("\r\n")).toBe(true);
  });
});

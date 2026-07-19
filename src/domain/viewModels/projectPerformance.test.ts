import { describe, expect, it } from "vitest";
import { createSyntheticImportFiles } from "../../features/import/demoImportFiles";
import { reviewImportFiles } from "../../features/import/importWorkflow";
import { DatasetRepository } from "../../repositories/datasetRepository";
import { ProjectControlsDb } from "../../repositories/db";
import { ImportRepository } from "../../repositories/importRepository";
import { ProjectConfigurationRepository } from "../../repositories/projectConfigurationRepository";
import {
  buildImportedPerformanceSnapshot,
  periodicPerformanceForScope,
} from "./projectPerformance";

describe("imported performance view model", () => {
  it("reconciles the synthetic pair from pence to project and work-package pounds", async () => {
    const db = new ProjectControlsDb("performance-view-model-test");
    const files = createSyntheticImportFiles();
    const pair = await reviewImportFiles(files.schedule, files.performance, {
      datasets: new DatasetRepository(db),
      imports: new ImportRepository(db),
      configurations: new ProjectConfigurationRepository(db),
    });

    expect(pair.preview).toBeDefined();
    const preview = pair.preview!;
    const snapshot = buildImportedPerformanceSnapshot({
      importId: "IMPORT-TEST-001",
      manifest: {
        importId: "IMPORT-TEST-001",
        schemaVersion: "1",
        projectId: pair.configuration!.projectId,
        baselineVersion: preview.activities[0]!.value.baselineVersion,
        dataDate: preview.dataDate!,
        importedAt: "2026-07-19T10:00:00.000Z",
        files: [
          {
            kind: "schedule",
            originalFileName: files.schedule.name,
            byteSize: files.schedule.size,
            checksumSha256: "a".repeat(64),
            counts: preview.scheduleCounts,
          },
          {
            kind: "performance",
            originalFileName: files.performance.name,
            byteSize: files.performance.size,
            checksumSha256: "b".repeat(64),
            counts: preview.performanceCounts,
          },
        ],
        totals: {
          sourceRows: 1020,
          acceptedRows: 1020,
          blockedRows: 0,
          quarantinedRows: 0,
          warningIssues: 0,
        },
        quarantinedRecords: [],
        previousImportId: undefined,
        duplicateChecksumMatches: [],
        projectConfigurationConfirmed: true,
        duplicateChecksumConfirmed: false,
      },
      activities: preview.activities.map((record) => record.value),
      performance: preview.performance.map((record) => record.value),
      configuration: pair.configuration!,
    });

    expect(snapshot.source).toBe("active-import");
    expect(snapshot.project.originalBac).toBe(2_400_000);
    expect(snapshot.project.reportingDate).toBe("2026-06-14");
    expect(snapshot.project.forecastFinish).toBe("2026-08-03");
    expect(snapshot.workPackages).toHaveLength(5);
    expect(snapshot.workPackages[2]).toMatchObject({
      id: "WP300",
      bac: 600_000,
      pv: 400_000,
      ev: 330_000,
      ac: 355_000,
    });
    expect(snapshot.activities).toHaveLength(60);
    expect(snapshot.trend).toHaveLength(16);
    expect(snapshot.trend.at(-1)).toEqual({
      period: "2026-06-14",
      label: "P16",
      pv: 1_500_000,
      ev: 1_350_000,
      ac: 1_440_000,
    });
    const wp300Periods = periodicPerformanceForScope(snapshot, "WP300");
    expect(wp300Periods).toHaveLength(16);
    expect(wp300Periods.reduce((total, period) => total + period.pv, 0)).toBe(
      400_000,
    );
    expect(wp300Periods.reduce((total, period) => total + period.ev, 0)).toBe(
      330_000,
    );
    expect(wp300Periods.reduce((total, period) => total + period.ac, 0)).toBe(
      355_000,
    );
    await db.delete();
  });
});

import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createSyntheticImportFiles } from "../features/import/demoImportFiles";
import {
  commitImportReview,
  reviewImportFiles,
} from "../features/import/importWorkflow";
import {
  BackupValidationError,
  encodeBackupJson,
  parseBackupJson,
} from "../schemas/backup";
import { varianceAnalysisRecordSchema } from "../domain/varianceAnalysis";
import { BackupRepository } from "./backupRepository";
import { DatasetRepository } from "./datasetRepository";
import { ProjectControlsDb } from "./db";
import { ImportRepository } from "./importRepository";
import { ProjectConfigurationRepository } from "./projectConfigurationRepository";

let sequence = 0;

const createDb = (label: string) =>
  new ProjectControlsDb(`backup-${label}-${String(sequence)}`, {
    indexedDB,
    IDBKeyRange,
  });

const commitSynthetic = async (db: ProjectControlsDb) => {
  const datasets = new DatasetRepository(db);
  const imports = new ImportRepository(db);
  const configurations = new ProjectConfigurationRepository(db);
  const files = createSyntheticImportFiles();
  const review = await reviewImportFiles(files.schedule, files.performance, {
    datasets,
    imports,
    configurations,
  });
  return commitImportReview(
    review,
    {
      configurationConfirmed: true,
      duplicateChecksumConfirmed: false,
      importId: "IMPORT-BACKUP-SOURCE",
      importedAt: "2026-07-19T09:00:00.000Z",
    },
    imports,
  );
};

describe("versioned backup and validated restore", () => {
  let sourceDb: ProjectControlsDb;
  let targetDb: ProjectControlsDb;

  beforeEach(() => {
    sequence += 1;
    sourceDb = createDb("source");
    targetDb = createDb("target");
  });

  afterEach(async () => {
    await sourceDb.delete();
    await targetDb.delete();
  });

  it("exports and restores the active generation through the atomic commit path", async () => {
    await commitSynthetic(sourceDb);
    const sourceDatasets = new DatasetRepository(sourceDb);
    const sourceActive = await sourceDatasets.getActiveDataset();
    const sourceBackups = new BackupRepository(sourceDb);
    const envelope = await sourceBackups.createActiveBackup(
      "2026-07-19T10:00:00.000Z",
    );
    const json = encodeBackupJson(envelope);

    expect(parseBackupJson(json)).toEqual(envelope);
    expect(json.endsWith("\n")).toBe(true);
    expect(envelope.dataset.activeImportId).toBe("IMPORT-BACKUP-SOURCE");
    expect(envelope.dataset.activities).toHaveLength(60);
    expect(envelope.dataset.performance).toHaveLength(960);

    const targetBackups = new BackupRepository(targetDb);
    const preview = await targetBackups.previewRestore(json, {
      restoredAt: "2026-07-19T11:00:00.000Z",
      restoreImportId: "RESTORE-001",
    });
    expect(preview.createsProjectRegistry).toBe(true);
    expect(preview.issues.filter((issue) => issue.severity === "blocking")).toEqual([]);
    await targetBackups.restorePreview(preview);

    const targetActive = await new DatasetRepository(targetDb).getActiveDataset();
    expect(targetActive?.importId).toBe("RESTORE-001");
    expect(targetActive?.activities).toEqual(sourceActive?.activities);
    expect(targetActive?.performance).toEqual(sourceActive?.performance);
    expect(targetActive?.configuration).toEqual(sourceActive?.configuration);
    expect(targetActive?.manifest.files).toEqual(sourceActive?.manifest.files);
    expect(targetActive?.manifest.totals).toEqual(sourceActive?.manifest.totals);
    expect((await targetBackups.getLifecycleStatus()).lastRestoreAt).toBe(
      "2026-07-19T11:00:00.000Z",
    );
  });

  it("preserves the active generation when restore fails before pointer flip", async () => {
    await commitSynthetic(sourceDb);
    const backups = new BackupRepository(sourceDb);
    const envelope = await backups.createActiveBackup(
      "2026-07-19T10:00:00.000Z",
    );
    const before = await new DatasetRepository(sourceDb).getActiveDataset();
    const preview = await backups.previewRestore(encodeBackupJson(envelope), {
      restoredAt: "2026-07-19T11:00:00.000Z",
      restoreImportId: "RESTORE-FAIL",
    });
    const failingImports = new ImportRepository(sourceDb, {
      beforePointerFlip: () => {
        throw new Error("injected restore failure");
      },
    });
    const failingBackups = new BackupRepository(sourceDb, failingImports);

    await expect(failingBackups.restorePreview(preview)).rejects.toThrow(
      "injected restore failure",
    );
    expect(await new DatasetRepository(sourceDb).getActiveDataset()).toEqual(before);
    expect(await sourceDb.manifests.get("RESTORE-FAIL")).toBeUndefined();
    expect(
      await sourceDb.activities.where("importId").equals("RESTORE-FAIL").count(),
    ).toBe(0);
  }, 30_000);

  it.each([
    ["unknown activity", "unknown_activity_reference", (value: any) => {
      value.dataset.performance[0].activityId = "A-999";
    }],
    ["schedule cycle", "schedule_cycle", (value: any) => {
      value.dataset.activities[0].predecessorLinks = [
        { activityId: "A-005", type: "FS", lagDays: 0 },
      ];
    }],
  ])("blocks a structurally valid backup with a %s", async (_, code, mutate) => {
    await commitSynthetic(sourceDb);
    const envelope = await new BackupRepository(sourceDb).createActiveBackup(
      "2026-07-19T10:00:00.000Z",
    );
    const hostile = JSON.parse(encodeBackupJson(envelope));
    mutate(hostile);

    await expect(
      new BackupRepository(targetDb).previewRestore(JSON.stringify(hostile), {
        restoredAt: "2026-07-19T11:00:00.000Z",
        restoreImportId: "RESTORE-HOSTILE",
      }),
    ).rejects.toThrow(code);
    expect(await new DatasetRepository(targetDb).getActiveImportId()).toBeUndefined();
  });

  it("rejects malformed and unsupported backup JSON before repository writes", async () => {
    const backups = new BackupRepository(targetDb);
    await expect(
      backups.previewRestore("not json", {
        restoredAt: "2026-07-19T11:00:00.000Z",
      }),
    ).rejects.toBeInstanceOf(BackupValidationError);
    expect(() =>
      parseBackupJson(
        JSON.stringify({
          format: "project-controls-dashboard",
          formatVersion: 99,
        }),
      ),
    ).toThrow("Backup schema error");
    expect(await targetDb.manifests.count()).toBe(0);
  });

  it("rejects an invalid schedule date relationship before repository writes", async () => {
    await commitSynthetic(sourceDb);
    const envelope = await new BackupRepository(sourceDb).createActiveBackup(
      "2026-07-19T10:00:00.000Z",
    );
    const invalid = JSON.parse(encodeBackupJson(envelope));
    invalid.dataset.activities[0].baselineFinish = "2026-01-01";

    await expect(
      new BackupRepository(targetDb).previewRestore(JSON.stringify(invalid), {
        restoredAt: "2026-07-19T11:00:00.000Z",
      }),
    ).rejects.toThrow("Backup schema error");
    expect(await targetDb.manifests.count()).toBe(0);

    invalid.dataset.activities[0].baselineFinish = "2026-02-30";
    await expect(
      new BackupRepository(targetDb).previewRestore(JSON.stringify(invalid), {
        restoredAt: "2026-07-19T11:00:00.000Z",
      }),
    ).rejects.toThrow("Enter a real calendar date");
    expect(await targetDb.manifests.count()).toBe(0);
  });

  it("records backup completion and resets all local data atomically", async () => {
    await commitSynthetic(sourceDb);
    await sourceDb.varianceAnalyses.put(
      varianceAnalysisRecordSchema.parse({
        recordId: "ASTER|B0|project|all|2026-06-14::draft",
        recordType: "draft",
        contextKey: "ASTER|B0|project|all|2026-06-14",
        projectId: "ASTER",
        baselineVersion: "B0",
        scopeType: "project",
        scopeId: "all",
        reportingPeriod: "2026-06-14",
        sourceImportId: "IMPORT-BACKUP-SOURCE",
        managementScenario: "budget-rate",
        breachedMetrics: ["SPI"],
        facts: {
          bacPence: 100_000,
          pvPence: 50_000,
          evPence: 45_000,
          acPence: 47_000,
          svPence: -5_000,
          cvPence: -2_000,
          spi: 0.9,
          cpi: 0.957,
          managementEacPence: 102_000,
          vacPence: -2_000,
          tcpiBac: 1.038,
          tcpiEac: 1,
        },
        factFingerprint: "test-fingerprint",
        details: {
          rootCause: "",
          dependencyImpact: "",
          milestoneImpact: "",
          criticalPathImpact: "",
          costEacEffect: "",
          correctiveAction: "",
          owner: "",
          dueDate: "",
          recoveryEvidence: "",
          expectedRecoveryPeriod: "",
          status: "open",
          author: "",
        },
        createdAt: "2026-07-19T09:30:00.000Z",
        updatedAt: "2026-07-19T09:30:00.000Z",
      }),
    );
    expect(await sourceDb.varianceAnalyses.count()).toBe(1);
    const backups = new BackupRepository(sourceDb);
    await backups.recordBackupCompleted("2026-07-19T10:00:00.000Z");
    expect((await backups.getLifecycleStatus()).lastBackupAt).toBe(
      "2026-07-19T10:00:00.000Z",
    );

    await backups.resetAllLocalData();
    const status = await backups.getLifecycleStatus();
    expect(status).toMatchObject({
      schemaVersion: "5",
      manifestCount: 0,
      activityCount: 0,
      performanceCount: 0,
      varianceAnalysisCount: 0,
      publishedReportCount: 0,
    });
    expect(status.activeImportId).toBeUndefined();
    expect(status.lastBackupAt).toBeUndefined();
  });
});

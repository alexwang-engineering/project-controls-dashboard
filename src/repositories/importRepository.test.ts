import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ActivityId } from "../domain/records";
import {
  projectConfiguration,
  sourcedActivity,
  sourcedPerformance,
} from "../test/factories/importRows";
import {
  IMPORT_SCHEMA_VERSION,
  importManifestDraftSchema,
} from "../schemas/manifest";
import { DatasetRepository } from "./datasetRepository";
import { ProjectControlsDb } from "./db";
import {
  DuplicateChecksumConfirmationRequiredError,
  ImportRepository,
  ProjectConfigurationConfirmationRequiredError,
  ProjectConfigurationMismatchError,
  StaleImportPreviewError,
  type CommitFaultHooks,
  type PreparedImportGeneration,
} from "./importRepository";

let databaseSequence = 0;

interface PreparedOptions {
  importId: string;
  importedAt: string;
  scheduleChecksum: string;
  performanceChecksum: string;
  expectedActiveImportId: string | null;
  configurationSource: "proposed" | "active";
  configurationConfirmed?: boolean;
  duplicateChecksumConfirmed?: boolean;
  activityName?: string;
}

const preparedGeneration = (options: PreparedOptions): PreparedImportGeneration => {
  const activities = [
    sourcedActivity({
      activity_id: "A-001",
      activity_name: options.activityName ?? "Confirm design requirements",
      predecessor_links: "",
    }),
    sourcedActivity(
      {
        activity_id: "A-002",
        activity_name: "Complete design review",
        predecessor_links: "A-001|FS|0",
      },
      3,
    ),
  ];
  const performance = [
    sourcedPerformance({ activity_id: "A-001" }),
    sourcedPerformance({ activity_id: "A-002" }, 3),
  ];
  const configuration = projectConfiguration(activities, {
    source: options.configurationSource,
    authorisedStartActivityIds: ["A-001" as ActivityId],
    authorisedFinishActivityIds: ["A-002" as ActivityId],
  });
  const fileCounts = {
    sourceRows: 2,
    acceptedRows: 2,
    blockedRows: 0,
    quarantinedRows: 0,
    warningIssues: 0,
  };
  const manifest = importManifestDraftSchema.parse({
    importId: options.importId,
    schemaVersion: IMPORT_SCHEMA_VERSION,
    projectId: "ASTER",
    baselineVersion: "B0",
    dataDate: "2026-04-12",
    importedAt: options.importedAt,
    files: [
      {
        kind: "schedule",
        originalFileName: "schedule.csv",
        byteSize: 500,
        checksumSha256: options.scheduleChecksum.repeat(64),
        counts: fileCounts,
      },
      {
        kind: "performance",
        originalFileName: "performance.csv",
        byteSize: 400,
        checksumSha256: options.performanceChecksum.repeat(64),
        counts: fileCounts,
      },
    ],
    totals: {
      sourceRows: 4,
      acceptedRows: 4,
      blockedRows: 0,
      quarantinedRows: 0,
      warningIssues: 0,
    },
    quarantinedRecords: [],
    projectConfigurationConfirmed: options.configurationConfirmed ?? false,
    duplicateChecksumConfirmed: options.duplicateChecksumConfirmed ?? false,
  });

  return {
    manifest,
    activities,
    performance,
    configuration,
    expectedActiveImportId: options.expectedActiveImportId,
  };
};

const firstGeneration = (overrides: Partial<PreparedOptions> = {}) =>
  preparedGeneration({
    importId: "IMPORT-001",
    importedAt: "2026-07-18T12:00:00.000Z",
    scheduleChecksum: "a",
    performanceChecksum: "b",
    expectedActiveImportId: null,
    configurationSource: "proposed",
    configurationConfirmed: true,
    ...overrides,
  });

const laterGeneration = (
  importId: string,
  importedAt: string,
  scheduleChecksum: string,
  performanceChecksum: string,
  expectedActiveImportId: string,
  overrides: Partial<PreparedOptions> = {},
) =>
  preparedGeneration({
    importId,
    importedAt,
    scheduleChecksum,
    performanceChecksum,
    expectedActiveImportId,
    configurationSource: "active",
    ...overrides,
  });

describe("generation and active-pointer repository", () => {
  let db: ProjectControlsDb;
  let repository: ImportRepository;
  let datasets: DatasetRepository;

  beforeEach(() => {
    databaseSequence += 1;
    db = new ProjectControlsDb("project-controls-test-" + String(databaseSequence), {
      indexedDB,
      IDBKeyRange,
    });
    repository = new ImportRepository(db);
    datasets = new DatasetRepository(db);
  });

  afterEach(async () => {
    await db.delete();
  });

  it("commits a complete first generation and flips the pointer last", async () => {
    const prepared = firstGeneration();
    const manifest = await repository.commitGeneration(prepared);
    const active = await datasets.getActiveDataset();

    expect(manifest.previousImportId).toBeUndefined();
    expect(manifest.totals.acceptedRows).toBe(4);
    expect(active).toMatchObject({
      importId: "IMPORT-001",
      activities: expect.arrayContaining([
        expect.objectContaining({ activityId: "A-001" }),
        expect.objectContaining({ activityId: "A-002" }),
      ]),
      performance: expect.arrayContaining([
        expect.objectContaining({ activityId: "A-001" }),
        expect.objectContaining({ activityId: "A-002" }),
      ]),
      configuration: { source: "active" },
    });
    expect(await db.meta.get("schemaVersion")).toMatchObject({ value: "1" });
    expect(await db.manifests.count()).toBe(1);
  });

  it("writes nothing when first-import configuration confirmation is absent", async () => {
    const prepared = firstGeneration({ configurationConfirmed: false });

    await expect(repository.commitGeneration(prepared)).rejects.toBeInstanceOf(
      ProjectConfigurationConfirmationRequiredError,
    );
    expect(await datasets.getActiveImportId()).toBeUndefined();
    expect(await db.projectConfigurations.count()).toBe(0);
    expect(await db.manifests.count()).toBe(0);
    expect(await db.activities.count()).toBe(0);
    expect(await db.performance.count()).toBe(0);
  });

  it("rolls back configuration and rows when the first commit fails", async () => {
    const failingRepository = new ImportRepository(db, {
      afterActivityHalf: () => {
        throw new Error("injected first-import failure");
      },
    });

    await expect(
      failingRepository.commitGeneration(firstGeneration()),
    ).rejects.toThrow("injected first-import failure");
    expect(await db.projectConfigurations.count()).toBe(0);
    expect(await db.manifests.count()).toBe(0);
    expect(await db.activities.count()).toBe(0);
    expect(await db.performance.count()).toBe(0);
    expect(await datasets.getActiveImportId()).toBeUndefined();
  });

  it.each([
    [
      "after half the activity rows",
      {
        afterActivityHalf: () => {
          throw new Error("injected mid-commit failure");
        },
      } satisfies CommitFaultHooks,
      "injected mid-commit failure",
    ],
    [
      "immediately before the pointer flip",
      {
        beforePointerFlip: () => {
          throw new Error("injected pre-pointer failure");
        },
      } satisfies CommitFaultHooks,
      "injected pre-pointer failure",
    ],
  ])("preserves the active dataset on failure %s", async (_, hooks, message) => {
    await repository.commitGeneration(firstGeneration());
    const before = await datasets.getActiveDataset();
    const failingRepository = new ImportRepository(db, hooks);
    const second = laterGeneration(
      "IMPORT-002",
      "2026-07-18T13:00:00.000Z",
      "c",
      "d",
      "IMPORT-001",
      { activityName: "Changed generation two activity" },
    );

    await expect(failingRepository.commitGeneration(second)).rejects.toThrow(
      message,
    );
    expect(await datasets.getActiveDataset()).toEqual(before);
    expect(await db.manifests.get("IMPORT-002")).toBeUndefined();
    expect(
      await db.activities.where("importId").equals("IMPORT-002").count(),
    ).toBe(0);
    expect(
      await db.performance.where("importId").equals("IMPORT-002").count(),
    ).toBe(0);
  });

  it("preserves the active generation on an injected quota failure", async () => {
    await repository.commitGeneration(firstGeneration());
    const before = await datasets.getActiveDataset();
    const quotaRepository = new ImportRepository(db, {
      afterPerformanceHalf: () => {
        throw new DOMException("Synthetic quota exhaustion", "QuotaExceededError");
      },
    });
    const second = laterGeneration(
      "IMPORT-002",
      "2026-07-18T13:00:00.000Z",
      "c",
      "d",
      "IMPORT-001",
    );

    await expect(quotaRepository.commitGeneration(second)).rejects.toMatchObject({
      name: "QuotaExceededError",
    });
    expect(await datasets.getActiveDataset()).toEqual(before);
    expect(await db.manifests.get("IMPORT-002")).toBeUndefined();
  });

  it("contains no await or asynchronous fault-hook contract in the commit body", () => {
    expect(ImportRepository.prototype.commitGeneration.toString()).not.toMatch(
      /\bawait\b/,
    );
    const synchronousHook: CommitFaultHooks = { beforePointerFlip: () => undefined };
    expect(synchronousHook.beforePointerFlip?.()).toBeUndefined();
  });

  it("requires and records confirmation for checksums found anywhere in history", async () => {
    await repository.commitGeneration(firstGeneration());
    const duplicate = laterGeneration(
      "IMPORT-002",
      "2026-07-18T13:00:00.000Z",
      "a",
      "b",
      "IMPORT-001",
    );

    await expect(repository.commitGeneration(duplicate)).rejects.toBeInstanceOf(
      DuplicateChecksumConfirmationRequiredError,
    );
    expect(await datasets.getActiveImportId()).toBe("IMPORT-001");

    const confirmed = laterGeneration(
      "IMPORT-002",
      "2026-07-18T13:00:00.000Z",
      "a",
      "b",
      "IMPORT-001",
      { duplicateChecksumConfirmed: true },
    );
    const manifest = await repository.commitGeneration(confirmed);

    expect(manifest.duplicateChecksumConfirmed).toBe(true);
    expect(manifest.duplicateChecksumMatches).toEqual([
      { checksumSha256: "a".repeat(64), previousImportId: "IMPORT-001" },
      { checksumSha256: "b".repeat(64), previousImportId: "IMPORT-001" },
    ]);
    expect(await datasets.getActiveImportId()).toBe("IMPORT-002");
  });

  it("allows the same filenames when their bytes have different checksums", async () => {
    await repository.commitGeneration(firstGeneration());
    await expect(
      repository.commitGeneration(
        laterGeneration(
          "IMPORT-002",
          "2026-07-18T13:00:00.000Z",
          "c",
          "d",
          "IMPORT-001",
        ),
      ),
    ).resolves.toMatchObject({ importId: "IMPORT-002" });
  });

  it("rejects stale previews and active-registry drift", async () => {
    await repository.commitGeneration(firstGeneration());
    const stale = laterGeneration(
      "IMPORT-002",
      "2026-07-18T13:00:00.000Z",
      "c",
      "d",
      "WRONG-ACTIVE",
    );
    await expect(repository.commitGeneration(stale)).rejects.toBeInstanceOf(
      StaleImportPreviewError,
    );

    const drifted = laterGeneration(
      "IMPORT-002",
      "2026-07-18T13:00:00.000Z",
      "c",
      "d",
      "IMPORT-001",
    );
    drifted.configuration = {
      ...drifted.configuration,
      calendarIds: [],
    };
    await expect(repository.commitGeneration(drifted)).rejects.toBeInstanceOf(
      ProjectConfigurationMismatchError,
    );
    expect(await datasets.getActiveImportId()).toBe("IMPORT-001");
  });

  it("reverts the active pointer to the complete previous generation", async () => {
    await repository.commitGeneration(firstGeneration());
    await repository.commitGeneration(
      laterGeneration(
        "IMPORT-002",
        "2026-07-18T13:00:00.000Z",
        "c",
        "d",
        "IMPORT-001",
        { activityName: "Generation two changed activity" },
      ),
    );
    expect((await datasets.getActiveDataset())?.activities[0]?.activityName).toBe(
      "Generation two changed activity",
    );

    await expect(repository.revertToPreviousImport("IMPORT-002")).resolves.toBe(
      "IMPORT-001",
    );
    expect((await datasets.getActiveDataset())?.activities[0]?.activityName).toBe(
      "Confirm design requirements",
    );
  });

  it("garbage-collects old row generations but preserves manifests and checksums", async () => {
    const generations = [
      firstGeneration(),
      laterGeneration(
        "IMPORT-002",
        "2026-07-18T13:00:00.000Z",
        "c",
        "d",
        "IMPORT-001",
      ),
      laterGeneration(
        "IMPORT-003",
        "2026-07-18T14:00:00.000Z",
        "e",
        "f",
        "IMPORT-002",
      ),
      laterGeneration(
        "IMPORT-004",
        "2026-07-18T15:00:00.000Z",
        "0",
        "1",
        "IMPORT-003",
      ),
    ];
    for (const generation of generations) {
      await repository.commitGeneration(generation);
    }

    const removed = await repository.garbageCollectGenerations(2);

    expect(new Set(removed)).toEqual(new Set(["IMPORT-001", "IMPORT-002"]));
    expect(await db.activities.where("importId").equals("IMPORT-001").count()).toBe(
      0,
    );
    expect(await db.performance.where("importId").equals("IMPORT-002").count()).toBe(
      0,
    );
    expect(await db.activities.where("importId").equals("IMPORT-003").count()).toBe(
      2,
    );
    expect(await db.performance.where("importId").equals("IMPORT-004").count()).toBe(
      2,
    );
    expect(await db.manifests.count()).toBe(4);
    expect(
      await repository.findDuplicateChecksums("ASTER", ["a".repeat(64)]),
    ).toEqual([
      { checksumSha256: "a".repeat(64), previousImportId: "IMPORT-001" },
    ]);
    expect(await datasets.getActiveImportId()).toBe("IMPORT-004");
  });
});

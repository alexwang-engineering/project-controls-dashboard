import Dexie from "dexie";
import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import { afterEach, describe, expect, it } from "vitest";
import type {
  ActivityId,
  CalendarId,
  ProjectId,
  WorkPackageId,
} from "../domain/records";
import { ProjectControlsDb } from "./db";
import { sourcedActivity, sourcedPerformance } from "../test/factories/importRows";

let sequence = 0;
let currentName = "";

describe("project-controls database migrations", () => {
  afterEach(async () => {
    if (currentName === "") return;
    const cleanup = new ProjectControlsDb(currentName, {
      indexedDB,
      IDBKeyRange,
    });
    await cleanup.delete();
  });

  it("upgrades a v1 project registry into revision-one history", async () => {
    sequence += 1;
    currentName = `database-migration-${sequence}`;
    const legacy = new Dexie(currentName, { indexedDB, IDBKeyRange });
    legacy.version(1).stores({
      meta: "&key",
      manifests: "&importId, projectId, importedAt",
      activities: "[importId+activityId], importId, activityId",
      performance:
        "[importId+activityId+periodEnd], importId, [importId+activityId], periodEnd",
      projectConfigurations: "&projectId",
    });
    await legacy.table("projectConfigurations").put({
      projectId: "ASTER",
      configuration: {
        source: "active",
        projectId: "ASTER" as ProjectId,
        workPackageIds: ["WP100" as WorkPackageId],
        calendarIds: ["CAL-5D" as CalendarId],
        authorisedStartActivityIds: ["A-001" as ActivityId],
        authorisedFinishActivityIds: ["A-005" as ActivityId],
      },
      createdImportId: "IMPORT-001",
      updatedAt: "2026-07-18T19:00:00.000Z",
    });
    legacy.close();

    const upgraded = new ProjectControlsDb(currentName, {
      indexedDB,
      IDBKeyRange,
    });
    expect(await upgraded.projectConfigurations.get("ASTER")).toMatchObject({
      revision: 1,
    });
    expect(
      await upgraded.projectConfigurationHistory.get(["ASTER", 1]),
    ).toMatchObject({
      activeImportId: "IMPORT-001",
      reason: "created",
    });
    expect(await upgraded.meta.get("schemaVersion")).toMatchObject({ value: "5" });
    expect(await upgraded.varianceAnalyses.count()).toBe(0);
    expect(await upgraded.baselineSnapshots.count()).toBe(0);
    expect(await upgraded.reportPublications.count()).toBe(0);
    upgraded.close();
  });

  it("backfills retained generation evidence when upgrading a v3 database", async () => {
    sequence += 1;
    currentName = `database-migration-${sequence}`;
    const legacy = new Dexie(currentName, { indexedDB, IDBKeyRange });
    legacy.version(3).stores({
      meta: "&key",
      manifests: "&importId, projectId, importedAt",
      activities: "[importId+activityId], importId, activityId",
      performance:
        "[importId+activityId+periodEnd], importId, [importId+activityId], periodEnd",
      projectConfigurations: "&projectId",
      projectConfigurationHistory:
        "[projectId+revision], projectId, recordedAt",
      varianceAnalyses:
        "&recordId, contextKey, [contextKey+recordType], projectId, sourceImportId, signedAt",
    });
    await legacy.table("manifests").put({
      importId: "IMPORT-V3",
      schemaVersion: "1",
      projectId: "ASTER",
      baselineVersion: "B0",
      dataDate: "2026-04-12",
      importedAt: "2026-07-18T19:00:00.000Z",
      files: [],
      totals: {
        sourceRows: 2,
        acceptedRows: 2,
        blockedRows: 0,
        quarantinedRows: 0,
        warningIssues: 0,
      },
      quarantinedRecords: [],
      projectConfigurationConfirmed: true,
      duplicateChecksumConfirmed: false,
      duplicateChecksumMatches: [],
    });
    await legacy.table("activities").put({
      ...sourcedActivity().value,
      importId: "IMPORT-V3",
    });
    await legacy.table("performance").put({
      ...sourcedPerformance().value,
      importId: "IMPORT-V3",
    });
    legacy.close();

    const upgraded = new ProjectControlsDb(currentName, {
      indexedDB,
      IDBKeyRange,
    });
    expect(await upgraded.baselineSnapshots.get("IMPORT-V3")).toMatchObject({
      projectId: "ASTER",
      baselineVersion: "B0",
      bacPence: 10_000_000,
      periods: [
        expect.objectContaining({
          periodEnd: "2026-04-12",
          pvPence: 2_500_000,
        }),
      ],
    });
    expect(await upgraded.meta.get("schemaVersion")).toMatchObject({ value: "5" });
    expect(await upgraded.reportPublications.count()).toBe(0);
    upgraded.close();
  });
});

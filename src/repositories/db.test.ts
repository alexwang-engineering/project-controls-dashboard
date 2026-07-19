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
    expect(await upgraded.meta.get("schemaVersion")).toMatchObject({ value: "3" });
    expect(await upgraded.varianceAnalyses.count()).toBe(0);
    upgraded.close();
  });
});

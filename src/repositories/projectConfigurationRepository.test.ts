import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type {
  ActivityId,
  CalendarId,
  ProjectConfigurationInput,
  ProjectId,
  WorkPackageId,
} from "../domain/records";
import { ProjectControlsDb } from "./db";
import { StaleImportPreviewError } from "./importRepository";
import { ProjectConfigurationRepository } from "./projectConfigurationRepository";

let sequence = 0;

const activeConfiguration: ProjectConfigurationInput = {
  source: "active",
  projectId: "ASTER" as ProjectId,
  workPackageIds: ["WP100" as WorkPackageId],
  calendarIds: ["CAL-5D" as CalendarId],
  authorisedStartActivityIds: ["A-001" as ActivityId],
  authorisedFinishActivityIds: ["A-005" as ActivityId],
};

const inferredConfiguration: ProjectConfigurationInput = {
  source: "proposed",
  projectId: "ASTER" as ProjectId,
  workPackageIds: ["WP100", "WP600"] as WorkPackageId[],
  calendarIds: ["CAL-5D", "CAL-7D"] as CalendarId[],
  authorisedStartActivityIds: ["A-001" as ActivityId],
  authorisedFinishActivityIds: ["A-060" as ActivityId],
};

describe("versioned project-configuration updates", () => {
  let db: ProjectControlsDb;
  let repository: ProjectConfigurationRepository;

  beforeEach(async () => {
    sequence += 1;
    db = new ProjectControlsDb(`configuration-update-${sequence}`, {
      indexedDB,
      IDBKeyRange,
    });
    repository = new ProjectConfigurationRepository(db);
    await db.meta.put({ key: "activeImportId", value: "IMPORT-001" });
    await db.projectConfigurations.put({
      projectId: "ASTER",
      configuration: activeConfiguration,
      createdImportId: "IMPORT-001",
      updatedAt: "2026-07-18T19:00:00.000Z",
      revision: 1,
    });
  });

  afterEach(async () => {
    await db.delete();
  });

  it("adds identifiers as a new revision while preserving the active pointer", async () => {
    const preview = await repository.previewAdditiveUpdate(
      inferredConfiguration,
      "IMPORT-001",
    );
    expect(preview?.additions).toEqual({
      workPackageIds: ["WP600"],
      calendarIds: ["CAL-7D"],
      authorisedStartActivityIds: [],
      authorisedFinishActivityIds: ["A-060"],
    });

    const updated = await repository.commitAdditiveUpdate(preview!, {
      confirmed: true,
      updatedAt: "2026-07-18T19:30:00.000Z",
    });

    expect(updated).toMatchObject({ revision: 2 });
    expect(updated.configuration.workPackageIds).toEqual(["WP100", "WP600"]);
    expect(await db.meta.get("activeImportId")).toMatchObject({
      value: "IMPORT-001",
    });
    expect(await db.projectConfigurationHistory.get(["ASTER", 2])).toMatchObject({
      reason: "additive-update",
      activeImportId: "IMPORT-001",
    });
  });

  it("rejects removals and stale active-generation previews", async () => {
    const preview = (await repository.previewAdditiveUpdate(
      inferredConfiguration,
      "IMPORT-001",
    ))!;
    const removal = {
      ...preview,
      proposedConfiguration: {
        ...preview.proposedConfiguration,
        workPackageIds: ["WP600" as WorkPackageId],
      },
    };
    await expect(
      repository.commitAdditiveUpdate(removal, {
        confirmed: true,
        updatedAt: "2026-07-18T19:30:00.000Z",
      }),
    ).rejects.toThrow("cannot remove identifiers");
    expect((await db.projectConfigurations.get("ASTER"))?.revision).toBe(1);

    await db.meta.put({ key: "activeImportId", value: "IMPORT-OTHER" });
    await expect(
      repository.commitAdditiveUpdate(preview, {
        confirmed: true,
        updatedAt: "2026-07-18T19:30:00.000Z",
      }),
    ).rejects.toBeInstanceOf(StaleImportPreviewError);
  });
});

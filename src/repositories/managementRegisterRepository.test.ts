import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Risk } from "../domain/types";
import { ManagementRegisterRepository } from "./managementRegisterRepository";
import { ProjectControlsDb } from "./db";

let sequence = 0;

const controlledRisk: Risk = {
  id: "R-001",
  title: "Supplier delivery delay",
  owner: "Supply lead",
  wbsId: "WP200",
  category: "Delivery",
  residualProbability: 3,
  residualImpact: 4,
  residualScore: 12,
  rating: "high",
  treatment: "Expedite the order and review dated dispatch evidence.",
  treatmentDue: "2026-07-28",
  triggerStatus: "watch",
  controlEffectiveness: "partly-effective",
};

describe("revisioned management-register storage", () => {
  let db: ProjectControlsDb;
  let repository: ManagementRegisterRepository;

  beforeEach(() => {
    sequence += 1;
    db = new ProjectControlsDb(`register-history-${String(sequence)}`, {
      indexedDB,
      IDBKeyRange,
    });
    repository = new ManagementRegisterRepository(db);
  });

  afterEach(async () => {
    await db.delete();
  });

  it("appends immutable snapshots and flips the current head last", async () => {
    const revisionOne = await repository.commitSnapshot(
      "ASTER",
      { milestones: [], risks: [], changes: [] },
      {
        expectedRevision: 0,
        recordedAt: "2026-07-21T13:00:00.000Z",
        reason: "created",
      },
    );
    const revisionTwo = await repository.commitSnapshot(
      "ASTER",
      { milestones: [], risks: [controlledRisk], changes: [] },
      {
        expectedRevision: 1,
        recordedAt: "2026-07-21T13:05:00.000Z",
        reason: "user-update",
      },
    );

    expect(revisionOne.revision).toBe(1);
    expect(revisionOne.snapshot.risks).toEqual([]);
    expect(revisionTwo.revision).toBe(2);
    expect((await repository.loadCurrent("ASTER"))?.snapshot.risks).toEqual([
      controlledRisk,
    ]);
    expect((await repository.loadHistory("ASTER")).map(({ revision }) => revision)).toEqual([
      2, 1,
    ]);
  });

  it("does not create a duplicate revision for an identical snapshot", async () => {
    const first = await repository.commitSnapshot(
      "ASTER",
      { milestones: [], risks: [controlledRisk], changes: [] },
      {
        expectedRevision: 0,
        recordedAt: "2026-07-21T13:00:00.000Z",
        reason: "created",
      },
    );
    const duplicate = await repository.commitSnapshot(
      "ASTER",
      { milestones: [], risks: [controlledRisk], changes: [] },
      {
        expectedRevision: 1,
        recordedAt: "2026-07-21T13:05:00.000Z",
        reason: "user-update",
      },
    );

    expect(duplicate).toEqual(first);
    expect(await db.managementRegisterRevisions.count()).toBe(1);
  });

  it("rejects a stale writer without changing the active head", async () => {
    await repository.commitSnapshot(
      "ASTER",
      { milestones: [], risks: [], changes: [] },
      {
        expectedRevision: 0,
        recordedAt: "2026-07-21T13:00:00.000Z",
        reason: "created",
      },
    );

    await expect(
      repository.commitSnapshot(
        "ASTER",
        { milestones: [], risks: [controlledRisk], changes: [] },
        {
          expectedRevision: 0,
          recordedAt: "2026-07-21T13:05:00.000Z",
          reason: "user-update",
        },
      ),
    ).rejects.toThrow("changed in another app window");
    expect(await db.managementRegisterHeads.get("ASTER")).toMatchObject({
      revision: 1,
    });
  });
});

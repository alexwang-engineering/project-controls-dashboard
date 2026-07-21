import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { defaultRiskAppetite } from "../domain/riskAppetite";
import { ProjectControlsDb } from "./db";
import {
  RiskAppetiteRepository,
  StaleRiskAppetiteRevisionError,
} from "./riskAppetiteRepository";

let sequence = 0;

describe("authorised risk-appetite history", () => {
  let db: ProjectControlsDb;
  let repository: RiskAppetiteRepository;

  beforeEach(() => {
    sequence += 1;
    db = new ProjectControlsDb(`risk-appetite-${String(sequence)}`, {
      indexedDB,
      IDBKeyRange,
    });
    repository = new RiskAppetiteRepository(db);
  });

  afterEach(async () => {
    await db.delete();
  });

  it("requires confirmation and complete authority evidence", async () => {
    await expect(
      repository.commitRevision({
        projectId: "ASTER",
        expectedRevision: 0,
        thresholds: defaultRiskAppetite,
        changeReason: "Use the approved project tolerance matrix.",
        authorisedBy: "Project director",
        effectiveFrom: "2026-07-21",
        recordedAt: "2026-07-21T13:00:00.000Z",
        confirmed: false,
      }),
    ).rejects.toThrow("Confirm the authorised appetite change");
    expect(await db.riskAppetiteRevisions.count()).toBe(0);
  });

  it("retains every authorised revision and rejects stale forms", async () => {
    const first = await repository.commitRevision({
      projectId: "ASTER",
      expectedRevision: 0,
      thresholds: defaultRiskAppetite,
      changeReason: "Use the approved project tolerance matrix.",
      authorisedBy: "Project director",
      effectiveFrom: "2026-07-21",
      recordedAt: "2026-07-21T13:00:00.000Z",
      confirmed: true,
    });
    const second = await repository.commitRevision({
      projectId: "ASTER",
      expectedRevision: 1,
      thresholds: { ...defaultRiskAppetite, schedule: 6 },
      changeReason: "Tighten schedule tolerance during commissioning.",
      authorisedBy: "Programme sponsor",
      effectiveFrom: "2026-08-01",
      recordedAt: "2026-07-21T14:00:00.000Z",
      confirmed: true,
    });

    expect(first.revision).toBe(1);
    expect(second).toMatchObject({ revision: 2, thresholds: { schedule: 6 } });
    expect((await repository.loadHistory("ASTER")).map(({ revision }) => revision)).toEqual([
      2, 1,
    ]);
    await expect(
      repository.commitRevision({
        projectId: "ASTER",
        expectedRevision: 1,
        thresholds: defaultRiskAppetite,
        changeReason: "Attempt to save an outdated tolerance decision.",
        authorisedBy: "Project director",
        effectiveFrom: "2026-08-02",
        recordedAt: "2026-07-21T15:00:00.000Z",
        confirmed: true,
      }),
    ).rejects.toBeInstanceOf(StaleRiskAppetiteRevisionError);
  });
});

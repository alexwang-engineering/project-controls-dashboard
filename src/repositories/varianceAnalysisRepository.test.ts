import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { calculateEarnedValue } from "../domain/calculations/earnedValue";
import {
  createVarianceAnalysisContext,
  emptyVarianceAnalysisDetails,
  type VarianceAnalysisDetails,
} from "../domain/varianceAnalysis";
import { ProjectControlsDb } from "./db";
import {
  StaleVarianceAnalysisError,
  VarianceAnalysisRepository,
} from "./varianceAnalysisRepository";

let sequence = 0;
let db: ProjectControlsDb;
let repository: VarianceAnalysisRepository;

const details: VarianceAnalysisDetails = {
  rootCause: "Late control-panel release constrained installation.",
  dependencyImpact: "Mechanical completion and test entry are delayed.",
  milestoneImpact: "Site acceptance is forecast seven days late.",
  criticalPathImpact: "Source schedule does not identify critical path.",
  costEacEffect: "CPI continuation indicates a £160,000 overrun.",
  correctiveAction: "Add a second wiring team and resequence dry testing.",
  owner: "Controls Manager",
  dueDate: "2026-06-21",
  recoveryEvidence: "Weekly completed-panel count reaches four units.",
  expectedRecoveryPeriod: "2026-06-28",
  status: "open",
  author: "Project Controls Engineer",
};

const context = () =>
  createVarianceAnalysisContext({
    projectId: "ASTER",
    baselineVersion: "B0",
    scopeId: "all",
    reportingPeriod: "2026-06-14",
    sourceImportId: "IMPORT-001",
    expectedActiveImportId: "IMPORT-001",
    managementScenario: "cpi",
    metrics: calculateEarnedValue({
      bac: 2_400_000,
      pv: 1_500_000,
      ev: 1_350_000,
      ac: 1_440_000,
      managementEac: 2_560_000,
    }),
  });

describe("variance analysis repository", () => {
  beforeEach(async () => {
    sequence += 1;
    db = new ProjectControlsDb(`variance-analysis-${String(sequence)}`, {
      indexedDB,
      IDBKeyRange,
    });
    repository = new VarianceAnalysisRepository(db);
    await db.meta.put({ key: "activeImportId", value: "IMPORT-001" });
  });

  afterEach(async () => {
    await db.delete();
  });

  it("persists one editable draft for the current source generation", async () => {
    await repository.saveDraft({
      context: context(),
      details: { ...emptyVarianceAnalysisDetails, rootCause: "Known cause" },
      savedAt: "2026-07-19T13:00:00.000Z",
    });

    const reloaded = await new VarianceAnalysisRepository(db).loadContext(
      context().contextKey,
      "IMPORT-001",
    );
    expect(reloaded.currentDraft?.details.rootCause).toBe("Known cause");
    expect(reloaded.signedRevisions).toEqual([]);
  });

  it("rejects incomplete sign-off without changing the stored draft", async () => {
    await repository.saveDraft({
      context: context(),
      details: emptyVarianceAnalysisDetails,
      savedAt: "2026-07-19T13:00:00.000Z",
    });

    await expect(
      repository.signOff({
        context: context(),
        details: emptyVarianceAnalysisDetails,
        signedAt: "2026-07-19T13:05:00.000Z",
      }),
    ).rejects.toThrow("Variance analysis is incomplete");
    expect((await db.varianceAnalyses.toArray())).toHaveLength(1);
  });

  it("freezes signed revisions and preserves the earlier revision", async () => {
    await repository.saveDraft({
      context: context(),
      details,
      savedAt: "2026-07-19T13:00:00.000Z",
    });
    const revisionOne = await repository.signOff({
      context: context(),
      details,
      signedAt: "2026-07-19T13:05:00.000Z",
    });

    const revisedDetails = {
      ...details,
      correctiveAction: "Deploy two wiring teams and add daily completion checks.",
      status: "monitoring" as const,
    };
    await repository.saveDraft({
      context: context(),
      details: revisedDetails,
      savedAt: "2026-07-20T09:00:00.000Z",
    });
    const revisionTwo = await repository.signOff({
      context: context(),
      details: revisedDetails,
      signedAt: "2026-07-20T09:05:00.000Z",
    });

    expect(revisionOne.revision).toBe(1);
    expect(revisionOne.createdAt).toBe("2026-07-19T13:00:00.000Z");
    expect(revisionTwo.revision).toBe(2);
    const reloaded = await repository.loadContext(
      context().contextKey,
      "IMPORT-001",
    );
    expect(reloaded.signedRevisions.map(({ revision }) => revision)).toEqual([
      2, 1,
    ]);
    expect(reloaded.signedRevisions[1]?.details.correctiveAction).toBe(
      details.correctiveAction,
    );
    expect(reloaded.currentDraft).toBeUndefined();
  });

  it("rejects a stale active-generation pointer before writing", async () => {
    await db.meta.put({ key: "activeImportId", value: "IMPORT-002" });

    await expect(
      repository.saveDraft({
        context: context(),
        details,
        savedAt: "2026-07-19T13:00:00.000Z",
      }),
    ).rejects.toBeInstanceOf(StaleVarianceAnalysisError);
    expect(await db.varianceAnalyses.count()).toBe(0);
  });

  it("preserves the draft when the active generation changes before sign-off", async () => {
    await repository.saveDraft({
      context: context(),
      details,
      savedAt: "2026-07-19T13:00:00.000Z",
    });
    await db.meta.put({ key: "activeImportId", value: "IMPORT-002" });

    await expect(
      repository.signOff({
        context: context(),
        details,
        signedAt: "2026-07-19T13:05:00.000Z",
      }),
    ).rejects.toBeInstanceOf(StaleVarianceAnalysisError);
    expect(await db.varianceAnalyses.count()).toBe(1);
    expect((await db.varianceAnalyses.toArray())[0]?.recordType).toBe("draft");
  });

  it("loads only signed analyses for the requested report baseline and period", async () => {
    await repository.saveDraft({
      context: context(),
      details,
      savedAt: "2026-07-19T13:00:00.000Z",
    });
    await repository.signOff({
      context: context(),
      details,
      signedAt: "2026-07-19T13:05:00.000Z",
    });
    await repository.saveDraft({
      context: {
        ...context(),
        contextKey: "ASTER|B0|work-package|WP300|2026-06-14",
        scopeType: "work-package",
        scopeId: "WP300",
      },
      details: emptyVarianceAnalysisDetails,
      savedAt: "2026-07-19T13:10:00.000Z",
    });

    const reportRecords = await repository.loadSignedForReport({
      projectId: "ASTER",
      baselineVersion: "B0",
      reportingPeriod: "2026-06-14",
    });

    expect(reportRecords).toHaveLength(1);
    expect(reportRecords[0]?.recordType).toBe("signed");
    expect(reportRecords[0]?.scopeId).toBe("all");
  });
});

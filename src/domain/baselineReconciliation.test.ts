import { describe, expect, it } from "vitest";
import type { ChangeRequest } from "./types";
import {
  buildBaselineReconciliation,
  type BaselineGenerationSnapshot,
} from "./baselineReconciliation";

const snapshots = (): BaselineGenerationSnapshot[] => [
  {
    importId: "IMPORT-B0",
    projectId: "ASTER",
    baselineVersion: "B0",
    importedAt: "2026-06-14T17:00:00.000Z",
    dataDate: "2026-06-14",
    bac: 1_000,
    baselineFinish: "2026-07-01",
    periods: [
      { period: "2026-06-07", pv: 500, ev: 450, ac: 480 },
      { period: "2026-06-14", pv: 250, ev: 230, ac: 240 },
    ],
  },
  {
    importId: "IMPORT-B1",
    projectId: "ASTER",
    baselineVersion: "B1",
    importedAt: "2026-06-21T17:00:00.000Z",
    dataDate: "2026-06-21",
    bac: 1_150,
    baselineFinish: "2026-07-06",
    periods: [
      { period: "2026-06-07", pv: 500, ev: 450, ac: 480 },
      { period: "2026-06-14", pv: 250, ev: 230, ac: 240 },
      { period: "2026-06-21", pv: 120, ev: 100, ac: 110 },
    ],
  },
];

const implementedChange = (
  overrides: Partial<ChangeRequest> = {},
): ChangeRequest => ({
  id: "CR-001",
  title: "Add inspection platform",
  wbsId: "WP300",
  costImpact: 150,
  scheduleImpactDays: 5,
  decisionDue: "2026-06-10",
  status: "implemented",
  effectiveDate: "2026-06-15",
  incorporatedBaselineVersion: "B1",
  ...overrides,
});

const reconcile = (
  overrides: {
    snapshots?: BaselineGenerationSnapshot[];
    changes?: ChangeRequest[];
    reportingDate?: string;
  } = {},
) =>
  buildBaselineReconciliation({
    projectId: "ASTER",
    activeImportId: "IMPORT-B1",
    reportingDate: overrides.reportingDate ?? "2026-06-21",
    snapshots: overrides.snapshots ?? snapshots(),
    changes: overrides.changes ?? [implementedChange()],
  });

describe("baseline reconciliation", () => {
  it("reconciles the immutable original baseline to the active version", () => {
    const result = reconcile();

    expect(result.available).toBe(true);
    expect(result.original).toMatchObject({ version: "B0", bac: 1_000 });
    expect(result.active).toMatchObject({ version: "B1", bac: 1_150 });
    expect(result.incorporated).toMatchObject({
      costImpact: 150,
      scheduleImpactDays: 5,
    });
    expect(result.cost).toEqual({
      expected: 1_150,
      actual: 1_150,
      variance: 0,
      reconciles: true,
    });
    expect(result.schedule).toMatchObject({
      expectedFinish: "2026-07-06",
      actualFinish: "2026-07-06",
      varianceDays: 0,
      reconciles: true,
    });
    expect(result.controls).toEqual([]);
  });

  it("preserves pre-change variance and separates post-change performance", () => {
    const result = reconcile();
    const comparison = result.changeComparisons[0];

    expect(comparison).toMatchObject({
      changeId: "CR-001",
      fromVersion: "B0",
      toVersion: "B1",
      effectiveDate: "2026-06-15",
      historicalPerformancePreserved: true,
    });
    expect(comparison?.preChange.metrics).toMatchObject({
      bac: 1_000,
      pv: 750,
      ev: 680,
      ac: 720,
      sv: -70,
      cv: -40,
    });
    expect(comparison?.postChange.metrics).toMatchObject({
      bac: 1_150,
      pv: 870,
      ev: 780,
      ac: 830,
      sv: -90,
      cv: -50,
    });
  });

  it("blocks a BAC mismatch instead of deriving an answer that always balances", () => {
    const history = snapshots();
    history[1] = { ...history[1]!, bac: 1_140 };
    const result = reconcile({ snapshots: history });

    expect(result.cost).toMatchObject({
      expected: 1_150,
      actual: 1_140,
      variance: -10,
      reconciles: false,
    });
    expect(result.controls.map(({ code }) => code)).toContain(
      "BASELINE_COST_MISMATCH",
    );
  });

  it("detects historical PV, EV or AC rewritten before the effective date", () => {
    const history = snapshots();
    history[1] = {
      ...history[1]!,
      periods: [
        { period: "2026-06-07", pv: 510, ev: 450, ac: 480 },
        ...history[1]!.periods.slice(1),
      ],
    };
    const result = reconcile({ snapshots: history });

    expect(result.changeComparisons[0]?.historicalPerformancePreserved).toBe(
      false,
    );
    expect(result.controls.map(({ code }) => code)).toContain(
      "HISTORICAL_PERFORMANCE_REWRITTEN",
    );
  });

  it("keeps approved, rejected and future-effective changes out of the active cut-off", () => {
    const result = reconcile({
      changes: [
        implementedChange({
          id: "CR-FUTURE",
          effectiveDate: "2026-06-29",
        }),
        implementedChange({
          id: "CR-APPROVED",
          status: "approved",
          incorporatedBaselineVersion: undefined,
          costImpact: 80,
        }),
        implementedChange({
          id: "CR-REJECTED",
          status: "rejected",
          incorporatedBaselineVersion: undefined,
          costImpact: 90,
        }),
      ],
    });

    expect(result.effectiveChangeIds).toEqual([]);
    expect(result.approvedNotIncorporated).toMatchObject({ costImpact: 80 });
    expect(result.controls.map(({ code }) => code)).toContain(
      "BASELINE_EFFECTIVE_DATE_PENDING",
    );
  });

  it("requires retained source history when an implemented revision is active", () => {
    const result = reconcile({ snapshots: [snapshots()[1]!] });

    expect(result.available).toBe(false);
    expect(result.controls.map(({ code }) => code)).toContain(
      "BASELINE_HISTORY_REQUIRED",
    );
  });

  it("blocks an implemented revision when the active pointer is reverted earlier", () => {
    const result = buildBaselineReconciliation({
      projectId: "ASTER",
      activeImportId: "IMPORT-B0",
      reportingDate: "2026-06-21",
      snapshots: snapshots(),
      changes: [implementedChange()],
    });

    expect(result.incorporated.changeIds).toEqual([]);
    expect(result.controls.map(({ code }) => code)).toContain(
      "INCORPORATED_BASELINE_NOT_ACTIVE",
    );
  });
});

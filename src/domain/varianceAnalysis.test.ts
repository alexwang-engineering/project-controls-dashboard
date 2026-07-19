import { describe, expect, it } from "vitest";
import { calculateEarnedValue } from "./calculations/earnedValue";
import {
  createVarianceAnalysisContext,
  emptyVarianceAnalysisDetails,
  validateVarianceAnalysisForSignOff,
} from "./varianceAnalysis";

const fixtureMetrics = calculateEarnedValue({
  bac: 2_400_000,
  pv: 1_500_000,
  ev: 1_350_000,
  ac: 1_440_000,
  managementEac: 2_560_000,
});

describe("variance analysis domain", () => {
  it("creates a stable project-period context and pence-normalised fact snapshot", () => {
    const context = createVarianceAnalysisContext({
      projectId: "ASTER",
      baselineVersion: "B0",
      scopeId: "all",
      reportingPeriod: "2026-06-14",
      sourceImportId: "IMPORT-001",
      expectedActiveImportId: "IMPORT-001",
      managementScenario: "cpi",
      metrics: fixtureMetrics,
    });

    expect(context.contextKey).toBe(
      "ASTER|B0|project|all|2026-06-14",
    );
    expect(context.breachedMetrics).toEqual(["SPI", "CPI", "VAC"]);
    expect(context.facts).toMatchObject({
      bacPence: 240_000_000,
      svPence: -15_000_000,
      cvPence: -9_000_000,
      managementEacPence: 256_000_000,
      vacPence: -16_000_000,
      spi: 0.9,
      cpi: 0.9375,
    });
    expect(context.factFingerprint).toContain('"managementScenario":"cpi"');
  });

  it("requires complete cause, impact, action, ownership and recovery evidence", () => {
    const result = validateVarianceAnalysisForSignOff(
      emptyVarianceAnalysisDetails,
      "2026-06-14",
    );

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.fieldErrors).toMatchObject({
      rootCause: expect.any(String),
      correctiveAction: expect.any(String),
      owner: expect.any(String),
      dueDate: expect.any(String),
      recoveryEvidence: expect.any(String),
      author: expect.any(String),
    });
  });

  it("rejects recovery dates before the selected reporting period", () => {
    const result = validateVarianceAnalysisForSignOff(
      {
        rootCause: "Late control-panel release constrained installation.",
        dependencyImpact: "Mechanical completion and test entry are delayed.",
        milestoneImpact: "Site acceptance is forecast seven days late.",
        criticalPathImpact: "Source schedule does not identify critical path.",
        costEacEffect: "CPI continuation indicates a £160,000 overrun.",
        correctiveAction: "Add a second wiring team and resequence dry testing.",
        owner: "Controls Manager",
        dueDate: "2026-06-07",
        recoveryEvidence: "Weekly completed-panel count reaches four units.",
        expectedRecoveryPeriod: "2026-06-07",
        status: "open",
        author: "Project Controls Engineer",
      },
      "2026-06-14",
    );

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.fieldErrors.dueDate).toContain("on or after");
    expect(result.fieldErrors.expectedRecoveryPeriod).toContain("on or after");
  });
});

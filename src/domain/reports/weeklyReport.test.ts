import { describe, expect, it } from "vitest";
import { demoSnapshot } from "../../data/demo";
import { calculateEarnedValue } from "../calculations/earnedValue";
import {
  createVarianceAnalysisContext,
  type VarianceAnalysisDetails,
  type VarianceAnalysisRecord,
} from "../varianceAnalysis";
import {
  buildSyntheticPerformanceSnapshot,
  type ProjectPerformanceSnapshot,
} from "../viewModels/projectPerformance";
import { buildWeeklyReportSnapshot } from "./weeklyReport";
import type { BaselineGenerationSnapshot } from "../baselineReconciliation";
import type { ChangeRequest, Risk } from "../types";

const completeDetails: VarianceAnalysisDetails = {
  rootCause: "Late control-panel release constrained installation.",
  dependencyImpact: "Mechanical completion and test entry are delayed.",
  milestoneImpact: "Site acceptance is forecast seven days late.",
  criticalPathImpact: "Source schedule does not identify critical path.",
  costEacEffect: "CPI continuation indicates a forecast cost overrun.",
  correctiveAction: "Add a second wiring team and resequence dry testing.",
  owner: "Controls Manager",
  dueDate: "2026-06-21",
  recoveryEvidence: "Weekly completed-panel count reaches four units.",
  expectedRecoveryPeriod: "2026-06-28",
  status: "open",
  author: "Project Controls Engineer",
};

const activeFixture = (): ProjectPerformanceSnapshot => ({
  ...buildSyntheticPerformanceSnapshot(),
  source: "active-import",
  importId: "IMPORT-REPORT-001",
  importedAt: "2026-06-14T17:10:00.000Z",
});

const singleScopeFixture = (): ProjectPerformanceSnapshot => ({
  source: "active-import",
  importId: "IMPORT-REPORT-ONE",
  importedAt: "2026-06-14T17:10:00.000Z",
  project: {
    id: "ONE",
    name: "Single-scope controls project",
    reportingDate: "2026-06-14",
    baselineVersion: "B0",
    originalBac: 1_000,
    baselineFinish: "2026-07-01",
    forecastFinish: "2026-07-08",
  },
  workPackages: [],
  trend: [
    {
      period: "2026-06-14",
      label: "P1",
      pv: 600,
      ev: 500,
      ac: 550,
    },
  ],
  periods: [
    {
      period: "2026-06-14",
      label: "P1",
      pv: 600,
      ev: 500,
      ac: 550,
    },
  ],
  activities: [],
  performance: [],
});

const signedProjectAnalysis = (
  performance: ProjectPerformanceSnapshot,
  sourceImportId = performance.importId,
): VarianceAnalysisRecord => {
  const totals = performance.periods.reduce(
    (sum, period) => ({
      pv: sum.pv + period.pv,
      ev: sum.ev + period.ev,
      ac: sum.ac + period.ac,
    }),
    { pv: 0, ev: 0, ac: 0 },
  );
  const base = calculateEarnedValue({
    bac: performance.project.originalBac,
    ...totals,
  });
  const managementEac = base.eacCpi ?? base.eacBudgetRate;
  const context = createVarianceAnalysisContext({
    projectId: performance.project.id,
    baselineVersion: performance.project.baselineVersion,
    scopeId: "all",
    reportingPeriod: performance.project.reportingDate,
    sourceImportId,
    expectedActiveImportId: sourceImportId,
    managementScenario: base.eacCpi === null ? "budget-rate" : "cpi",
    metrics: calculateEarnedValue({
      bac: performance.project.originalBac,
      ...totals,
      managementEac,
    }),
  });
  return {
    recordId: `SIGNED::${context.contextKey}::1`,
    recordType: "signed",
    contextKey: context.contextKey,
    projectId: context.projectId,
    baselineVersion: context.baselineVersion,
    scopeType: context.scopeType,
    scopeId: context.scopeId,
    reportingPeriod: context.reportingPeriod,
    sourceImportId,
    managementScenario: context.managementScenario,
    breachedMetrics: [...context.breachedMetrics],
    facts: context.facts,
    factFingerprint: context.factFingerprint,
    details: completeDetails,
    revision: 1,
    createdAt: "2026-07-19T13:00:00.000Z",
    updatedAt: "2026-07-19T13:05:00.000Z",
    signedAt: "2026-07-19T13:05:00.000Z",
  };
};

const controlledImplementedChange = (): ChangeRequest => ({
  id: "CR-BASELINE-001",
  title: "Add authorised inspection platform",
  reason: "Provide permanent access for mandatory inspections.",
  requester: "Engineering Manager",
  wbsId: "WP300",
  scopeDescription: "Add one permanent inspection platform.",
  costImpact: 150,
  scheduleImpactDays: 5,
  technicalQualityImpact: "Structural verification is required.",
  riskImpact: "Reduces repeated temporary-access exposure.",
  benefit: "Safer and faster inspections.",
  assumptions: "Existing steelwork supports the verified design.",
  alternatives: "Mobile access was rejected after assessment.",
  recommendation: "Implement the permanent platform.",
  decisionDue: "2026-06-10",
  status: "implemented",
  submittedDate: "2026-06-01",
  decisionAuthority: "Project Change Board",
  approver: "Programme Director",
  decisionDate: "2026-06-08",
  decisionRationale: "The safety and access benefits justify the change.",
  evidenceReference: "CCB-PACK-001",
  effectiveDate: "2026-06-15",
  incorporatedBaselineVersion: "B1",
  rebaselineJustification: "Authorised scope changed after baseline approval.",
  preventionCorrectiveMeasures: "Future access reviews occur during design.",
});

const reconciledBaselineSnapshots = (): BaselineGenerationSnapshot[] => [
  {
    importId: "IMPORT-B0",
    projectId: "ONE",
    baselineVersion: "B0",
    importedAt: "2026-06-14T17:00:00.000Z",
    dataDate: "2026-06-14",
    bac: 1_000,
    baselineFinish: "2026-07-01",
    periods: [{ period: "2026-06-14", pv: 600, ev: 500, ac: 550 }],
  },
  {
    importId: "IMPORT-B1",
    projectId: "ONE",
    baselineVersion: "B1",
    importedAt: "2026-06-21T17:00:00.000Z",
    dataDate: "2026-06-21",
    bac: 1_150,
    baselineFinish: "2026-07-06",
    periods: [
      { period: "2026-06-14", pv: 600, ev: 500, ac: 550 },
      { period: "2026-06-21", pv: 100, ev: 90, ac: 95 },
    ],
  },
];

const revisedBaselineFixture = (): ProjectPerformanceSnapshot => ({
  ...singleScopeFixture(),
  importId: "IMPORT-B1",
  project: {
    ...singleScopeFixture().project,
    reportingDate: "2026-06-21",
    baselineVersion: "B1",
    originalBac: 1_150,
    baselineFinish: "2026-07-06",
  },
  periods: [
    { period: "2026-06-14", label: "P1", pv: 600, ev: 500, ac: 550 },
    { period: "2026-06-21", label: "P2", pv: 100, ev: 90, ac: 95 },
  ],
  baselineSnapshots: reconciledBaselineSnapshots(),
});

describe("weekly report snapshot", () => {
  it("reconciles current-period, cumulative and forecast values to the dashboard fixture", () => {
    const report = buildWeeklyReportSnapshot({
      performance: activeFixture(),
      signedAnalyses: [],
      milestones: demoSnapshot.milestones,
      risks: demoSnapshot.risks,
      changes: demoSnapshot.changes,
      generatedAt: "2026-07-19T18:00:00.000Z",
    });

    expect(report.currentPeriod.metrics).toMatchObject({
      pv: 100_000,
      ev: 90_000,
      ac: 90_000,
      sv: -10_000,
      cv: 0,
      spi: 0.9,
      cpi: 1,
    });
    expect(report.cumulative.metrics).toMatchObject({
      bac: 2_400_000,
      pv: 1_500_000,
      ev: 1_350_000,
      ac: 1_440_000,
      sv: -150_000,
      cv: -90_000,
      spi: 0.9,
      cpi: 0.9375,
    });
    expect(report.forecast.minimumEac).toBe(2_490_000);
    expect(report.forecast.maximumEac).toBeCloseTo(2_684_444.44, 2);
    expect(report.varianceExceptions.map(({ scopeId }) => scopeId)).toEqual([
      "all",
      "WP200",
      "WP300",
      "WP400",
      "WP500",
    ]);
    expect(report.canPublish).toBe(false);
    expect(report.controls.map(({ code }) => code)).toContain(
      "VARIANCE_ANALYSIS_REQUIRED",
    );
  });

  it("accepts a complete signed analysis only when it matches the active facts", () => {
    const performance = singleScopeFixture();
    const signed = signedProjectAnalysis(performance);
    const report = buildWeeklyReportSnapshot({
      performance,
      signedAnalyses: [signed],
      milestones: [],
      risks: [],
      changes: [],
      generatedAt: "2026-07-19T18:00:00.000Z",
    });

    expect(report.canPublish).toBe(true);
    expect(report.controls).toEqual([]);
    expect(report.varianceExceptions).toHaveLength(1);
    expect(report.varianceExceptions[0]).toMatchObject({
      scopeId: "all",
      analysisStatus: "signed",
      signedRevision: 1,
      owner: "Controls Manager",
      correctiveAction:
        "Add a second wiring team and resequence dry testing.",
    });
    expect(report.executiveSummary).toContain(
      "Late control-panel release constrained installation.",
    );
    expect(report.movement).toContain(
      "one accepted performance period",
    );
    expect(report.sourceNotes).toContain(
      "Performance history contains one accepted period; current-period and cumulative columns therefore reconcile to the same values.",
    );
  });

  it("reports active control exceptions and excludes closed risk exposure", () => {
    const performance = singleScopeFixture();
    const activeControlException: Risk = {
      ...demoSnapshot.risks[11]!,
      id: "R-CONTROL",
      status: "active",
      residualProbability: 2,
      residualImpact: 2,
      residualScore: 4,
      rating: "low",
      treatmentDue: "2026-06-20",
      reviewDate: "2026-06-20",
      triggerStatus: "clear",
      controlEffectiveness: "not-tested",
      disposition: "within-tolerance",
    };
    const closedCritical: Risk = {
      ...demoSnapshot.risks[0]!,
      id: "R-CLOSED",
      status: "closed",
    };
    const report = buildWeeklyReportSnapshot({
      performance,
      signedAnalyses: [signedProjectAnalysis(performance)],
      milestones: [],
      risks: [closedCritical, activeControlException],
      changes: [],
      generatedAt: "2026-07-19T18:00:00.000Z",
    });

    expect(report.topRisks.map(({ id }) => id)).toEqual(["R-CONTROL"]);
  });

  it("uses the named authority for a submitted change decision", () => {
    const performance = singleScopeFixture();
    const report = buildWeeklyReportSnapshot({
      performance,
      signedAnalyses: [signedProjectAnalysis(performance)],
      milestones: [],
      risks: [],
      changes: [
        {
          id: "CR-001",
          title: "Add inspection platform",
          reason: "Improve safe access for mandatory inspection work.",
          requester: "Engineering Manager",
          wbsId: "WP300",
          scopeDescription: "Add one permanent inspection platform.",
          status: "submitted",
          costImpact: 25_000,
          scheduleImpactDays: 3,
          technicalQualityImpact: "The design requires a structural load check.",
          riskImpact: "The change reduces repeat access risk.",
          benefit: "Safer and faster mandatory inspection work.",
          assumptions: "Existing steelwork can support the verified design.",
          alternatives: "Mobile access was reviewed and rejected.",
          recommendation: "Approve the permanent access platform.",
          decisionDue: "2026-08-05",
          submittedDate: "2026-07-20",
          decisionAuthority: "Project Change Board",
          evidenceReference: "CCB-PACK-001",
        },
      ],
      generatedAt: "2026-07-19T18:00:00.000Z",
    });

    expect(report.controls.map(({ code }) => code)).not.toContain(
      "DECISION_AUTHORITY_REQUIRED",
    );
    expect(report.canPublish).toBe(true);
    expect(report.changeDecisions[0]?.decisionOwner).toBe(
      "Project Change Board",
    );
  });

  it("blocks publication when a controlled change has incomplete impact evidence", () => {
    const performance = singleScopeFixture();
    const report = buildWeeklyReportSnapshot({
      performance,
      signedAnalyses: [signedProjectAnalysis(performance)],
      milestones: [],
      risks: [],
      changes: [
        {
          id: "CR-002",
          title: "Incomplete submitted request",
          wbsId: "WP300",
          status: "submitted",
          costImpact: 1_000,
          scheduleImpactDays: 0,
          decisionDue: "2026-08-05",
          decisionAuthority: "Project Change Board",
        },
      ],
      generatedAt: "2026-07-19T18:00:00.000Z",
    });

    expect(report.canPublish).toBe(false);
    expect(report.controls.map(({ code }) => code)).toContain(
      "CHANGE_RECORD_INCOMPLETE",
    );
  });

  it("blocks an earlier-generation or fact-mismatched sign-off", () => {
    const performance = singleScopeFixture();
    const oldGeneration = signedProjectAnalysis(performance, "IMPORT-OLD");
    const staleFacts = {
      ...signedProjectAnalysis(performance),
      factFingerprint: "stale-fingerprint",
    };

    const oldReport = buildWeeklyReportSnapshot({
      performance,
      signedAnalyses: [oldGeneration],
      milestones: [],
      risks: [],
      changes: [],
      generatedAt: "2026-07-19T18:00:00.000Z",
    });
    const staleReport = buildWeeklyReportSnapshot({
      performance,
      signedAnalyses: [staleFacts],
      milestones: [],
      risks: [],
      changes: [],
      generatedAt: "2026-07-19T18:00:00.000Z",
    });

    expect(oldReport.varianceExceptions[0]?.analysisStatus).toBe("required");
    expect(staleReport.varianceExceptions[0]?.analysisStatus).toBe("stale");
    expect(staleReport.controls.map(({ code }) => code)).toContain(
      "VARIANCE_ANALYSIS_STALE",
    );
  });

  it("keeps incorporated and unincorporated change exposure distinct", () => {
    const report = buildWeeklyReportSnapshot({
      performance: activeFixture(),
      signedAnalyses: [],
      milestones: demoSnapshot.milestones,
      risks: demoSnapshot.risks,
      changes: demoSnapshot.changes,
      generatedAt: "2026-07-19T18:00:00.000Z",
    });

    expect(report.baseline).toMatchObject({
      activeVersion: "B0",
      activeBac: 2_400_000,
      approvedNotIncorporated: 77_000,
      incorporatedInActiveBaseline: 0,
    });
    expect(report.baseline.otherBaselineVersions).toEqual(["B1"]);
    expect(report.controls.map(({ code }) => code)).toContain(
      "BASELINE_VERSION_MISMATCH",
    );
  });

  it("publishes the exact original-to-current baseline reconciliation", () => {
    const performance = revisedBaselineFixture();
    const report = buildWeeklyReportSnapshot({
      performance,
      signedAnalyses: [signedProjectAnalysis(performance)],
      milestones: [],
      risks: [],
      changes: [controlledImplementedChange()],
      generatedAt: "2026-07-19T18:00:00.000Z",
    });

    expect(report.baseline).toMatchObject({
      originalVersion: "B0",
      originalBac: 1_000,
      activeVersion: "B1",
      activeBac: 1_150,
      incorporatedInActiveBaseline: 150,
      expectedActiveBac: 1_150,
      reconciliationVariance: 0,
      historicalPerformancePreserved: true,
      effectiveChangeIds: ["CR-BASELINE-001"],
    });
    expect(report.controls.map(({ code }) => code)).not.toContain(
      "BASELINE_COST_MISMATCH",
    );
  });

  it("blocks publication when revised history rewrites pre-effective PV", () => {
    const performance = revisedBaselineFixture();
    performance.baselineSnapshots = [
      reconciledBaselineSnapshots()[0]!,
      {
        ...reconciledBaselineSnapshots()[1]!,
        periods: [
          { period: "2026-06-14", pv: 610, ev: 500, ac: 550 },
          { period: "2026-06-21", pv: 100, ev: 90, ac: 95 },
        ],
      },
    ];
    const report = buildWeeklyReportSnapshot({
      performance,
      signedAnalyses: [signedProjectAnalysis(performance)],
      milestones: [],
      risks: [],
      changes: [controlledImplementedChange()],
      generatedAt: "2026-07-19T18:00:00.000Z",
    });

    expect(report.canPublish).toBe(false);
    expect(report.controls.map(({ code }) => code)).toContain(
      "HISTORICAL_PERFORMANCE_REWRITTEN",
    );
  });
});

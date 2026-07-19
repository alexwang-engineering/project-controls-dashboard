import { describe, expect, it } from "vitest";
import type { WeeklyReportSnapshot } from "./weeklyReport";
import {
  buildReportSourceFingerprint,
  emptyReportNarrative,
  validateReportNarrativeForPublication,
  type WeeklyReportSourceEvidence,
} from "./reportPublication";

const report = {
  identity: {
    projectId: "ASTER",
    projectName: "Project Aster",
    reportingPeriod: "2026-06-14",
    baselineVersion: "B0",
    generatedAt: "2026-07-19T18:00:00.000Z",
    sourceImportId: "IMPORT-001",
  },
  canPublish: true,
} as WeeklyReportSnapshot;

const evidence: WeeklyReportSourceEvidence = {
  activeImportId: "IMPORT-001",
  signedAnalyses: [],
  milestones: [],
  risks: [],
  changes: [],
};

describe("weekly report publication", () => {
  it("produces the same fingerprint when source arrays arrive in a different order", () => {
    const risk = {
      id: "R-002",
      title: "Late release",
      owner: "Engineering",
      wbsId: "WP100",
      category: "Schedule",
      residualProbability: 4,
      residualImpact: 4,
      residualScore: 16,
      rating: "high" as const,
      treatment: "Daily review",
      treatmentDue: "2026-06-21",
      triggerStatus: "watch" as const,
      controlEffectiveness: "partly-effective" as const,
    };
    const otherRisk = { ...risk, id: "R-001", title: "Supply delay" };

    const first = buildReportSourceFingerprint(report, {
      ...evidence,
      risks: [risk, otherRisk],
    });
    const second = buildReportSourceFingerprint(report, {
      ...evidence,
      risks: [otherRisk, risk],
    });

    expect(first).toBe(second);
  });

  it("does not make the source fingerprint stale only because generation time changed", () => {
    const later = {
      ...report,
      identity: {
        ...report.identity,
        generatedAt: "2026-07-19T19:00:00.000Z",
      },
    };

    expect(buildReportSourceFingerprint(later, evidence)).toBe(
      buildReportSourceFingerprint(report, evidence),
    );
  });

  it("changes the fingerprint when a source register value changes", () => {
    const changed = {
      ...evidence,
      risks: [
        {
          id: "R-001",
          title: "Supply delay",
          owner: "Engineering",
          wbsId: "WP100",
          category: "Schedule",
          residualProbability: 5,
          residualImpact: 4,
          residualScore: 20,
          rating: "critical" as const,
          treatment: "Escalate supplier",
          treatmentDue: "2026-06-21",
          triggerStatus: "breached" as const,
          controlEffectiveness: "ineffective" as const,
        },
      ],
    };

    expect(buildReportSourceFingerprint(report, changed)).not.toBe(
      buildReportSourceFingerprint(report, evidence),
    );
  });

  it("requires a named author and decision-focused narrative before publication", () => {
    const result = validateReportNarrativeForPublication(emptyReportNarrative);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.fieldErrors.author).toMatch(/required/i);
    expect(result.fieldErrors.managementSummary).toMatch(/at least/i);
    expect(result.fieldErrors.nextPeriodFocus).toMatch(/at least/i);
  });
});

import { describe, expect, it } from "vitest";
import type { Risk } from "./types";
import {
  riskExceptionFlags,
  riskExposure,
  riskRating,
  riskToleranceForObjective,
  riskTrend,
} from "./risks";

const risk = (overrides: Partial<Risk> = {}): Risk => ({
  id: "R-001",
  title: "Supplier delivery delay",
  owner: "Supply Chain Manager",
  wbsId: "WP200",
  category: "Delivery",
  status: "active",
  objective: "schedule",
  inherentProbability: 5,
  inherentImpact: 4,
  inherentScore: 20,
  inherentRating: "critical",
  previousResidualProbability: 3,
  previousResidualImpact: 3,
  residualProbability: 4,
  residualImpact: 4,
  residualScore: 16,
  rating: "critical",
  treatment: "Expedite the purchase order and track dispatch evidence daily.",
  treatmentDue: "2026-07-19",
  reviewDate: "2026-07-19",
  triggerDescription: "Dispatch evidence is not received by the agreed cut-off.",
  triggerStatus: "breached",
  controlDescription: "Daily supplier progress confirmation and receipt log review.",
  controlOwner: "Supply Chain Manager",
  controlEvidence: "SUPPLIER-LOG-001",
  controlTestDate: "2026-07-18",
  controlEffectiveness: "ineffective",
  disposition: "escalated",
  escalationOwner: "Project Director",
  escalationDate: "2026-07-18",
  ...overrides,
});

describe("risk-control rules", () => {
  it.each([
    [1, "low"],
    [4, "low"],
    [5, "moderate"],
    [9, "moderate"],
    [10, "high"],
    [14, "high"],
    [15, "critical"],
    [25, "critical"],
  ] as const)("maps score %i to %s", (score, rating) => {
    expect(riskRating(score)).toBe(rating);
  });

  it("keeps inherent and residual exposure explicit", () => {
    expect(riskExposure(risk(), "inherent")).toEqual({
      probability: 5,
      impact: 4,
      score: 20,
      rating: "critical",
    });
    expect(riskExposure(risk(), "residual")).toEqual({
      probability: 4,
      impact: 4,
      score: 16,
      rating: "critical",
    });
  });

  it("applies the stricter safety/quality tolerance", () => {
    expect(riskToleranceForObjective("safety-quality")).toBe(4);
    expect(riskToleranceForObjective("schedule")).toBe(9);
  });

  it("derives improving, stable and worsening residual trend", () => {
    expect(riskTrend(risk())).toBe("worsening");
    expect(
      riskTrend(
        risk({ residualProbability: 3, residualImpact: 3, residualScore: 9 }),
      ),
    ).toBe("stable");
    expect(
      riskTrend(
        risk({ residualProbability: 2, residualImpact: 3, residualScore: 6 }),
      ),
    ).toBe("improving");
  });

  it("uses a strict reporting-date boundary for overdue evidence", () => {
    const boundary = riskExceptionFlags(
      risk({ treatmentDue: "2026-07-20", reviewDate: "2026-07-20" }),
      "2026-07-20",
    );
    const overdue = riskExceptionFlags(risk(), "2026-07-20");

    expect(boundary.treatmentOverdue).toBe(false);
    expect(boundary.reviewOverdue).toBe(false);
    expect(overdue).toMatchObject({
      aboveTolerance: true,
      treatmentOverdue: true,
      reviewOverdue: true,
      triggerBreached: true,
      controlConcern: true,
      escalationRequired: false,
    });
  });

  it("flags above-tolerance legacy data without escalation evidence", () => {
    expect(
      riskExceptionFlags(
        risk({ disposition: undefined, escalationOwner: undefined }),
        "2026-07-20",
      ).escalationRequired,
    ).toBe(true);
  });
});

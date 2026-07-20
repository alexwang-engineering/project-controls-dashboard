import { describe, expect, it } from "vitest";
import { changeInputSchema, riskInputSchema } from "./registers";

const fullSubmission = {
  id: "CR-001",
  title: "Add inspection platform",
  reason: "Improve safe access for mandatory inspection work.",
  requester: "Engineering Manager",
  wbsId: "WP300",
  scopeDescription: "Add one permanent access platform and associated guarding.",
  costImpact: "25000",
  scheduleImpactDays: "3",
  technicalQualityImpact: "Inspection access improves; loading requires design verification.",
  riskImpact: "Reduces access risk and introduces a design-interface risk.",
  benefit: "Safer repeat inspection with shorter planned outage duration.",
  assumptions: "Existing steelwork can carry the verified platform loads.",
  alternatives: "Mobile access equipment was assessed and rejected for repeat use.",
  recommendation: "Submit the permanent platform for Change Board approval.",
  decisionDue: "2026-08-05",
  submittedDate: "2026-07-20",
  decisionAuthority: "Project Change Board",
  evidenceReference: "CCB-PACK-001",
  approver: "",
  decisionDate: "",
  decisionRationale: "",
  effectiveDate: "",
  incorporatedBaselineVersion: "",
  rebaselineJustification: "",
  preventionCorrectiveMeasures: "",
  status: "submitted",
};

describe("change input validation", () => {
  it("requires the complete impact assessment and authority at submission", () => {
    const incomplete = changeInputSchema.safeParse({
      ...fullSubmission,
      decisionAuthority: "",
      technicalQualityImpact: "",
    });

    expect(incomplete.success).toBe(false);
    if (!incomplete.success) {
      expect(incomplete.error.issues.map(({ path }) => path[0])).toEqual(
        expect.arrayContaining(["decisionAuthority", "technicalQualityImpact"]),
      );
    }
  });

  it("requires an authorised decision record before approval", () => {
    const incomplete = changeInputSchema.safeParse({
      ...fullSubmission,
      status: "approved",
    });

    expect(incomplete.success).toBe(false);
    if (!incomplete.success) {
      expect(incomplete.error.issues.map(({ path }) => path[0])).toEqual(
        expect.arrayContaining(["approver", "decisionDate", "decisionRationale"]),
      );
    }
  });

  it("requires implementation and rebaseline evidence before incorporation", () => {
    const incomplete = changeInputSchema.safeParse({
      ...fullSubmission,
      status: "implemented",
      approver: "Change Board Chair",
      decisionDate: "2026-07-23",
      decisionRationale: "Approved after review of the full impact pack.",
    });

    expect(incomplete.success).toBe(false);
    if (!incomplete.success) {
      expect(incomplete.error.issues.map(({ path }) => path[0])).toEqual(
        expect.arrayContaining([
          "effectiveDate",
          "incorporatedBaselineVersion",
          "rebaselineJustification",
          "preventionCorrectiveMeasures",
        ]),
      );
    }
  });
});

const fullRisk = {
  id: "R-001",
  title: "Supplier delivery delay",
  owner: "Supply Chain Manager",
  wbsId: "WP200",
  category: "Delivery",
  status: "active",
  objective: "schedule",
  condition: "The supplier has not secured the planned dispatch slot.",
  event: "The control panel may arrive after the installation window.",
  consequence: "Energisation and integrated testing could be delayed.",
  inherentProbability: "5",
  inherentImpact: "4",
  previousResidualProbability: "3",
  previousResidualImpact: "3",
  residualProbability: "4",
  residualImpact: "4",
  treatment: "Expedite the purchase order and track dispatch evidence daily.",
  treatmentDue: "2026-07-28",
  reviewDate: "2026-07-24",
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
  acceptanceAuthority: "",
  acceptanceRationale: "",
  acceptanceReviewDate: "",
};

describe("risk input validation", () => {
  it("derives inherent and residual ratings with trend evidence", () => {
    const parsed = riskInputSchema.parse(fullRisk);

    expect(parsed).toMatchObject({
      inherentScore: 20,
      inherentRating: "critical",
      residualScore: 16,
      rating: "critical",
    });
  });

  it("requires named escalation when residual exposure is above tolerance", () => {
    const parsed = riskInputSchema.safeParse({
      ...fullRisk,
      disposition: "within-tolerance",
      escalationOwner: "",
      escalationDate: "",
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.map(({ path }) => path[0])).toContain(
        "disposition",
      );
    }
  });

  it("requires complete authorised acceptance evidence", () => {
    const parsed = riskInputSchema.safeParse({
      ...fullRisk,
      disposition: "accepted",
      escalationOwner: "",
      escalationDate: "",
      acceptanceAuthority: "",
      acceptanceRationale: "",
      acceptanceReviewDate: "",
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.map(({ path }) => path[0])).toEqual(
        expect.arrayContaining([
          "acceptanceAuthority",
          "acceptanceRationale",
          "acceptanceReviewDate",
        ]),
      );
    }
  });
});

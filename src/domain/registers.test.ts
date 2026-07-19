import { describe, expect, it } from "vitest";
import { changeInputSchema } from "./registers";

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

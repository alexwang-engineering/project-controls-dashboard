import { describe, expect, it } from "vitest";
import type { ChangeRequest } from "./types";
import {
  applyChangeTransition,
  allowedChangeStatuses,
  canDeleteChange,
  canTransitionChange,
} from "./changes";

const draft: ChangeRequest = {
  id: "CR-001",
  title: "Add inspection platform",
  reason: "Improve safe access for mandatory inspection work.",
  requester: "Engineering Manager",
  wbsId: "WP300",
  scopeDescription: "Add one permanent access platform and associated guarding.",
  costImpact: 25_000,
  scheduleImpactDays: 3,
  technicalQualityImpact: "Inspection access improves; loading requires design verification.",
  riskImpact: "Reduces access risk and introduces a temporary design-interface risk.",
  benefit: "Safer repeat inspection with shorter planned outage duration.",
  assumptions: "Existing steelwork can carry the verified platform loads.",
  alternatives: "Mobile access equipment was assessed and rejected for repeat use.",
  recommendation: "Submit the permanent platform for Change Board approval.",
  decisionDue: "2026-08-05",
  status: "draft",
};

describe("controlled change workflow", () => {
  it("exposes only the allowed next states", () => {
    expect(allowedChangeStatuses(undefined)).toEqual(["draft"]);
    expect(allowedChangeStatuses("draft")).toEqual(["draft", "submitted"]);
    expect(allowedChangeStatuses("submitted")).toEqual([
      "submitted",
      "approved",
      "rejected",
      "draft",
    ]);
    expect(allowedChangeStatuses("approved")).toEqual([
      "approved",
      "implemented",
      "withdrawn",
    ]);
    expect(allowedChangeStatuses("implemented")).toEqual(["implemented"]);
    expect(canTransitionChange("draft", "approved")).toBe(false);
    expect(canDeleteChange(draft)).toBe(true);
  });

  it("appends immutable evidence for each valid transition", () => {
    const submitted = applyChangeTransition(draft, {
      ...draft,
      status: "submitted",
      submittedDate: "2026-07-20",
      decisionAuthority: "Project Change Board",
      evidenceReference: "CCB-PACK-001",
    });
    const approved = applyChangeTransition(submitted, {
      ...submitted,
      status: "approved",
      approver: "Change Board Chair",
      decisionDate: "2026-07-23",
      decisionRationale: "The safety benefit justifies the verified cost and time impact.",
    });

    expect(submitted.decisionHistory).toHaveLength(1);
    expect(canDeleteChange(submitted)).toBe(false);
    expect(approved.decisionHistory).toHaveLength(2);
    expect(approved.decisionHistory?.[1]).toMatchObject({
      sequence: 2,
      fromStatus: "submitted",
      toStatus: "approved",
      authority: "Project Change Board",
      actor: "Change Board Chair",
      date: "2026-07-23",
      evidenceReference: "CCB-PACK-001",
    });
    expect(submitted.decisionHistory).toHaveLength(1);
  });

  it("rejects a transition that skips the decision gate", () => {
    expect(() =>
      applyChangeTransition(draft, {
        ...draft,
        status: "approved",
        decisionAuthority: "Project Change Board",
        approver: "Change Board Chair",
        decisionDate: "2026-07-23",
        decisionRationale: "Approved after review.",
        evidenceReference: "CCB-MIN-001",
      }),
    ).toThrow("draft to approved");
  });

  it("requires a controlled request to return to draft before its case changes", () => {
    const submitted = applyChangeTransition(draft, {
      ...draft,
      status: "submitted",
      submittedDate: "2026-07-20",
      decisionAuthority: "Project Change Board",
      evidenceReference: "CCB-PACK-001",
    });

    expect(() =>
      applyChangeTransition(submitted, {
        ...submitted,
        title: "Changed after submission",
      }),
    ).toThrow("returned to draft");
  });
});

import { describe, expect, it } from "vitest";
import { defaultRiskAppetite } from "./riskAppetite";
import type { ChangeRequest, Milestone, Risk } from "./types";
import {
  buildManagementExceptions,
  groupManagementExceptions,
} from "./managementExceptions";

const milestone = (overrides: Partial<Milestone> = {}): Milestone => ({
  id: "MS-001",
  name: "Mechanical completion",
  wbsId: "WP300",
  owner: "Delivery Manager",
  baselineDate: "2026-07-20",
  previousForecastDate: "2026-07-20",
  forecastDate: "2026-07-22",
  status: "forecast-late",
  cause: "Supplier release moved.",
  recoveryAction: "Resequence installation.",
  actionOwner: "Construction Manager",
  actionDueDate: "2026-07-14",
  decisionRequired: "Approve resequencing.",
  commentary: "Two-day forecast movement.",
  ...overrides,
});

const risk = (overrides: Partial<Risk> = {}): Risk => ({
  id: "R-001",
  title: "Control-panel delivery may miss test entry",
  owner: "Engineering Manager",
  wbsId: "WP400",
  category: "Supply chain",
  status: "active",
  objective: "schedule",
  residualProbability: 4,
  residualImpact: 5,
  residualScore: 20,
  rating: "critical",
  treatment: "Expedite witnessed testing and split delivery lots.",
  treatmentDue: "2026-07-11",
  triggerStatus: "breached",
  controlDescription: "Weekly supplier evidence review.",
  controlOwner: "Procurement Manager",
  controlEvidence: "EXPEDITE-LOG-07",
  controlEffectiveness: "partly-effective",
  disposition: "escalated",
  escalationOwner: "Project Director",
  escalationDate: "2026-07-10",
  ...overrides,
});

const change = (overrides: Partial<ChangeRequest> = {}): ChangeRequest => ({
  id: "CR-001",
  title: "Add permanent inspection access",
  reason: "Close the access hazard.",
  requester: "Engineering Manager",
  wbsId: "WP300",
  scopeDescription: "Add one access platform.",
  costImpact: 120_000,
  scheduleImpactDays: 4,
  technicalQualityImpact: "Structural verification required.",
  riskImpact: "Reduces repeated temporary access.",
  benefit: "Safer inspection.",
  assumptions: "Existing steelwork can carry the load.",
  alternatives: "Mobile access rejected.",
  recommendation: "Approve the permanent platform.",
  decisionDue: "2026-07-12",
  status: "submitted",
  submittedDate: "2026-07-01",
  decisionAuthority: "Project Change Board",
  evidenceReference: "CCB-001",
  ...overrides,
});

const build = (overrides: Partial<Parameters<typeof buildManagementExceptions>[0]> = {}) =>
  buildManagementExceptions({
    reportingDate: "2026-07-10",
    scopeId: "all",
    scopeOwner: "Project Controls Manager",
    metrics: { spi: 1, cpi: 1 },
    finishVarianceDays: 0,
    milestones: [],
    risks: [],
    changes: [],
    riskAppetite: defaultRiskAppetite,
    bac: 2_400_000,
    ...overrides,
  });

describe("management exceptions", () => {
  it("ranks by materiality and urgency rather than module order", () => {
    const result = build({
      milestones: [milestone()],
      risks: [risk()],
      changes: [change({ decisionDue: "2026-07-20" })],
    });

    expect(result[0]).toMatchObject({
      id: "risk:R-001",
      kind: "risk",
      severity: "recovery",
      horizon: "now",
      route: "/risks?record=R-001&scope=all&date=2026-07-10",
    });
    expect(result.map(({ kind }) => kind)).toContain("milestone");
    expect(result.map(({ kind }) => kind)).toContain("change");
  });

  it("separates an attention breach from a recovery breach", () => {
    const result = build({
      metrics: { spi: 0.97, cpi: 0.94 },
    });

    expect(result.find(({ id }) => id === "performance:SPI")).toMatchObject({
      severity: "attention",
      horizon: "this-period",
      evidence: "required",
    });
    expect(result.find(({ id }) => id === "performance:CPI")).toMatchObject({
      severity: "recovery",
      horizon: "now",
    });
  });

  it("elevates overdue records and explains evidence gaps", () => {
    const result = build({
      milestones: [
        milestone({
          forecastDate: "2026-07-01",
          actionDueDate: "2026-07-05",
          recoveryAction: undefined,
        }),
      ],
    });

    expect(result[0]).toMatchObject({
      id: "milestone:MS-001",
      severity: "recovery",
      horizon: "now",
      evidence: "incomplete",
    });
    expect(result[0]?.priorityReason).toContain("5 days overdue");
    expect(result[0]?.reason).toContain("recovery fields incomplete");
  });

  it("groups stable sorted results into management horizons", () => {
    const result = build({
      risks: [
        risk(),
        risk({
          id: "R-LOW",
          title: "Minor close-out documentation risk",
          residualProbability: 1,
          residualImpact: 2,
          residualScore: 2,
          rating: "low",
          triggerStatus: "clear",
          treatmentDue: "2026-09-01",
          controlEffectiveness: "effective",
          disposition: "within-tolerance",
        }),
      ],
      changes: [change({ decisionDue: "2026-07-20" })],
    });
    const grouped = groupManagementExceptions(result);

    expect(grouped.now.map(({ id }) => id)).toContain("risk:R-001");
    expect(grouped.thisPeriod.map(({ id }) => id)).toContain("change:CR-001");
    expect(grouped.monitor.map(({ id }) => id)).toContain("risk:R-LOW");
    expect(result).toEqual([...result].sort((left, right) => right.score - left.score));
  });

  it("keeps a completed late milestone in monitoring without a stale due date", () => {
    const result = build({
      milestones: [
        milestone({
          baselineDate: "2026-07-01",
          previousForecastDate: "2026-07-09",
          forecastDate: "2026-07-09",
          actualDate: "2026-07-09",
          actionDueDate: "2026-07-05",
        }),
      ],
    });

    expect(result[0]).toMatchObject({
      id: "milestone:MS-001",
      severity: "monitor",
      horizon: "monitor",
      dueDate: undefined,
    });
  });

  it("does not reuse an expired decision date for baseline incorporation", () => {
    const result = build({
      changes: [
        change({
          status: "approved",
          decisionDue: "2026-07-01",
          incorporatedBaselineVersion: undefined,
        }),
      ],
    });

    expect(result[0]).toMatchObject({
      id: "change:CR-001",
      severity: "attention",
      horizon: "this-period",
      dueDate: undefined,
    });
    expect(result[0]?.priorityReason).toContain("no separate due date");
  });
});

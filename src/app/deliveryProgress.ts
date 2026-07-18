export interface DeliveryMilestoneProgress {
  id: string;
  title: string;
  plannedHours: number;
  completionPercent: number;
  evidence: string;
}

export const deliveryMilestones: readonly DeliveryMilestoneProgress[] = [
  {
    id: "M0",
    title: "Specification and architecture",
    plannedHours: 7,
    completionPercent: 90,
    evidence: "Master plan, data rules, ADRs and repository baseline are recorded.",
  },
  {
    id: "M1",
    title: "Foundation and import",
    plannedHours: 15,
    completionPercent: 70,
    evidence: "Parsing, validation, hostile fixtures and atomic storage are tested; the import wizard and backup UI remain.",
  },
  {
    id: "M2",
    title: "Overview and performance views",
    plannedHours: 12,
    completionPercent: 60,
    evidence: "The overview, KPI cards, trend, filters and accessible tables work; full drill-down and user research remain.",
  },
  {
    id: "M3",
    title: "Calculation engine",
    plannedHours: 10,
    completionPercent: 45,
    evidence: "Core EVM calculations and boundary tests work; traces, variance workflow and complete aggregation remain.",
  },
  {
    id: "M4",
    title: "Milestone control",
    plannedHours: 6,
    completionPercent: 50,
    evidence: "The register, status and variance view work; filters, predecessor trace and editable recovery actions remain.",
  },
  {
    id: "M5",
    title: "Risk control",
    plannedHours: 9,
    completionPercent: 45,
    evidence: "The heatmap and prioritised register work; editing, filtering, escalation and control evidence remain.",
  },
  {
    id: "M6",
    title: "Change control",
    plannedHours: 9,
    completionPercent: 35,
    evidence: "The change register and baseline warning work; controlled workflow, history and reconciliation remain.",
  },
  {
    id: "M7",
    title: "Weekly report",
    plannedHours: 11,
    completionPercent: 5,
    evidence: "The delivery scope is defined; report generation and accessible output remain.",
  },
  {
    id: "M8",
    title: "Quality and portfolio release",
    plannedHours: 15,
    completionPercent: 15,
    evidence: "Automated checks and a review app exist; full accessibility, browser and release evidence remain.",
  },
];

const totalPlannedHours = deliveryMilestones.reduce(
  (total, milestone) => total + milestone.plannedHours,
  0,
);

const rawEvidencedPlanHours = deliveryMilestones.reduce(
  (total, milestone) =>
    total + milestone.plannedHours * (milestone.completionPercent / 100),
  0,
);

const evidencedPlanHours = Math.round(rawEvidencedPlanHours * 10) / 10;

export const deliveryProgress = {
  totalPlannedHours,
  evidencedPlanHours,
  completionPercent: Math.round(
    (evidencedPlanHours / totalPlannedHours) * 100,
  ),
  assessedOn: "2026-07-18",
} as const;

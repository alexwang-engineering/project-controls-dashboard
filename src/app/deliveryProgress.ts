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
    completionPercent: 100,
    evidence: "Worker-isolated validation with identical fallback, the complete ASTER pair, revisioned registry updates, atomic storage and recovery all pass; the independent M1 review approved the increment with no blocking findings.",
  },
  {
    id: "M2",
    title: "Overview and performance views",
    plannedHours: 12,
    completionPercent: 80,
    evidence: "The overview and schedule/cost drill-down now read the active generation with reconciled project, period, work-package and activity traces; user research remains.",
  },
  {
    id: "M3",
    title: "Calculation engine",
    plannedHours: 10,
    completionPercent: 95,
    evidence: "Core EVM calculations, imported-data aggregation, three explicit EAC scenarios, revisioned variance analysis and weekly-report reconciliation work; the independent M3 closure review remains.",
  },
  {
    id: "M4",
    title: "Milestone control",
    plannedHours: 6,
    completionPercent: 70,
    evidence: "Validated add/edit/delete input, local persistence, status/date consistency, variance display and overview/report integration work; filters and predecessor/recovery trace remain.",
  },
  {
    id: "M5",
    title: "Risk control",
    plannedHours: 9,
    completionPercent: 90,
    evidence: "Validated cause-event-effect input, inherent/residual scoring and trend, combined filters, selectable accessible heatmap, objective tolerance, control tests, overdue exceptions and escalation/acceptance evidence all work; configurable appetite history and revisioned register storage remain.",
  },
  {
    id: "M6",
    title: "Change control",
    plannedHours: 9,
    completionPercent: 100,
    evidence: "Complete impact input, domain-enforced transitions, immutable decisions, retained generation baselines, original-to-current BAC and finish reconciliation, effective-period comparison, historical PV/EV/AC protection and report publication controls pass.",
  },
  {
    id: "M7",
    title: "Weekly report",
    plannedHours: 11,
    completionPercent: 90,
    evidence: "Immutable revisions now have an explicit live-versus-published print boundary, locked historical narrative, rollback and concurrency regression coverage, plus a visually inspected three-page A4 persisted-publication PDF; full-ASTER and Firefox/WKWebView print evidence plus moderated usability remain.",
  },
  {
    id: "M8",
    title: "Quality and portfolio release",
    plannedHours: 15,
    completionPercent: 25,
    evidence: "Automated input journeys and a signed native AppKit/WebKit review app with verified child-server lifecycle and a clean input-first launch exist; full accessibility, browser matrix and release evidence remain.",
  },
];

const totalPlannedHours = deliveryMilestones.reduce(
  (total, milestone) => total + milestone.plannedHours,
  0,
);

const weightedHourPercent = deliveryMilestones.reduce(
  (total, milestone) =>
    total + milestone.plannedHours * milestone.completionPercent,
  0,
);

const evidencedPlanHours = Math.round(weightedHourPercent / 10) / 10;

export const deliveryProgress = {
  totalPlannedHours,
  evidencedPlanHours,
  completionPercent: Math.round(weightedHourPercent / totalPlannedHours),
  assessedOn: "2026-07-20",
} as const;

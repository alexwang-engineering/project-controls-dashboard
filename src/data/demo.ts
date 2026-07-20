import { addDays, formatISO } from "date-fns";
import type {
  Activity,
  ChangeRequest,
  DemoSnapshot,
  Milestone,
  Risk,
  TrendPoint,
  WorkPackageSnapshot,
} from "../domain/types";
import { riskRating, riskToleranceForObjective } from "../domain/risks";

const isoDate = (date: Date) => formatISO(date, { representation: "date" });
const projectStart = new Date("2026-04-06T12:00:00Z");

export const workPackages: WorkPackageSnapshot[] = [
  {
    id: "WP100",
    name: "Enabling works and design",
    owner: "Design lead",
    bac: 240_000,
    pv: 240_000,
    ev: 240_000,
    ac: 235_000,
    forecastFinish: "2026-04-26",
  },
  {
    id: "WP200",
    name: "Civil and structural works",
    owner: "Civil lead",
    bac: 720_000,
    pv: 720_000,
    ev: 680_000,
    ac: 730_000,
    forecastFinish: "2026-05-28",
  },
  {
    id: "WP300",
    name: "Mechanical installation",
    owner: "Mechanical lead",
    bac: 600_000,
    pv: 400_000,
    ev: 330_000,
    ac: 355_000,
    forecastFinish: "2026-06-28",
  },
  {
    id: "WP400",
    name: "Electrical, controls and sensors",
    owner: "Controls lead",
    bac: 600_000,
    pv: 120_000,
    ev: 90_000,
    ac: 110_000,
    forecastFinish: "2026-07-12",
  },
  {
    id: "WP500",
    name: "Integration, testing and handover",
    owner: "Commissioning lead",
    bac: 240_000,
    pv: 20_000,
    ev: 10_000,
    ac: 10_000,
    forecastFinish: "2026-08-03",
  },
];

const cumulativeTrend = [
  [120_000, 120_000, 118_000],
  [240_000, 235_000, 230_000],
  [390_000, 375_000, 380_000],
  [540_000, 520_000, 535_000],
  [720_000, 690_000, 710_000],
  [900_000, 850_000, 890_000],
  [1_080_000, 1_000_000, 1_070_000],
  [1_260_000, 1_160_000, 1_245_000],
  [1_400_000, 1_260_000, 1_350_000],
  [1_500_000, 1_350_000, 1_440_000],
  [1_680_000, 1_510_000, 1_610_000],
  [1_860_000, 1_680_000, 1_790_000],
  [2_040_000, 1_850_000, 1_980_000],
  [2_200_000, 2_040_000, 2_190_000],
  [2_320_000, 2_180_000, 2_360_000],
  [2_400_000, 2_320_000, 2_520_000],
] as const;

export const trend: TrendPoint[] = cumulativeTrend.map(
  ([pv, ev, ac], index) => ({
    period: isoDate(addDays(projectStart, index * 7 + 6)),
    label: "W" + String(index + 1),
    pv,
    ev,
    ac,
  }),
);

export const milestoneActivityIds = [
  "A-011",
  "A-012",
  "A-024",
  "A-030",
  "A-036",
  "A-048",
  "A-059",
  "A-060",
] as const;

const milestoneActivityDetails = new Map<
  string,
  {
    name: string;
    owner: string;
    baselineDate: string;
    forecastDate: string;
    actualDate?: string;
  }
>([
  ["A-011", { name: "Design freeze", owner: "Design lead", baselineDate: "2026-04-19", forecastDate: "2026-04-19", actualDate: "2026-04-18" }],
  ["A-012", { name: "Site access ready", owner: "Site lead", baselineDate: "2026-04-26", forecastDate: "2026-04-26", actualDate: "2026-04-26" }],
  ["A-024", { name: "Structural works complete", owner: "Civil lead", baselineDate: "2026-05-24", forecastDate: "2026-05-28", actualDate: "2026-05-28" }],
  ["A-030", { name: "Mechanical equipment delivered", owner: "Supply lead", baselineDate: "2026-05-31", forecastDate: "2026-05-31", actualDate: "2026-05-30" }],
  ["A-036", { name: "Mechanical completion", owner: "Mechanical lead", baselineDate: "2026-06-21", forecastDate: "2026-06-28" }],
  ["A-048", { name: "Electrical energisation", owner: "Controls lead", baselineDate: "2026-06-28", forecastDate: "2026-06-28" }],
  ["A-059", { name: "Integrated testing complete", owner: "Commissioning lead", baselineDate: "2026-07-19", forecastDate: "2026-07-19" }],
  ["A-060", { name: "Operational handover", owner: "Project manager", baselineDate: "2026-07-26", forecastDate: "2026-08-03" }],
]);

function createActivities(): Activity[] {
  return workPackages.flatMap((workPackage, packageIndex) => {
    const standardBudget = Math.floor(workPackage.bac / 12);

    return Array.from({ length: 12 }, (_, activityIndex) => {
      const sequence = packageIndex * 12 + activityIndex + 1;
      const activityId = "A-" + String(sequence).padStart(3, "0");
      const milestone = milestoneActivityDetails.get(activityId);
      const start = addDays(projectStart, packageIndex * 14 + activityIndex * 4);
      const finish = addDays(start, 3);
      const predecessorId =
        sequence === 1
          ? undefined
          : "A-" + String(sequence - 1).padStart(3, "0");

      return {
        id: activityId,
        wbsId: workPackage.id,
        name: milestone?.name ?? workPackage.name + " activity " + String(activityIndex + 1),
        owner: milestone?.owner ?? workPackage.owner,
        baselineStart: isoDate(start),
        baselineFinish: milestone?.baselineDate ?? isoDate(finish),
        forecastStart: isoDate(
          addDays(start, packageIndex >= 2 && activityIndex >= 5 ? 2 : 0),
        ),
        forecastFinish:
          milestone?.forecastDate ??
          isoDate(addDays(finish, packageIndex >= 2 && activityIndex >= 5 ? 4 : 0)),
        actualFinish: milestone?.actualDate,
        predecessorIds: predecessorId ? [predecessorId] : [],
        isMilestone: milestone !== undefined,
        calendarId: "CAL-5D",
        constraintType: "none" as const,
        baselineBudget:
          activityIndex === 11
            ? workPackage.bac - standardBudget * 11
            : standardBudget,
        progressMethod: "percent_complete" as const,
      };
    });
  });
}

export const milestones: Milestone[] = [
  {
    id: "MS-001",
    sourceActivityId: "A-011",
    name: "Design freeze",
    wbsId: "WP100",
    owner: "Design lead",
    baselineDate: "2026-04-19",
    previousForecastDate: "2026-04-19",
    forecastDate: "2026-04-19",
    actualDate: "2026-04-18",
    status: "complete-on-time",
    commentary: "Design pack approved one day before the baseline date.",
  },
  {
    id: "MS-002",
    sourceActivityId: "A-012",
    name: "Site access ready",
    wbsId: "WP100",
    owner: "Site lead",
    baselineDate: "2026-04-26",
    previousForecastDate: "2026-04-26",
    forecastDate: "2026-04-26",
    actualDate: "2026-04-26",
    status: "complete-on-time",
    commentary: "Access permits and welfare setup complete.",
  },
  {
    id: "MS-003",
    sourceActivityId: "A-024",
    name: "Structural works complete",
    wbsId: "WP200",
    owner: "Civil lead",
    baselineDate: "2026-05-24",
    previousForecastDate: "2026-05-27",
    forecastDate: "2026-05-28",
    actualDate: "2026-05-28",
    status: "complete-late",
    cause: "Restricted access and survey rework delayed structural completion.",
    recoveryAction: "Close the residual survey actions and protect the released mechanical interfaces.",
    actionOwner: "Civil lead",
    actionDueDate: "2026-06-14",
    decisionRequired: "Accept the four-day outcome and retain the interface protection plan.",
    updatedAt: "2026-06-14T17:10:00Z",
    commentary: "Access and survey rework moved completion by four days.",
  },
  {
    id: "MS-004",
    sourceActivityId: "A-030",
    name: "Mechanical equipment delivered",
    wbsId: "WP300",
    owner: "Supply lead",
    baselineDate: "2026-05-31",
    previousForecastDate: "2026-05-31",
    forecastDate: "2026-05-31",
    actualDate: "2026-05-30",
    status: "complete-on-time",
    commentary: "All tagged equipment accepted into controlled storage.",
  },
  {
    id: "MS-005",
    sourceActivityId: "A-036",
    name: "Mechanical completion",
    wbsId: "WP300",
    owner: "Mechanical lead",
    baselineDate: "2026-06-21",
    previousForecastDate: "2026-06-25",
    forecastDate: "2026-06-28",
    status: "forecast-late",
    cause: "Alignment and guarding installation are progressing below the approved sequence.",
    recoveryAction: "Add a recovery shift and resequence guarding completion behind aligned equipment.",
    actionOwner: "Mechanical lead",
    actionDueDate: "2026-06-18",
    decisionRequired: "Approve the temporary second shift through mechanical completion.",
    updatedAt: "2026-06-14T17:10:00Z",
    commentary: "Recovery shift proposed for alignment and guarding work.",
  },
  {
    id: "MS-006",
    sourceActivityId: "A-048",
    name: "Electrical energisation",
    wbsId: "WP400",
    owner: "Controls lead",
    baselineDate: "2026-06-28",
    previousForecastDate: "2026-06-28",
    forecastDate: "2026-06-28",
    status: "on-track",
    commentary: "On date, but panel-test risk trigger is breached.",
  },
  {
    id: "MS-007",
    sourceActivityId: "A-059",
    name: "Integrated testing complete",
    wbsId: "WP500",
    owner: "Commissioning lead",
    baselineDate: "2026-07-19",
    previousForecastDate: "2026-07-19",
    forecastDate: "2026-07-19",
    status: "on-track",
    commentary: "Test scripts are in preparation.",
  },
  {
    id: "MS-008",
    sourceActivityId: "A-060",
    name: "Operational handover",
    wbsId: "WP500",
    owner: "Project manager",
    baselineDate: "2026-07-26",
    previousForecastDate: "2026-07-30",
    forecastDate: "2026-08-03",
    status: "forecast-late",
    cause: "Mechanical recovery and the dependent retest sequence have moved handover.",
    recoveryAction: "Protect the integrated-test window and run handover evidence reviews in parallel.",
    actionOwner: "Project manager",
    actionDueDate: "2026-06-21",
    decisionRequired: "Confirm priority access to the test area for the protected recovery window.",
    updatedAt: "2026-06-14T17:10:00Z",
    commentary: "Current forecast reflects mechanical recovery and retest.",
  },
];

const riskSeeds = [
  ["Panel FAT defects delay energisation", "WP400", 4, 4, "breached"],
  ["Mechanical alignment exceeds tolerance", "WP300", 3, 5, "watch"],
  ["Integrated test scripts are incomplete", "WP500", 3, 4, "watch"],
  ["Legacy supply isolation is undocumented", "WP100", 2, 5, "clear"],
  ["Structural interface survey is inaccurate", "WP200", 2, 4, "clear"],
  ["Sensor delivery misses installation window", "WP400", 3, 3, "watch"],
  ["Operator availability limits acceptance tests", "WP500", 2, 4, "clear"],
  ["Temporary works inspection is delayed", "WP200", 2, 3, "clear"],
  ["Control software configuration is incomplete", "WP400", 3, 4, "watch"],
  ["Lifting plan approval is late", "WP300", 2, 4, "clear"],
  ["Handover evidence is not indexed", "WP500", 2, 3, "clear"],
  ["Final spares list exceeds allowance", "WP300", 2, 2, "clear"],
] as const;

export const risks: Risk[] = riskSeeds.map(
  ([title, wbsId, probability, impact, triggerStatus], index) => {
    const score = probability * impact;
    const workPackage = workPackages.find((item) => item.id === wbsId);
    const objective = [
      "schedule",
      "safety-quality",
      "cost",
      "operational-readiness",
    ][index % 4] as NonNullable<Risk["objective"]>;
    const inherentProbability = Math.min(5, probability + 1);
    const inherentImpact = Math.min(5, impact + (index % 2));
    const inherentScore = inherentProbability * inherentImpact;
    const previousResidualProbability =
      index % 3 === 0
        ? Math.max(1, probability - 1)
        : index % 3 === 2
          ? Math.min(5, probability + 1)
          : probability;
    const aboveTolerance = score > riskToleranceForObjective(objective);
    const accepted = aboveTolerance && index % 2 === 1;

    return {
      id: "R-" + String(index + 1).padStart(3, "0"),
      title,
      owner: workPackage?.owner ?? "Project manager",
      wbsId,
      category: index % 2 === 0 ? "Delivery" : "Technical",
      status: index === riskSeeds.length - 1 ? "closed" : "active",
      objective,
      condition: "Current delivery evidence shows uncertainty against the approved control plan.",
      event: `${title} may occur before the next reporting review.`,
      consequence: "The affected work package could miss its authorised cost, schedule or readiness objective.",
      inherentProbability,
      inherentImpact,
      inherentScore,
      inherentRating: riskRating(inherentScore),
      previousResidualProbability,
      previousResidualImpact: impact,
      residualProbability: probability,
      residualImpact: impact,
      residualScore: score,
      rating: riskRating(score),
      treatment:
        index < 3
          ? "Complete targeted review and track evidence at the daily coordination meeting."
          : "Monitor trigger and complete the assigned preventive action.",
      treatmentDue: isoDate(addDays(new Date("2026-06-14T12:00:00Z"), index - 2)),
      reviewDate: isoDate(addDays(new Date("2026-06-14T12:00:00Z"), index - 1)),
      triggerDescription: "The named evidence is not available by the weekly control cut-off.",
      triggerStatus,
      controlDescription: "The accountable owner reviews dated evidence at the weekly controls meeting.",
      controlOwner: workPackage?.owner ?? "Project manager",
      controlEvidence: `RISK-CONTROL-${String(index + 1).padStart(3, "0")}`,
      controlTestDate: "2026-06-13",
      controlEffectiveness:
        index === 0
          ? "ineffective"
          : index < 4
            ? "partly-effective"
            : "effective",
      disposition: aboveTolerance
        ? accepted
          ? "accepted"
          : "escalated"
        : "within-tolerance",
      ...(aboveTolerance && !accepted
        ? {
            escalationOwner: "Project director",
            escalationDate: "2026-06-14",
          }
        : {}),
      ...(accepted
        ? {
            acceptanceAuthority: "Project director",
            acceptanceRationale:
              "Exposure is time-bounded and the treatment is funded and monitored weekly.",
            acceptanceReviewDate: "2026-06-21",
          }
        : {}),
    };
  },
);

export const changes: ChangeRequest[] = [
  {
    id: "CR-001",
    title: "Add panel ventilation monitoring",
    wbsId: "WP400",
    status: "approved",
    costImpact: 32_000,
    scheduleImpactDays: 2,
    decisionDue: "2026-06-11",
  },
  {
    id: "CR-002",
    title: "Revise guarding support detail",
    wbsId: "WP300",
    status: "implemented",
    costImpact: 18_000,
    scheduleImpactDays: 1,
    decisionDue: "2026-05-29",
    incorporatedBaselineVersion: "B1",
  },
  {
    id: "CR-003",
    title: "Extend operator training scope",
    wbsId: "WP500",
    status: "submitted",
    costImpact: 24_000,
    scheduleImpactDays: 0,
    decisionDue: "2026-06-18",
  },
  {
    id: "CR-004",
    title: "Replace legacy local isolators",
    wbsId: "WP400",
    status: "approved",
    costImpact: 45_000,
    scheduleImpactDays: 3,
    decisionDue: "2026-06-10",
  },
  {
    id: "CR-005",
    title: "Change depot floor coating",
    wbsId: "WP200",
    status: "rejected",
    costImpact: 16_000,
    scheduleImpactDays: 4,
    decisionDue: "2026-05-20",
  },
  {
    id: "CR-006",
    title: "Add remote diagnostic display",
    wbsId: "WP400",
    status: "submitted",
    costImpact: 52_000,
    scheduleImpactDays: 5,
    decisionDue: "2026-06-20",
  },
];

export const demoSnapshot: DemoSnapshot = {
  project: {
    id: "ASTER",
    name: "Aster Depot Automation Upgrade",
    description:
      "Synthetic depot upgrade covering structural, mechanical, electrical, controls, testing and handover work.",
    originalBac: 2_400_000,
    baselineVersion: "B0",
    reportingDate: "2026-06-14",
    baselineFinish: "2026-07-26",
    forecastFinish: "2026-08-03",
    lastImportAt: "2026-06-14T17:10:00Z",
    importId: "IMP-DEMO-W10",
    schemaVersion: "1.0.0",
  },
  trend,
  workPackages,
  activities: createActivities(),
  milestones,
  risks,
  changes,
};

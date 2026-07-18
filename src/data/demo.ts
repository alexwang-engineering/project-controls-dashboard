import { addDays, formatISO } from "date-fns";
import type {
  Activity,
  ChangeRequest,
  DemoSnapshot,
  Milestone,
  Risk,
  RiskRating,
  TrendPoint,
  WorkPackageSnapshot,
} from "../domain/types";

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

function createActivities(): Activity[] {
  return workPackages.flatMap((workPackage, packageIndex) => {
    const standardBudget = Math.floor(workPackage.bac / 12);

    return Array.from({ length: 12 }, (_, activityIndex) => {
      const sequence = packageIndex * 12 + activityIndex + 1;
      const start = addDays(projectStart, packageIndex * 14 + activityIndex * 4);
      const finish = addDays(start, 3);
      const predecessorId =
        sequence === 1
          ? undefined
          : "A-" + String(sequence - 1).padStart(3, "0");

      return {
        id: "A-" + String(sequence).padStart(3, "0"),
        wbsId: workPackage.id,
        name: workPackage.name + " activity " + String(activityIndex + 1),
        owner: workPackage.owner,
        baselineStart: isoDate(start),
        baselineFinish: isoDate(finish),
        forecastStart: isoDate(
          addDays(start, packageIndex >= 2 && activityIndex >= 5 ? 2 : 0),
        ),
        forecastFinish: isoDate(
          addDays(finish, packageIndex >= 2 && activityIndex >= 5 ? 4 : 0),
        ),
        predecessorIds: predecessorId ? [predecessorId] : [],
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
    name: "Structural works complete",
    wbsId: "WP200",
    owner: "Civil lead",
    baselineDate: "2026-05-24",
    previousForecastDate: "2026-05-27",
    forecastDate: "2026-05-28",
    actualDate: "2026-05-28",
    status: "complete-late",
    commentary: "Access and survey rework moved completion by four days.",
  },
  {
    id: "MS-004",
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
    name: "Mechanical completion",
    wbsId: "WP300",
    owner: "Mechanical lead",
    baselineDate: "2026-06-21",
    previousForecastDate: "2026-06-25",
    forecastDate: "2026-06-28",
    status: "forecast-late",
    commentary: "Recovery shift proposed for alignment and guarding work.",
  },
  {
    id: "MS-006",
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
    name: "Operational handover",
    wbsId: "WP500",
    owner: "Project manager",
    baselineDate: "2026-07-26",
    previousForecastDate: "2026-07-30",
    forecastDate: "2026-08-03",
    status: "forecast-late",
    commentary: "Current forecast reflects mechanical recovery and retest.",
  },
];

const riskRating = (score: number): RiskRating => {
  if (score >= 15) return "critical";
  if (score >= 10) return "high";
  if (score >= 5) return "moderate";
  return "low";
};

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

    return {
      id: "R-" + String(index + 1).padStart(3, "0"),
      title,
      owner: workPackage?.owner ?? "Project manager",
      wbsId,
      category: index % 2 === 0 ? "Delivery" : "Technical",
      residualProbability: probability,
      residualImpact: impact,
      residualScore: score,
      rating: riskRating(score),
      treatment:
        index < 3
          ? "Complete targeted review and track evidence at the daily coordination meeting."
          : "Monitor trigger and complete the assigned preventive action.",
      treatmentDue: isoDate(addDays(new Date("2026-06-14T12:00:00Z"), index - 2)),
      triggerStatus,
      controlEffectiveness:
        index === 0
          ? "ineffective"
          : index < 4
            ? "partly-effective"
            : "effective",
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

import { demoSnapshot, milestoneActivityIds } from "../../data/demo";
import { encodeCsv } from "../../utils/safeCsvExport";

export interface SyntheticImportFiles {
  schedule: File;
  performance: File;
}

const scheduleHeaders = [
  "project_id",
  "baseline_version",
  "activity_id",
  "wbs_id",
  "activity_name",
  "owner",
  "baseline_start",
  "baseline_finish",
  "forecast_start",
  "forecast_finish",
  "actual_start",
  "actual_finish",
  "predecessor_links",
  "calendar_id",
  "constraint_type",
  "constraint_date",
  "is_milestone",
  "baseline_budget",
  "progress_method",
  "commentary",
] as const;

const performanceHeaders = [
  "project_id",
  "baseline_version",
  "period_end",
  "activity_id",
  "pv_period",
  "ev_period",
  "ac_period",
  "physical_percent_complete",
  "remaining_cost_forecast",
  "progress_commentary",
] as const;

const milestoneByActivity = new Map<
  string,
  (typeof demoSnapshot.milestones)[number]
>();
milestoneActivityIds.forEach((activityId, index) => {
  const milestone = demoSnapshot.milestones[index];
  if (milestone !== undefined) milestoneByActivity.set(activityId, milestone);
});

const weeklyPeriods = () => {
  const reportingDate = new Date(
    demoSnapshot.project.reportingDate + "T00:00:00Z",
  );
  return Array.from({ length: 16 }, (_, index) => {
    const date = new Date(reportingDate);
    date.setUTCDate(date.getUTCDate() - (15 - index) * 7);
    return date.toISOString().slice(0, 10);
  });
};

const allocateInteger = (total: number, weights: readonly number[]) => {
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  let allocated = 0;
  return weights.map((weight, index) => {
    if (index === weights.length - 1) return total - allocated;
    const value = Math.floor((total * weight) / weightTotal);
    allocated += value;
    return value;
  });
};

const scheduleRows = () =>
  demoSnapshot.activities.map((activity, index) => {
    const milestone = milestoneByActivity.get(activity.id);
    const predecessor =
      index === 0
        ? ""
        : `${demoSnapshot.activities[index - 1]?.id ?? ""}|FS|0`;
    const baselineStart = milestone?.baselineDate ?? activity.baselineStart;
    const baselineFinish = milestone?.baselineDate ?? activity.baselineFinish;
    const forecastStart = milestone?.forecastDate ?? activity.forecastStart;
    const forecastFinish = milestone?.forecastDate ?? activity.forecastFinish;
    const actualDate =
      milestone?.actualDate !== undefined &&
      milestone.actualDate <= demoSnapshot.project.reportingDate
        ? milestone.actualDate
        : "";

    return [
      demoSnapshot.project.id,
      demoSnapshot.project.baselineVersion,
      activity.id,
      activity.wbsId,
      milestone?.name ?? activity.name,
      milestone?.owner ?? activity.owner,
      baselineStart,
      baselineFinish,
      forecastStart,
      forecastFinish,
      actualDate,
      actualDate,
      predecessor,
      "CAL-5D",
      "none",
      "",
      milestone === undefined ? "false" : "true",
      String(activity.baselineBudget),
      activity.progressMethod,
      milestone?.commentary ??
        "Synthetic planning activity in the complete ASTER demonstration pack.",
    ];
  });

const performanceRows = () => {
  const periods = weeklyPeriods();
  const periodWeights = [0, 0, 0, 0, 0, 0, 8, 8, 10, 10, 12, 12, 10, 10, 10, 10];
  const rows: string[][] = [];

  for (const workPackage of demoSnapshot.workPackages) {
    const activities = demoSnapshot.activities.filter(
      (activity) => activity.wbsId === workPackage.id,
    );
    const budgets = activities.map((activity) => activity.baselineBudget);
    const finalPv = allocateInteger(workPackage.pv, budgets);
    const finalEv = allocateInteger(workPackage.ev, budgets);
    const finalAc = allocateInteger(workPackage.ac, budgets);

    activities.forEach((activity, activityIndex) => {
      const pvByPeriod = allocateInteger(finalPv[activityIndex] ?? 0, periodWeights);
      const evByPeriod = allocateInteger(finalEv[activityIndex] ?? 0, periodWeights);
      const acByPeriod = allocateInteger(finalAc[activityIndex] ?? 0, periodWeights);
      let cumulativeEv = 0;

      periods.forEach((period, periodIndex) => {
        cumulativeEv += evByPeriod[periodIndex] ?? 0;
        const physicalPercent = Math.min(
          100,
          (cumulativeEv / activity.baselineBudget) * 100,
        );
        rows.push([
          demoSnapshot.project.id,
          demoSnapshot.project.baselineVersion,
          period,
          activity.id,
          String(pvByPeriod[periodIndex] ?? 0),
          String(evByPeriod[periodIndex] ?? 0),
          String(acByPeriod[periodIndex] ?? 0),
          physicalPercent.toFixed(2).replace(/\.00$/, ""),
          periodIndex === periods.length - 1
            ? String(Math.max(0, activity.baselineBudget - cumulativeEv))
            : "",
          periodIndex === periods.length - 1
            ? "Synthetic Week 16 status aligned to the fixed management position."
            : "Synthetic weekly period.",
        ]);
      });
    });
  }

  return rows;
};

export function createSyntheticImportFiles(): SyntheticImportFiles {
  return {
    schedule: new File(
      [encodeCsv([scheduleHeaders, ...scheduleRows()])],
      "aster-schedule-60.csv",
      { type: "text/csv;charset=utf-8" },
    ),
    performance: new File(
      [encodeCsv([performanceHeaders, ...performanceRows()])],
      "aster-performance-16-periods.csv",
      { type: "text/csv;charset=utf-8" },
    ),
  };
}

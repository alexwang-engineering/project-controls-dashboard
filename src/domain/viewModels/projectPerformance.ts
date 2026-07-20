import type { NormalisedActivity, PerformanceRecord } from "../records";
import type { TrendPoint, WorkPackageSnapshot } from "../types";
import type { ActiveDataset } from "../../repositories/datasetRepository";
import { demoSnapshot } from "../../data/demo";
import type { BaselineGenerationSnapshot } from "../baselineReconciliation";

const penceToPounds = (value: number) => value / 100;

export interface PerformanceActivity {
  id: string;
  wbsId: string;
  name: string;
  owner: string;
  bac: number;
  baselineFinish: string;
  forecastFinish: string;
  actualFinish?: string;
  commentary: string;
}

export interface PeriodicPerformance {
  period: string;
  label: string;
  pv: number;
  ev: number;
  ac: number;
}

export interface ProjectPerformanceSnapshot {
  source: "active-import" | "synthetic-fallback";
  importId: string;
  importedAt: string;
  project: {
    id: string;
    name: string;
    reportingDate: string;
    baselineVersion: string;
    originalBac: number;
    baselineFinish: string;
    forecastFinish: string;
  };
  workPackages: readonly WorkPackageSnapshot[];
  trend: readonly TrendPoint[];
  periods: readonly PeriodicPerformance[];
  activities: readonly PerformanceActivity[];
  performance: readonly PerformanceRecord[];
  baselineSnapshots?: readonly BaselineGenerationSnapshot[];
}

const maximumDate = (values: readonly string[]) =>
  values.reduce((latest, candidate) =>
    candidate > latest ? candidate : latest,
  );

const projectDisplayName = (projectId: string) =>
  projectId === demoSnapshot.project.id
    ? demoSnapshot.project.name
    : `Project ${projectId}`;

const recordsForActivities = (
  records: readonly PerformanceRecord[],
  activities: readonly NormalisedActivity[],
) => {
  const activityIds = new Set(activities.map((activity) => activity.activityId));
  return records.filter((record) => activityIds.has(record.activityId));
};

const totalPence = (
  records: readonly PerformanceRecord[],
  field: "pvPeriod" | "evPeriod" | "acPeriod",
) => records.reduce((total, record) => total + record[field], 0);

export function buildImportedPerformanceSnapshot(
  dataset: ActiveDataset,
): ProjectPerformanceSnapshot {
  if (dataset.activities.length === 0 || dataset.performance.length === 0) {
    throw new Error("The active generation has no accepted performance data.");
  }

  const activityGroups = new Map<string, NormalisedActivity[]>();
  for (const activity of dataset.activities) {
    const group = activityGroups.get(activity.wbsId) ?? [];
    group.push(activity);
    activityGroups.set(activity.wbsId, group);
  }

  const workPackages = [...activityGroups.entries()]
    .map(([id, activities]): WorkPackageSnapshot => {
      const records = recordsForActivities(dataset.performance, activities);
      const owners = [...new Set(activities.map((activity) => activity.owner))];
      return {
        id,
        name:
          activities.length === 1
            ? activities[0]!.activityName
            : `Work package ${id}`,
        owner: owners.length === 1 ? owners[0]! : "Multiple owners",
        bac: penceToPounds(
          activities.reduce(
            (total, activity) => total + activity.baselineBudget,
            0,
          ),
        ),
        pv: penceToPounds(totalPence(records, "pvPeriod")),
        ev: penceToPounds(totalPence(records, "evPeriod")),
        ac: penceToPounds(totalPence(records, "acPeriod")),
        forecastFinish: maximumDate(
          activities.map((activity) => activity.forecastFinish),
        ),
      };
    })
    .sort((left, right) => left.id.localeCompare(right.id));

  const periodicByDate = new Map<string, { pv: number; ev: number; ac: number }>();
  for (const record of dataset.performance) {
    const totals = periodicByDate.get(record.periodEnd) ?? { pv: 0, ev: 0, ac: 0 };
    totals.pv += penceToPounds(record.pvPeriod);
    totals.ev += penceToPounds(record.evPeriod);
    totals.ac += penceToPounds(record.acPeriod);
    periodicByDate.set(record.periodEnd, totals);
  }

  const periods = [...periodicByDate.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([period, totals], index) => ({
      period,
      label: `P${index + 1}`,
      ...totals,
    }));
  let cumulativePv = 0;
  let cumulativeEv = 0;
  let cumulativeAc = 0;
  const trend = periods.map((period) => {
    cumulativePv += period.pv;
    cumulativeEv += period.ev;
    cumulativeAc += period.ac;
    return {
      period: period.period,
      label: period.label,
      pv: cumulativePv,
      ev: cumulativeEv,
      ac: cumulativeAc,
    };
  });

  const activities = dataset.activities
    .map(
      (activity): PerformanceActivity => ({
        id: activity.activityId,
        wbsId: activity.wbsId,
        name: activity.activityName,
        owner: activity.owner,
        bac: penceToPounds(activity.baselineBudget),
        baselineFinish: activity.baselineFinish,
        forecastFinish: activity.forecastFinish,
        actualFinish: activity.actualFinish,
        commentary: activity.commentary,
      }),
    )
    .sort((left, right) => left.id.localeCompare(right.id));

  const originalBac = workPackages.reduce(
    (total, workPackage) => total + workPackage.bac,
    0,
  );

  return {
    source: "active-import",
    importId: dataset.importId,
    importedAt: dataset.manifest.importedAt,
    project: {
      id: dataset.manifest.projectId,
      name: projectDisplayName(dataset.manifest.projectId),
      reportingDate: dataset.manifest.dataDate,
      baselineVersion: dataset.manifest.baselineVersion,
      originalBac,
      baselineFinish: maximumDate(
        dataset.activities.map((activity) => activity.baselineFinish),
      ),
      forecastFinish: maximumDate(
        dataset.activities.map((activity) => activity.forecastFinish),
      ),
    },
    workPackages,
    trend,
    periods,
    activities,
    performance: dataset.performance,
    baselineSnapshots: dataset.baselineSnapshots,
  };
}

export function buildSyntheticPerformanceSnapshot(): ProjectPerformanceSnapshot {
  const periods = demoSnapshot.trend.map((point, index, trend) => ({
    period: point.period,
    label: point.label,
    pv: point.pv - (trend[index - 1]?.pv ?? 0),
    ev: point.ev - (trend[index - 1]?.ev ?? 0),
    ac: point.ac - (trend[index - 1]?.ac ?? 0),
  }));

  return {
    source: "synthetic-fallback",
    importId: demoSnapshot.project.importId,
    importedAt: demoSnapshot.project.lastImportAt,
    project: {
      id: demoSnapshot.project.id,
      name: demoSnapshot.project.name,
      reportingDate: demoSnapshot.project.reportingDate,
      baselineVersion: demoSnapshot.project.baselineVersion,
      originalBac: demoSnapshot.project.originalBac,
      baselineFinish: demoSnapshot.project.baselineFinish,
      forecastFinish: demoSnapshot.project.forecastFinish,
    },
    workPackages: demoSnapshot.workPackages,
    trend: demoSnapshot.trend,
    periods,
    activities: demoSnapshot.activities.map((activity) => ({
      id: activity.id,
      wbsId: activity.wbsId,
      name: activity.name,
      owner: activity.owner,
      bac: activity.baselineBudget,
      baselineFinish: activity.baselineFinish,
      forecastFinish: activity.forecastFinish,
      commentary: "Synthetic planning activity; import a performance pair for source-period trace.",
    })),
    performance: [],
    baselineSnapshots: [],
  };
}

export function activityPerformanceAtPeriod(
  snapshot: ProjectPerformanceSnapshot,
  activityId: string,
  period: string,
) {
  const records = snapshot.performance.filter(
    (record) => record.activityId === activityId && record.periodEnd <= period,
  );
  const latest = [...records].sort((left, right) =>
    right.periodEnd.localeCompare(left.periodEnd),
  )[0];
  return {
    pv: penceToPounds(totalPence(records, "pvPeriod")),
    ev: penceToPounds(totalPence(records, "evPeriod")),
    ac: penceToPounds(totalPence(records, "acPeriod")),
    physicalPercentComplete: latest?.physicalPercentComplete,
    commentary: latest?.progressCommentary,
  };
}

export function periodicPerformanceForScope(
  snapshot: ProjectPerformanceSnapshot,
  workPackageId: string,
): PeriodicPerformance[] {
  if (snapshot.performance.length === 0) {
    if (workPackageId === "all") return [...snapshot.periods];
    const workPackage = snapshot.workPackages.find(
      (candidate) => candidate.id === workPackageId,
    );
    return workPackage
      ? [
          {
            period: snapshot.project.reportingDate,
            label: "Status",
            pv: workPackage.pv,
            ev: workPackage.ev,
            ac: workPackage.ac,
          },
        ]
      : [];
  }

  const scopedActivityIds = new Set(
    snapshot.activities
      .filter(
        (activity) =>
          workPackageId === "all" || activity.wbsId === workPackageId,
      )
      .map((activity) => activity.id),
  );
  const totalsByDate = new Map<string, { pv: number; ev: number; ac: number }>();
  for (const record of snapshot.performance) {
    if (!scopedActivityIds.has(record.activityId)) continue;
    const totals = totalsByDate.get(record.periodEnd) ?? { pv: 0, ev: 0, ac: 0 };
    totals.pv += penceToPounds(record.pvPeriod);
    totals.ev += penceToPounds(record.evPeriod);
    totals.ac += penceToPounds(record.acPeriod);
    totalsByDate.set(record.periodEnd, totals);
  }

  return [...totalsByDate.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([period, totals], index) => ({
      period,
      label: `P${index + 1}`,
      ...totals,
    }));
}

export function resolveWorkPackageScope(
  snapshot: ProjectPerformanceSnapshot,
  requestedScope: string,
): string {
  return requestedScope !== "all" &&
    snapshot.workPackages.some(({ id }) => id === requestedScope)
    ? requestedScope
    : "all";
}

export function cumulativePerformanceForScope(
  snapshot: ProjectPerformanceSnapshot,
  requestedScope: string,
): TrendPoint[] {
  const scope = resolveWorkPackageScope(snapshot, requestedScope);
  if (scope === "all") return [...snapshot.trend];

  let pv = 0;
  let ev = 0;
  let ac = 0;
  return periodicPerformanceForScope(snapshot, scope).map((period) => {
    pv += period.pv;
    ev += period.ev;
    ac += period.ac;
    return {
      period: period.period,
      label: period.label,
      pv,
      ev,
      ac,
    };
  });
}

export const findActivity = (
  dataset: ActiveDataset,
  activityId: string,
) => dataset.activities.find((activity) => activity.activityId === activityId);

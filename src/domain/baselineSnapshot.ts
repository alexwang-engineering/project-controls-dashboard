import type { ImportManifestDraft } from "../schemas/manifest";
import type {
  NormalisedActivity,
  PerformanceRecord,
} from "./records";
import type { BaselineGenerationSnapshot } from "./baselineReconciliation";

export interface StoredBaselinePerformancePeriod {
  periodEnd: string;
  pvPence: number;
  evPence: number;
  acPence: number;
}

export interface StoredBaselineSnapshot {
  importId: string;
  projectId: string;
  baselineVersion: string;
  importedAt: string;
  dataDate: string;
  bacPence: number;
  baselineFinish: string;
  definitionSignature: string;
  periods: readonly StoredBaselinePerformancePeriod[];
}

interface SnapshotSource {
  manifest: Pick<
    ImportManifestDraft,
    | "importId"
    | "projectId"
    | "baselineVersion"
    | "importedAt"
    | "dataDate"
  >;
  activities: readonly NormalisedActivity[];
  performance: readonly PerformanceRecord[];
}

export function buildStoredBaselineSnapshot(
  source: SnapshotSource,
): StoredBaselineSnapshot {
  if (source.activities.length === 0) {
    throw new Error("A baseline snapshot requires schedule activities.");
  }
  const definition = [...source.activities]
    .sort((left, right) => left.activityId.localeCompare(right.activityId))
    .map((activity) => ({
      activityId: activity.activityId,
      wbsId: activity.wbsId,
      baselineStart: activity.baselineStart,
      baselineFinish: activity.baselineFinish,
      baselineBudget: activity.baselineBudget,
      calendarId: activity.calendarId,
      constraintType: activity.constraintType,
      constraintDate: activity.constraintDate,
      isMilestone: activity.isMilestone,
      progressMethod: activity.progressMethod,
      predecessorLinks: [...activity.predecessorLinks]
        .map((link) => ({ ...link }))
        .sort((left, right) =>
          `${left.activityId}|${left.type}|${String(left.lagDays)}`.localeCompare(
            `${right.activityId}|${right.type}|${String(right.lagDays)}`,
          ),
        ),
    }));
  const totalsByPeriod = new Map<
    string,
    { pvPence: number; evPence: number; acPence: number }
  >();
  for (const record of source.performance) {
    const totals = totalsByPeriod.get(record.periodEnd) ?? {
      pvPence: 0,
      evPence: 0,
      acPence: 0,
    };
    totals.pvPence += record.pvPeriod;
    totals.evPence += record.evPeriod;
    totals.acPence += record.acPeriod;
    totalsByPeriod.set(record.periodEnd, totals);
  }

  return {
    importId: source.manifest.importId,
    projectId: source.manifest.projectId,
    baselineVersion: source.manifest.baselineVersion,
    importedAt: source.manifest.importedAt,
    dataDate: source.manifest.dataDate,
    bacPence: source.activities.reduce(
      (total, activity) => total + activity.baselineBudget,
      0,
    ),
    baselineFinish: source.activities.reduce(
      (latest, activity) =>
        activity.baselineFinish > latest ? activity.baselineFinish : latest,
      source.activities[0]!.baselineFinish,
    ),
    definitionSignature: JSON.stringify(definition),
    periods: [...totalsByPeriod.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([periodEnd, totals]) => ({ periodEnd, ...totals })),
  };
}

const penceToPounds = (value: number) => value / 100;

export const toBaselineGenerationSnapshot = (
  stored: StoredBaselineSnapshot,
): BaselineGenerationSnapshot => ({
  importId: stored.importId,
  projectId: stored.projectId,
  baselineVersion: stored.baselineVersion,
  importedAt: stored.importedAt,
  dataDate: stored.dataDate,
  bac: penceToPounds(stored.bacPence),
  baselineFinish: stored.baselineFinish,
  periods: stored.periods.map((period) => ({
    period: period.periodEnd,
    pv: penceToPounds(period.pvPence),
    ev: penceToPounds(period.evPence),
    ac: penceToPounds(period.acPence),
  })),
});

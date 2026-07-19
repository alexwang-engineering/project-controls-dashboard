import { addDays, differenceInCalendarDays, formatISO, parseISO } from "date-fns";
import { calculateEarnedValue, type EarnedValueResult } from "./calculations/earnedValue";
import type { ChangeRequest } from "./types";

export interface BaselinePerformancePeriod {
  period: string;
  pv: number;
  ev: number;
  ac: number;
}

export interface BaselineGenerationSnapshot {
  importId: string;
  projectId: string;
  baselineVersion: string;
  importedAt: string;
  dataDate: string;
  bac: number;
  baselineFinish: string;
  periods: readonly BaselinePerformancePeriod[];
}

export type BaselineControlCode =
  | "BASELINE_HISTORY_REQUIRED"
  | "BASELINE_COST_MISMATCH"
  | "BASELINE_SCHEDULE_MISMATCH"
  | "HISTORICAL_PERFORMANCE_REWRITTEN"
  | "INCORPORATED_BASELINE_NOT_ACTIVE"
  | "BASELINE_EFFECTIVE_DATE_PENDING";

export interface BaselineControl {
  code: BaselineControlCode;
  severity: "blocking";
  message: string;
  changeId?: string;
}

export interface BaselinePosition {
  period: string;
  metrics: EarnedValueResult;
}

export interface BaselineChangeComparison {
  changeId: string;
  fromVersion: string;
  toVersion: string;
  effectiveDate: string;
  historicalPerformancePreserved: boolean;
  preChange: BaselinePosition;
  postChange: BaselinePosition;
}

export interface BaselineReconciliation {
  available: boolean;
  original?: { version: string; bac: number; baselineFinish: string; importId: string };
  active?: { version: string; bac: number; baselineFinish: string; importId: string };
  incorporated: { costImpact: number; scheduleImpactDays: number; changeIds: readonly string[] };
  approvedNotIncorporated: { costImpact: number; scheduleImpactDays: number; changeIds: readonly string[] };
  cost?: { expected: number; actual: number; variance: number; reconciles: boolean };
  schedule?: {
    expectedFinish: string;
    actualFinish: string;
    varianceDays: number;
    reconciles: boolean;
  };
  effectiveChangeIds: readonly string[];
  changeComparisons: readonly BaselineChangeComparison[];
  controls: readonly BaselineControl[];
}

export interface BuildBaselineReconciliationInput {
  projectId: string;
  activeImportId: string;
  reportingDate: string;
  snapshots: readonly BaselineGenerationSnapshot[];
  changes: readonly ChangeRequest[];
}

const sumChanges = (changes: readonly ChangeRequest[]) => ({
  costImpact: changes.reduce((total, change) => total + change.costImpact, 0),
  scheduleImpactDays: changes.reduce(
    (total, change) => total + change.scheduleImpactDays,
    0,
  ),
  changeIds: changes.map(({ id }) => id).sort(),
});

const periodTotals = (
  periods: readonly BaselinePerformancePeriod[],
  include: (period: string) => boolean,
) =>
  periods.reduce(
    (totals, period) =>
      include(period.period)
        ? {
            pv: totals.pv + period.pv,
            ev: totals.ev + period.ev,
            ac: totals.ac + period.ac,
          }
        : totals,
    { pv: 0, ev: 0, ac: 0 },
  );

const position = (
  snapshot: BaselineGenerationSnapshot,
  period: string,
  include: (candidate: string) => boolean,
): BaselinePosition => ({
  period,
  metrics: calculateEarnedValue({
    bac: snapshot.bac,
    ...periodTotals(snapshot.periods, include),
  }),
});

const periodSignature = (
  periods: readonly BaselinePerformancePeriod[],
  effectiveDate: string,
) =>
  JSON.stringify(
    periods
      .filter(({ period }) => period < effectiveDate)
      .map(({ period, pv, ev, ac }) => ({ period, pv, ev, ac }))
      .sort((left, right) => left.period.localeCompare(right.period)),
  );

const dateAfterDays = (date: string, days: number) =>
  formatISO(addDays(parseISO(date), days), { representation: "date" });

export function buildBaselineReconciliation(
  input: BuildBaselineReconciliationInput,
): BaselineReconciliation {
  const snapshots = input.snapshots
    .filter(({ projectId }) => projectId === input.projectId)
    .sort((left, right) =>
      left.importedAt === right.importedAt
        ? left.importId.localeCompare(right.importId)
        : left.importedAt.localeCompare(right.importedAt),
    );
  const active = snapshots.find(
    ({ importId }) => importId === input.activeImportId,
  );
  const implemented = input.changes.filter(
    (change): change is ChangeRequest & {
      effectiveDate: string;
      incorporatedBaselineVersion: string;
    } =>
      change.status === "implemented" &&
      change.effectiveDate !== undefined &&
      change.incorporatedBaselineVersion !== undefined,
  );
  const approved = input.changes.filter(({ status }) => status === "approved");
  const empty = sumChanges([]);

  if (active === undefined) {
    return {
      available: false,
      incorporated: empty,
      approvedNotIncorporated: sumChanges(approved),
      effectiveChangeIds: [],
      changeComparisons: [],
      controls: [
        {
          code: "BASELINE_HISTORY_REQUIRED",
          severity: "blocking",
          message: "The active generation has no retained baseline snapshot.",
        },
      ],
    };
  }

  const versionOrder = new Map<string, number>();
  for (const snapshot of snapshots) {
    if (!versionOrder.has(snapshot.baselineVersion)) {
      versionOrder.set(snapshot.baselineVersion, versionOrder.size);
    }
  }
  const activeVersionIndex = versionOrder.get(active.baselineVersion) ?? 0;
  const incorporated = implemented.filter((change) => {
    const index = versionOrder.get(change.incorporatedBaselineVersion);
    return index !== undefined && index <= activeVersionIndex;
  });
  const inactiveVersionChanges = implemented.filter(
    ({ incorporatedBaselineVersion }) => {
      const index = versionOrder.get(incorporatedBaselineVersion);
      return index === undefined || index > activeVersionIndex;
    },
  );
  const effective = incorporated.filter(
    ({ effectiveDate }) => effectiveDate <= input.reportingDate,
  );
  const futureEffective = incorporated.filter(
    ({ effectiveDate }) => effectiveDate > input.reportingDate,
  );
  const requiresHistory = implemented.length > 0 && snapshots.length < 2;
  const original = snapshots[0]!;
  const controls: BaselineControl[] = [];

  if (requiresHistory) {
    controls.push({
      code: "BASELINE_HISTORY_REQUIRED",
      severity: "blocking",
      message:
        "An implemented baseline revision requires its retained pre-change generation evidence.",
    });
  }
  for (const change of inactiveVersionChanges) {
    const retained = versionOrder.has(change.incorporatedBaselineVersion);
    controls.push({
      code: "INCORPORATED_BASELINE_NOT_ACTIVE",
      severity: "blocking",
      changeId: change.id,
      message: retained
        ? `${change.id} is incorporated in ${change.incorporatedBaselineVersion}, but the active pointer is still ${active.baselineVersion}.`
        : `${change.id} references baseline ${change.incorporatedBaselineVersion}, which is absent from retained import history.`,
    });
  }
  for (const change of futureEffective) {
    controls.push({
      code: "BASELINE_EFFECTIVE_DATE_PENDING",
      severity: "blocking",
      changeId: change.id,
      message: `${change.id} is incorporated in the active baseline but is not effective until ${change.effectiveDate}.`,
    });
  }

  const incorporatedTotals = sumChanges(incorporated);
  const expectedBac = original.bac + incorporatedTotals.costImpact;
  const costVariance = active.bac - expectedBac;
  const costReconciles = Math.abs(costVariance) < 0.005;
  if (!costReconciles) {
    controls.push({
      code: "BASELINE_COST_MISMATCH",
      severity: "blocking",
      message: `Active BAC differs from original BAC plus incorporated changes by ${String(costVariance)}.`,
    });
  }

  const expectedFinish = dateAfterDays(
    original.baselineFinish,
    incorporatedTotals.scheduleImpactDays,
  );
  const scheduleVariance = differenceInCalendarDays(
    parseISO(active.baselineFinish),
    parseISO(expectedFinish),
  );
  if (scheduleVariance !== 0) {
    controls.push({
      code: "BASELINE_SCHEDULE_MISMATCH",
      severity: "blocking",
      message: `Active baseline finish differs from the original finish plus incorporated calendar-day impacts by ${String(scheduleVariance)} days.`,
    });
  }

  const changeComparisons = effective.flatMap(
    (change): BaselineChangeComparison[] => {
      const firstTarget = snapshots.find(
        ({ baselineVersion }) =>
          baselineVersion === change.incorporatedBaselineVersion,
      );
      if (firstTarget === undefined) return [];
      const before = snapshots
        .filter(
          (snapshot) =>
            snapshot.importedAt < firstTarget.importedAt &&
            snapshot.baselineVersion !== firstTarget.baselineVersion,
        )
        .at(-1);
      if (before === undefined) return [];
      const historicalPerformancePreserved =
        periodSignature(before.periods, change.effectiveDate) ===
        periodSignature(active.periods, change.effectiveDate);
      if (!historicalPerformancePreserved) {
        controls.push({
          code: "HISTORICAL_PERFORMANCE_REWRITTEN",
          severity: "blocking",
          changeId: change.id,
          message: `${change.id} changes PV, EV or AC in a period before its effective date.`,
        });
      }
      return [
        {
          changeId: change.id,
          fromVersion: before.baselineVersion,
          toVersion: change.incorporatedBaselineVersion,
          effectiveDate: change.effectiveDate,
          historicalPerformancePreserved,
          preChange: position(
            before,
            change.effectiveDate,
            (period) => period < change.effectiveDate,
          ),
          postChange: position(
            active,
            input.reportingDate,
            (period) => period <= input.reportingDate,
          ),
        },
      ];
    },
  );

  return {
    available: !requiresHistory,
    original: {
      version: original.baselineVersion,
      bac: original.bac,
      baselineFinish: original.baselineFinish,
      importId: original.importId,
    },
    active: {
      version: active.baselineVersion,
      bac: active.bac,
      baselineFinish: active.baselineFinish,
      importId: active.importId,
    },
    incorporated: incorporatedTotals,
    approvedNotIncorporated: sumChanges(approved),
    cost: {
      expected: expectedBac,
      actual: active.bac,
      variance: costVariance,
      reconciles: costReconciles,
    },
    schedule: {
      expectedFinish,
      actualFinish: active.baselineFinish,
      varianceDays: scheduleVariance,
      reconciles: scheduleVariance === 0,
    },
    effectiveChangeIds: effective.map(({ id }) => id).sort(),
    changeComparisons,
    controls,
  };
}

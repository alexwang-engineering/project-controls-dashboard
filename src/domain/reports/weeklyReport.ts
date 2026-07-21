import { differenceInCalendarDays, parseISO } from "date-fns";
import type {
  ChangeRequest,
  Milestone,
  Risk,
  WorkPackageSnapshot,
} from "../types";
import { calculateEarnedValue, type EarnedValueResult } from "../calculations/earnedValue";
import {
  buildEacScenarios,
  type EacScenario,
  type EacScenarioId,
} from "../calculations/eacScenarios";
import {
  createVarianceAnalysisContext,
  varianceAnalysisRecordSchema,
  type VarianceAnalysisRecord,
  type VarianceMetric,
} from "../varianceAnalysis";
import { missingChangeControlFields } from "../changes";
import {
  buildMilestoneDependencyTrace,
  isAdverseMilestoneStatus,
  milestoneStatusAt,
  missingMilestoneRecoveryFields,
} from "../milestones";
import { riskExceptionFlags, riskExposure } from "../risks";
import {
  buildBaselineReconciliation,
  type BaselineChangeComparison,
  type BaselineControlCode,
  type BaselineGenerationSnapshot,
} from "../baselineReconciliation";
import {
  periodicPerformanceForScope,
  type ProjectPerformanceSnapshot,
} from "../viewModels/projectPerformance";
import type { RiskAppetiteThresholds } from "../riskAppetite";
import { defaultRiskAppetite } from "../riskAppetite";

export type ReportControlCode =
  | "ACTIVE_IMPORT_REQUIRED"
  | "PERFORMANCE_DATA_MISSING"
  | "VARIANCE_ANALYSIS_REQUIRED"
  | "VARIANCE_ANALYSIS_STALE"
  | "BASELINE_VERSION_MISMATCH"
  | "DECISION_AUTHORITY_REQUIRED"
  | "CHANGE_RECORD_INCOMPLETE"
  | "MILESTONE_RECOVERY_REQUIRED"
  | "MILESTONE_LOGIC_UNRESOLVED"
  | "MILESTONE_REGISTER_INCOMPLETE"
  | BaselineControlCode;

export interface ReportControl {
  code: ReportControlCode;
  severity: "blocking" | "warning";
  message: string;
  scopeId?: string;
}

export interface ReportPerformancePosition {
  period: string;
  label: string;
  metrics: EarnedValueResult;
}

export interface ReportVarianceException {
  scopeId: string;
  scopeName: string;
  accountableOwner: string;
  breachedMetrics: readonly VarianceMetric[];
  metrics: EarnedValueResult;
  selectedScenario: EacScenarioId;
  analysisStatus: "required" | "stale" | "signed";
  signedRevision?: number;
  signedAt?: string;
  rootCause?: string;
  impact?: string;
  correctiveAction?: string;
  owner?: string;
  dueDate?: string;
  expectedRecoveryPeriod?: string;
  recoveryEvidence?: string;
  workflowStatus?: "open" | "monitoring" | "closed";
}

export interface WeeklyReportSnapshot {
  identity: {
    projectId: string;
    projectName: string;
    reportingPeriod: string;
    baselineVersion: string;
    generatedAt: string;
    sourceImportId: string;
  };
  headline: string;
  movement: string;
  executiveSummary: string;
  currentPeriod: ReportPerformancePosition;
  cumulative: ReportPerformancePosition;
  forecast: {
    scenarios: readonly EacScenario[];
    selectedScenario: EacScenarioId;
    selectedEac: number;
    minimumEac: number;
    maximumEac: number;
  };
  varianceExceptions: readonly ReportVarianceException[];
  milestoneExceptions: ReadonlyArray<{
    id: string;
    name: string;
    owner: string;
    baselineDate: string;
    previousForecastDate: string;
    forecastDate: string;
    actualDate?: string;
    outcomeDate: string;
    varianceDays: number;
    movementDays: number;
    status: Milestone["status"];
    dependencyQuality: "credible" | "warning" | "unresolved" | "unlinked";
    dependencyIssues: readonly string[];
    cause?: string;
    recoveryAction?: string;
    actionOwner?: string;
    actionDueDate?: string;
    decisionRequired?: string;
    commentary: string;
  }>;
  topRisks: readonly Risk[];
  changeDecisions: ReadonlyArray<{
    id: string;
    title: string;
    requiredBy: string;
    decisionOwner: string | null;
    costImpact: number;
    scheduleImpactDays: number;
  }>;
  actions: ReadonlyArray<{
    scopeId: string;
    action: string;
    owner: string;
    dueDate: string;
    status: "open" | "monitoring" | "closed";
    evidence: string;
  }>;
  baseline: {
    originalVersion: string | null;
    originalBac: number | null;
    activeVersion: string;
    activeBac: number;
    approvedNotIncorporated: number;
    incorporatedInActiveBaseline: number;
    otherBaselineVersions: readonly string[];
    expectedActiveBac: number | null;
    reconciliationVariance: number | null;
    expectedBaselineFinish: string | null;
    activeBaselineFinish: string;
    scheduleVarianceDays: number | null;
    historicalPerformancePreserved: boolean;
    effectiveChangeIds: readonly string[];
    changeComparisons: readonly BaselineChangeComparison[];
  };
  controls: readonly ReportControl[];
  canPublish: boolean;
  sourceNotes: readonly string[];
}

export interface BuildWeeklyReportInput {
  performance: ProjectPerformanceSnapshot;
  signedAnalyses: readonly VarianceAnalysisRecord[];
  milestones: readonly Milestone[];
  risks: readonly Risk[];
  changes: readonly ChangeRequest[];
  generatedAt: string;
  registerSource?: string;
  riskAppetite?: RiskAppetiteThresholds;
}

interface ScopePosition {
  scopeId: string;
  scopeName: string;
  accountableOwner: string;
  bac: number;
  current: ReportPerformancePosition;
  cumulative: ReportPerformancePosition;
}

const currency = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

const formatIndex = (value: number | null) =>
  value === null ? "not available" : value.toFixed(3);

const sourceImportId = (performance: ProjectPerformanceSnapshot) =>
  performance.source === "active-import"
    ? performance.importId
    : `SYNTHETIC-${performance.importId}`;

const preferredScenario = (metrics: EarnedValueResult): EacScenarioId =>
  metrics.eacCpi === null ? "budget-rate" : "cpi";

const metricsForScenario = (
  base: EarnedValueResult,
  scenarioId: EacScenarioId,
) => {
  const scenarios = buildEacScenarios(base);
  const requested = scenarios.find(({ id }) => id === scenarioId);
  const fallback = scenarios.find(({ id }) => id === "budget-rate");
  const selected = requested?.available === true ? requested : fallback;
  const selectedEac = selected?.value ?? base.eacBudgetRate;
  return {
    scenarios,
    selectedScenario: selected?.id ?? "budget-rate",
    metrics: calculateEarnedValue({
      bac: base.bac,
      pv: base.pv,
      ev: base.ev,
      ac: base.ac,
      managementEac: selectedEac,
    }),
  };
};

const positionForScope = (
  performance: ProjectPerformanceSnapshot,
  scopeId: string,
  scopeName: string,
  accountableOwner: string,
  bac: number,
): ScopePosition => {
  const periods = periodicPerformanceForScope(performance, scopeId).filter(
    ({ period }) => period <= performance.project.reportingDate,
  );
  const current = periods.at(-1) ?? {
    period: performance.project.reportingDate,
    label: "No accepted period",
    pv: 0,
    ev: 0,
    ac: 0,
  };
  const cumulativeTotals = periods.reduce(
    (sum, period) => ({
      pv: sum.pv + period.pv,
      ev: sum.ev + period.ev,
      ac: sum.ac + period.ac,
    }),
    { pv: 0, ev: 0, ac: 0 },
  );
  return {
    scopeId,
    scopeName,
    accountableOwner,
    bac,
    current: {
      period: current.period,
      label: current.label,
      metrics: calculateEarnedValue({ bac, pv: current.pv, ev: current.ev, ac: current.ac }),
    },
    cumulative: {
      period: performance.project.reportingDate,
      label: `Cumulative to ${performance.project.reportingDate}`,
      metrics: calculateEarnedValue({ bac, ...cumulativeTotals }),
    },
  };
};

const signedCandidateForScope = (
  analyses: readonly VarianceAnalysisRecord[],
  input: {
    performance: ProjectPerformanceSnapshot;
    scopeId: string;
  },
) =>
  analyses
    .filter(
      (record) =>
        record.recordType === "signed" &&
        record.projectId === input.performance.project.id &&
        record.baselineVersion === input.performance.project.baselineVersion &&
        record.reportingPeriod === input.performance.project.reportingDate &&
        record.scopeId === input.scopeId &&
        record.sourceImportId === sourceImportId(input.performance),
    )
    .sort((left, right) => (right.revision ?? 0) - (left.revision ?? 0))[0];

const varianceExceptionForScope = (
  scope: ScopePosition,
  performance: ProjectPerformanceSnapshot,
  analyses: readonly VarianceAnalysisRecord[],
): ReportVarianceException | undefined => {
  const candidate = signedCandidateForScope(analyses, {
    performance,
    scopeId: scope.scopeId,
  });
  const scenario = candidate?.managementScenario ?? preferredScenario(scope.cumulative.metrics);
  const selected = metricsForScenario(scope.cumulative.metrics, scenario);
  const expected = createVarianceAnalysisContext({
    projectId: performance.project.id,
    baselineVersion: performance.project.baselineVersion,
    scopeId: scope.scopeId,
    reportingPeriod: performance.project.reportingDate,
    sourceImportId: sourceImportId(performance),
    expectedActiveImportId:
      performance.source === "active-import" ? performance.importId : null,
    managementScenario: selected.selectedScenario,
    metrics: selected.metrics,
  });
  if (expected.breachedMetrics.length === 0) return undefined;

  const parsedCandidate =
    candidate === undefined
      ? undefined
      : varianceAnalysisRecordSchema.safeParse(candidate);
  const isCurrent =
    parsedCandidate?.success === true &&
    parsedCandidate.data.factFingerprint === expected.factFingerprint;

  return {
    scopeId: scope.scopeId,
    scopeName: scope.scopeName,
    accountableOwner: scope.accountableOwner,
    breachedMetrics: expected.breachedMetrics,
    metrics: selected.metrics,
    selectedScenario: selected.selectedScenario,
    analysisStatus:
      candidate === undefined ? "required" : isCurrent ? "signed" : "stale",
    ...(isCurrent
      ? {
          signedRevision: parsedCandidate.data.revision,
          signedAt: parsedCandidate.data.signedAt,
          rootCause: parsedCandidate.data.details.rootCause,
          impact: [
            parsedCandidate.data.details.dependencyImpact,
            parsedCandidate.data.details.milestoneImpact,
            parsedCandidate.data.details.costEacEffect,
          ].join(" "),
          correctiveAction: parsedCandidate.data.details.correctiveAction,
          owner: parsedCandidate.data.details.owner,
          dueDate: parsedCandidate.data.details.dueDate,
          expectedRecoveryPeriod:
            parsedCandidate.data.details.expectedRecoveryPeriod,
          recoveryEvidence: parsedCandidate.data.details.recoveryEvidence,
          workflowStatus: parsedCandidate.data.details.status,
        }
      : {}),
  };
};

const registerScope = (
  workPackage: WorkPackageSnapshot,
  performance: ProjectPerformanceSnapshot,
) =>
  positionForScope(
    performance,
    workPackage.id,
    workPackage.name,
    workPackage.owner,
    workPackage.bac,
  );

const buildExecutiveText = (
  cumulative: EarnedValueResult,
  projectAnalysis: ReportVarianceException | undefined,
) => {
  const position = `Cumulative SPI is ${formatIndex(cumulative.spi)} and CPI is ${formatIndex(cumulative.cpi)}. Selected management EAC is ${currency.format(cumulative.managementEac)}, giving VAC of ${currency.format(cumulative.vac)}.`;
  if (projectAnalysis?.analysisStatus === "signed") {
    return `${position} Signed root cause: ${projectAnalysis.rootCause} Corrective action: ${projectAnalysis.correctiveAction}`;
  }
  if (projectAnalysis !== undefined) {
    return `${position} No signed cause is available for the current facts; the report does not infer causation.`;
  }
  return `${position} No project-level variance analysis is required at the configured thresholds.`;
};

export function buildWeeklyReportSnapshot(
  input: BuildWeeklyReportInput,
): WeeklyReportSnapshot {
  const activeBaselineSnapshot: BaselineGenerationSnapshot = {
    importId: input.performance.importId,
    projectId: input.performance.project.id,
    baselineVersion: input.performance.project.baselineVersion,
    importedAt: input.performance.importedAt,
    dataDate: input.performance.project.reportingDate,
    bac: input.performance.project.originalBac,
    baselineFinish: input.performance.project.baselineFinish,
    periods: input.performance.periods.map(({ period, pv, ev, ac }) => ({
      period,
      pv,
      ev,
      ac,
    })),
  };
  const baselineReconciliation = buildBaselineReconciliation({
    projectId: input.performance.project.id,
    activeImportId: input.performance.importId,
    reportingDate: input.performance.project.reportingDate,
    snapshots:
      input.performance.baselineSnapshots?.length
        ? input.performance.baselineSnapshots
        : [activeBaselineSnapshot],
    changes: input.changes,
  });
  const acceptedProjectPeriods = periodicPerformanceForScope(
    input.performance,
    "all",
  ).filter(({ period }) => period <= input.performance.project.reportingDate);
  const projectScope = positionForScope(
    input.performance,
    "all",
    input.performance.project.name,
    "Project manager",
    input.performance.project.originalBac,
  );
  const scopes = [
    projectScope,
    ...input.performance.workPackages.map((workPackage) =>
      registerScope(workPackage, input.performance),
    ),
  ];
  const varianceExceptions = scopes
    .map((scope) =>
      varianceExceptionForScope(scope, input.performance, input.signedAnalyses),
    )
    .filter((exception): exception is ReportVarianceException => exception !== undefined);
  const projectException = varianceExceptions.find(
    ({ scopeId }) => scopeId === "all",
  );
  const projectScenario = metricsForScenario(
    projectScope.cumulative.metrics,
    projectException?.selectedScenario ??
      preferredScenario(projectScope.cumulative.metrics),
  );
  const availableEacs = projectScenario.scenarios
    .filter(
      (scenario): scenario is EacScenario & { value: number } =>
        scenario.available && scenario.value !== null,
    )
    .map(({ value }) => value);

  const controls: ReportControl[] = [];
  controls.push(
    ...baselineReconciliation.controls.map((control) => ({
      code: control.code,
      severity: control.severity,
      message: control.message,
      ...(control.changeId === undefined ? {} : { scopeId: control.changeId }),
    })),
  );
  if (input.performance.source !== "active-import") {
    controls.push({
      code: "ACTIVE_IMPORT_REQUIRED",
      severity: "blocking",
      message: "Commit a validated import before publishing a weekly report.",
    });
  }
  if (acceptedProjectPeriods.length === 0) {
    controls.push({
      code: "PERFORMANCE_DATA_MISSING",
      severity: "blocking",
      message: "No accepted reporting period is available for the selected date.",
    });
  }
  for (const exception of varianceExceptions) {
    if (exception.analysisStatus === "signed") continue;
    controls.push({
      code:
        exception.analysisStatus === "stale"
          ? "VARIANCE_ANALYSIS_STALE"
          : "VARIANCE_ANALYSIS_REQUIRED",
      severity: "blocking",
      scopeId: exception.scopeId,
      message:
        exception.analysisStatus === "stale"
          ? `${exception.scopeName} has a signed revision that does not match the current source facts or forecast selection.`
          : `${exception.scopeName} breaches ${exception.breachedMetrics.join(", ")} and requires a complete signed variance analysis.`,
    });
  }

  const approvedNotIncorporated = input.changes.filter(
    (change) =>
      change.status === "approved" &&
      change.incorporatedBaselineVersion === undefined,
  );
  const incorporatedInActiveBaseline = input.changes.filter(
    (change) =>
      change.incorporatedBaselineVersion ===
      input.performance.project.baselineVersion,
  );
  const otherBaselineVersions = [
    ...new Set(
      input.changes
        .map(({ incorporatedBaselineVersion }) => incorporatedBaselineVersion)
        .filter(
          (version): version is string =>
            version !== undefined &&
            version !== input.performance.project.baselineVersion,
        ),
    ),
  ].sort();
  if (otherBaselineVersions.length > 0) {
    controls.push({
      code: "BASELINE_VERSION_MISMATCH",
      severity: "blocking",
      message: `The change register references ${otherBaselineVersions.join(", ")} while performance is measured against ${input.performance.project.baselineVersion}. Reconcile the active baseline before publication.`,
    });
  }

  const submittedChanges = input.changes.filter(
    ({ status }) => status === "submitted",
  );
  const submittedWithoutAuthority = submittedChanges.filter(
    ({ decisionAuthority }) => !decisionAuthority?.trim(),
  );
  if (submittedWithoutAuthority.length > 0) {
    controls.push({
      code: "DECISION_AUTHORITY_REQUIRED",
      severity: "blocking",
      message: `${submittedWithoutAuthority.length} submitted change decision${submittedWithoutAuthority.length === 1 ? "" : "s"} lack a recorded decision authority; assign an authorised owner before publication.`,
    });
  }

  const incompleteControlledChanges = input.changes.filter((change) =>
    missingChangeControlFields(change).some(
      (field) => field !== "decisionAuthority",
    ),
  );
  if (incompleteControlledChanges.length > 0) {
    controls.push({
      code: "CHANGE_RECORD_INCOMPLETE",
      severity: "blocking",
      message: `${incompleteControlledChanges.map(({ id }) => id).join(", ")} ${incompleteControlledChanges.length === 1 ? "is" : "are"} missing required impact, decision or implementation evidence.`,
    });
  }

  const registeredSourceActivityIds = new Set(
    input.milestones.flatMap((milestone) => [
      milestone.id,
      ...(milestone.sourceActivityId ? [milestone.sourceActivityId] : []),
    ]),
  );
  const missingScheduleMilestones = input.performance.activities.filter(
    (activity) =>
      activity.isMilestone && !registeredSourceActivityIds.has(activity.id),
  );
  if (missingScheduleMilestones.length > 0) {
    controls.push({
      code: "MILESTONE_REGISTER_INCOMPLETE",
      severity: "blocking",
      message: `${String(missingScheduleMilestones.length)} accepted schedule milestone${missingScheduleMilestones.length === 1 ? " is" : "s are"} missing from the controlled milestone register: ${missingScheduleMilestones.map(({ id }) => id).join(", ")}.`,
    });
  }

  const milestonesAtReportingDate = input.milestones.map((milestone) => ({
    ...milestone,
    status: milestoneStatusAt(
      milestone,
      input.performance.project.reportingDate,
    ),
  }));
  const incompleteMilestoneRecovery = milestonesAtReportingDate.filter(
    (milestone) => missingMilestoneRecoveryFields(milestone).length > 0,
  );
  if (incompleteMilestoneRecovery.length > 0) {
    controls.push({
      code: "MILESTONE_RECOVERY_REQUIRED",
      severity: "blocking",
      message: `${incompleteMilestoneRecovery.map(({ id }) => id).join(", ")} ${incompleteMilestoneRecovery.length === 1 ? "requires" : "require"} complete cause, recovery action, owner, due date and management-decision evidence.`,
    });
  }
  const milestoneExceptions = milestonesAtReportingDate
    .filter(({ status }) => isAdverseMilestoneStatus(status))
    .map((milestone) => {
      const outcomeDate = milestone.actualDate ?? milestone.forecastDate;
      const dependency = milestone.sourceActivityId
        ? buildMilestoneDependencyTrace(
            input.performance.activities,
            milestone.sourceActivityId,
          )
        : {
            quality: "unlinked" as const,
            issues: [],
          };
      return {
        id: milestone.id,
        name: milestone.name,
        owner: milestone.owner,
        baselineDate: milestone.baselineDate,
        previousForecastDate: milestone.previousForecastDate,
        forecastDate: milestone.forecastDate,
        actualDate: milestone.actualDate,
        outcomeDate,
        varianceDays: differenceInCalendarDays(
          parseISO(outcomeDate),
          parseISO(milestone.baselineDate),
        ),
        movementDays: differenceInCalendarDays(
          parseISO(milestone.forecastDate),
          parseISO(milestone.previousForecastDate),
        ),
        status: milestone.status,
        dependencyQuality: dependency.quality,
        dependencyIssues: dependency.issues.map(({ code }) => code),
        cause: milestone.cause,
        recoveryAction: milestone.recoveryAction,
        actionOwner: milestone.actionOwner,
        actionDueDate: milestone.actionDueDate,
        decisionRequired: milestone.decisionRequired,
        commentary: milestone.commentary,
      };
    });
  const milestonesWithoutCredibleLogic = milestoneExceptions.filter(
    ({ dependencyQuality }) =>
      dependencyQuality === "unresolved" || dependencyQuality === "unlinked",
  );
  if (milestonesWithoutCredibleLogic.length > 0) {
    controls.push({
      code: "MILESTONE_LOGIC_UNRESOLVED",
      severity: "blocking",
      message: `${milestonesWithoutCredibleLogic.map(({ id }) => id).join(", ")} ${milestonesWithoutCredibleLogic.length === 1 ? "does" : "do"} not have a credible accepted predecessor trace. Link the milestone to its active schedule activity and resolve missing or circular logic.`,
    });
  }
  const topRisks = [...input.risks]
    .filter((risk) => {
      if (risk.status === "closed") return false;
      const flags = riskExceptionFlags(
        risk,
        input.performance.project.reportingDate,
        input.riskAppetite ?? defaultRiskAppetite,
      );
      return (
        riskExposure(risk, "residual").rating === "critical" ||
        riskExposure(risk, "residual").rating === "high" ||
        Object.values(flags).some(Boolean)
      );
    })
    .sort(
      (left, right) =>
        riskExposure(right, "residual").score -
        riskExposure(left, "residual").score,
    )
    .slice(0, 5);
  const actions = varianceExceptions
    .filter(
      (
        exception,
      ): exception is ReportVarianceException & {
        correctiveAction: string;
        owner: string;
        dueDate: string;
        workflowStatus: "open" | "monitoring" | "closed";
        recoveryEvidence: string;
      } =>
        exception.analysisStatus === "signed" &&
        exception.correctiveAction !== undefined &&
        exception.owner !== undefined &&
        exception.dueDate !== undefined &&
        exception.workflowStatus !== undefined &&
        exception.recoveryEvidence !== undefined,
    )
    .map((exception) => ({
      scopeId: exception.scopeId,
      action: exception.correctiveAction,
      owner: exception.owner,
      dueDate: exception.dueDate,
      status: exception.workflowStatus,
      evidence: exception.recoveryEvidence,
    }));

  const cumulativeMetrics = projectScenario.metrics;
  const schedulePosition =
    cumulativeMetrics.spi === null
      ? "Schedule efficiency is unavailable"
      : cumulativeMetrics.spi < 0.98
        ? "Behind plan"
        : "On or ahead of plan";
  const costPosition =
    cumulativeMetrics.cpi === null
      ? "cost efficiency is unavailable"
      : cumulativeMetrics.cpi < 0.98
        ? "over cost"
        : "cost efficient";
  const movement = `This period produced SV ${currency.format(projectScope.current.metrics.sv)} and CV ${currency.format(projectScope.current.metrics.cv)}; current-period SPI is ${formatIndex(projectScope.current.metrics.spi)} and CPI is ${formatIndex(projectScope.current.metrics.cpi)}.${acceptedProjectPeriods.length === 1 ? " The source contains one accepted performance period, so current-period and cumulative values are identical." : ""}`;

  return {
    identity: {
      projectId: input.performance.project.id,
      projectName: input.performance.project.name,
      reportingPeriod: input.performance.project.reportingDate,
      baselineVersion: input.performance.project.baselineVersion,
      generatedAt: input.generatedAt,
      sourceImportId: sourceImportId(input.performance),
    },
    headline: `${schedulePosition} and ${costPosition} at the reporting date.`,
    movement,
    executiveSummary: buildExecutiveText(cumulativeMetrics, projectException),
    currentPeriod: projectScope.current,
    cumulative: {
      ...projectScope.cumulative,
      metrics: cumulativeMetrics,
    },
    forecast: {
      scenarios: projectScenario.scenarios,
      selectedScenario: projectScenario.selectedScenario,
      selectedEac: cumulativeMetrics.managementEac,
      minimumEac: Math.min(...availableEacs),
      maximumEac: Math.max(...availableEacs),
    },
    varianceExceptions,
    milestoneExceptions,
    topRisks,
    changeDecisions: submittedChanges.map((change) => ({
      id: change.id,
      title: change.title,
      requiredBy: change.decisionDue,
      decisionOwner: change.decisionAuthority ?? null,
      costImpact: change.costImpact,
      scheduleImpactDays: change.scheduleImpactDays,
    })),
    actions,
    baseline: {
      originalVersion: baselineReconciliation.original?.version ?? null,
      originalBac: baselineReconciliation.original?.bac ?? null,
      activeVersion: input.performance.project.baselineVersion,
      activeBac: input.performance.project.originalBac,
      approvedNotIncorporated: approvedNotIncorporated.reduce(
        (total, change) => total + change.costImpact,
        0,
      ),
      incorporatedInActiveBaseline: incorporatedInActiveBaseline.reduce(
        (total, change) => total + change.costImpact,
        0,
      ),
      otherBaselineVersions,
      expectedActiveBac: baselineReconciliation.cost?.expected ?? null,
      reconciliationVariance: baselineReconciliation.cost?.variance ?? null,
      expectedBaselineFinish:
        baselineReconciliation.schedule?.expectedFinish ?? null,
      activeBaselineFinish: input.performance.project.baselineFinish,
      scheduleVarianceDays:
        baselineReconciliation.schedule?.varianceDays ?? null,
      historicalPerformancePreserved:
        !baselineReconciliation.controls.some(
          ({ code }) => code === "HISTORICAL_PERFORMANCE_REWRITTEN",
        ),
      effectiveChangeIds: baselineReconciliation.effectiveChangeIds,
      changeComparisons: baselineReconciliation.changeComparisons,
    },
    controls,
    canPublish: controls.every(({ severity }) => severity !== "blocking"),
    sourceNotes: [
      input.performance.source === "active-import"
        ? `Schedule and cost: active validated import ${input.performance.importId}.`
        : "Schedule and cost: labelled synthetic fallback; publication is blocked.",
      `${input.registerSource ?? "Supplied management registers"}: ${String(input.milestones.length)} milestones, ${String(input.risks.length)} risks and ${String(input.changes.length)} changes.`,
      `Risk appetite maximum residual scores: safety/quality ${(input.riskAppetite ?? defaultRiskAppetite)["safety-quality"]}, schedule ${(input.riskAppetite ?? defaultRiskAppetite).schedule}, cost ${(input.riskAppetite ?? defaultRiskAppetite).cost}, operational readiness ${(input.riskAppetite ?? defaultRiskAppetite)["operational-readiness"]}.`,
      `Baseline evidence: ${String(input.performance.baselineSnapshots?.length ?? 0)} retained generation snapshot${(input.performance.baselineSnapshots?.length ?? 0) === 1 ? "" : "s"}; original and pre-effective performance are compared without rewriting source rows.`,
      ...(acceptedProjectPeriods.length === 1
        ? [
            "Performance history contains one accepted period; current-period and cumulative columns therefore reconcile to the same values.",
          ]
        : []),
      "HTML is the authoritative report. Print or PDF output must reproduce this same snapshot.",
    ],
  };
}

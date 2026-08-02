import { differenceInCalendarDays, parseISO } from "date-fns";
import { efficiencyBand } from "./calculations/earnedValue";
import { missingChangeControlFields } from "./changes";
import {
  isAdverseMilestoneStatus,
  milestoneStatusAt,
  missingMilestoneRecoveryFields,
} from "./milestones";
import type { RiskAppetiteThresholds } from "./riskAppetite";
import { defaultRiskAppetite } from "./riskAppetite";
import { riskExceptionFlags, riskExposure } from "./risks";
import type { ChangeRequest, Milestone, Risk } from "./types";

export type ManagementExceptionKind =
  | "schedule"
  | "cost"
  | "milestone"
  | "risk"
  | "change";

export type ManagementExceptionSeverity =
  | "recovery"
  | "attention"
  | "monitor";

export type ManagementExceptionHorizon = "now" | "this-period" | "monitor";

export type ManagementExceptionEvidence =
  | "complete"
  | "incomplete"
  | "required"
  | "not-required";

export interface ManagementException {
  id: string;
  recordId: string;
  kind: ManagementExceptionKind;
  kindLabel: string;
  title: string;
  severity: ManagementExceptionSeverity;
  horizon: ManagementExceptionHorizon;
  owner: string;
  action: string;
  dueDate?: string;
  reason: string;
  priorityReason: string;
  evidence: ManagementExceptionEvidence;
  score: number;
  route: string;
  cta: string;
}

export interface BuildManagementExceptionsInput {
  bac: number;
  reportingDate: string;
  scopeId: string;
  scopeOwner: string;
  metrics: {
    spi: number | null;
    cpi: number | null;
  };
  finishVarianceDays: number;
  milestones: readonly Milestone[];
  risks: readonly Risk[];
  changes: readonly ChangeRequest[];
  riskAppetite?: RiskAppetiteThresholds;
}

const severityWeight: Record<ManagementExceptionSeverity, number> = {
  recovery: 400,
  attention: 250,
  monitor: 100,
};

const severityLabel: Record<ManagementExceptionSeverity, string> = {
  recovery: "Recovery required",
  attention: "Attention required",
  monitor: "Monitor",
};

const validDate = (date: string | undefined): date is string =>
  date !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(date);

const daysUntil = (dueDate: string | undefined, reportingDate: string) =>
  validDate(dueDate)
    ? differenceInCalendarDays(parseISO(dueDate), parseISO(reportingDate))
    : undefined;

const urgencyWeight = (days: number | undefined) => {
  if (days === undefined) return 0;
  if (days < 0) return 140 + Math.min(Math.abs(days), 60) * 2;
  if (days <= 7) return 100 - days * 5;
  if (days <= 30) return 50 - Math.floor(days / 3);
  return 0;
};

const horizonFor = (
  severity: ManagementExceptionSeverity,
  days: number | undefined,
): ManagementExceptionHorizon => {
  if (severity === "recovery" || (days !== undefined && days <= 7)) {
    return "now";
  }
  if (severity === "attention" || (days !== undefined && days <= 30)) {
    return "this-period";
  }
  return "monitor";
};

const dueReason = (days: number | undefined) => {
  if (days === undefined) return "no separate due date";
  if (days < 0) return `${String(Math.abs(days))} day${days === -1 ? "" : "s"} overdue`;
  if (days === 0) return "due at the data date";
  return `due in ${String(days)} day${days === 1 ? "" : "s"}`;
};

const evidenceLabel: Record<ManagementExceptionEvidence, string> = {
  complete: "control evidence complete",
  incomplete: "control evidence incomplete",
  required: "governed analysis required",
  "not-required": "no additional evidence required",
};

const createException = (input: {
  id: string;
  recordId: string;
  kind: ManagementExceptionKind;
  kindLabel: string;
  title: string;
  severity: ManagementExceptionSeverity;
  owner: string;
  action: string;
  dueDate?: string;
  reason: string;
  evidence: ManagementExceptionEvidence;
  impactWeight: number;
  reportingDate: string;
  route: string;
  cta: string;
}): ManagementException => {
  const days = daysUntil(input.dueDate, input.reportingDate);
  const evidenceWeight = input.evidence === "incomplete" ? 35 : 0;
  const score =
    severityWeight[input.severity] +
    urgencyWeight(days) +
    Math.max(0, Math.round(input.impactWeight)) +
    evidenceWeight;

  return {
    id: input.id,
    recordId: input.recordId,
    kind: input.kind,
    kindLabel: input.kindLabel,
    title: input.title,
    severity: input.severity,
    horizon: horizonFor(input.severity, days),
    owner: input.owner,
    action: input.action,
    dueDate: input.dueDate,
    reason: input.reason,
    priorityReason: `${severityLabel[input.severity]}; ${dueReason(days)}; ${evidenceLabel[input.evidence]}.`,
    evidence: input.evidence,
    score,
    route: input.route,
    cta: input.cta,
  };
};

const metricException = (input: {
  metric: "SPI" | "CPI";
  value: number;
  reportingDate: string;
  scopeId: string;
  scopeOwner: string;
}): ManagementException | undefined => {
  const band = efficiencyBand(input.value);
  if (band !== "attention" && band !== "recovery") return undefined;
  const isSchedule = input.metric === "SPI";
  const severity = band === "recovery" ? "recovery" : "attention";
  const gap = Math.max(0, 0.98 - input.value);

  return createException({
    id: `performance:${input.metric}`,
    recordId: input.metric,
    kind: isSchedule ? "schedule" : "cost",
    kindLabel: isSchedule ? "Schedule performance" : "Cost performance",
    title: `${input.metric} ${input.value.toFixed(3)}`,
    severity,
    owner: input.scopeOwner,
    action: `Trace the ${input.metric} variance to its contributing activities and complete the governed analysis.`,
    reason: `${input.metric} is ${(gap * 100).toFixed(1)} percentage points below the 0.98 control tolerance.`,
    evidence: "required",
    impactWeight: Math.min(gap * 1_000, 150),
    reportingDate: input.reportingDate,
    route: `/schedule-cost?metric=${input.metric}&scope=${encodeURIComponent(input.scopeId)}`,
    cta: `Trace ${input.metric}`,
  });
};

const milestoneExceptions = (
  milestones: readonly Milestone[],
  reportingDate: string,
): ManagementException[] =>
  milestones.flatMap((milestone) => {
    const status = milestoneStatusAt(milestone, reportingDate);
    if (!isAdverseMilestoneStatus(status)) return [];
    const varianceDays = validDate(milestone.baselineDate) && validDate(milestone.forecastDate)
      ? differenceInCalendarDays(
          parseISO(milestone.forecastDate),
          parseISO(milestone.baselineDate),
        )
      : 0;
    const missing = missingMilestoneRecoveryFields({ ...milestone, status });
    const severity: ManagementExceptionSeverity = status === "complete-late"
      ? missing.length === 0
        ? "monitor"
        : "attention"
      : status === "overdue" || status === "data-issue" || varianceDays > 5
        ? "recovery"
        : "attention";
    const dueDate = status === "complete-late"
      ? undefined
      : milestone.actionDueDate ?? milestone.forecastDate;
    const statusReason = status.replaceAll("-", " ");

    return [
      createException({
        id: `milestone:${milestone.id}`,
        recordId: milestone.id,
        kind: "milestone",
        kindLabel: "Milestone control",
        title: milestone.name,
        severity,
        owner: milestone.actionOwner?.trim() || milestone.owner,
        action: status === "complete-late" && missing.length === 0
          ? "Review and retain the late-completion lessons and control evidence."
          : milestone.recoveryAction?.trim() ||
            milestone.decisionRequired?.trim() ||
            "Agree and record the proportionate milestone response.",
        dueDate,
        reason: `${statusReason}; forecast variance ${varianceDays > 0 ? "+" : ""}${String(varianceDays)} days${missing.length > 0 ? `; ${String(missing.length)} recovery fields incomplete` : ""}.`,
        evidence: missing.length === 0 ? "complete" : "incomplete",
        impactWeight: Math.min(Math.max(varianceDays, 0), 60) * 3 +
          (status === "data-issue" ? 90 : status === "overdue" ? 75 : 30),
        reportingDate,
        route: `/milestones?record=${encodeURIComponent(milestone.id)}`,
        cta: "Open milestone",
      }),
    ];
  });

const riskExceptions = (
  risks: readonly Risk[],
  reportingDate: string,
  appetite: RiskAppetiteThresholds,
): ManagementException[] =>
  risks.flatMap((risk) => {
    if ((risk.status ?? "active") === "closed") return [];
    const exposure = riskExposure(risk, "residual");
    const flags = riskExceptionFlags(risk, reportingDate, appetite);
    const flagCount = Object.values(flags).filter(Boolean).length;
    const severity: ManagementExceptionSeverity =
      exposure.rating === "critical" ||
      flags.triggerBreached ||
      flags.escalationRequired
        ? "recovery"
        : exposure.rating === "high" || flagCount > 0
          ? "attention"
          : "monitor";
    const dueDate = flags.reviewOverdue
      ? risk.reviewDate
      : flags.treatmentOverdue
        ? risk.treatmentDue
        : risk.treatmentDue || risk.reviewDate;
    const evidenceIncomplete =
      flags.escalationRequired ||
      (flags.controlConcern && !risk.controlEvidence?.trim());
    const reasons = [
      `residual ${exposure.rating} ${String(exposure.score)}/25`,
      flags.triggerBreached ? "trigger breached" : undefined,
      flags.aboveTolerance ? "above tolerance" : undefined,
      flags.treatmentOverdue ? "treatment overdue" : undefined,
      flags.reviewOverdue ? "review overdue" : undefined,
      flags.controlConcern ? "control concern" : undefined,
      flags.escalationRequired ? "escalation evidence required" : undefined,
    ].filter((item): item is string => item !== undefined);

    return [
      createException({
        id: `risk:${risk.id}`,
        recordId: risk.id,
        kind: "risk",
        kindLabel: "Risk treatment",
        title: risk.title,
        severity,
        owner:
          (flags.escalationRequired ? risk.escalationOwner : undefined)?.trim() ||
          risk.controlOwner?.trim() ||
          risk.owner,
        action:
          risk.treatment.trim() ||
          "Agree and record the risk treatment and control evidence.",
        dueDate,
        reason: `${reasons.join("; ")}.`,
        evidence: evidenceIncomplete ? "incomplete" : "complete",
        impactWeight: exposure.score * 5 + flagCount * 15,
        reportingDate,
        route: `/risks?record=${encodeURIComponent(risk.id)}`,
        cta: "Open risk",
      }),
    ];
  });

const changeExceptions = (
  changes: readonly ChangeRequest[],
  reportingDate: string,
  bac: number,
): ManagementException[] =>
  changes.flatMap((change) => {
    const approvedNotIncorporated =
      change.status === "approved" && !change.incorporatedBaselineVersion;
    if (change.status !== "submitted" && !approvedNotIncorporated) return [];
    const dueDate = approvedNotIncorporated ? undefined : change.decisionDue;
    const dueDays = daysUntil(dueDate, reportingDate);
    const severity: ManagementExceptionSeverity =
      dueDays !== undefined && dueDays < 0
        ? "recovery"
        : approvedNotIncorporated
          ? "attention"
          : "attention";
    const missing = missingChangeControlFields(change);
    const costShare = bac > 0 ? Math.abs(change.costImpact) / bac : 0;

    return [
      createException({
        id: `change:${change.id}`,
        recordId: change.id,
        kind: "change",
        kindLabel: approvedNotIncorporated
          ? "Baseline incorporation"
          : "Change decision",
        title: change.title,
        severity,
        owner:
          change.decisionAuthority?.trim() ||
          change.approver?.trim() ||
          change.requester?.trim() ||
          "Decision authority not assigned",
        action: approvedNotIncorporated
          ? "Incorporate the approved impact into a controlled baseline or record the hold decision."
          : change.recommendation?.trim() ||
            "Review the impact case and record the authorised decision.",
        dueDate,
        reason: `${change.status}; cost impact ${String(change.costImpact)}; schedule impact ${change.scheduleImpactDays > 0 ? "+" : ""}${String(change.scheduleImpactDays)} days${missing.length > 0 ? `; ${String(missing.length)} control fields incomplete` : ""}.`,
        evidence: missing.length === 0 ? "complete" : "incomplete",
        impactWeight:
          Math.min(costShare * 500, 120) +
          Math.min(Math.abs(change.scheduleImpactDays) * 4, 120) +
          (approvedNotIncorporated ? 60 : 30),
        reportingDate,
        route: `/changes?record=${encodeURIComponent(change.id)}`,
        cta: approvedNotIncorporated ? "Open baseline action" : "Open change",
      }),
    ];
  });

export function buildManagementExceptions(
  input: BuildManagementExceptionsInput,
): ManagementException[] {
  const exceptions: ManagementException[] = [];
  if (input.metrics.spi !== null) {
    const schedule = metricException({
      metric: "SPI",
      value: input.metrics.spi,
      reportingDate: input.reportingDate,
      scopeId: input.scopeId,
      scopeOwner: input.scopeOwner,
    });
    if (schedule !== undefined) exceptions.push(schedule);
  }
  if (input.metrics.cpi !== null) {
    const cost = metricException({
      metric: "CPI",
      value: input.metrics.cpi,
      reportingDate: input.reportingDate,
      scopeId: input.scopeId,
      scopeOwner: input.scopeOwner,
    });
    if (cost !== undefined) exceptions.push(cost);
  }
  if (input.finishVarianceDays > 0) {
    const severity = input.finishVarianceDays > 5 ? "recovery" : "attention";
    exceptions.push(
      createException({
        id: "schedule:finish",
        recordId: "FINISH",
        kind: "schedule",
        kindLabel: "Forecast finish",
        title: `Forecast finish ${String(input.finishVarianceDays)} days late`,
        severity,
        owner: input.scopeOwner,
        action: "Trace the driving activities and record the forecast-finish recovery evidence.",
        reason: `Forecast finish exceeds the baseline by ${String(input.finishVarianceDays)} calendar days.`,
        evidence: "required",
        impactWeight: Math.min(input.finishVarianceDays * 4, 150),
        reportingDate: input.reportingDate,
        route: `/schedule-cost?metric=FINISH&scope=${encodeURIComponent(input.scopeId)}`,
        cta: "Trace finish variance",
      }),
    );
  }

  exceptions.push(
    ...milestoneExceptions(input.milestones, input.reportingDate),
    ...riskExceptions(
      input.risks,
      input.reportingDate,
      input.riskAppetite ?? defaultRiskAppetite,
    ),
    ...changeExceptions(input.changes, input.reportingDate, input.bac),
  );

  return exceptions.sort(
    (left, right) =>
      right.score - left.score ||
      (left.dueDate ?? "9999-12-31").localeCompare(
        right.dueDate ?? "9999-12-31",
      ) ||
      left.kind.localeCompare(right.kind) ||
      left.recordId.localeCompare(right.recordId),
  );
}

export const groupManagementExceptions = (
  exceptions: readonly ManagementException[],
) => ({
  now: exceptions.filter(({ horizon }) => horizon === "now"),
  thisPeriod: exceptions.filter(({ horizon }) => horizon === "this-period"),
  monitor: exceptions.filter(({ horizon }) => horizon === "monitor"),
});

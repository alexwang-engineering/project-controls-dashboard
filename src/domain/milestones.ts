import type {
  ConstraintType,
  LinkType,
} from "./records";
import type { Milestone, MilestoneStatus } from "./types";

export interface MilestoneDates {
  baselineDate: string;
  forecastDate: string;
  actualDate?: string;
}

export interface MilestoneDependencyActivity {
  id: string;
  wbsId: string;
  name: string;
  owner: string;
  baselineFinish: string;
  forecastFinish: string;
  actualFinish?: string;
  predecessorLinks: readonly {
    activityId: string;
    type: LinkType;
    lagDays: number;
  }[];
  constraintType: ConstraintType;
  constraintDate?: string;
  isMilestone: boolean;
  commentary: string;
}

export type MilestoneRecoveryField =
  | "cause"
  | "recoveryAction"
  | "actionOwner"
  | "actionDueDate"
  | "decisionRequired";

export type MilestoneDependencyIssueCode =
  | "source-missing"
  | "source-not-milestone"
  | "missing-predecessor"
  | "cycle"
  | "negative-lag"
  | "excessive-lag"
  | "hard-constraint";

export interface MilestoneDependencyIssue {
  code: MilestoneDependencyIssueCode;
  activityId: string;
  message: string;
}

export interface MilestoneDependencyStep {
  activityId: string;
  activityName: string;
  type: LinkType;
  lagDays: number;
  depth: number;
}

export interface MilestoneDependencyTrace {
  sourceActivityId: string;
  quality: "credible" | "warning" | "unresolved" | "unlinked";
  chain: readonly MilestoneDependencyStep[];
  issues: readonly MilestoneDependencyIssue[];
}

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

const isValidIsoDate = (value: string | undefined) => {
  if (value === undefined || !isoDatePattern.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

export const milestoneStatusAt = (
  dates: MilestoneDates,
  reportingDate: string,
): MilestoneStatus => {
  if (
    !isValidIsoDate(dates.baselineDate) ||
    !isValidIsoDate(dates.forecastDate) ||
    !isValidIsoDate(reportingDate) ||
    (dates.actualDate !== undefined && !isValidIsoDate(dates.actualDate))
  ) {
    return "data-issue";
  }

  if (dates.actualDate !== undefined) {
    if (dates.actualDate > reportingDate) return "data-issue";
    return dates.actualDate <= dates.baselineDate
      ? "complete-on-time"
      : "complete-late";
  }
  if (dates.forecastDate < reportingDate) return "overdue";
  if (dates.forecastDate > dates.baselineDate) return "forecast-late";
  return "on-track";
};

export const isAdverseMilestoneStatus = (status: MilestoneStatus) =>
  status === "complete-late" ||
  status === "forecast-late" ||
  status === "overdue" ||
  status === "data-issue";

const recoveryFields: readonly MilestoneRecoveryField[] = [
  "cause",
  "recoveryAction",
  "actionOwner",
  "actionDueDate",
  "decisionRequired",
];

export const missingMilestoneRecoveryFields = (
  milestone: Pick<Milestone, "status" | MilestoneRecoveryField>,
): MilestoneRecoveryField[] =>
  isAdverseMilestoneStatus(milestone.status)
    ? recoveryFields.filter((field) => !milestone[field]?.trim())
    : [];

const isHardConstraint = (constraintType: ConstraintType) =>
  constraintType === "must-start-on" || constraintType === "must-finish-on";

export function buildMilestoneDependencyTrace(
  activities: readonly MilestoneDependencyActivity[],
  sourceActivityId: string,
): MilestoneDependencyTrace {
  const byId = new Map(activities.map((activity) => [activity.id, activity]));
  const source = byId.get(sourceActivityId);
  const issues: MilestoneDependencyIssue[] = [];
  const chain: MilestoneDependencyStep[] = [];
  const issueKeys = new Set<string>();
  const chainKeys = new Set<string>();
  const addIssue = (issue: MilestoneDependencyIssue) => {
    const key = `${issue.code}:${issue.activityId}`;
    if (!issueKeys.has(key)) {
      issueKeys.add(key);
      issues.push(issue);
    }
  };

  if (source === undefined) {
    return {
      sourceActivityId,
      quality: "unresolved",
      chain,
      issues: [
        {
          code: "source-missing",
          activityId: sourceActivityId,
          message: "The linked schedule activity is not present in the active generation.",
        },
      ],
    };
  }
  if (!source.isMilestone) {
    addIssue({
      code: "source-not-milestone",
      activityId: source.id,
      message: "The linked schedule activity is not marked as a milestone.",
    });
  }
  if (isHardConstraint(source.constraintType)) {
    addIssue({
      code: "hard-constraint",
      activityId: source.id,
      message: `${source.id} uses ${source.constraintType}; confirm the constraint is authorised.`,
    });
  }

  type Frame = {
    activity: MilestoneDependencyActivity;
    depth: number;
    nextLink: number;
  };
  const colour = new Map<string, "grey" | "black">([[source.id, "grey"]]);
  const stack: Frame[] = [{ activity: source, depth: 0, nextLink: 0 }];

  while (stack.length > 0) {
    const frame = stack.at(-1)!;
    if (frame.nextLink >= frame.activity.predecessorLinks.length) {
      colour.set(frame.activity.id, "black");
      stack.pop();
      continue;
    }

    const link = frame.activity.predecessorLinks[frame.nextLink++]!;
    const predecessorId = String(link.activityId);
    const predecessor = byId.get(predecessorId);
    if (link.lagDays < 0) {
      addIssue({
        code: "negative-lag",
        activityId: frame.activity.id,
        message: `${frame.activity.id} has a ${String(link.lagDays)}-day lead from ${predecessorId}.`,
      });
    } else if (link.lagDays > 5) {
      addIssue({
        code: "excessive-lag",
        activityId: frame.activity.id,
        message: `${frame.activity.id} has a ${String(link.lagDays)}-day lag from ${predecessorId}; confirm it represents real logic.`,
      });
    }
    if (predecessor === undefined) {
      addIssue({
        code: "missing-predecessor",
        activityId: predecessorId,
        message: `${frame.activity.id} references missing predecessor ${predecessorId}.`,
      });
      continue;
    }

    const chainKey = `${frame.activity.id}:${predecessorId}:${String(link.type)}:${String(link.lagDays)}`;
    if (!chainKeys.has(chainKey)) {
      chainKeys.add(chainKey);
      chain.push({
        activityId: predecessor.id,
        activityName: predecessor.name,
        type: link.type,
        lagDays: link.lagDays,
        depth: frame.depth + 1,
      });
    }
    if (isHardConstraint(predecessor.constraintType)) {
      addIssue({
        code: "hard-constraint",
        activityId: predecessor.id,
        message: `${predecessor.id} uses ${predecessor.constraintType}; confirm the constraint is authorised.`,
      });
    }

    const predecessorColour = colour.get(predecessor.id);
    if (predecessorColour === "grey") {
      addIssue({
        code: "cycle",
        activityId: predecessor.id,
        message: `Circular predecessor logic reaches ${predecessor.id}.`,
      });
      continue;
    }
    if (predecessorColour === "black") continue;
    colour.set(predecessor.id, "grey");
    stack.push({ activity: predecessor, depth: frame.depth + 1, nextLink: 0 });
  }

  const unresolved = issues.some(({ code }) =>
    ["source-missing", "source-not-milestone", "missing-predecessor", "cycle"].includes(code),
  );
  const warning = issues.some(({ code }) =>
    ["negative-lag", "excessive-lag", "hard-constraint"].includes(code),
  );
  return {
    sourceActivityId,
    quality: unresolved
      ? "unresolved"
      : warning
        ? "warning"
        : source.predecessorLinks.length === 0
          ? "unlinked"
          : "credible",
    chain,
    issues,
  };
}

export const milestoneFromScheduleActivity = (
  activity: MilestoneDependencyActivity,
  reportingDate: string,
  updatedAt: string,
): Milestone => {
  const dates = {
    baselineDate: activity.baselineFinish,
    forecastDate: activity.forecastFinish,
    ...(activity.actualFinish === undefined
      ? {}
      : { actualDate: activity.actualFinish }),
  };
  return {
    id: activity.id,
    sourceActivityId: activity.id,
    name: activity.name,
    wbsId: activity.wbsId,
    owner: activity.owner,
    baselineDate: activity.baselineFinish,
    previousForecastDate: activity.forecastFinish,
    forecastDate: activity.forecastFinish,
    ...(activity.actualFinish === undefined
      ? {}
      : { actualDate: activity.actualFinish }),
    status: milestoneStatusAt(dates, reportingDate),
    commentary: activity.commentary,
    updatedAt,
  };
};

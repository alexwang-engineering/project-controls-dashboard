import type {
  ChangeDecisionHistoryEntry,
  ChangeRequest,
  ChangeStatus,
} from "./types";

const transitions: Record<ChangeStatus, readonly ChangeStatus[]> = {
  draft: ["draft", "submitted"],
  submitted: ["submitted", "approved", "rejected", "draft"],
  approved: ["approved", "implemented", "withdrawn"],
  rejected: ["rejected"],
  implemented: ["implemented"],
  withdrawn: ["withdrawn"],
};

export const allowedChangeStatuses = (
  current: ChangeStatus | undefined,
): readonly ChangeStatus[] => current === undefined ? ["draft"] : transitions[current];

export const canTransitionChange = (
  current: ChangeStatus | undefined,
  next: ChangeStatus,
) => allowedChangeStatuses(current).includes(next);

export const canDeleteChange = (change: ChangeRequest) =>
  change.status === "draft" && (change.decisionHistory?.length ?? 0) === 0;

const controlledRequestFields: ReadonlyArray<keyof ChangeRequest> = [
  "id",
  "title",
  "reason",
  "requester",
  "wbsId",
  "scopeDescription",
  "costImpact",
  "scheduleImpactDays",
  "technicalQualityImpact",
  "riskImpact",
  "benefit",
  "assumptions",
  "alternatives",
  "recommendation",
  "decisionDue",
  "submittedDate",
  "decisionAuthority",
];

export const changeSubmissionFields: ReadonlyArray<keyof ChangeRequest> = [
  "reason",
  "requester",
  "scopeDescription",
  "technicalQualityImpact",
  "riskImpact",
  "benefit",
  "assumptions",
  "alternatives",
  "recommendation",
  "submittedDate",
  "decisionAuthority",
  "evidenceReference",
];

export const changeDecisionFields: ReadonlyArray<keyof ChangeRequest> = [
  "approver",
  "decisionDate",
  "decisionRationale",
];

export const changeImplementationFields: ReadonlyArray<keyof ChangeRequest> = [
  "effectiveDate",
  "incorporatedBaselineVersion",
  "rebaselineJustification",
  "preventionCorrectiveMeasures",
];

const changeFieldIsMissing = (change: ChangeRequest, field: keyof ChangeRequest) => {
  const value = change[field];
  return value === undefined || (typeof value === "string" && value.trim() === "");
};

export const missingChangeControlFields = (
  change: ChangeRequest,
): ReadonlyArray<keyof ChangeRequest> => {
  const required: Array<keyof ChangeRequest> = [];
  if (change.status !== "draft") required.push(...changeSubmissionFields);
  if (["approved", "rejected", "implemented", "withdrawn"].includes(change.status)) {
    required.push(...changeDecisionFields);
  }
  if (change.status === "implemented") {
    required.push(...changeImplementationFields);
  }
  return [...new Set(required)].filter((field) => changeFieldIsMissing(change, field));
};

const requiredTransitionValue = (
  value: string | undefined,
  label: string,
) => {
  if (value === undefined || value.trim() === "") {
    throw new Error(`${label} is required to record this change transition.`);
  }
  return value;
};

const buildHistoryEntry = (
  previous: ChangeRequest,
  next: ChangeRequest,
): ChangeDecisionHistoryEntry => {
  const isSubmission = previous.status === "draft" && next.status === "submitted";
  const isImplementation = next.status === "implemented";
  const actor = isSubmission ? next.requester : next.approver;
  const date = isSubmission
    ? next.submittedDate
    : isImplementation
      ? next.effectiveDate
      : next.decisionDate;
  const rationale = isSubmission
    ? next.recommendation
    : isImplementation
      ? next.rebaselineJustification
      : next.decisionRationale;

  return {
    sequence: (previous.decisionHistory?.length ?? 0) + 1,
    fromStatus: previous.status,
    toStatus: next.status,
    actor: requiredTransitionValue(actor, "Transition actor"),
    authority: requiredTransitionValue(next.decisionAuthority, "Decision authority"),
    date: requiredTransitionValue(date, "Transition date"),
    rationale: requiredTransitionValue(rationale, "Transition rationale"),
    evidenceReference: requiredTransitionValue(
      next.evidenceReference,
      "Evidence reference",
    ),
  };
};

export function applyChangeTransition(
  previous: ChangeRequest | undefined,
  next: ChangeRequest,
): ChangeRequest {
  if (!canTransitionChange(previous?.status, next.status)) {
    throw new Error(
      `Change transition from ${previous?.status ?? "new"} to ${next.status} is not allowed.`,
    );
  }
  if (previous !== undefined && previous.id !== next.id) {
    throw new Error("A controlled change ID cannot be altered after creation.");
  }
  if (
    previous !== undefined &&
    previous.status !== "draft" &&
    controlledRequestFields.some((field) => previous[field] !== next[field])
  ) {
    throw new Error(
      "A submitted change case must be returned to draft before its request or impact assessment can be amended.",
    );
  }
  if (
    previous !== undefined &&
    previous.status !== "draft" &&
    previous.status === next.status
  ) {
    throw new Error(
      "A controlled change must move to an allowed next status; its recorded decision cannot be overwritten in place.",
    );
  }

  const existingHistory = [...(previous?.decisionHistory ?? [])];
  if (previous === undefined || previous.status === next.status) {
    return { ...next, decisionHistory: existingHistory };
  }

  return {
    ...next,
    decisionHistory: [...existingHistory, buildHistoryEntry(previous, next)],
  };
}

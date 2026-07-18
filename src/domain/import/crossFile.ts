import type {
  ActivityId,
  IsoDate,
  NormalisedActivity,
  PerformanceRecord,
  ProjectConfigurationInput,
  SourcedRecord,
} from "../records";
import type { ValidationIssue } from "../../schemas/validationIssue";

export interface CrossFileValidationInput {
  activities: readonly SourcedRecord<NormalisedActivity>[];
  performance: readonly SourcedRecord<PerformanceRecord>[];
  configuration: ProjectConfigurationInput;
}

export interface CrossFileValidationResult {
  issues: ValidationIssue[];
  dataDate?: IsoDate;
}

const issueAt = (
  record: Pick<SourcedRecord<unknown>, "source">,
  issue: Omit<
    ValidationIssue,
    "fileName" | "recordNumber" | "physicalLineStart"
  >,
): ValidationIssue => ({ ...record.source, ...issue });

const duplicateRecordIndexes = <Value>(
  records: readonly SourcedRecord<Value>[],
  keyFor: (value: Value) => string,
  code: string,
  column: string,
  ruleFor: (key: string) => string,
) => {
  const groups = new Map<string, number[]>();
  records.forEach((record, index) => {
    const key = keyFor(record.value);
    const indexes = groups.get(key) ?? [];
    indexes.push(index);
    groups.set(key, indexes);
  });

  const duplicateIndexes = new Set<number>();
  const issues: ValidationIssue[] = [];
  for (const [key, indexes] of groups) {
    if (indexes.length < 2) continue;
    for (const index of indexes) {
      duplicateIndexes.add(index);
      const record = records[index];
      if (record === undefined) continue;
      issues.push(
        issueAt(record, {
          severity: "blocking",
          code,
          column,
          suppliedValue: key,
          rule: ruleFor(key),
          suggestion: "Make this key unique before importing again.",
        }),
      );
    }
  }
  return { duplicateIndexes, issues };
};

const gapInCalendarDays = (earlier: string, later: string) =>
  Math.round((Date.parse(later + "T00:00:00Z") - Date.parse(earlier + "T00:00:00Z")) / 86_400_000);

export function validateCrossFile(
  input: CrossFileValidationInput,
): CrossFileValidationResult {
  const issues: ValidationIssue[] = [];
  const activityDuplicates = duplicateRecordIndexes(
    input.activities,
    (activity) => activity.activityId,
    "duplicate_activity_id",
    "activity_id",
    (key) => "Activity ID " + key + " occurs more than once in the schedule.",
  );
  const performanceDuplicates = duplicateRecordIndexes(
    input.performance,
    (record) => record.activityId + "|" + record.periodEnd,
    "duplicate_performance_key",
    "activity_id",
    (key) =>
      "Activity and period key " + key + " occurs more than once in performance data.",
  );
  issues.push(...activityDuplicates.issues, ...performanceDuplicates.issues);

  const activities = input.activities.filter(
    (_, index) => !activityDuplicates.duplicateIndexes.has(index),
  );
  const performance = input.performance.filter(
    (_, index) => !performanceDuplicates.duplicateIndexes.has(index),
  );
  const expectedProjectId = input.configuration.projectId;
  const expectedBaselineVersion = activities[0]?.value.baselineVersion;

  for (const record of [...activities, ...performance]) {
    if (record.value.projectId !== expectedProjectId) {
      issues.push(
        issueAt(record, {
          severity: "blocking",
          code: "project_id_mismatch",
          column: "project_id",
          suppliedValue: record.value.projectId,
          rule:
            "Project ID must match configured project " + expectedProjectId + ".",
          suggestion: "Import files for one configured project only.",
        }),
      );
    }
    if (
      expectedBaselineVersion !== undefined &&
      record.value.baselineVersion !== expectedBaselineVersion
    ) {
      issues.push(
        issueAt(record, {
          severity: "blocking",
          code: "baseline_version_mismatch",
          column: "baseline_version",
          suppliedValue: record.value.baselineVersion,
          rule:
            "Baseline version must match schedule baseline " +
            expectedBaselineVersion +
            ".",
          suggestion: "Import schedule and performance for the same baseline.",
        }),
      );
    }
  }

  const configuredWorkPackages = new Set(input.configuration.workPackageIds);
  const configuredCalendars = new Set(input.configuration.calendarIds);
  for (const record of activities) {
    if (!configuredWorkPackages.has(record.value.wbsId)) {
      issues.push(
        issueAt(record, {
          severity: "blocking",
          code: "unknown_work_package",
          column: "wbs_id",
          suppliedValue: record.value.wbsId,
          rule:
            "Work package is not in the " +
            input.configuration.source +
            " registry. Configured IDs: " +
            ([...configuredWorkPackages].join(", ") || "none") +
            ".",
          suggestion: "Confirm or deliberately update the project registry.",
        }),
      );
    }
    if (!configuredCalendars.has(record.value.calendarId)) {
      issues.push(
        issueAt(record, {
          severity: "blocking",
          code: "unknown_calendar",
          column: "calendar_id",
          suppliedValue: record.value.calendarId,
          rule:
            "Calendar is not in the " +
            input.configuration.source +
            " allowlist. Configured IDs: " +
            ([...configuredCalendars].join(", ") || "none") +
            ".",
          suggestion: "Confirm or deliberately update the calendar allowlist.",
        }),
      );
    }
  }

  const activitiesById = new Map(
    activities.map((record) => [record.value.activityId, record] as const),
  );
  for (const record of performance) {
    if (activitiesById.has(record.value.activityId)) continue;
    issues.push(
      issueAt(record, {
        severity: "blocking",
        code: "unknown_activity_reference",
        column: "activity_id",
        suppliedValue: record.value.activityId,
        rule: "Performance activity does not exist in the candidate schedule.",
        suggestion: "Correct the activity ID or add its schedule record.",
      }),
    );
  }

  const earnedValueByActivity = new Map<ActivityId, bigint>();
  for (const record of performance) {
    if (!activitiesById.has(record.value.activityId)) continue;
    earnedValueByActivity.set(
      record.value.activityId,
      (earnedValueByActivity.get(record.value.activityId) ?? 0n) +
        BigInt(record.value.evPeriod),
    );
  }
  for (const [activityId, total] of earnedValueByActivity) {
    const activity = activitiesById.get(activityId);
    if (activity === undefined || total <= BigInt(activity.value.baselineBudget)) {
      continue;
    }
    issues.push(
      issueAt(activity, {
        severity: "blocking",
        code: "earned_value_exceeds_budget",
        column: "baseline_budget",
        suppliedValue: String(total) + " pence cumulative EV",
        rule:
          "Cumulative earned value exceeds the activity baseline budget of " +
          String(activity.value.baselineBudget) +
          " pence.",
        suggestion: "Correct the periodic EV or baseline budget.",
      }),
    );
  }

  const distinctPeriods = [...new Set(performance.map((row) => row.value.periodEnd))].sort();
  for (let index = 1; index < distinctPeriods.length; index += 1) {
    const previous = distinctPeriods[index - 1];
    const current = distinctPeriods[index];
    if (previous === undefined || current === undefined) continue;
    const gap = gapInCalendarDays(previous, current);
    if (gap === 7) continue;
    const source = performance.find((row) => row.value.periodEnd === current);
    if (source === undefined) continue;
    issues.push(
      issueAt(source, {
        severity: "warning",
        code: "reporting_period_gap",
        column: "period_end",
        suppliedValue: previous + " to " + current,
        rule:
          "Consecutive project reporting periods are " +
          String(gap) +
          " calendar days apart; expected 7.",
        suggestion: "Confirm the reporting calendar or supply the missing period.",
      }),
    );
  }

  const dataDate = distinctPeriods.at(-1);
  if (dataDate !== undefined) {
    for (const record of activities) {
      for (const [column, date] of [
        ["actual_start", record.value.actualStart],
        ["actual_finish", record.value.actualFinish],
      ] as const) {
        if (date === undefined || date <= dataDate) continue;
        issues.push(
          issueAt(record, {
            severity: "blocking",
            code: "actual_after_data_date",
            column,
            suppliedValue: date,
            rule: "Actual date cannot be after data date " + dataDate + ".",
            suggestion: "Correct the actual date or performance reporting period.",
          }),
        );
      }
    }
  }

  return { issues, dataDate };
}

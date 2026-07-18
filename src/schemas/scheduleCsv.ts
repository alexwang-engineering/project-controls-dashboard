import { z } from "zod";
import type { RawCsvRecord } from "../domain/import/parseCsv";
import type {
  ActivityId,
  BaselineVersion,
  CalendarId,
  ConstraintType,
  IsoDate,
  LinkType,
  NormalisedActivity,
  PredecessorLink,
  ProjectId,
  WorkPackageId,
} from "../domain/records";
import { validateCsvRows } from "./csvRowValidation";
import {
  addCodedIssue,
  requiredBooleanSchema,
  requiredIdentifierSchema,
  requiredIsoDateSchema,
  requiredNonNegativeMoneyPenceSchema,
  startsWithFormulaCharacter,
  optionalIsoDateSchema,
} from "./fields";

export const SCHEDULE_CSV_HEADERS = [
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

const requiredBoundedText = (minimum: number, maximum: number, label: string) =>
  z.string().superRefine((input, context) => {
    if (input === "") {
      addCodedIssue(context, "required_field", label + " is required.");
      return;
    }
    if (input.length < minimum || input.length > maximum) {
      addCodedIssue(
        context,
        "invalid_length",
        label +
          " must contain " +
          String(minimum) +
          "–" +
          String(maximum) +
          " characters.",
      );
    }
  });

const optionalBoundedText = (maximum: number, label: string) =>
  z.string().superRefine((input, context) => {
    if (input.length <= maximum) return;
    addCodedIssue(
      context,
      "invalid_length",
      label + " must not exceed " + String(maximum) + " characters.",
    );
  });

const linkTypes = new Set<LinkType>(["FS", "SS", "FF", "SF"]);
const lagGrammar = /^-?\d+$/;
const identifierGrammar = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;

export const predecessorLinksSchema = z
  .string()
  .transform((input, context): readonly PredecessorLink[] => {
    if (input === "") return [];

    const links: PredecessorLink[] = [];
    for (const segment of input.split(";")) {
      const parts = segment.split("|");
      const [activityId = "", type = "", lag = ""] = parts;
      const isValid =
        parts.length === 3 &&
        identifierGrammar.test(activityId) &&
        linkTypes.has(type as LinkType) &&
        lagGrammar.test(lag) &&
        Number.isSafeInteger(Number(lag));

      if (!isValid) {
        addCodedIssue(
          context,
          startsWithFormulaCharacter(input)
            ? "formula_like"
            : "invalid_relationship",
          "Use semicolon-separated ACTIVITY_ID|TYPE|LAG_DAYS links; TYPE must be FS, SS, FF, or SF and lag must be an integer.",
        );
        return z.NEVER;
      }

      links.push({
        activityId: activityId as ActivityId,
        type: type as LinkType,
        lagDays: Number(lag),
      });
    }

    return links;
  });

const constraintTypes = new Set<ConstraintType>([
  "none",
  "start-no-earlier-than",
  "finish-no-later-than",
  "must-start-on",
  "must-finish-on",
]);

const constraintTypeSchema = z
  .string()
  .superRefine((input, context) => {
    if (input === "" || constraintTypes.has(input as ConstraintType)) return;
    addCodedIssue(
      context,
      startsWithFormulaCharacter(input) ? "formula_like" : "invalid_enum",
      "Use none, start-no-earlier-than, finish-no-later-than, must-start-on, or must-finish-on.",
    );
  })
  .transform((input) => (input === "" ? "none" : input) as ConstraintType);

const progressMethodSchema = z
  .string()
  .superRefine((input, context) => {
    if (input === "percent_complete") return;
    if (input === "") {
      addCodedIssue(context, "required_field", "A progress method is required.");
      return;
    }
    addCodedIssue(
      context,
      startsWithFormulaCharacter(input) ? "formula_like" : "invalid_enum",
      "Use percent_complete for the MVP.",
    );
  })
  .transform(() => "percent_complete" as const);

const rawScheduleRowSchema = z
  .object({
    project_id: requiredIdentifierSchema,
    baseline_version: requiredIdentifierSchema,
    activity_id: requiredIdentifierSchema,
    wbs_id: requiredIdentifierSchema,
    activity_name: requiredBoundedText(3, 120, "Activity name"),
    owner: requiredBoundedText(2, 80, "Owner"),
    baseline_start: requiredIsoDateSchema,
    baseline_finish: requiredIsoDateSchema,
    forecast_start: requiredIsoDateSchema,
    forecast_finish: requiredIsoDateSchema,
    actual_start: optionalIsoDateSchema,
    actual_finish: optionalIsoDateSchema,
    predecessor_links: predecessorLinksSchema,
    calendar_id: requiredIdentifierSchema,
    constraint_type: constraintTypeSchema,
    constraint_date: optionalIsoDateSchema,
    is_milestone: requiredBooleanSchema,
    baseline_budget: requiredNonNegativeMoneyPenceSchema,
    progress_method: progressMethodSchema,
    commentary: optionalBoundedText(500, "Commentary"),
  })
  .superRefine((row, context) => {
    if (row.baseline_start > row.baseline_finish) {
      addCodedIssue(
        context,
        "invalid_date_order",
        "Baseline finish must be on or after baseline start.",
        ["baseline_finish"],
      );
    }
    if (row.forecast_start > row.forecast_finish) {
      addCodedIssue(
        context,
        "invalid_date_order",
        "Forecast finish must be on or after forecast start.",
        ["forecast_finish"],
      );
    }
    if (row.actual_finish !== undefined && row.actual_start === undefined) {
      addCodedIssue(
        context,
        "actual_start_required",
        "Actual finish requires an actual start.",
        ["actual_finish"],
      );
    }
    if (
      row.actual_start !== undefined &&
      row.actual_finish !== undefined &&
      row.actual_start > row.actual_finish
    ) {
      addCodedIssue(
        context,
        "invalid_date_order",
        "Actual finish must be on or after actual start.",
        ["actual_finish"],
      );
    }
    const hasConstraint = row.constraint_type !== "none";
    if (hasConstraint && row.constraint_date === undefined) {
      addCodedIssue(
        context,
        "constraint_date_required",
        "Constraint date is required when constraint type is not none.",
        ["constraint_date"],
      );
    }
    if (!hasConstraint && row.constraint_date !== undefined) {
      addCodedIssue(
        context,
        "unexpected_constraint_date",
        "Constraint date must be blank when constraint type is none.",
        ["constraint_date"],
      );
    }
    if (
      row.is_milestone &&
      (row.baseline_start !== row.baseline_finish ||
        row.forecast_start !== row.forecast_finish)
    ) {
      addCodedIssue(
        context,
        "milestone_duration",
        "A milestone must have zero baseline and forecast duration.",
        ["is_milestone"],
      );
    }
  });

export const scheduleRowSchema = rawScheduleRowSchema.transform(
  (row): NormalisedActivity => ({
    projectId: row.project_id as ProjectId,
    baselineVersion: row.baseline_version as BaselineVersion,
    activityId: row.activity_id as ActivityId,
    wbsId: row.wbs_id as WorkPackageId,
    activityName: row.activity_name,
    owner: row.owner,
    baselineStart: row.baseline_start as IsoDate,
    baselineFinish: row.baseline_finish as IsoDate,
    forecastStart: row.forecast_start as IsoDate,
    forecastFinish: row.forecast_finish as IsoDate,
    actualStart: row.actual_start as IsoDate | undefined,
    actualFinish: row.actual_finish as IsoDate | undefined,
    predecessorLinks: row.predecessor_links,
    calendarId: row.calendar_id as CalendarId,
    constraintType: row.constraint_type,
    constraintDate: row.constraint_date as IsoDate | undefined,
    isMilestone: row.is_milestone,
    baselineBudget: row.baseline_budget,
    progressMethod: row.progress_method,
    commentary: row.commentary,
  }),
);

export const validateScheduleCsvRows = (
  fileName: string,
  headers: readonly string[],
  records: readonly RawCsvRecord[],
) => validateCsvRows(scheduleRowSchema, fileName, headers, records);

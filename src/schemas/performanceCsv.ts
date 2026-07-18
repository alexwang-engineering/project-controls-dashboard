import Decimal from "decimal.js";
import { z } from "zod";
import type { RawCsvRecord } from "../domain/import/parseCsv";
import type {
  ActivityId,
  BaselineVersion,
  IsoDate,
  PerformanceRecord,
  ProjectId,
} from "../domain/records";
import { validateCsvRows } from "./csvRowValidation";
import {
  addCodedIssue,
  optionalNonNegativeMoneyPenceSchema,
  requiredIdentifierSchema,
  requiredIsoDateSchema,
  requiredNonNegativeMoneyPenceSchema,
  startsWithFormulaCharacter,
} from "./fields";

export const PERFORMANCE_CSV_HEADERS = [
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

// Parse the signed numeric grammar before applying the formula heuristic so a
// legitimate negative literal receives the range error required by ADR D5.
const percentageGrammar = /^-?\d+(?:\.\d+)?$/;

export const percentageSchema = z.string().transform((input, context) => {
  if (input === "") {
    addCodedIssue(context, "required_field", "A percentage is required.");
    return z.NEVER;
  }
  if (!percentageGrammar.test(input)) {
    addCodedIssue(
      context,
      startsWithFormulaCharacter(input) ? "formula_like" : "invalid_percentage",
      "Enter a decimal percentage from 0 to 100 without scientific notation.",
    );
    return z.NEVER;
  }

  const value = new Decimal(input);
  if (value.isNegative() || value.greaterThan(100)) {
    addCodedIssue(
      context,
      "invalid_percentage",
      "Physical percent complete must be between 0 and 100.",
    );
    return z.NEVER;
  }
  return value.toNumber();
});

const progressCommentarySchema = z.string().superRefine((input, context) => {
  if (input.length <= 500) return;
  addCodedIssue(
    context,
    "invalid_length",
    "Progress commentary must not exceed 500 characters.",
  );
});

export const performanceRowSchema = z
  .object({
    project_id: requiredIdentifierSchema,
    baseline_version: requiredIdentifierSchema,
    period_end: requiredIsoDateSchema,
    activity_id: requiredIdentifierSchema,
    pv_period: requiredNonNegativeMoneyPenceSchema,
    ev_period: requiredNonNegativeMoneyPenceSchema,
    ac_period: requiredNonNegativeMoneyPenceSchema,
    physical_percent_complete: percentageSchema,
    remaining_cost_forecast: optionalNonNegativeMoneyPenceSchema,
    progress_commentary: progressCommentarySchema,
  })
  .transform(
    (row): PerformanceRecord => ({
      projectId: row.project_id as ProjectId,
      baselineVersion: row.baseline_version as BaselineVersion,
      periodEnd: row.period_end as IsoDate,
      activityId: row.activity_id as ActivityId,
      pvPeriod: row.pv_period,
      evPeriod: row.ev_period,
      acPeriod: row.ac_period,
      physicalPercentComplete: row.physical_percent_complete,
      remainingCostForecast: row.remaining_cost_forecast,
      progressCommentary: row.progress_commentary,
    }),
  );

export const validatePerformanceCsvRows = (
  fileName: string,
  headers: readonly string[],
  records: readonly RawCsvRecord[],
) => validateCsvRows(performanceRowSchema, fileName, headers, records);

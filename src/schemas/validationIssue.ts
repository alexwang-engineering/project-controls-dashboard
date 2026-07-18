export type ValidationSeverity = "blocking" | "warning" | "information";

export interface ValidationIssue {
  severity: ValidationSeverity;
  code: string;
  fileName: string;
  recordNumber?: number;
  physicalLineStart?: number;
  column?: string;
  suppliedValue?: string;
  rule: string;
  suggestion: string;
}

export const truncateSuppliedValue = (value: string, maximum = 120) =>
  value.length <= maximum ? value : value.slice(0, maximum - 1) + "…";

export const formatValidationIssue = (issue: ValidationIssue) => {
  const location = [
    issue.fileName,
    issue.recordNumber === undefined
      ? undefined
      : "record " + String(issue.recordNumber),
    issue.column === undefined ? undefined : "field " + issue.column,
  ]
    .filter((part): part is string => part !== undefined)
    .join(", ");
  const supplied =
    issue.suppliedValue === undefined
      ? ""
      : ": “" + issue.suppliedValue + "” is invalid";

  return location + supplied + ". " + issue.rule + " " + issue.suggestion;
};

export interface RowIssueContext {
  fileName: string;
  recordNumber: number;
  physicalLineStart?: number;
  rawValues: Readonly<Record<string, string>>;
}

const ruleFor = (code: string, column: string | undefined, fallback: string) => {
  if (code === "negative_not_allowed" && column === "ac_period") {
    return "Actual cost must be zero or positive.";
  }
  return fallback;
};

const suggestionFor = (code: string) => {
  if (code === "formula_like") {
    return "Replace the formula-like input with a literal value.";
  }
  if (code === "required_field") {
    return "Supply the required value before importing again.";
  }
  return "Correct the value or remove the record before importing again.";
};

export function zodErrorToValidationIssues(
  error: z.ZodError,
  context: RowIssueContext,
): ValidationIssue[] {
  return error.issues.map((issue) => {
    const firstPathPart = issue.path[0];
    const column =
      typeof firstPathPart === "string" ? firstPathPart : undefined;
    const supplied = column === undefined ? undefined : context.rawValues[column];
    const code = validationCodeFromIssue(issue);

    return {
      severity: "blocking",
      code,
      fileName: context.fileName,
      recordNumber: context.recordNumber,
      physicalLineStart: context.physicalLineStart,
      column,
      suppliedValue:
        supplied === undefined ? undefined : truncateSuppliedValue(supplied),
      rule: ruleFor(code, column, issue.message),
      suggestion: suggestionFor(code),
    };
  });
}
import type { z } from "zod";
import { validationCodeFromIssue } from "./fields";

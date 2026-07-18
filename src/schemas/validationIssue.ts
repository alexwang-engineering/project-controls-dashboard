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

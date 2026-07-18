import type { z } from "zod";
import type { RawCsvRecord } from "../domain/import/parseCsv";
import type { SourcedRecord } from "../domain/records";
import type { ValidationIssue } from "./validationIssue";
import { zodErrorToValidationIssues } from "./validationIssue";

export interface CsvRowValidationResult<Value> {
  records: SourcedRecord<Value>[];
  issues: ValidationIssue[];
}

const valuesByHeader = (
  headers: readonly string[],
  cells: readonly string[],
) =>
  Object.fromEntries(
    headers.map((header, index) => [header, cells[index] ?? ""]),
  );

export function validateCsvRows<Value>(
  schema: z.ZodType<Value>,
  fileName: string,
  headers: readonly string[],
  rawRecords: readonly RawCsvRecord[],
): CsvRowValidationResult<Value> {
  const records: SourcedRecord<Value>[] = [];
  const issues: ValidationIssue[] = [];

  for (const rawRecord of rawRecords) {
    const rawValues = valuesByHeader(headers, rawRecord.cells);
    const result = schema.safeParse(rawValues);
    if (!result.success) {
      issues.push(
        ...zodErrorToValidationIssues(result.error, {
          fileName,
          recordNumber: rawRecord.recordNumber,
          physicalLineStart: rawRecord.physicalLineStart,
          rawValues,
        }),
      );
      continue;
    }

    records.push({
      value: result.data,
      source: {
        fileName,
        recordNumber: rawRecord.recordNumber,
        physicalLineStart: rawRecord.physicalLineStart,
      },
    });
  }

  return { records, issues };
}

import { startsWithFormulaCharacter } from "../schemas/fields";

export const neutraliseSpreadsheetCell = (value: string) =>
  startsWithFormulaCharacter(value) ? "'" + value : value;

export type CsvCellTrust = "untrusted-text" | "trusted-scalar";

export interface CsvEncodingOptions {
  /** Defaults to untrusted text for every column (the safe error-report policy). */
  columnTrust?: readonly CsvCellTrust[];
}

export function encodeCsvCell(
  value: string,
  trust: CsvCellTrust = "untrusted-text",
): string {
  const neutralised =
    trust === "untrusted-text" ? neutraliseSpreadsheetCell(value) : value;
  const requiresQuoting =
    neutralised !== value || /[",\r\n]/.test(neutralised);

  return requiresQuoting
    ? '"' + neutralised.replaceAll('"', '""') + '"'
    : neutralised;
}

export function encodeCsv(
  rows: readonly (readonly string[])[],
  options: CsvEncodingOptions = {},
): string {
  return (
    rows
      .map((row) =>
        row
          .map((cell, columnIndex) =>
            encodeCsvCell(
              cell,
              options.columnTrust?.[columnIndex] ?? "untrusted-text",
            ),
          )
          .join(","),
      )
      .join("\r\n") + "\r\n"
  );
}
